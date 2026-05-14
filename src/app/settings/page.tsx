import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/auth/SettingsForm";
import { createClient } from "@/utils/supabase/server";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-6xl items-center justify-center px-8 py-10 sm:px-12">
      <SettingsForm
        email={user.email ?? ""}
        initialProfile={{
          fullName: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "",
          headline: typeof user.user_metadata?.headline === "string" ? user.user_metadata.headline : "",
          location: typeof user.user_metadata?.location === "string" ? user.user_metadata.location : "",
          website: typeof user.user_metadata?.website === "string" ? user.user_metadata.website : "",
        }}
      />
    </main>
  );
}
