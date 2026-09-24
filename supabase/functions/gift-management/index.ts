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

 const auth = await verifyAdmin(
  req,
  null,
  ["super_admin", "admin", "editor", "manager", "support_admin", "content_admin", "custom"],
  true
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
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
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

  let body;

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
  if (!hasAdminPermission(auth.admin, "manage_gifts")) {
    return response({ success: false, error: "Insufficient permission" }, 403);
  }

  /*
   * LIST GIFTS
   */
  if (action === "list") {
    const { data, error } =
      await supabaseAdmin
        .from("gift_types")
        .select("*")
        .order("created_at", {
          ascending: true,
        });

    if (error) {
      console.error(
        "Failed to load gifts:",
        error
      );

      return response(
        {
          success: false,
          error: "Failed to load gifts",
        },
        500
      );
    }

    return response({
      success: true,
      gifts: data || [],
    });
  }

  /*
   * CREATE GIFT
   */
  /*
 * CREATE GIFT
 */
if (action === "create") {
  const name =
    typeof body?.name === "string"
      ? body.name.trim()
      : "";

  const slug =
    typeof body?.slug === "string"
      ? body.slug.trim()
      : "";

  const description =
    typeof body?.description === "string"
      ? body.description.trim()
      : "";

  if (!name) {
    return response(
      {
        success: false,
        error: "Gift name is required",
      },
      400
    );
  }

  if (!slug) {
    return response(
      {
        success: false,
        error: "Gift slug is required",
      },
      400
    );
  }

  const { data, error } =
    await supabaseAdmin
      .from("gift_types")
      .insert({
        name,
        slug,
        description,
        is_active: true,
      })
      .select("*")
      .single();

  if (error) {
    console.error(
      "Failed to create gift:",
      error
    );

    return response(
      {
        success: false,
        error:
          error.message ||
          "Failed to create gift",
      },
      500
    );
  }

  return response({
    success: true,
    gift: data,
  });
}

  /*
   * UPDATE GIFT
   */
  if (action === "update") {
    const id =
      typeof body?.id === "string"
        ? body.id
        : "";

    if (!id) {
      return response(
        {
          success: false,
          error: "Gift ID is required",
        },
        400
      );
    }

    const updates: Record<
      string,
      unknown
    > = {};

    if (
      typeof body?.name === "string"
    ) {
      const name =
        body.name.trim();

      if (!name) {
        return response(
          {
            success: false,
            error:
              "Gift name cannot be empty",
          },
          400
        );
      }

      updates.name = name;
    }

    if (
      typeof body?.slug === "string"
    ) {
      const slug =
        body.slug.trim();

      if (!slug) {
        return response(
          {
            success: false,
            error:
              "Gift slug cannot be empty",
          },
          400
        );
      }

      updates.slug = slug;
    }

    if (
      typeof body?.description ===
      "string"
    ) {
      updates.description =
        body.description.trim();
    }

    if (
      typeof body?.is_active ===
      "boolean"
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
          error:
            "No valid changes supplied",
        },
        400
      );
    }

    const { data, error } =
      await supabaseAdmin
        .from("gift_types")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();

    if (error) {
      console.error(
        "Failed to update gift:",
        error
      );

      return response(
        {
          success: false,
          error:
            error.message ||
            "Failed to update gift",
        },
        500
      );
    }

    return response({
      success: true,
      gift: data,
    });
  }

  /*
   * DEACTIVATE GIFT
   */
  if (action === "deactivate") {
    const id =
      typeof body?.id === "string"
        ? body.id
        : "";

    if (!id) {
      return response(
        {
          success: false,
          error: "Gift ID is required",
        },
        400
      );
    }

    const { data, error } =
      await supabaseAdmin
        .from("gift_types")
        .update({
          is_active: false,
        })
        .eq("id", id)
        .select("*")
        .single();

    if (error) {
      console.error(
        "Failed to deactivate gift:",
        error
      );

      return response(
        {
          success: false,
          error:
            error.message ||
            "Failed to deactivate gift",
        },
        500
      );
    }

    return response({
      success: true,
      gift: data,
    });
  }

  /*
   * DELETE GIFT
   */
  if (action === "delete") {
    const id =
      typeof body?.id === "string"
        ? body.id.trim()
        : "";

    if (!id) {
      return response(
        {
          success: false,
          error: "Gift ID is required",
        },
        400
      );
    }

    const { data: gift, error: giftError } = await supabaseAdmin
      .from("gift_types")
      .select("id, name, is_active")
      .eq("id", id)
      .maybeSingle();

    if (giftError) {
      console.error("Failed to load gift before deletion:", giftError);
      return response(
        { success: false, error: "Unable to verify gift before deletion" },
        500
      );
    }

    if (!gift) {
      return response(
        { success: false, error: "Gift was not found" },
        404
      );
    }

    if (gift.is_active) {
      return response(
        {
          success: false,
          error: "Deactivate the gift before deleting it.",
        },
        409
      );
    }

    const { count, error: referenceError } = await supabaseAdmin
      .from("templates")
      .select("id", { count: "exact", head: true })
      .eq("gift_type_id", id);

    if (referenceError) {
      console.error("Failed to check gift references:", referenceError);
      return response(
        { success: false, error: "Unable to verify gift references" },
        500
      );
    }

    if ((count || 0) > 0) {
      return response(
        {
          success: false,
          error: `This gift is used by ${count} template${count === 1 ? "" : "s"}. Remove those template references before deleting it.`,
        },
        409
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from("gift_types")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Failed to delete gift:", deleteError);
      return response(
        {
          success: false,
          error: deleteError.message || "Failed to delete gift",
        },
        500
      );
    }

    return response({
      success: true,
      deleted_id: id,
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