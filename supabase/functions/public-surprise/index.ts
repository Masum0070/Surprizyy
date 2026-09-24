import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Method not allowed",
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    const body = await req.json();

    const publicId = cleanString(body?.publicId);

    if (!publicId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Surprise ID is required.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { data: surprise, error: surpriseError } =
      await supabase
        .from("surprises")
        .select(`
          id,
          public_id,
          status,
          recipient_name,
          theme_id,
          template_version_id,
          created_at,
          published_at
        `)
        .eq("public_id", publicId)
        .maybeSingle();

    if (surpriseError) {
      throw surpriseError;
    }

    if (!surprise) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Surprise not found.",
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (surprise.status !== "published") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "This surprise is not published yet.",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (
      surprise.expires_at &&
      new Date(surprise.expires_at).getTime() <= Date.now()
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "This surprise has expired.",
        }),
        {
          status: 410,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { data: values, error: valuesError } =
      await supabase
        .from("submission_values")
        .select(`
          field_key,
          value_text,
          value_number,
          value_boolean,
          value_date,
          value_json
        `)
        .eq("surprise_id", surprise.id);

    if (valuesError) {
      throw valuesError;
    }

    const { data: media, error: mediaError } =
      await supabase
        .from("media_files")
        .select(`
          id,
          field_key,
          bucket_name,
          storage_path,
          original_filename,
          mime_type,
          sort_order
        `)
        .eq("surprise_id", surprise.id)
        .order("sort_order");

    if (mediaError) {
      throw mediaError;
    }

    const mediaWithUrls = [];

    for (const item of media || []) {
      const { data: signedUrlData } =
        await supabase.storage
          .from(item.bucket_name)
          .createSignedUrl(
            item.storage_path,
            60 * 10
          );

      mediaWithUrls.push({
        ...item,
        signed_url:
          signedUrlData?.signedUrl || null,
      });
    }

    const { data: templateVersion } =
      await supabase
        .from("template_versions")
        .select(`
          id,
          version,
          template_id
        `)
        .eq("id", surprise.template_version_id)
        .maybeSingle();

    let template = null;

    if (templateVersion) {
      const { data: templateData } =
        await supabase
          .from("templates")
          .select(`
            id,
            name,
            slug,
            description,
            thumbnail_path,
            base_price
          `)
          .eq(
            "id",
            templateVersion.template_id
          )
          .maybeSingle();

      template = templateData
        ? {
            ...templateData,
            version: templateVersion.version,
          }
        : null;
    }

    return new Response(
      JSON.stringify({
        success: true,
        surprise,
        template,
        values: values || [],
        media: mediaWithUrls,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error(
      "public-surprise error:",
      error
    );

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong.",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});