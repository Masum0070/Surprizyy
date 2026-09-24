import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabaseUrl =
  Deno.env.get("SUPABASE_URL") ?? "";

const serviceRoleKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const adminClient = createClient(
  supabaseUrl,
  serviceRoleKey
);
async function hashToken(token: string) {
  const data = new TextEncoder().encode(token);

  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    data
  );

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

export function hasAdminPermission(
  admin: { role?: string; permissions?: Record<string, unknown> } | null | undefined,
  permission: string,
) {
  return (
    admin?.role === "super_admin" ||
    admin?.role === "admin" ||
    admin?.permissions?.[permission] === true
  );
}

export async function verifyAdmin(
  req: Request,
  requiredPermission: string | null = null,
  allowedRoles: string[] = [
    "super_admin",
    "admin",
    "editor",
    "manager",
    "support_admin",
    "content_admin",
    "custom",
  ],
  requireTemporarySession = true
) {
  const authHeader =
    req.headers.get("Authorization");

  if (
    !authHeader ||
    !authHeader.startsWith("Bearer ")
  ) {
    return {
      ok: false,
      status: 401,
      error: "Missing authentication token",
    };
  }

  const authToken = authHeader
    .replace("Bearer ", "")
    .trim();

  if (!authToken) {
    return {
      ok: false,
      status: 401,
      error: "Missing authentication token",
    };
  }

 let sessionToken: string | null = null;
let sessionCode: string | null = null;

if (requireTemporarySession) {
  sessionToken =
    req.headers.get(
      "X-Admin-Session-Token"
    );

  sessionCode =
    req.headers.get(
      "X-Admin-Session-Code"
    );

  if (!sessionToken || !sessionCode) {
    return {
      ok: false,
      status: 401,
      error:
        "Temporary admin session is required",
    };
  }
}

  /*
   * Verify the Supabase Auth identity.
   */
 const {
  data: claimsData,
  error: claimsError,
} = await adminClient.auth.getClaims(
  authToken
);

const claims = claimsData?.claims;

if (
  claimsError ||
  !claims?.sub
) {
  console.error(
    "JWT verification failed:",
    claimsError
  );

  return {
    ok: false,
    status: 401,
    error:
      claimsError?.message ||
      "Invalid or expired authentication token",
  };
}

const user = {
  id: String(claims.sub),
  email:
    typeof claims.email === "string"
      ? claims.email
      : undefined,
};

  /*
 * Prepare temporary-session hash before the
 * database lookups.
 */
let tokenHash: string | null = null;

if (requireTemporarySession) {
  tokenHash = await hashToken(
    sessionToken!
  );
}

/*
 * Verify admin profile and temporary session
 * in parallel.
 */
const profilePromise = adminClient
  .from("admin_profiles")
  .select(`
    id,
    user_id,
    name,
    email,
    role,
    active,
    approval_status,
    permissions
  `)
  .eq("user_id", user.id)
  .maybeSingle();

const sessionPromise = requireTemporarySession
  ? adminClient
      .from("admin_sessions")
      .select(`
        id,
        user_id,
        session_code,
        expires_at,
        revoked
      `)
      .eq("user_id", user.id)
      .eq("session_code", sessionCode)
      .eq("token_hash", tokenHash!)
      .maybeSingle()
  : Promise.resolve({
      data: null,
      error: null,
    });

const [
  {
    data: admin,
    error: adminError,
  },
  {
    data: sessionData,
    error: sessionError,
  },
] = await Promise.all([
  profilePromise,
  sessionPromise,
]);

if (adminError) {
  console.error(
    "Admin profile lookup failed:",
    adminError
  );

  return {
    ok: false,
    status: 500,
    error:
      "Unable to verify admin profile",
  };
}

if (!admin) {
  return {
    ok: false,
    status: 403,
    error:
      "Admin profile not found",
  };
}

if (admin.approval_status === "pending") {
  return {
    ok: false,
    status: 403,
    error:
      "Administrator approval is pending. Ask the Super Admin to approve this account.",
  };
}

if (admin.approval_status === "rejected") {
  return {
    ok: false,
    status: 403,
    error:
      "Administrator access has been rejected.",
  };
}

if (!admin.active) {
  return {
    ok: false,
    status: 403,
    error:
      "Admin account is inactive",
  };
}

if (!allowedRoles.includes(admin.role)) {
  return {
    ok: false,
    status: 403,
    error:
      "Insufficient admin role",
  };
}

let adminSession = null;

if (requireTemporarySession) {
  if (sessionError) {
    console.error(
      "Admin session lookup failed:",
      sessionError
    );

    return {
      ok: false,
      status: 500,
      error:
        "Unable to verify admin session",
    };
  }

  if (!sessionData) {
    return {
      ok: false,
      status: 401,
      error:
        "Invalid temporary admin session",
    };
  }

  if (sessionData.revoked) {
    return {
      ok: false,
      status: 401,
      error:
        "Admin session has been revoked",
    };
  }

  if (
    new Date(
      sessionData.expires_at
    ).getTime() <= Date.now()
  ) {
    return {
      ok: false,
      status: 401,
      error:
        "Temporary admin session has expired",
    };
  }

  adminSession = sessionData;
}


  /*
   * Verify the required permission.
   */
  if (requiredPermission) {
    const permissions =
      admin.permissions || {};

    const hasPermission =
      admin.role === "super_admin" ||
      permissions[requiredPermission] === true;

    if (!hasPermission) {
      return {
        ok: false,
        status: 403,
        error:
          "Insufficient permission",
      };
    }
  }

  return {
    ok: true,
    status: 200,
    user,
    admin,
    adminSession,
  };
}