import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasAdminPermission, verifyAdmin } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
  "authorization, x-client-info, apikey, content-type, x-admin-session-token, x-admin-session-code",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return response(
      {
        success: false,
        error: "Method not allowed",
      },
      405
    );
  }

  const auth = await verifyAdmin(
    req,
    null
  );

  if (!auth.ok) {
    return response(
      {
        success: false,
        error: auth.error,
      },
      auth.status
    );
  }

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL");

  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return response(
      {
        success: false,
        error: "Server configuration error",
      },
      500
    );
  }

  const db = createClient(
    supabaseUrl,
    serviceRoleKey
  );

  let body: any;

  try {
    body = await req.json();
  } catch {
    return response(
      {
        success: false,
        error: "Invalid JSON body",
      },
      400
    );
  }

  const action = body?.action;
  if (!hasAdminPermission(auth.admin, "manage_forms")) {
    return response({ success: false, error: "Insufficient permission" }, 403);
  }

  /*
   * LIST SECTIONS + FIELDS
   */
  if (action === "list") {
    const templateVersionId =
      typeof body?.template_version_id === "string"
        ? body.template_version_id
        : "";

    if (!templateVersionId) {
      return response(
        {
          success: false,
          error: "Template version ID is required",
        },
        400
      );
    }

    const { data: sections, error: sectionError } =
      await db
        .from("form_sections")
        .select("*")
        .eq("template_version_id", templateVersionId)
        .order("sort_order", {
          ascending: true,
        });

    if (sectionError) {
      console.error(sectionError);

      return response(
        {
          success: false,
          error: "Failed to load form sections",
        },
        500
      );
    }

    const sectionIds =
      (sections || []).map(
        (section) => section.id
      );

    let fields: any[] = [];

    if (sectionIds.length > 0) {
      const { data, error: fieldError } =
        await db
          .from("form_fields")
          .select("*")
          .in("section_id", sectionIds)
          .order("sort_order", {
            ascending: true,
          });

      if (fieldError) {
        console.error(fieldError);

        return response(
          {
            success: false,
            error: "Failed to load form fields",
          },
          500
        );
      }

      fields = data || [];
    }

    return response({
      success: true,
      sections: sections || [],
      fields,
    });
  }

  /*
   * CREATE SECTION
   */
  if (action === "create_section") {
    const templateVersionId =
      typeof body?.template_version_id === "string"
        ? body.template_version_id
        : "";

    const title =
      typeof body?.title === "string"
        ? body.title.trim()
        : "";

    if (!templateVersionId || !title) {
      return response(
        {
          success: false,
          error:
            "Template version ID and section title are required",
        },
        400
      );
    }

    const description =
      typeof body?.description === "string"
        ? body.description.trim()
        : null;

    const sortOrder =
      Number.isInteger(body?.sort_order) &&
      body.sort_order >= 0
        ? body.sort_order
        : 0;

    const isActive =
      typeof body?.is_active === "boolean"
        ? body.is_active
        : true;

    const { data, error } =
      await db
        .from("form_sections")
        .insert({
          template_version_id: templateVersionId,
          title,
          description,
          sort_order: sortOrder,
          is_active: isActive,
        })
        .select("*")
        .single();

    if (error) {
      console.error(error);

      return response(
        {
          success: false,
          error: "Failed to create section",
        },
        500
      );
    }

    return response({
      success: true,
      section: data,
    });
  }

  /*
   * UPDATE SECTION
   */
  if (action === "update_section") {
    const id =
      typeof body?.id === "string"
        ? body.id
        : "";

    if (!id) {
      return response(
        {
          success: false,
          error: "Section ID is required",
        },
        400
      );
    }

    const updates: Record<string, unknown> = {};

    if (typeof body?.title === "string") {
      const title = body.title.trim();

      if (!title) {
        return response(
          {
            success: false,
            error: "Section title cannot be empty",
          },
          400
        );
      }

      updates.title = title;
    }

    if (typeof body?.description === "string") {
      updates.description =
        body.description.trim();
    }

    if (
      Number.isInteger(body?.sort_order) &&
      body.sort_order >= 0
    ) {
      updates.sort_order = body.sort_order;
    }

    if (typeof body?.is_active === "boolean") {
      updates.is_active = body.is_active;
    }

    if (Object.keys(updates).length === 0) {
      return response(
        {
          success: false,
          error: "No valid section changes supplied",
        },
        400
      );
    }

    const { data, error } =
      await db
        .from("form_sections")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();

    if (error) {
      console.error(error);

      return response(
        {
          success: false,
          error: "Failed to update section",
        },
        500
      );
    }

    return response({
      success: true,
      section: data,
    });
  }

  /*
   * DELETE SECTION
   */
  if (action === "delete_section") {
    const id =
      typeof body?.id === "string"
        ? body.id
        : "";

    if (!id) {
      return response(
        {
          success: false,
          error: "Section ID is required",
        },
        400
      );
    }

    const { error } =
      await db
        .from("form_sections")
        .delete()
        .eq("id", id);

    if (error) {
      console.error(error);

      return response(
        {
          success: false,
          error: "Failed to delete section",
        },
        500
      );
    }

    return response({
      success: true,
    });
  }

  /*
   * CREATE FIELD
   */
  if (action === "create_field") {
    const sectionId =
      typeof body?.section_id === "string"
        ? body.section_id
        : "";

    const fieldKey =
      typeof body?.field_key === "string"
        ? body.field_key.trim()
        : "";

    const label =
      typeof body?.label === "string"
        ? body.label.trim()
        : "";

    if (!sectionId || !fieldKey || !label) {
      return response(
        {
          success: false,
          error:
            "Section ID, field key and label are required",
        },
        400
      );
    }

    const fieldType =
      typeof body?.field_type === "string" &&
      body.field_type.trim()
        ? body.field_type.trim()
        : "text";

    const placeholder =
      typeof body?.placeholder === "string"
        ? body.placeholder.trim()
        : null;

    const helperText =
      typeof body?.helper_text === "string"
        ? body.helper_text.trim()
        : null;

    const required =
      typeof body?.required === "boolean"
        ? body.required
        : false;

    const sortOrder =
      Number.isInteger(body?.sort_order) &&
      body.sort_order >= 0
        ? body.sort_order
        : 0;

    const isActive =
      typeof body?.is_active === "boolean"
        ? body.is_active
        : true;

    const options =
      body?.options !== undefined
        ? body.options
        : null;

    const { data, error } =
      await db
        .from("form_fields")
        .insert({
          section_id: sectionId,
          field_key: fieldKey,
          label,
          field_type: fieldType,
          placeholder,
          helper_text: helperText,
          required,
          options,
          sort_order: sortOrder,
          is_active: isActive,
        })
        .select("*")
        .single();

    if (error) {
      console.error(error);

      return response(
        {
          success: false,
          error: "Failed to create field",
        },
        500
      );
    }

    return response({
      success: true,
      field: data,
    });
  }

  /*
   * UPDATE FIELD
   */
  if (action === "update_field") {
    const id =
      typeof body?.id === "string"
        ? body.id
        : "";

    if (!id) {
      return response(
        {
          success: false,
          error: "Field ID is required",
        },
        400
      );
    }

    const updates: Record<string, unknown> = {};

    if (typeof body?.field_key === "string") {
      const fieldKey =
        body.field_key.trim();

      if (!fieldKey) {
        return response(
          {
            success: false,
            error: "Field key cannot be empty",
          },
          400
        );
      }

      updates.field_key = fieldKey;
    }

    if (typeof body?.label === "string") {
      const label = body.label.trim();

      if (!label) {
        return response(
          {
            success: false,
            error: "Field label cannot be empty",
          },
          400
        );
      }

      updates.label = label;
    }

    if (typeof body?.field_type === "string") {
      const fieldType =
        body.field_type.trim();

      if (!fieldType) {
        return response(
          {
            success: false,
            error: "Field type cannot be empty",
          },
          400
        );
      }

      updates.field_type = fieldType;
    }

    if (typeof body?.placeholder === "string") {
      updates.placeholder =
        body.placeholder.trim();
    }

    if (typeof body?.helper_text === "string") {
      updates.helper_text =
        body.helper_text.trim();
    }

    if (typeof body?.required === "boolean") {
      updates.required = body.required;
    }

    if (body?.options !== undefined) {
      updates.options = body.options;
    }

    if (
      Number.isInteger(body?.sort_order) &&
      body.sort_order >= 0
    ) {
      updates.sort_order = body.sort_order;
    }

    if (typeof body?.is_active === "boolean") {
      updates.is_active = body.is_active;
    }

    if (Object.keys(updates).length === 0) {
      return response(
        {
          success: false,
          error: "No valid field changes supplied",
        },
        400
      );
    }

    const { data, error } =
      await db
        .from("form_fields")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();

    if (error) {
      console.error(error);

      return response(
        {
          success: false,
          error: "Failed to update field",
        },
        500
      );
    }

    return response({
      success: true,
      field: data,
    });
  }

  /*
   * DELETE FIELD
   */
  if (action === "delete_field") {
    const id =
      typeof body?.id === "string"
        ? body.id
        : "";

    if (!id) {
      return response(
        {
          success: false,
          error: "Field ID is required",
        },
        400
      );
    }

    const { error } =
      await db
        .from("form_fields")
        .delete()
        .eq("id", id);

    if (error) {
      console.error(error);

      return response(
        {
          success: false,
          error: "Failed to delete field",
        },
        500
      );
    }

    return response({
      success: true,
    });
  }

  return response(
    {
      success: false,
      error: "Unknown action",
    },
    400
  );
});