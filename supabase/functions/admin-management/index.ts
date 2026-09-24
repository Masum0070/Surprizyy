import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAdmin } from "../_shared/adminAuth.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
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

const ALLOWED_ROLES = [
  "super_admin",
  "manager",
  "support_admin",
  "content_admin",
  "custom",
];

const CREATABLE_ROLES = [
  "manager",
  "support_admin",
  "content_admin",
  "custom",
];

const PERMISSIONS = [
  "manage_dashboard",
  "manage_gifts",
  "manage_admins",
  "manage_orders",
  "manage_customers",
  "manage_templates",
  "manage_forms",
  "manage_surprises",
  "publish_surprises",
  "manage_settings",
];

const ADMIN_SELECT = `
  id,
  user_id,
  name,
  email,
  mobile,
  role,
  active,
  permissions,
  created_at,
  updated_at,
  last_login_at
  ,approval_status
`;

async function writeAuditLog(
  actor: { id: string },
  actorRole: string,
  action: string,
  targetUserId: string | null,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await supabase
    .from("admin_audit_logs")
    .insert({
      actor_user_id: actor.id,
      actor_role: actorRole,
      action,
      target_user_id: targetUserId,
      metadata,
    });

  if (error) {
    console.error("admin audit log write failed:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return {
      recorded: false,
      error: error.message,
    };
  }

  return { recorded: true, error: null };
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

  const auth = await verifyAdmin(
    req,
    "manage_admins",
    ["super_admin", "admin"]
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

  try {
    const body = await req.json();
    const action = body?.action;
    const isSuperAdmin =
      auth.admin?.role === "super_admin" ||
      auth.admin?.role === "admin";

    const requiresSuperAdmin = [
      "list_audit_logs",
      "create",
      "update",
      "approve",
      "delete",
    ].includes(action);

    if (requiresSuperAdmin && !isSuperAdmin) {
      return jsonResponse(
        {
          success: false,
          error: "Only a Super Admin can perform this action.",
        },
        403
      );
    }

    // -------------------------
    // LIST ADMINS
    // -------------------------
    if (action === "list") {
      const { data, error } =
        await supabase
          .from("admin_profiles")
          .select(ADMIN_SELECT)
          .order("created_at", {
            ascending: false,
          });

      if (error) {
        throw error;
      }

      return jsonResponse({
        success: true,
        admins: data || [],
      });
    }

    // -------------------------
    // LIST AUDIT LOGS
    // -------------------------
    if (action === "list_audit_logs") {
      const requestedLimit = Number(body?.limit);
      const limit = Number.isInteger(requestedLimit)
        ? Math.min(Math.max(requestedLimit, 1), 100)
        : 50;
      const requestedOffset = Number(body?.offset);
      const offset = Number.isInteger(requestedOffset)
        ? Math.max(requestedOffset, 0)
        : 0;

      const { data, error } = await supabase
        .from("admin_audit_logs")
        .select(`
          id,
          actor_user_id,
          actor_role,
          action,
          target_user_id,
          metadata,
          created_at
        `)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return jsonResponse({
        success: true,
        audit_logs: data || [],
        limit,
        offset,
      });
    }

    // -------------------------
    // GET ADMIN
    // -------------------------
    if (action === "get") {
      const userId =
        typeof body?.user_id === "string"
          ? body.user_id.trim()
          : "";

      if (!userId) {
        return jsonResponse(
          {
            success: false,
            error: "user_id is required.",
          },
          400
        );
      }

      const { data, error } =
        await supabase
          .from("admin_profiles")
          .select(ADMIN_SELECT)
          .eq("user_id", userId)
          .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return jsonResponse(
          {
            success: false,
            error: "Admin not found.",
          },
          404
        );
      }

      return jsonResponse({
        success: true,
        admin: data,
      });
    }

    // -------------------------
    // CREATE ADMIN PROFILE
    // -------------------------
    if (action === "create") {
      const userId =
        typeof body?.user_id === "string"
          ? body.user_id.trim()
          : "";

      const name =
        typeof body?.name === "string"
          ? body.name.trim()
          : "";

      const email =
        typeof body?.email === "string"
          ? body.email.trim()
          : "";

      const mobile =
        typeof body?.mobile === "string"
          ? body.mobile.trim()
          : "";

      const password =
        typeof body?.password === "string"
          ? body.password
          : "";

      const role =
        typeof body?.role === "string"
          ? body.role.trim()
          : "editor";

      if (!name) {
        return jsonResponse(
          {
            success: false,
            error: "Name is required.",
          },
          400
        );
      }

      if (!email) {
        return jsonResponse(
          {
            success: false,
            error: "Email is required.",
          },
          400
        );
      }

      if (!userId && password.length < 8) {
        return jsonResponse(
          { success: false, error: "A password with at least 8 characters is required." },
          400
        );
      }

      if (!CREATABLE_ROLES.includes(role)) {
        return jsonResponse(
          {
            success: false,
            error: "Super Admin accounts cannot be created from this panel.",
          },
          400
        );
      }

      const permissions =
        body?.permissions &&
        typeof body.permissions === "object" &&
        !Array.isArray(body.permissions)
          ? body.permissions
          : {};

      const cleanedPermissions: Record<
        string,
        boolean
      > = {};

      for (const permission of PERMISSIONS) {
        if (
          permissions[permission] === true
        ) {
          cleanedPermissions[permission] =
            true;
        }
      }

      let createdAuthUserId = userId;
      if (!createdAuthUserId) {
        const { data: authData, error: authError } =
          await supabase.auth.admin.createUser({
            email,
            password,
            // Accounts created from this protected panel receive their
            // password directly, so no separate email-confirmation step is
            // required before the first admin login.
            email_confirm: true,
            user_metadata: { name, mobile: mobile || null },
          });

        if (authError || !authData.user) {
          return jsonResponse(
            { success: false, error: authError?.message || "Failed to create the Auth user." },
            400
          );
        }
        createdAuthUserId = authData.user.id;
      }

      const { data, error } =
        await supabase
          .from("admin_profiles")
          .insert({
            user_id: createdAuthUserId,
            name,
            email,
            mobile: mobile || null,
            role,
            active: false,
            approval_status: "pending",
            permissions:
              cleanedPermissions,
          })
          .select(ADMIN_SELECT)
          .single();

      if (error) {
        if (!userId) {
          await supabase.auth.admin.deleteUser(createdAuthUserId);
        }
        throw error;
      }

      const auditResult = await writeAuditLog(
        auth.user!,
        auth.admin!.role,
        "admin.created",
        createdAuthUserId,
        { role, permissions: cleanedPermissions },
      );

      return jsonResponse({
        success: true,
        admin: data,
        warning: auditResult.recorded
          ? null
          : "Administrator created, but the audit entry could not be recorded. Check the server logs.",
      }, 201);
    }

    // -------------------------
    // UPDATE ADMIN
    // -------------------------
    if (action === "update") {
      const userId =
        typeof body?.user_id === "string"
          ? body.user_id.trim()
          : "";

      if (!userId) {
        return jsonResponse(
          {
            success: false,
            error: "user_id is required.",
          },
          400
        );
      }

      const updateData: Record<
        string,
        unknown
      > = {};

      if (
        Object.prototype.hasOwnProperty.call(
          body,
          "name"
        )
      ) {
        if (
          typeof body.name !== "string" ||
          !body.name.trim()
        ) {
          return jsonResponse(
            {
              success: false,
              error: "Name cannot be empty.",
            },
            400
          );
        }

        updateData.name =
          body.name.trim();
      }

      if (
        Object.prototype.hasOwnProperty.call(
          body,
          "mobile"
        )
      ) {
        if (
          body.mobile !== null &&
          typeof body.mobile !== "string"
        ) {
          return jsonResponse(
            {
              success: false,
              error:
                "Mobile must be text or null.",
            },
            400
          );
        }

        updateData.mobile =
          body.mobile?.trim() || null;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          body,
          "role"
        )
      ) {
        if (
          typeof body.role !== "string" ||
          !ALLOWED_ROLES.includes(
            body.role.trim()
          )
        ) {
          return jsonResponse(
            {
              success: false,
              error: "Invalid admin role.",
            },
            400
          );
        }

        updateData.role =
          body.role.trim();
      }

      if (
        Object.prototype.hasOwnProperty.call(
          body,
          "active"
        )
      ) {
        if (
          typeof body.active !== "boolean"
        ) {
          return jsonResponse(
            {
              success: false,
              error:
                "active must be true or false.",
            },
            400
          );
        }

        updateData.active =
          body.active;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          body,
          "permissions"
        )
      ) {
        if (
          !body.permissions ||
          typeof body.permissions !==
            "object" ||
          Array.isArray(
            body.permissions
          )
        ) {
          return jsonResponse(
            {
              success: false,
              error:
                "permissions must be an object.",
            },
            400
          );
        }

        const cleanedPermissions: Record<
          string,
          boolean
        > = {};

        for (const permission of PERMISSIONS) {
          if (
            body.permissions[
              permission
            ] === true
          ) {
            cleanedPermissions[
              permission
            ] = true;
          }
        }

        updateData.permissions =
          cleanedPermissions;
      }

      if (
        Object.keys(updateData).length === 0
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "No fields were provided for update.",
          },
          400
        );
      }

      updateData.updated_at =
        new Date().toISOString();

      // Prevent accidentally disabling
      // or changing the role of the currently
      // authenticated super admin.
      if (
    userId === auth.user?.id
        ) {
        if (
          updateData.active === false
        ) {
          return jsonResponse(
            {
              success: false,
              error:
                "You cannot deactivate your own admin account.",
            },
            400
          );
        }

        if (
          updateData.role &&
          updateData.role !==
            "super_admin"
        ) {
          return jsonResponse(
            {
              success: false,
              error:
                "You cannot remove your own super_admin role.",
            },
            400
          );
        }
      }

      const { data: currentAdmin, error: currentAdminError } =
        await supabase
          .from("admin_profiles")
          .select("role, active, approval_status")
          .eq("user_id", userId)
          .maybeSingle();

      if (currentAdminError) {
        throw currentAdminError;
      }

      if (!currentAdmin) {
        return jsonResponse(
          { success: false, error: "Admin not found." },
          404
        );
      }

      if (currentAdmin.role === "super_admin") {
        return jsonResponse(
          {
            success: false,
            error: "The protected Super Admin account cannot be changed or removed.",
          },
          403
        );
      }

      if (
        currentAdmin.approval_status !== "approved" &&
        Object.prototype.hasOwnProperty.call(updateData, "active")
      ) {
        return jsonResponse(
          {
            success: false,
            error: "This administrator must be approved before changing active status.",
          },
          400
        );
      }

      if (updateData.active === false) {
        updateData.approval_status = "pending";
      }

      const removesSuperAdminAccess =
        currentAdmin.role === "super_admin" &&
        currentAdmin.active &&
        (updateData.active === false ||
          (typeof updateData.role === "string" &&
            updateData.role !== "super_admin"));

      if (removesSuperAdminAccess) {
        const { count, error: countError } = await supabase
          .from("admin_profiles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "super_admin")
          .eq("active", true);

        if (countError) {
          throw countError;
        }

        if ((count || 0) <= 1) {
          return jsonResponse(
            {
              success: false,
              error: "The last active super_admin cannot be removed.",
            },
            400
          );
        }
      }

      const { data, error } =
        await supabase
          .from("admin_profiles")
          .update(updateData)
          .eq("user_id", userId)
          .select(ADMIN_SELECT)
          .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return jsonResponse(
          {
            success: false,
            error: "Admin not found.",
          },
          404
        );
      }

      if (updateData.active === false) {
        const { error: revokeError } = await supabase
          .from("admin_sessions")
          .update({ revoked: true })
          .eq("user_id", userId)
          .eq("revoked", false);

        if (revokeError) {
          throw revokeError;
        }
      }

      await writeAuditLog(
        auth.user!,
        auth.admin!.role,
        "admin.updated",
        userId,
        { changed_fields: Object.keys(updateData).filter((field) => field !== "updated_at") },
      );

      return jsonResponse({
        success: true,
        admin: data,
      });
    }

    if (action === "approve") {
      const userId =
        typeof body?.user_id === "string"
          ? body.user_id.trim()
          : "";

      if (!userId) {
        return jsonResponse(
          { success: false, error: "user_id is required." },
          400
        );
      }

      const { data: currentAdmin, error: lookupError } = await supabase
        .from("admin_profiles")
        .select(ADMIN_SELECT)
        .eq("user_id", userId)
        .maybeSingle();

      if (lookupError) throw lookupError;
      if (!currentAdmin) {
        return jsonResponse(
          { success: false, error: "Admin not found." },
          404
        );
      }
      if (currentAdmin.role === "super_admin") {
        return jsonResponse(
          { success: false, error: "The protected Super Admin does not require approval." },
          400
        );
      }
      if (currentAdmin.approval_status === "approved") {
        return jsonResponse(
          { success: false, error: "This administrator has already been approved. Use Enable or Disable for status changes." },
          400
        );
      }

      const { error: authUpdateError } =
        await supabase.auth.admin.updateUserById(userId, {
          email_confirm: true,
        });

      if (authUpdateError) {
        return jsonResponse(
          { success: false, error: authUpdateError.message },
          400
        );
      }

      const { data, error } =       await supabase
        .from("admin_profiles")
        .update({
          active: true,
          approval_status: "approved",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select(ADMIN_SELECT)
        .single();

      if (error) throw error;

      await writeAuditLog(
        auth.user!,
        auth.admin!.role,
        "admin.approved",
        userId,
        { previous_active: currentAdmin.active }
      );

      return jsonResponse({ success: true, admin: data });
    }

    if (action === "delete") {
      const userId =
        typeof body?.user_id === "string"
          ? body.user_id.trim()
          : "";

      if (!userId) {
        return jsonResponse(
          { success: false, error: "user_id is required." },
          400
        );
      }

      if (userId === auth.user?.id) {
        return jsonResponse(
          { success: false, error: "You cannot delete your own administrator account." },
          400
        );
      }

      const { data: target, error: lookupError } = await supabase
        .from("admin_profiles")
        .select("user_id, role, name, email")
        .eq("user_id", userId)
        .maybeSingle();

      if (lookupError) throw lookupError;
      if (!target) {
        return jsonResponse(
          { success: false, error: "Admin not found." },
          404
        );
      }
      if (target.role === "super_admin") {
        return jsonResponse(
          { success: false, error: "The protected Super Admin account cannot be deleted." },
          403
        );
      }

      const { error: authDeleteError } =
        await supabase.auth.admin.deleteUser(userId);

      if (authDeleteError) {
        return jsonResponse(
          { success: false, error: authDeleteError.message },
          400
        );
      }

      const { error: profileDeleteError } = await supabase
        .from("admin_profiles")
        .delete()
        .eq("user_id", userId);

      if (profileDeleteError) throw profileDeleteError;

      await supabase
        .from("admin_sessions")
        .delete()
        .eq("user_id", userId);

      await writeAuditLog(
        auth.user!,
        auth.admin!.role,
        "admin.deleted",
        userId,
        { email: target.email, name: target.name }
      );

      return jsonResponse({ success: true, deleted_user_id: userId });
    }

    return jsonResponse(
      {
        success: false,
        error: "Unknown action.",
      },
      400
    );
  } catch (error) {
    console.error(
      "admin-management error:",
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