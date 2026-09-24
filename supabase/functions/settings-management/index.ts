import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAdmin } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-session-token, x-admin-session-code",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

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
    "manage_settings",
    ["super_admin", "admin", "manager", "support_admin", "content_admin", "custom"],
    true
  );

  if (!auth.ok) {
    return json(
      { error: auth.error },
      auth.status
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY"
  );

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
    const action = body?.action;

    if (action === "get") {
      const { data, error } = await adminClient
        .from("site_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error(
          "Failed to load settings:",
          error
        );

        return json(
          { error: "Failed to load settings" },
          500
        );
      }

      return json({
        settings: data || null,
      });
    }

    if (action === "update") {
      const incoming = body?.settings;

      if (!incoming || typeof incoming !== "object") {
        return json(
          { error: "Invalid settings data" },
          400
        );
      }

      const settings = {
        site_name:
          typeof incoming.site_name === "string"
            ? incoming.site_name.trim()
            : "Surprizyy",

        support_email:
          typeof incoming.support_email === "string"
            ? incoming.support_email.trim()
            : "",

        whatsapp_number:
          typeof incoming.whatsapp_number === "string"
            ? incoming.whatsapp_number.trim()
            : "",

        instagram_url:
          typeof incoming.instagram_url === "string"
            ? incoming.instagram_url.trim()
            : "",

        maintenance_mode:
          incoming.maintenance_mode === true,
      };

      const { data: existing } =
        await adminClient
          .from("site_settings")
          .select("id")
          .limit(1)
          .maybeSingle();

      let result;

      if (existing?.id) {
        result = await adminClient
          .from("site_settings")
          .update(settings)
          .eq("id", existing.id)
          .select("*")
          .single();
      } else {
        result = await adminClient
          .from("site_settings")
          .insert(settings)
          .select("*")
          .single();
      }

      if (result.error) {
        console.error(
          "Failed to save settings:",
          result.error
        );

        return json(
          { error: "Failed to save settings" },
          500
        );
      }

      return json({
        success: true,
        settings: result.data,
      });
    }

    return json(
      { error: "Invalid action" },
      400
    );
  } catch (error) {
    console.error(
      "Settings management error:",
      error
    );

    return json(
      { error: "Invalid request" },
      400
    );
  }
});