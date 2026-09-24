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

async function hashToken(token: string) {
    const data = new TextEncoder().encode(token);

    const hashBuffer =
        await crypto.subtle.digest(
            "SHA-256",
            data
        );

    return Array.from(
        new Uint8Array(hashBuffer)
    )
        .map((byte) =>
            byte.toString(16).padStart(2, "0")
        )
        .join("");
}

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
                    "Content-Type":
                        "application/json",
                },
            }
        );
    }

    try {
        const body = await req.json();

        const publicId = cleanString(
            body?.publicId
        );

        const managementToken = cleanString(
            body?.managementToken
        );

        if (!publicId || !managementToken) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error:
                        "Surprise ID and management token are required.",
                }),
                {
                    status: 400,
                    headers: {
                        ...corsHeaders,
                        "Content-Type":
                            "application/json",
                    },
                }
            );
        }

        const tokenHash =
            await hashToken(
                managementToken
            );

        const {
            data: surprise,
            error: surpriseError,
        } = await supabase
            .from("surprises")
            .select(`
                id,
                public_id,
                status,
                recipient_name,
                customer_email,
                customer_phone,
                theme_id,
                template_version_id,
                created_at,
                updated_at
            `)
            .eq("public_id", publicId)
            .eq(
                "management_token_hash",
                tokenHash
            )
            .maybeSingle();

        if (surpriseError) {
            throw surpriseError;
        }

        if (!surprise) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error:
                        "Invalid Surprise ID or management token.",
                }),
                {
                    status: 401,
                    headers: {
                        ...corsHeaders,
                        "Content-Type":
                            "application/json",
                    },
                }
            );
        }

        const {
            data: values,
            error: valuesError,
        } = await supabase
            .from("submission_values")
            .select(`
                field_key,
                value_text,
                value_number,
                value_boolean,
                value_date,
                value_json
            `)
            .eq(
                "surprise_id",
                surprise.id
            )
            .order("created_at");

        if (valuesError) {
            throw valuesError;
        }

        const {
            data: media,
            error: mediaError,
        } = await supabase
            .from("media_files")
            .select(`
                id,
                field_key,
                bucket_name,
                storage_path,
                original_filename,
                mime_type,
                file_size_bytes,
                sort_order,
                created_at
            `)
            .eq(
                "surprise_id",
                surprise.id
            )
            .order("sort_order");
            const mediaWithUrls = [];

for (const item of media || []) {
    const { data: signedUrlData, error: signedUrlError } =
        await supabase.storage
            .from(item.bucket_name)
            .createSignedUrl(item.storage_path, 60 * 10);

    if (signedUrlError) {
        console.error(
            "Signed URL error:",
            signedUrlError
        );

        continue;
    }

    mediaWithUrls.push({
        ...item,
        signed_url: signedUrlData?.signedUrl || null,
    });
}

        if (mediaError) {
            throw mediaError;
        }

        return new Response(
            JSON.stringify({
                success: true,

                surprise,

                values: values || [],

                media: mediaWithUrls,
            }),
            {
                status: 200,
                headers: {
                    ...corsHeaders,
                    "Content-Type":
                        "application/json",
                },
            }
        );
    } catch (error) {
        console.error(
            "manage-surprise error:",
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
                    "Content-Type":
                        "application/json",
                },
            }
        );
    }
});