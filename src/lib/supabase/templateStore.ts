import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ResumeTemplate, StoredTemplateRecord } from "@/types/template";
import { Upload as TusUpload } from "tus-js-client";

const TABLE = "resume_templates";
const DEFAULT_CACHE_CONTROL = "3600";
const LARGE_FILE_THRESHOLD_BYTES = 50 * 1024 * 1024;
const RESUMABLE_CHUNK_SIZE_BYTES = 4 * 1024 * 1024;

function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  }

  return { url: url.replace(/\/$/, ""), anonKey };
}

function buildStoragePath(ownerId: string, file: File, prefix = ""): string {
  const safeName = file.name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180) || "upload.bin";
  return `${ownerId}/${prefix}${Date.now()}-${safeName}`;
}

async function uploadFileResumable(input: {
  bucket: string;
  path: string;
  file: File;
  cacheControl?: string;
}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Sign in first to upload media.");
  }

  const { url, anonKey } = getSupabasePublicConfig();

  await new Promise<void>((resolve, reject) => {
    const upload = new TusUpload(input.file, {
      endpoint: `${url}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      // Keep creation request lightweight to avoid gateway/content-size limits.
      uploadDataDuringCreation: false,
      removeFingerprintOnSuccess: true,
      chunkSize: RESUMABLE_CHUNK_SIZE_BYTES,
      headers: {
        authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
        "x-upsert": "false",
      },
      metadata: {
        bucketName: input.bucket,
        objectName: input.path,
        contentType: input.file.type || "application/octet-stream",
        cacheControl: input.cacheControl ?? DEFAULT_CACHE_CONTROL,
      },
      onError: (error) => {
        const message = (error.message || "").toLowerCase();
        if (message.includes("413") || message.includes("content too large") || message.includes("payload")) {
          reject(new Error("Upload rejected (413). This usually means your Supabase bucket max file size is below this file. Increase the bucket file size limit in Supabase Storage settings, then retry."));
          return;
        }

        reject(new Error(error.message || "Resumable upload failed."));
      },
      onSuccess: () => {
        resolve();
      },
    });

    upload.start();
  });
}

async function uploadFileToBucket(input: {
  bucket: string;
  path: string;
  file: File;
  cacheControl?: string;
}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  }

  if (input.file.size >= LARGE_FILE_THRESHOLD_BYTES) {
    await uploadFileResumable(input);
    return;
  }

  const { error: uploadError } = await supabase.storage
    .from(input.bucket)
    .upload(input.path, input.file, { upsert: false, cacheControl: input.cacheControl ?? DEFAULT_CACHE_CONTROL });

  if (!uploadError) {
    return;
  }

  const message = uploadError.message?.toLowerCase() ?? "";
  const shouldRetryResumable = message.includes("413") || message.includes("payload") || message.includes("too large");

  if (shouldRetryResumable) {
    await uploadFileResumable(input);
    return;
  }

  throw new Error(uploadError.message);
}

export async function listTemplates(): Promise<StoredTemplateRecord[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select("id, owner_id, title, data, is_published, published_at, created_at, updated_at")
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
    .select("id, owner_id, title, data, is_published, published_at, created_at, updated_at")
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
    .select("id, owner_id, title, data, is_published, published_at, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as StoredTemplateRecord;
}

export async function deleteTemplate(id: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  }

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function setTemplatePublishState(input: {
  id: string;
  isPublished: boolean;
}): Promise<StoredTemplateRecord> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      is_published: input.isPublished,
      published_at: input.isPublished ? new Date().toISOString() : null,
    })
    .eq("id", input.id)
    .select("id, owner_id, title, data, is_published, published_at, created_at, updated_at")
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

  const path = buildStoragePath(input.ownerId, input.file);
  await uploadFileToBucket({ bucket: "resume-media", path, file: input.file, cacheControl: DEFAULT_CACHE_CONTROL });

  const { data } = supabase.storage.from("resume-media").getPublicUrl(path);

  return {
    path,
    publicUrl: data.publicUrl,
  };
}

export async function uploadHeroImage(input: {
  ownerId: string;
  file: File;
}): Promise<{ path: string; publicUrl: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  }

  const path = buildStoragePath(input.ownerId, input.file);
  await uploadFileToBucket({ bucket: "resume-hero-images", path, file: input.file, cacheControl: DEFAULT_CACHE_CONTROL });

  const { data } = supabase.storage.from("resume-hero-images").getPublicUrl(path);

  return {
    path,
    publicUrl: data.publicUrl,
  };
}

export async function uploadBannerVideo(input: {
  ownerId: string;
  file: File;
}): Promise<{ path: string; publicUrl: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  }

  const path = buildStoragePath(input.ownerId, input.file, "banner-");
  await uploadFileToBucket({ bucket: "resume-hero-images", path, file: input.file, cacheControl: DEFAULT_CACHE_CONTROL });

  const { data } = supabase.storage.from("resume-hero-images").getPublicUrl(path);

  return {
    path,
    publicUrl: data.publicUrl,
  };
}

export async function uploadSourceDocument(input: {
  ownerId: string;
  file: File;
}): Promise<{ path: string; publicUrl: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  }

  const path = buildStoragePath(input.ownerId, input.file);
  await uploadFileToBucket({ bucket: "resume-source-docs", path, file: input.file, cacheControl: DEFAULT_CACHE_CONTROL });

  const { data } = supabase.storage.from("resume-source-docs").getPublicUrl(path);

  return {
    path,
    publicUrl: data.publicUrl,
  };
}
