"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function GlobalHeader() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setIsAuthenticated(false);
      return;
    }

    let mounted = true;

    const sync = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (mounted) {
        setIsAuthenticated(Boolean(user));
      }
    };

    void sync();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setIsAuthenticated(Boolean(session?.user));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="w-full border-b" style={{ borderColor: "var(--border)", background: "#090a0b" }}>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-end gap-2 px-8 py-3 sm:px-12">
        {!isAuthenticated ? (
          <>
            <Link
              href="/auth"
              className="px-3 py-1 text-[10px] uppercase tracking-[0.18em]"
              style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: "2px", color: "rgba(255,255,255,0.55)" }}
            >
              Sign In
            </Link>
            <Link
              href="/auth?mode=signup"
              className="px-3 py-1 text-[10px] uppercase tracking-[0.18em]"
              style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: "2px", color: "rgba(255,255,255,0.55)" }}
            >
              Sign Up
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/settings"
              className="px-3 py-1 text-[10px] uppercase tracking-[0.18em]"
              style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: "2px", color: "rgba(255,255,255,0.55)" }}
            >
              Settings
            </Link>
            <Link
              href="/editor"
              className="px-3 py-1 text-[10px] uppercase tracking-[0.18em]"
              style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: "2px", color: "rgba(255,255,255,0.55)" }}
            >
              Editor
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
