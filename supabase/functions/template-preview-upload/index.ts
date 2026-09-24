import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasAdminPermission, verifyAdmin } from "../_shared/adminAuth.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-session-token, x-admin-session-code",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers });
    if (req.method !== "POST") {
      return json({ success: false, error: "Method not allowed" }, 405);
    }

    const auth = await verifyAdmin(req, null);
    if (!auth.ok) return json({ success: false, error: auth.error }, auth.status);
    if (!hasAdminPermission(auth.admin, "manage_templates")) {
      return json({ success: false, error: "Insufficient permission" }, 403);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      return json({ success: false, error: "Server configuration error" }, 500);
    }

    const db = createClient(url, key);
    const bucket = "template-previews";
    const bucketResult = await db.storage.getBucket(bucket);

    if (bucketResult.error) {
      const createdBucket = await db.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: "150KB",
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      });

      if (createdBucket.error && !createdBucket.error.message.toLowerCase().includes("already exists")) {
        console.error(createdBucket.error);
        return json({
          success: false,
          error: `Could not create public preview bucket: ${createdBucket.error.message}`,
        }, 500);
      }
    } else if (bucketResult.data && !bucketResult.data.public) {
      const updatedBucket = await db.storage.updateBucket(bucket, {
        public: true,
      });

      if (updatedBucket.error) {
        console.error(updatedBucket.error);
        return json({
          success: false,
          error: `Could not make preview bucket public: ${updatedBucket.error.message}`,
        }, 500);
      }
    }

    const data = await req.formData();
    const templateId = String(data.get("template_id") || "").trim();
    const file = data.get("file");

    if (!templateId || !(file instanceof File)) {
      return json({ success: false, error: "Template and preview image are required" }, 400);
    }
    if (!file.type.startsWith("image/")) {
      return json({ success: false, error: "Preview must be an image" }, 400);
    }
    if (file.size > 150 * 1024) {
      return json({ success: false, error: "Preview image must be under 150 KB" }, 400);
    }

    const path = `${templateId}/${crypto.randomUUID()}.jpg`;
    const upload = await db.storage.from(bucket).upload(path, file, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (upload.error) {
      console.error(upload.error);
      return json({ success: false, error: `Failed to upload preview image: ${upload.error.message}` }, 500);
    }

    const publicUrl = `${url}/storage/v1/object/public/${bucket}/${path}`;
    const update = await db.from("templates").update({ preview_url: publicUrl }).eq("id", templateId);
    if (update.error) {
      console.error(update.error);
      await db.storage.from(bucket).remove([path]);
      return json({ success: false, error: `Failed to save preview image: ${update.error.message}` }, 500);
    }

    return json({ success: true, preview_url: publicUrl });
  } catch (error) {
    console.error("template-preview-upload error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Preview upload failed",
    }, 500);
  }
});
