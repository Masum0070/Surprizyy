import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return response({ success: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return response(
      { success: false, error: "Server configuration error" },
      500
    );
  }

  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return response({ success: false, error: "Invalid JSON body" }, 400);
  }

  const templateVersionId = cleanString(body.template_version_id);

  if (!templateVersionId) {
    return response(
      { success: false, error: "Template version ID is required" },
      400
    );
  }

  const db = createClient(supabaseUrl, serviceRoleKey);

  const { data: templateVersion, error: templateVersionError } = await db
    .from("template_versions")
    .select("id, template_id")
    .eq("id", templateVersionId)
    .eq("is_active", true)
    .maybeSingle();

  if (templateVersionError) {
    console.error(templateVersionError);
    return response(
      { success: false, error: "Failed to verify template version" },
      500
    );
  }

  if (!templateVersion) {
    return response(
      { success: false, error: "Template version is not available" },
      404
    );
  }

  const { data: template, error: templateError } = await db
    .from("templates")
    .select("id")
    .eq("id", templateVersion.template_id)
    .eq("is_active", true)
    .maybeSingle();

  if (templateError) {
    console.error(templateError);
    return response(
      { success: false, error: "Failed to verify template" },
      500
    );
  }

  if (!template) {
    return response(
      { success: false, error: "Template is not available" },
      404
    );
  }

  const { data: sections, error: sectionError } = await db
    .from("form_sections")
    .select(
      "id, template_version_id, title, description, sort_order, is_active"
    )
    .eq("template_version_id", templateVersionId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (sectionError) {
    console.error(sectionError);
    return response(
      { success: false, error: "Failed to load form sections" },
      500
    );
  }

  const sectionIds = (sections || []).map((section) => section.id);
  let fields: Record<string, unknown>[] = [];

  if (sectionIds.length > 0) {
    const { data, error: fieldError } = await db
      .from("form_fields")
      .select(
        "id, section_id, field_key, label, field_type, placeholder, helper_text, required, options, max_files, sort_order, is_active"
      )
      .in("section_id", sectionIds)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (fieldError) {
      console.error(fieldError);
      return response(
        { success: false, error: "Failed to load form fields" },
        500
      );
    }

    fields = data || [];
  }

  return response({
    success: true,
    sections: (sections || []).map((section) => ({
      ...section,
      fields: fields.filter((field) => field.section_id === section.id),
    })),
  });
});
