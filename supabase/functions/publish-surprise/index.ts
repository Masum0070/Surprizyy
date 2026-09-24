import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasAdminPermission, verifyAdmin } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-session-token, x-admin-session-code",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json(
      { error: "Method not allowed" },
      405
    );
  }

  const auth = await verifyAdmin(
    req,
    null,
    ["super_admin", "admin", "manager", "support_admin", "content_admin", "custom"],
    true
  );

  if (!auth.ok) {
    return json(
      { error: auth.error },
      auth.status
    );
  }

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL");

  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json(
      { error: "Server configuration is missing" },
      500
    );
  }

  const adminClient = createClient(
    supabaseUrl,
    serviceRoleKey
  );

  try {
    const body = await req.json();
    if (!hasAdminPermission(auth.admin, "manage_surprises")) {
      return json({ error: "Insufficient permission" }, 403);
    }

    const surpriseId = body?.surprise_id;

    if (!surpriseId) {
      return json(
        { error: "surprise_id is required" },
        400
      );
    }

    const { data: surprise, error: findError } =
      await adminClient
        .from("surprises")
        .select(
          "id, public_id, status, expires_at, published_at"
        )
        .eq("id", surpriseId)
        .maybeSingle();

    if (findError) {
      console.error(
        "Failed to find surprise:",
        findError
      );

      return json(
        { error: "Failed to find surprise" },
        500
      );
    }

    if (!surprise) {
      return json(
        { error: "Surprise not found" },
        404
      );
    }

    if (surprise.status === "published") {
      return json({
        success: true,
        message: "Surprise is already published",
        surprise,
      });
    }

    if (surprise.status !== "draft") {
      return json(
        {
          error:
            "Only draft surprises can be published",
        },
        400
      );
    }

    const now = new Date().toISOString();

    const { data: updated, error: updateError } =
      await adminClient
        .from("surprises")
        .update({
          status: "published",
          published_at: now,
          updated_at: now,
        })
        .eq("id", surprise.id)
        .eq("status", "draft")
        .select(
          "id, public_id, status, published_at, expires_at"
        )
        .single();

    if (updateError) {
      console.error(
        "Failed to publish surprise:",
        updateError
      );

      return json(
        { error: "Failed to publish surprise" },
        500
      );
    }

    return json({
      success: true,
      message: "Surprise published successfully",
      surprise: updated,
    });
  } catch (error) {
    console.error(
      "Publish surprise error:",
      error
    );

    return json(
      { error: "Invalid request" },
      400
    );
  }
});