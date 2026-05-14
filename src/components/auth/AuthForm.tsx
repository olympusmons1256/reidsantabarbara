"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type AuthMode = "signin" | "signup";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canResendVerification, setCanResendVerification] = useState(false);

  useEffect(() => {
    const requestedMode = searchParams.get("mode");
    if (requestedMode === "signup") {
      setMode("signup");
    }
  }, [searchParams]);

  const handlePasswordAuth = async () => {
    const supabase = createClient();

    try {
      setIsSubmitting(true);
      setStatus(mode === "signin" ? "Signing in..." : "Creating account and sending verification email...");

      if (mode === "signin") {
        setCanResendVerification(false);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          throw error;
        }
        setStatus("Signed in. Redirecting...");
        router.push("/settings");
        router.refresh();
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });

      if (error) {
        throw error;
      }

      setCanResendVerification(true);
      setStatus("Verification email sent. Open your inbox, confirm your email, then sign in with your password.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    const supabase = createClient();

    try {
      setIsSubmitting(true);
      setStatus("Resending verification email...");

      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });

      if (error) {
        throw error;
      }

      setStatus("Verification email resent. Check inbox/spam and wait up to a minute.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to resend verification email.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="glass w-full max-w-md px-6 py-6" style={{ borderRadius: "2px" }}>
      <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--label)" }}>
        Supabase Auth
      </p>
      <h1 className="mt-2 text-xl font-light" style={{ color: "#f0f0f0" }}>
        {mode === "signin" ? "Sign In" : "Create Account"}
      </h1>
      <p className="mt-2 text-xs" style={{ color: "var(--label)" }}>
        {mode === "signin"
          ? "Sign in with your email and password after verifying your account."
          : "Sign up once, check your inbox for the verification email, then come back here to sign in."}
      </p>

      <div className="mt-5 grid gap-2">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="border bg-transparent px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="border bg-transparent px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!email || !password || isSubmitting}
          onClick={handlePasswordAuth}
          className="px-3 py-1.5 text-[11px] uppercase tracking-[0.16em]"
          style={{ border: "1px solid #fef08a55", borderRadius: "2px", color: "#fef08a" }}
        >
          {mode === "signin" ? "Sign In" : "Sign Up"}
        </button>

        {mode === "signup" && canResendVerification ? (
          <button
            type="button"
            disabled={!email || isSubmitting}
            onClick={handleResendVerification}
            className="px-3 py-1.5 text-[11px] uppercase tracking-[0.16em]"
            style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}
          >
            Resend Verification Email
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => {
          setMode((current) => (current === "signin" ? "signup" : "signin"));
          setCanResendVerification(false);
        }}
        className="mt-4 text-xs"
        style={{ color: "var(--label)" }}
      >
        {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>

      {status ? (
        <p className="mt-3 text-xs" style={{ color: "var(--label)" }}>
          {status}
        </p>
      ) : null}

      {mode === "signup" && canResendVerification ? (
        <div className="mt-2 text-xs" style={{ color: "var(--label)" }}>
          <p>
            Didn&apos;t get it? Check spam/promotions, wait up to a minute, then click <strong>Resend Verification Email</strong>.
          </p>
        </div>
      ) : null}

      <div className="mt-4 text-xs" style={{ color: "var(--label)" }}>
        <Link href="/editor" style={{ textDecoration: "underline" }}>
          Back to editor
        </Link>
      </div>
    </section>
  );
}
