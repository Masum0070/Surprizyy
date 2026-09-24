import { supabase } from "../supabase/client";

export async function getGiftTypes() {
  const { data, error } = await supabase
    .from("gift_types")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) {
    throw new Error(`Failed to load gift types: ${error.message}`);
  }

  return data;
}

export async function getTemplates() {
  const { data, error } = await supabase
    .from("templates")
    .select(`
      id,
      name,
      slug,
      description,
      thumbnail_path,
      base_price,
      gift_types (
        id,
        name,
        slug
      )
    `)
    .eq("is_active", true)
    .order("name");

  if (error) {
    throw new Error(`Failed to load templates: ${error.message}`);
  }

  return data;
}

export async function getTemplateBySlug(slug) {
  const { data, error } = await supabase
    .from("templates")
    .select(`
      id,
      name,
      slug,
      description,
      thumbnail_path,
      base_price,
      gift_types (
        id,
        name,
        slug
      ),
      template_versions (
        id,
        version,
        is_active
      )
    `)
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) {
    throw new Error(`Failed to load template: ${error.message}`);
  }

  return data;
}