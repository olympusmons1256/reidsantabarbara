"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

type SettingsFormProps = {
  email: string;
  initialProfile: {
    fullName: string;
    headline: string;
    location: string;
    website: string;
  };
};

export function SettingsForm({ email, initialProfile }: SettingsFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialProfile.fullName);
  const [headline, setHeadline] = useState(initialProfile.headline);
  const [location, setLocation] = useState(initialProfile.location);
  const [website, setWebsite] = useState(initialProfile.website);
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const supabase = createClient();

    try {
      setIsSaving(true);
      setStatus("Saving profile...");

      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          headline,
          location,
          website,
        },
      });

      if (error) {
        throw error;
      }

      setStatus("Profile updated.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();

    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  };

  return (
    <section className="glass w-full max-w-2xl px-6 py-6" style={{ borderRadius: "2px" }}>
      <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--label)" }}>
        Account Settings
      </p>
      <h1 className="mt-2 text-xl font-light" style={{ color: "#f0f0f0" }}>
        Profile
      </h1>

      <p className="mt-2 text-xs" style={{ color: "var(--label)" }}>
        Signed in as {email}
      </p>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <input
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Full name"
          className="border bg-transparent px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
        />
        <input
          value={headline}
          onChange={(event) => setHeadline(event.target.value)}
          placeholder="Headline"
          className="border bg-transparent px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
        />
        <input
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="Location"
          className="border bg-transparent px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
        />
        <input
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          placeholder="Website"
          className="border bg-transparent px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="px-3 py-1.5 text-[11px] uppercase tracking-[0.16em]"
          style={{ border: "1px solid #fef08a55", borderRadius: "2px", color: "#fef08a" }}
        >
          Save Profile
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          className="px-3 py-1.5 text-[11px] uppercase tracking-[0.16em]"
          style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}
        >
          Sign Out
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px]" style={{ color: "var(--label)" }}>
        <Link href="/editor" style={{ textDecoration: "underline" }}>Open Editor</Link>
        <span>·</span>
        <Link href="/" style={{ textDecoration: "underline" }}>View Resume</Link>
      </div>

      {status ? (
        <p className="mt-3 text-xs" style={{ color: "var(--label)" }}>
          {status}
        </p>
      ) : null}
    </section>
  );
}
