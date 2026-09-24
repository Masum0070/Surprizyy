import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const bucket = "template-music";

function response(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return response({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const { data: files, error } = await supabase.storage
      .from(bucket)
      .list("", {
        limit: 100,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) {
      console.error("Music catalog loading failed:", error);
      return response({
        success: false,
        error: "Music catalog is unavailable.",
      }, 500);
    }

    const songs = [];

    for (const file of files || []) {
      if (!file.name || file.name.startsWith(".") || file.id === null) {
        continue;
      }

      if (!/\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name)) {
        continue;
      }

      const { data: signedUrl, error: signedUrlError } =
        await supabase.storage
          .from(bucket)
          .createSignedUrl(file.name, 60 * 60);

      if (signedUrlError || !signedUrl?.signedUrl) {
        console.error("Music URL creation failed:", signedUrlError);
        continue;
      }

      songs.push({
        value: file.name,
        label: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
        signed_url: signedUrl.signedUrl,
      });
    }

    return response({ success: true, songs });
  } catch (error) {
    console.error("public-music error:", error);
    return response({
      success: false,
      error: "Music catalog is unavailable.",
    }, 500);
  }
});
