import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAdmin } from "../_shared/adminAuth.ts";

const supabaseUrl =
  Deno.env.get("SUPABASE_URL") ?? "";

const serviceRoleKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-session-token, x-admin-session-code",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

function jsonResponse(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

function generateSessionCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);

  return String(
    100000 + (bytes[0] % 900000)
  );
}

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

async function hashToken(token: string) {
  const data =
    new TextEncoder().encode(token);

  const hashBuffer =
    await crypto.subtle.digest(
      "SHA-256",
      data
    );

  return Array.from(
    new Uint8Array(hashBuffer)
  )
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Method not allowed.",
      },
      405
    );
  }

  try {
    let body: {
      action?: string;
      login_id?: string;
    } = {};

    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const action =
      body.action ?? "login";

    /*
     * =========================================================
     * LOGOUT
     * =========================================================
     */

    if (action === "logout") {
      const auth = await verifyAdmin(
        req,
        null,
        [
          "super_admin",
          "admin",
          "editor",
          "manager",
          "support_admin",
          "content_admin",
          "custom",
        ],
        true
      );

      if (!auth.ok) {
        return jsonResponse(
          {
            success: false,
            error: auth.error,
          },
          auth.status
        );
      }

      if (!auth.adminSession) {
        return jsonResponse(
          {
            success: false,
            error:
              "Temporary admin session not found.",
          },
          401
        );
      }

      /*
       * Revoke the exact temporary security session.
       */
      const { error: revokeError } =
        await supabase
          .from("admin_sessions")
          .update({
            revoked: true,
          })
          .eq(
            "id",
            auth.adminSession.id
          );

      if (revokeError) {
        console.error(
          "Failed to revoke admin session:",
          revokeError.message
        );

        return jsonResponse(
          {
            success: false,
            error:
              "Unable to revoke admin security session.",
          },
          500
        );
      }

      /*
       * Record logout event.
       */
      const now =
        new Date().toISOString();

      let logoutQuery =
        supabase
          .from("admin_login_logs")
          .update({
            logout_at: now,
          })
          .eq(
            "user_id",
            auth.user!.id
          )
          .is("logout_at", null);

      if (body.login_id) {
        logoutQuery =
          logoutQuery.eq(
            "id",
            body.login_id
          );
      }

      const {
        data: logoutLog,
        error: logoutError,
      } = await logoutQuery
        .order("login_at", {
          ascending: false,
        })
        .limit(1)
        .select(`
          id,
          user_id,
          admin_profile_id,
          login_at,
          logout_at,
          created_at
        `)
        .maybeSingle();

      if (logoutError) {
        console.error(
          "Failed to record admin logout:",
          logoutError.message
        );

        return jsonResponse(
          {
            success: false,
            error:
              "Unable to record admin logout.",
          },
          500
        );
      }

      return jsonResponse({
        success: true,
        logout: logoutLog ?? null,
      });
    }
/*
 * =========================================================
 * REFRESH ACTIVE ADMIN SESSION
 * =========================================================
 */

if (action === "refresh_session") {
  const auth = await verifyAdmin(
    req,
    null,
    [
      "super_admin",
      "admin",
      "editor",
      "manager",
      "support_admin",
      "content_admin",
      "custom",
    ],
    true
  );

  if (!auth.ok) {
    return jsonResponse(
      {
        success: false,
        error: auth.error,
      },
      auth.status
    );
  }

  if (!auth.adminSession) {
    return jsonResponse(
      {
        success: false,
        error: "Temporary admin session not found.",
      },
      401
    );
  }

  /*
   * Extend the session by another 30 minutes
   * from this verified activity.
   */
  const newExpiresAt = new Date(
    Date.now() + 30 * 60 * 1000
  ).toISOString();

  const {
    data: updatedSession,
    error: updateError,
  } = await supabase
    .from("admin_sessions")
    .update({
      expires_at: newExpiresAt,
    })
    .eq("id", auth.adminSession.id)
    .eq("revoked", false)
    .select(`
      id,
      session_code,
      expires_at,
      created_at
    `)
    .single();

  if (updateError) {
    console.error(
      "Failed to refresh admin session:",
      updateError.message
    );

    return jsonResponse(
      {
        success: false,
        error: "Unable to refresh admin security session.",
      },
      500
    );
  }

  return jsonResponse({
    success: true,
    admin_session: {
      id: updatedSession.id,
      session_code: updatedSession.session_code,
      expires_at: updatedSession.expires_at,
      created_at: updatedSession.created_at,
    },
  });
}
    /*
     * =========================================================
     * LOGIN
     * =========================================================
     */

    if (action !== "login") {
      return jsonResponse(
        {
          success: false,
          error:
            "Invalid admin authentication action.",
        },
        400
      );
    }

    /*
     * Verify Supabase Auth identity.
     *
     * Temporary admin session is NOT required here
     * because this request creates the temporary session.
     */
    const auth = await verifyAdmin(
      req,
      null,
      [
        "super_admin",
        "admin",
        "editor",
        "manager",
        "support_admin",
        "content_admin",
        "custom",
      ],
      false
    );

    if (!auth.ok) {
      return jsonResponse(
        {
          success: false,
          error: auth.error,
        },
        auth.status
      );
    }

    const user = auth.user!;
    const admin = auth.admin!;

    if (admin.approval_status === "pending") {
      return jsonResponse(
        {
          success: false,
          error: "Your administrator access is awaiting Super Admin approval.",
        },
        403
      );
    }

    if (admin.approval_status === "rejected") {
      return jsonResponse(
        {
          success: false,
          error: "Your administrator access has been rejected.",
        },
        403
      );
    }

    if (!admin.active) {
      return jsonResponse(
        { success: false, error: "This admin account is inactive." },
        403
      );
    }

    const now =
      new Date().toISOString();

    /*
     * Create login log.
     */
    const {
      data: loginLog,
      error: logError,
    } = await supabase
      .from("admin_login_logs")
      .insert({
        user_id: user.id,
        admin_profile_id: admin.id,
        login_at: now,
      })
      .select(`
        id,
        user_id,
        admin_profile_id,
        login_at,
        logout_at,
        created_at
      `)
      .single();

    if (logError) {
      console.error(
        "Failed to create login log:",
        logError.message
      );

      return jsonResponse(
        {
          success: false,
          error:
            "Unable to record admin login.",
        },
        500
      );
    }

    /*
     * Update admin's latest login time.
     */
    const {
      error: profileError,
    } = await supabase
      .from("admin_profiles")
      .update({
        last_login_at: now,
        updated_at: now,
      })
      .eq("id", admin.id);

    if (profileError) {
      console.error(
        "Failed to update last_login_at:",
        profileError.message
      );
    }

    /*
     * Create temporary security session.
     */
    // Revoke all previous active temporary sessions
// for this admin before creating a new one.
const { error: revokeOldSessionsError } =
  await supabase
    .from("admin_sessions")
    .update({
      revoked: true,
    })
    .eq("user_id", user.id)
    .eq("revoked", false);

if (revokeOldSessionsError) {
  console.error(
    "Failed to revoke previous admin sessions:",
    revokeOldSessionsError.message
  );

  return jsonResponse(
    {
      success: false,
      error:
        "Unable to initialize admin security session.",
    },
    500
  );
}


    const sessionCode =
      generateSessionCode();

    const temporaryToken =
      generateToken();

    const tokenHash =
      await hashToken(
        temporaryToken
      );

    const expiresAt =
      new Date(
        Date.now() +
          30 * 60 * 1000
      ).toISOString();

    const {
      data: adminSession,
      error: sessionError,
    } = await supabase
      .from("admin_sessions")
      .insert({
        user_id: user.id,
        session_code: sessionCode,
        token_hash: tokenHash,
        expires_at: expiresAt,
        revoked: false,
      })
      .select(`
        id,
        session_code,
        expires_at,
        created_at
      `)
      .single();

    if (sessionError) {
      console.error(
        "Admin session creation failed:",
        sessionError.message
      );

      /*
       * Login was logged but the security
       * session could not be created.
       */
      await supabase
        .from("admin_login_logs")
        .update({
          logout_at: new Date().toISOString(),
        })
        .eq("id", loginLog.id);

      return jsonResponse(
        {
          success: false,
          error:
            "Unable to create admin security session.",
        },
        500
      );
    }

    return jsonResponse({
      success: true,

      admin: {
        id: admin.id,
        user_id: admin.user_id,
        name: admin.name,
        email: admin.email,
        mobile: admin.mobile,
        role: admin.role,
        active: admin.active,
        permissions:
          admin.permissions || {},
        last_login_at: now,
      },

      login: loginLog,

      admin_session: {
        id: adminSession.id,
        session_code:
          adminSession.session_code,
        temporary_token:
          temporaryToken,
        expires_at:
          adminSession.expires_at,
        created_at:
          adminSession.created_at,
      },
    });
  } catch (error) {
    console.error(
      "admin-auth error:",
      error
    );

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong.",
      },
      500
    );
  }
});