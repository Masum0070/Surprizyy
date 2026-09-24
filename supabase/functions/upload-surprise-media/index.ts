import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl =
  Deno.env.get("SUPABASE_URL") ?? "";

const serviceRoleKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey
);

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

function jsonResponse(
  data: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

async function hashToken(token: string) {
  const data = new TextEncoder().encode(token);

  const hash = await crypto.subtle.digest(
    "SHA-256",
    data
  );

  return Array.from(new Uint8Array(hash))
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Method not allowed",
      },
      405
    );
  }

  try {
    const formData = await req.formData();

    const surpriseId = cleanString(
      formData.get("surpriseId")
    );

    const managementToken = cleanString(
      formData.get("managementToken")
    );

    if (!surpriseId || !managementToken) {
      return jsonResponse(
        {
          success: false,
          error:
            "Surprise ID and management token are required",
        },
        400
      );
    }

    const tokenHash = await hashToken(
      managementToken
    );

    const {
      data: surprise,
      error: surpriseError,
    } = await supabase
      .from("surprises")
      .select("id, status")
      .eq("id", surpriseId)
      .eq("management_token_hash", tokenHash)
      .maybeSingle();

    if (surpriseError) {
      console.error(surpriseError);

      return jsonResponse(
        {
          success: false,
          error: "Failed to verify surprise",
        },
        500
      );
    }

    if (!surprise) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid surprise or management token",
        },
        403
      );
    }

    const files = formData.getAll("files");

    if (!files.length) {
      return jsonResponse(
        {
          success: false,
          error: "No files received",
        },
        400
      );
    }

    const uploadedFiles = [];

    for (let index = 0; index < files.length; index++) {
      const file = files[index];

      if (!(file instanceof File)) {
        continue;
      }

      if (!file.type.startsWith("image/")) {
        return jsonResponse(
          {
            success: false,
            error: `File ${file.name} is not an image`,
          },
          400
        );
      }

      const safeName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, "_");

      const storagePath =
        `${surpriseId}/${crypto.randomUUID()}-${safeName}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from("surprise-media")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error(uploadError);

        return jsonResponse(
          {
            success: false,
            error: "Failed to upload image",
          },
          500
        );
      }

      const {
        data: mediaRow,
        error: mediaError,
      } = await supabase
        .from("media_files")
        .insert({
          surprise_id: surpriseId,
          field_key:
            index === 0
              ? "main_photo"
              : "memory_photos",
          bucket_name: "surprise-media",
          storage_path: storagePath,
          original_filename: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
          sort_order: index,
        })
        .select(
          "id, storage_path, original_filename"
        )
        .single();

      if (mediaError) {
        console.error(mediaError);

        await supabase.storage
          .from("surprise-media")
          .remove([storagePath]);

        return jsonResponse(
          {
            success: false,
            error:
              "Image uploaded but media record failed",
          },
          500
        );
      }

      uploadedFiles.push(mediaRow);
    }

    return jsonResponse({
      success: true,
      files: uploadedFiles,
    });
  } catch (error) {
    console.error(
      "upload-surprise-media error:",
      error
    );

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      500
    );
  }
});