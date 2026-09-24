import { supabase } from "../supabase/client";

export async function createSurprise(data) {
  const { data: result, error } = await supabase.functions.invoke(
    "create-surprise",
    {
      body: data,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  if (result?.error) {
    throw new Error(result.error);
  }

  return result;
}

export async function updateSurprise(data) {
  const { data: result, error } = await supabase.functions.invoke(
    "update-surprise",
    {
      body: data,
    }
  );

  if (error) {
    let message = error.message;

    if (error.context) {
      try {
        const body = await error.context.text();

        if (body) {
          const parsed = JSON.parse(body);
          if (parsed?.error) {
            message = parsed.error;
          }
        }
      } catch {
        // Keep the original error message
      }
    }

    throw new Error(message);
  }

  if (result?.error) {
    throw new Error(result.error);
  }

  return result;
}