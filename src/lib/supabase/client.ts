import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

declare global {
  var __supabaseBrowserClient__: SupabaseClient | undefined;
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (globalThis.__supabaseBrowserClient__) {
    return globalThis.__supabaseBrowserClient__;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  globalThis.__supabaseBrowserClient__ = createBrowserClient(url, anonKey);

  return globalThis.__supabaseBrowserClient__;
}
