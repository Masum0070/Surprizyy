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

  console.time("template-management-auth");

const auth = await verifyAdmin(
  req,
  null,
  ["super_admin", "admin", "editor", "manager", "support_admin", "content_admin", "custom"],
  true
);

console.timeEnd("template-management-auth");

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

  const supabaseAdmin = createClient(
    supabaseUrl,
    serviceRoleKey
  );

  let body: Record<string, unknown>;

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

  const action = body.action;
  if (!hasAdminPermission(auth.admin, "manage_templates")) {
    return response({ success: false, error: "Insufficient permission" }, 403);
  }

  // LIST TEMPLATES
if (action === "list") {
  const pageValue =
    Number(body.page);

  const page =
    Number.isInteger(pageValue) &&
    pageValue > 0
      ? pageValue
      : 1;

  const pageSize = 50;

  const from =
    (page - 1) * pageSize;

  const to =
    from + pageSize - 1;

  const search =
    typeof body.search === "string"
      ? body.search.trim()
      : "";

  const status =
    typeof body.status === "string"
      ? body.status
      : "all";

  const giftTypeId =
    typeof body.gift_type_id === "string"
      ? body.gift_type_id.trim()
      : "";

  let query = supabaseAdmin
    .from("templates")
    .select(
      `
        id,
        gift_type_id,
        name,
        slug,
        description,
        preview_url,
        base_price,
        discount_percentage,
        is_active,
        created_at,
        gift_types (
          id,
          name
        )
      `,
      {
        count: "exact",
      }
    );

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,slug.ilike.%${search}%`
    );
  }

  if (status === "active") {
    query = query.eq(
      "is_active",
      true
    );
  }

  if (status === "inactive") {
    query = query.eq(
      "is_active",
      false
    );
  }

  if (giftTypeId) {
    query = query.eq(
      "gift_type_id",
      giftTypeId
    );
  }
console.time("template-management-list-query");
  const {
    data,
    error,
    count,
  } = await query
    .order("created_at", {
      ascending: true,
    })
    .range(from, to);
    
console.timeEnd("template-management-list-query");

  if (error) {
    console.error(
      "Failed to load templates:",
      error.message
    );

    return response(
      {
        success: false,
        error: "Failed to load templates",
      },
      500
    );
  }

  return response({
    success: true,
    templates: data || [],
    pagination: {
      page,
      page_size: pageSize,
      total: count || 0,
      total_pages: Math.ceil(
        (count || 0) / pageSize
      ),
    },
  });
}

  // LIST VERSIONS
  if (action === "list_versions") {
    const templateId =
      typeof body.template_id === "string"
        ? body.template_id
        : "";

    if (!templateId) {
      return response(
        {
          success: false,
          error: "Template ID is required",
        },
        400
      );
    }

    const { data, error } =
      await supabaseAdmin
        .from("template_versions")
        .select("*")
        .eq("template_id", templateId)
        .order("created_at", {
          ascending: true,
        });

    if (error) {
      console.error(
        "Failed to list template versions:",
        error.message
      );

      return response(
        {
          success: false,
          error: "Failed to list template versions",
        },
        500
      );
    }

    return response({
      success: true,
      versions: data || [],
    });
  }

  // CREATE VERSION
  if (action === "create_version") {
    const templateId =
      typeof body.template_id === "string"
        ? body.template_id
        : "";

    const version =
      typeof body.version === "string"
        ? body.version.trim()
        : "";

    if (!templateId) {
      return response(
        {
          success: false,
          error: "Template ID is required",
        },
        400
      );
    }

    if (!version) {
      return response(
        {
          success: false,
          error: "Version is required",
        },
        400
      );
    }

    const { data, error } =
      await supabaseAdmin
        .from("template_versions")
        .insert({
          template_id: templateId,
          version,
          is_active: true,
        })
        .select("*")
        .single();

    if (error) {
      console.error(
        "Failed to create template version:",
        error.message
      );

      return response(
        {
          success: false,
          error: "Failed to create template version",
        },
        500
      );
    }

    return response({
      success: true,
      version: data,
    });
  }

  // UPDATE VERSION
  if (action === "update_version") {
    const id =
      typeof body.id === "string"
        ? body.id
        : "";

    const version =
      typeof body.version === "string"
        ? body.version.trim()
        : "";

    if (!id) {
      return response(
        {
          success: false,
          error: "Version ID is required",
        },
        400
      );
    }

    if (!version) {
      return response(
        {
          success: false,
          error: "Version is required",
        },
        400
      );
    }

    const { data, error } =
      await supabaseAdmin
        .from("template_versions")
        .update({
          version,
        })
        .eq("id", id)
        .select("*")
        .single();

    if (error) {
      console.error(
        "Failed to update template version:",
        error.message
      );

      return response(
        {
          success: false,
          error: "Failed to update template version",
        },
        500
      );
    }

    return response({
      success: true,
      version: data,
    });
  }

  // DEACTIVATE VERSION
  if (action === "deactivate_version") {
    const id =
      typeof body.id === "string"
        ? body.id
        : "";

    if (!id) {
      return response(
        {
          success: false,
          error: "Version ID is required",
        },
        400
      );
    }

    const { data, error } =
      await supabaseAdmin
        .from("template_versions")
        .update({
          is_active: false,
        })
        .eq("id", id)
        .select("*")
        .single();

    if (error) {
      console.error(
        "Failed to deactivate template version:",
        error.message
      );

      return response(
        {
          success: false,
          error: "Failed to deactivate template version",
        },
        500
      );
    }

    return response({
      success: true,
      version: data,
    });
  }

  // CREATE TEMPLATE
  if (action === "create") {
    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const slug =
      typeof body.slug === "string"
        ? body.slug.trim()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    const giftTypeId =
      typeof body.gift_type_id === "string"
        ? body.gift_type_id
        : "";

    const basePrice =
      Number(body.base_price);

    const discountPercentage =
      body.discount_percentage !== undefined
        ? Number(body.discount_percentage)
        : 0;

    if (!name) {
      return response(
        {
          success: false,
          error: "Template name is required",
        },
        400
      );
    }

    if (!slug) {
      return response(
        {
          success: false,
          error: "Template slug is required",
        },
        400
      );
    }

    if (!giftTypeId) {
      return response(
        {
          success: false,
          error: "Gift type is required",
        },
        400
      );
    }

    if (
      !Number.isFinite(basePrice) ||
      basePrice < 0
    ) {
      return response(
        {
          success: false,
          error: "Invalid base price",
        },
        400
      );
    }

    if (
      !Number.isFinite(discountPercentage) ||
      discountPercentage < 0 ||
      discountPercentage > 100
    ) {
      return response(
        {
          success: false,
          error: "Discount must be between 0 and 100",
        },
        400
      );
    }

    const { data, error } =
      await supabaseAdmin
        .from("templates")
        .insert({
          gift_type_id: giftTypeId,
          name,
          slug,
          description,
          base_price: basePrice,
          discount_percentage:
            discountPercentage,
          is_active: true,
        })
        .select("*")
        .single();

    if (error) {
      console.error(
        "Failed to create template:",
        error.message
      );

      return response(
        {
          success: false,
          error: "Failed to create template",
        },
        500
      );
    }

    return response({
      success: true,
      template: data,
    });
  }

  // UPDATE TEMPLATE
  if (action === "update") {
    const id =
      typeof body.id === "string"
        ? body.id
        : "";

    if (!id) {
      return response(
        {
          success: false,
          error: "Template ID is required",
        },
        400
      );
    }

    const updates: Record<string, unknown> = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();

      if (!name) {
        return response(
          {
            success: false,
            error: "Template name cannot be empty",
          },
          400
        );
      }

      updates.name = name;
    }

    if (typeof body.slug === "string") {
      const slug = body.slug.trim();

      if (!slug) {
        return response(
          {
            success: false,
            error: "Slug cannot be empty",
          },
          400
        );
      }

      updates.slug = slug;
    }

    if (typeof body.description === "string") {
      updates.description =
        body.description.trim();
    }

    if (body.base_price !== undefined) {
      const price =
        Number(body.base_price);

      if (
        !Number.isFinite(price) ||
        price < 0
      ) {
        return response(
          {
            success: false,
            error: "Invalid base price",
          },
          400
        );
      }

      updates.base_price = price;
    }

    if (
      body.discount_percentage !==
      undefined
    ) {
      const discount =
        Number(body.discount_percentage);

      if (
        !Number.isFinite(discount) ||
        discount < 0 ||
        discount > 100
      ) {
        return response(
          {
            success: false,
            error:
              "Discount must be between 0 and 100",
          },
          400
        );
      }

      updates.discount_percentage =
        discount;
    }

    if (
      typeof body.gift_type_id ===
      "string"
    ) {
      const giftTypeId =
        body.gift_type_id.trim();

      if (!giftTypeId) {
        return response(
          {
            success: false,
            error:
              "Gift type cannot be empty",
          },
          400
        );
      }

      updates.gift_type_id = giftTypeId;
    }

    if (
      typeof body.is_active === "boolean"
    ) {
      updates.is_active =
        body.is_active;
    }

    if (
      Object.keys(updates).length === 0
    ) {
      return response(
        {
          success: false,
          error: "No valid changes supplied",
        },
        400
      );
    }

    updates.updated_at =
      new Date().toISOString();

    const { data, error } =
      await supabaseAdmin
        .from("templates")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();

    if (error) {
      console.error(
        "Failed to update template:",
        {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        }
      );

      return response(
        {
          success: false,
          error:
            error.code === "23505"
              ? "A template with this slug already exists."
              : error.message || "Failed to update template",
        },
        error.code === "23505" ? 409 : 500
      );
    }

    return response({
      success: true,
      template: data,
    });
  }

  // DEACTIVATE TEMPLATE
  if (action === "deactivate") {
    const id =
      typeof body.id === "string"
        ? body.id
        : "";

    if (!id) {
      return response(
        {
          success: false,
          error: "Template ID is required",
        },
        400
      );
    }

    const { data, error } =
      await supabaseAdmin
        .from("templates")
        .update({
          is_active: false,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();

    if (error) {
      console.error(
        "Failed to deactivate template:",
        error.message
      );

      return response(
        {
          success: false,
          error: "Failed to deactivate template",
        },
        500
      );
    }

    return response({
      success: true,
      template: data,
    });
  }

  // DELETE TEMPLATE
  // Templates are intentionally only hard-deletable when inactive and
  // unused. Versions are protected by database RESTRICT constraints so
  // historical customer experiences cannot be removed accidentally.
  if (action === "delete") {
    const id =
      typeof body.id === "string"
        ? body.id.trim()
        : "";

    if (!id) {
      return response(
        { success: false, error: "Template ID is required" },
        400
      );
    }

    const { data: template, error: templateError } =
      await supabaseAdmin
        .from("templates")
        .select("id, name, is_active")
        .eq("id", id)
        .maybeSingle();

    if (templateError) {
      console.error("Failed to find template for deletion:", templateError.message);
      return response(
        { success: false, error: "Failed to find template" },
        500
      );
    }

    if (!template) {
      return response(
        { success: false, error: "Template not found" },
        404
      );
    }

    if (template.is_active) {
      return response(
        {
          success: false,
          error: "Deactivate the template before deleting it.",
        },
        409
      );
    }

    const { count: versionCount, error: versionError } =
      await supabaseAdmin
        .from("template_versions")
        .select("id", { count: "exact", head: true })
        .eq("template_id", id);

    if (versionError) {
      console.error("Failed to check template versions:", versionError.message);
      return response(
        { success: false, error: "Failed to check template usage" },
        500
      );
    }

    if ((versionCount || 0) > 0) {
      return response(
        {
          success: false,
          error:
            "This template has versions and cannot be deleted. Deactivate it instead to preserve historical experiences.",
        },
        409
      );
    }

    const { error: deleteError } =
      await supabaseAdmin
        .from("templates")
        .delete()
        .eq("id", id);

    if (deleteError) {
      console.error("Failed to delete template:", deleteError.message);
      return response(
        {
          success: false,
          error:
            "Template could not be deleted because it is still referenced by other records.",
        },
        409
      );
    }

    return response({
      success: true,
      deleted_template_id: id,
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