import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ResumeTemplate, StoredTemplateRecord } from "@/types/template";

const TABLE = "resume_templates";

export async function listTemplates(): Promise<StoredTemplateRecord[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select("id, owner_id, title, data, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as StoredTemplateRecord[];
}

export async function getTemplateById(id: string): Promise<StoredTemplateRecord | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select("id, owner_id, title, data, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as StoredTemplateRecord | null) ?? null;
}

export async function saveTemplate(input: {
  id?: string;
  ownerId?: string | null;
  title: string;
  template: ResumeTemplate;
}): Promise<StoredTemplateRecord> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  }

  const payload = {
    id: input.id,
    owner_id: input.ownerId ?? null,
    title: input.title,
    data: {
      ...input.template,
      updatedAt: new Date().toISOString(),
    },
  };

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: "id" })
    .select("id, owner_id, title, data, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as StoredTemplateRecord;
}

export async function uploadTemplateAsset(input: {
  ownerId: string;
  file: File;
}): Promise<{ path: string; publicUrl: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  }

  const safeName = input.file.name.replace(/\s+/g, "-").toLowerCase();
  const path = `${input.ownerId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("resume-media")
    .upload(path, input.file, { upsert: false, cacheControl: "3600" });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from("resume-media").getPublicUrl(path);

  return {
    path,
    publicUrl: data.publicUrl,
  };
}
