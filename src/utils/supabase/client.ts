import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export const createClient = () => {
	const client = getSupabaseBrowserClient();
	if (!client) {
		throw new Error(
			"Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)."
		);
	}
	return client;
};
