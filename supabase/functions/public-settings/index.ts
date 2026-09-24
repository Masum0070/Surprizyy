import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("site_name, maintenance_mode")
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return json({
      success: true,
      settings: {
        site_name: data?.site_name || "Surprizyy",
        maintenance_mode: data?.maintenance_mode === true,
      },
    });
  } catch (error) {
    console.error("public-settings error:", error);
    return json({
      success: true,
      settings: {
        site_name: "Surprizyy",
        maintenance_mode: false,
      },
    });
  }
});
