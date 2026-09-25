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
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json",
      },
    }
  );
}

/*
 * ---------------------------------------------------------
 * TOKEN HELPERS
 * ---------------------------------------------------------
 */

async function hashToken(
  token: string
): Promise<string> {
  const data =
    new TextEncoder().encode(token);

  const hash =
    await crypto.subtle.digest(
      "SHA-256",
      data
    );

  return Array.from(
    new Uint8Array(hash)
  )
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}

function createManagementToken(): string {
  return (
    crypto.randomUUID() +
    "-" +
    crypto.randomUUID()
  );
}

/*
 * ---------------------------------------------------------
 * VALIDATION HELPERS
 * ---------------------------------------------------------
 */

function cleanString(
  value: unknown
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const cleaned =
    value.trim();

  return cleaned
    ? cleaned
    : null;
}

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

/*
 * ---------------------------------------------------------
 * MAIN FUNCTION
 * ---------------------------------------------------------
 */

Deno.serve(
  async (req: Request) => {
    if (
      req.method === "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          status: 200,
          headers:
            corsHeaders,
        }
      );
    }

    if (
      req.method !== "POST"
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "Method not allowed",
        },
        405
      );
    }

    try {
      const body =
        await req.json();

      /*
       * -----------------------------------------------------
       * REQUEST DATA
       * -----------------------------------------------------
       */

      const templateVersionId =
        cleanString(
          body?.templateVersionId
        );

      const values =
        isPlainObject(
          body?.values
        )
          ? body.values
          : {};
      const paymentId = cleanString(body?.paymentId);
          const themeId =
  cleanString(body?.theme) ||
  "royal-gold";

      /*
       * -----------------------------------------------------
       * VALIDATE TEMPLATE VERSION
       * -----------------------------------------------------
       */

      if (
        !templateVersionId
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Template version is required",
          },
          400
        );
      }

      const {
        data: templateVersion,
        error:
          templateVersionError,
      } = await supabase
        .from(
          "template_versions"
        )
        .select(
          `
            id,
            version,
            is_active,
            template_id
          `
        )
        .eq(
          "id",
          templateVersionId
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle();

      if (
        templateVersionError
      ) {
        console.error(
          templateVersionError
        );

        return jsonResponse(
          {
            success: false,
            error:
              "Failed to verify template version",
          },
          500
        );
      }

      if (
        !templateVersion
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Invalid or inactive template version",
          },
          400
        );
      }

      /*
       * -----------------------------------------------------
       * GET TEMPLATE
       * -----------------------------------------------------
       */

      const {
        data: template,
        error:
          templateError,
      } = await supabase
        .from("templates")
        .select(
          `
            id,
            name,
            slug,
            base_price,
            is_active
          `
        )
        .eq(
          "id",
          templateVersion.template_id
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle();

      if (
        templateError
      ) {
        console.error(
          templateError
        );

        return jsonResponse(
          {
            success: false,
            error:
              "Failed to verify template",
          },
          500
        );
      }

      if (!template) {
        return jsonResponse(
          {
            success: false,
            error:
              "Template is not available",
          },
          400
        );
      }

      const { data: formSections, error: formSectionsError } =
        await supabase
          .from("form_sections")
          .select("id")
          .eq("template_version_id", templateVersionId)
          .eq("is_active", true);

      if (formSectionsError) {
        console.error(formSectionsError);

        return jsonResponse(
          {
            success: false,
            error: "Failed to verify the selected form",
          },
          500
        );
      }

      const sectionIds = (formSections || []).map((section) => section.id);

      if (sectionIds.length > 0) {
        const { data: requiredFields, error: requiredFieldsError } =
          await supabase
            .from("form_fields")
            .select("field_key, label, field_type, required")
            .in("section_id", sectionIds)
            .eq("is_active", true)
            .eq("required", true);

        if (requiredFieldsError) {
          console.error(requiredFieldsError);

          return jsonResponse(
            {
              success: false,
              error: "Failed to verify required form fields",
            },
            500
          );
        }

        for (const field of requiredFields || []) {
          if (["file", "image", "images"].includes(field.field_type)) {
            continue;
          }

          const value = values[field.field_key];
          const missing =
            value === null ||
            value === undefined ||
            value === "" ||
            (typeof value === "string" && !value.trim());

          if (missing) {
            return jsonResponse(
              {
                success: false,
                error: `${field.label || field.field_key} is required`,
              },
              400
            );
          }
        }
      }

      /*
       * -----------------------------------------------------
       * EXTRACT COMMON CUSTOMER DATA
       * -----------------------------------------------------
       */

      const recipientName =
        cleanString(
          values.recipient_name
        );

      const customerEmail =
        cleanString(
          values.customer_email
        );

      const customerPhone =
        cleanString(
          values.customer_phone
        );

      /*
       * -----------------------------------------------------
       * REQUIRED BASIC VALIDATION
       * -----------------------------------------------------
       */

      if (
        !recipientName
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Recipient name is required",
          },
          400
        );
      }

      if (
        !customerEmail
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Your email is required",
          },
          400
        );
      }

      const specialMessage =
        cleanString(
          values.special_message
        ) || "A little surprise made especially for you.";

      if (!paymentId) {
        return jsonResponse(
          {
            success: false,
            error: "Verified payment is required",
          },
          400
        );
      }

      const {
        data: payment,
        error: paymentError,
      } = await supabase
        .from("payment_orders")
        .select(
          "id, amount, status, template_version_id, non_refundable_accepted"
        )
        .eq("id", paymentId)
        .maybeSingle();

      if (paymentError) {
        console.error(paymentError);
        return jsonResponse(
          {
            success: false,
            error: "Failed to verify payment",
          },
          500
        );
      }

      if (
        !payment ||
        payment.status !== "verified" ||
        payment.non_refundable_accepted !== true ||
        payment.template_version_id !== templateVersionId ||
        Number(payment.amount) !== Number(template.base_price)
      ) {
        return jsonResponse(
          {
            success: false,
            error: "Payment does not match the selected template",
          },
          402
        );
      }

      const { error: paymentCustomerError } = await supabase
        .from("payment_orders")
        .update({
          customer_name: recipientName,
          customer_email: customerEmail,
        })
        .eq("id", payment.id);

      if (paymentCustomerError) {
        console.error(
          "Failed to save payment customer details:",
          paymentCustomerError
        );
        return jsonResponse(
          {
            success: false,
            error: "Failed to save customer order details",
          },
          500
        );
      }

      /*
       * -----------------------------------------------------
       * GENERATE CUSTOMER MANAGEMENT TOKEN
       * -----------------------------------------------------
       *
       * IMPORTANT:
       * We store only the SHA-256 hash.
       *
       * The plain token is returned once to the customer.
       *
       * We DO NOT use:
       * management_token_expires_at
       *
       * because that column does not exist in your database.
       */

      const managementToken =
  createManagementToken();

const managementTokenHash =
  await hashToken(
    managementToken
  );

const managementTokenExpiresAt =
  new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  ).toISOString();

      /*
       * -----------------------------------------------------
       * CREATE SURPRISE
       * -----------------------------------------------------
       */

      const {
        data: surprise,
        error:
          surpriseError,
      } = await supabase
        .from("surprises")
       .insert({
  template_version_id:
    templateVersionId,

  recipient_name:
    recipientName,

  customer_email:
    customerEmail,

  customer_phone:
    customerPhone,

  payment_id:
    payment.id,

  management_token_hash:
  managementTokenHash,

expires_at:
  managementTokenExpiresAt,

theme_id:
  themeId,

  status:
    "draft",
})
        .select(
          `
            id,
            public_id,
            status,
            created_at,
            expires_at
          `
        )
        .single();

      if (
        surpriseError ||
        !surprise
      ) {
        console.error(
          surpriseError
        );

        return jsonResponse(
          {
            success: false,
            error:
              "Failed to create surprise",
          },
          500
        );
      }

      /*
       * -----------------------------------------------------
       * SAVE FORM VALUES
       * -----------------------------------------------------
       *
       * Common customer fields are already stored directly
       * in surprises, so don't duplicate them here.
       *
       * Other dynamic fields are stored in submission_values.
       */

      const ignoredKeys =
        new Set([
          "recipient_name",
          "customer_email",
          "customer_phone",
        ]);

      const valueRows =
        Object.entries(values)
          .filter(
            ([key, value]) =>
              !ignoredKeys.has(
                key
              ) &&
              value !== null &&
              value !== undefined &&
              value !== ""
          )
          .map(
            ([fieldKey, value]) => {
              const row: Record<
                string,
                unknown
              > = {
                surprise_id:
                  surprise.id,

                field_key:
                  fieldKey,
              };

              if (
                typeof value ===
                "string"
              ) {
                row.value_text =
                  value;
              } else if (
                typeof value ===
                "number"
              ) {
                row.value_number =
                  value;
              } else if (
                typeof value ===
                "boolean"
              ) {
                row.value_boolean =
                  value;
              } else {
                row.value_json =
                  value;
              }

              return row;
            }
          );

      if (
        valueRows.length > 0
      ) {
        const {
          error:
            valuesError,
        } = await supabase
          .from(
            "submission_values"
          )
          .insert(
            valueRows
          );

        if (
          valuesError
        ) {
          console.error(
            valuesError
          );

          /*
           * Roll back the surprise if its
           * submitted values cannot be saved.
           */

          await supabase
            .from("surprises")
            .delete()
            .eq(
              "id",
              surprise.id
            );

          return jsonResponse(
            {
              success: false,
              error:
                "Failed to save form data",
            },
            500
          );
        }
      }

      /*
       * -----------------------------------------------------
       * RETURN RESULT
       * -----------------------------------------------------
       */

      return jsonResponse({
        success: true,

        publicId:
          surprise.public_id,

        managementToken,

        surpriseId:
          surprise.id,

        template: {
          id:
            template.id,

          name:
            template.name,

          version:
            templateVersion.version,
        },

        status:
          surprise.status,

        createdAt:
          surprise.created_at,
          
          expiresAt:
  surprise.expires_at,
      });
    } catch (error) {
      console.error(
        "create-surprise error:",
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
  }
);