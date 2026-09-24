import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAdmin } from "../_shared/adminAuth.ts";

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
    const action = body?.action;
    const requiredPermission = {
      list_drafts: "manage_surprises",
      delete_surprise: "manage_surprises",
      list_orders: "manage_orders",
      list_customers: "manage_customers",
    }[action];

    if (!requiredPermission) {
      return json({ error: "Unknown action" }, 400);
    }

    const isOwner =
      auth.admin?.role === "super_admin" ||
      auth.admin?.role === "admin";
    const hasPermission =
      isOwner ||
      auth.admin?.permissions?.[requiredPermission] === true;

    if (!hasPermission) {
      return json(
        { error: `Missing permission: ${requiredPermission}` },
        403
      );
    }

    if (action === "delete_surprise") {
      const surpriseId =
        typeof body?.surprise_id === "string"
          ? body.surprise_id.trim()
          : "";

      if (!surpriseId) {
        return json({ error: "surprise_id is required" }, 400);
      }

      const { data: media, error: mediaLookupError } =
        await adminClient
          .from("media_files")
          .select("bucket_name, storage_path")
          .eq("surprise_id", surpriseId);

      if (mediaLookupError) {
        console.error("Failed to load surprise media:", mediaLookupError);
        return json({ error: "Failed to prepare surprise deletion" }, 500);
      }

      const filesByBucket = new Map<string, string[]>();
      for (const item of media || []) {
        const paths = filesByBucket.get(item.bucket_name) || [];
        paths.push(item.storage_path);
        filesByBucket.set(item.bucket_name, paths);
      }

      for (const [bucket, paths] of filesByBucket) {
        const { error: storageError } = await adminClient.storage
          .from(bucket)
          .remove(paths);

        if (storageError) {
          console.error("Failed to delete surprise media:", storageError);
          return json({ error: "Failed to delete surprise media" }, 500);
        }
      }

      const { error: deleteError } = await adminClient
        .from("surprises")
        .delete()
        .eq("id", surpriseId);

      if (deleteError) {
        console.error("Failed to delete surprise:", deleteError);
        return json({ error: "Failed to delete surprise" }, 500);
      }

      return json({ success: true, surprise_id: surpriseId });
    }

    if (action === "list_drafts") {
      const { data, error } =
        await adminClient
          .from("surprises")
          .select(
            "id, public_id, recipient_name, customer_email, customer_phone, status, published_at, expires_at, created_at, updated_at"
          )
          .eq("status", "draft")
          .order("created_at", {
            ascending: false,
          });

      if (error) {
        console.error(
          "Failed to load drafts:",
          error
        );

        return json(
          { error: "Failed to load surprises" },
          500
        );
      }

      return json({
        success: true,
        surprises: data || [],
      });
    }

    if (action === "list_orders") {
      const { data, error } = await adminClient
        .from("payment_orders")
        .select(
          "id, provider, provider_order_id, provider_payment_id, template_version_id, amount, currency, status, customer_email, created_at, verified_at"
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load payment orders:", error);
        return json({ error: "Failed to load payment orders" }, 500);
      }

      const payments = data || [];
      const paymentIds = payments.map((item) => item.id);
      const { data: surprises, error: surpriseError } = paymentIds.length
        ? await adminClient
            .from("surprises")
            .select("payment_id, recipient_name, customer_email, customer_phone")
            .in("payment_id", paymentIds)
        : { data: [], error: null };
      if (surpriseError) throw surpriseError;
      const surpriseByPayment = new Map(
        (surprises || []).map((item) => [item.payment_id, item])
      );
      return json({
        success: true,
        orders: payments.map((payment) => ({
          ...payment,
          ...(surpriseByPayment.get(payment.id) || {}),
        })),
      });
    }

    if (action === "list_customers") {
      const { data: surprises, error: surprisesError } =
        await adminClient
          .from("surprises")
          .select(
            "id, public_id, template_version_id, payment_id, recipient_name, customer_email, customer_phone, status, expires_at, published_at, created_at, updated_at"
          )
          .order("created_at", { ascending: false });

      if (surprisesError) {
        console.error("Failed to load customer details:", surprisesError);
        return json({ error: "Failed to load customer details" }, 500);
      }

      const rows = surprises || [];
      const paymentIds = rows
        .map((row) => row.payment_id)
        .filter(Boolean);
      const versionIds = rows
        .map((row) => row.template_version_id)
        .filter(Boolean);
      const surpriseIds = rows.map((row) => row.id);

      const [paymentsResult, versionsResult, valuesResult, mediaResult] =
        await Promise.all([
          paymentIds.length
            ? adminClient
                .from("payment_orders")
                .select(
                  "id, provider, provider_order_id, provider_payment_id, amount, currency, status, verified_at"
                )
                .in("id", paymentIds)
            : Promise.resolve({ data: [], error: null }),
          versionIds.length
            ? adminClient
                .from("template_versions")
                .select("id, version, template_id")
                .in("id", versionIds)
            : Promise.resolve({ data: [], error: null }),
          surpriseIds.length
            ? adminClient
                .from("submission_values")
                .select("surprise_id, field_key, value_text, value_number, value_boolean, value_date, value_json")
                .in("surprise_id", surpriseIds)
            : Promise.resolve({ data: [], error: null }),
          surpriseIds.length
            ? adminClient
                .from("media_files")
                .select("surprise_id, id, original_filename, mime_type, file_size_bytes")
                .in("surprise_id", surpriseIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

      const queryError =
        paymentsResult.error ||
        versionsResult.error ||
        valuesResult.error ||
        mediaResult.error;
      if (queryError) {
        console.error("Failed to load customer detail relations:", queryError);
        return json({ error: "Failed to load customer detail relations" }, 500);
      }

      const payments = new Map(
        (paymentsResult.data || []).map((item) => [item.id, item])
      );
      const versions = new Map(
        (versionsResult.data || []).map((item) => [item.id, item])
      );
      const valuesBySurprise = new Map();
      for (const value of valuesResult.data || []) {
        const current = valuesBySurprise.get(value.surprise_id) || [];
        current.push(value);
        valuesBySurprise.set(value.surprise_id, current);
      }
      const mediaCountBySurprise = new Map();
      for (const media of mediaResult.data || []) {
        mediaCountBySurprise.set(
          media.surprise_id,
          (mediaCountBySurprise.get(media.surprise_id) || 0) + 1
        );
      }

      return json({
        success: true,
        customers: rows.map((row) => ({
          ...row,
          payment: payments.get(row.payment_id) || null,
          template_version: versions.get(row.template_version_id) || null,
          values: valuesBySurprise.get(row.id) || [],
          media_count: mediaCountBySurprise.get(row.id) || 0,
        })),
      });
    }

    return json(
      { error: "Unknown action" },
      400
    );
  } catch (error) {
    console.error(
      "Surprise management error:",
      error
    );

    return json(
      { error: "Invalid request" },
      400
    );
  }
});