"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Bio } from "@/types/resume";

function getYouTubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
      return id || null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        const id = parsed.searchParams.get("v") ?? "";
        return id || null;
      }

      if (parsed.pathname.startsWith("/embed/")) {
        const id = parsed.pathname.split("/")[2] ?? "";
        return id || null;
      }

      if (parsed.pathname.startsWith("/shorts/")) {
        const id = parsed.pathname.split("/")[2] ?? "";
        return id || null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

type VideoBannerProps = {
  bio: Bio;
  isTimelineMode: boolean;
  onTimelineTourAction: () => void;
  onExportResumeAction: () => void;
  variants?: Array<{ id: string; title: string; audience?: string }>;
  activeVariantId?: string;
  onVariantChange?: (variantId: string) => void;
};

export function VideoBanner({
  bio,
  isTimelineMode,
  onTimelineTourAction,
  onExportResumeAction,
  variants = [],
  activeVariantId,
  onVariantChange,
}: VideoBannerProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Sync auth state
  useState(() => {
    const client = getSupabaseBrowserClient();
    client.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });
  }, []);

  const hasProfileContent = Boolean(bio.name || bio.title || bio.location || bio.summary || bio.links.length);
  const youtubeBannerId = getYouTubeVideoId(bio.bannerBackgroundVideo || "");
  const youtubeBannerSrc = youtubeBannerId
    ? `https://www.youtube.com/embed/${youtubeBannerId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeBannerId}&modestbranding=1&rel=0&playsinline=1`
    : null;
  const bannerVideoOpacity = Math.min(100, Math.max(0, typeof bio.bannerVideoOpacity === "number" ? bio.bannerVideoOpacity : 42));
  const bannerOverlayOpacity = Math.min(100, Math.max(0, typeof bio.bannerOverlayOpacity === "number" ? bio.bannerOverlayOpacity : 72));
  const bannerVideoFilter = (bio.bannerVideoFilter || "brightness(0.9) saturate(0.95)").trim() || "none";

  return (
    <section className="relative w-full overflow-hidden" style={{ background: "#080809" }}>
      {bio.bannerBackgroundImage ? (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${bio.bannerBackgroundImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.2,
            filter: "brightness(0.45) saturate(0.7)",
          }}
        />
      ) : null}

      {youtubeBannerSrc ? (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity: bannerVideoOpacity / 100, filter: bannerVideoFilter }}>
          <iframe
            className="h-full w-full"
            src={youtubeBannerSrc}
            title="Banner background video"
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ border: 0 }}
          />
        </div>
      ) : null}

      {bio.bannerBackgroundVideo && !youtubeBannerSrc ? (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity: bannerVideoOpacity / 100 }}>
          <video
            className="h-full w-full object-cover"
            src={bio.bannerBackgroundVideo}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            style={{ filter: bannerVideoFilter }}
          />
        </div>
      ) : null}

      {/* Ambient backdrop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: bannerOverlayOpacity / 100,
          background:
            "radial-gradient(ellipse 85% 60% at 50% 30%, rgba(255,255,255,0.06) 0%, rgba(8,8,9,0.2) 45%, rgba(8,8,9,0.94) 100%)",
        }}
      />

      {/* Turrell-style vignette: deep edges, soft luminous centre */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: bannerOverlayOpacity / 100,
          background:
            "radial-gradient(ellipse 70% 60% at 50% 60%, transparent 0%, rgba(8,8,9,0.55) 60%, rgba(8,8,9,0.92) 100%)",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col justify-end px-8 pb-14 pt-32 sm:px-12 sm:pb-20 sm:pt-44">
        {variants.length > 1 ? (
          <div className="mb-8">
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--label)" }}>
              Resume Tags
            </p>
            <div className="flex flex-wrap items-center gap-2">
            {variants.map((variant) => {
              const isActive = variant.id === activeVariantId;
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => onVariantChange?.(variant.id)}
                  className="px-3 py-1 text-[10px] uppercase tracking-[0.18em] font-light transition"
                  style={{
                    color: isActive ? "#f0f0f0" : "rgba(255,255,255,0.45)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "2px",
                    background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                  }}
                >
                  #{variant.title}
                </button>
              );
            })}
            </div>
          </div>
        ) : null}

        <div>
          {hasProfileContent && bio.heroImage ? (
            <div className="mb-6 relative h-28 w-28 overflow-hidden sm:h-36 sm:w-36" style={{ borderRadius: "2px", boxShadow: "0 0 40px rgba(255,255,255,0.08)" }}>
              <div
                className="h-full w-full bg-cover bg-center"
                role="img"
                aria-label={`${bio.name} profile image`}
                style={{ backgroundImage: `url(${bio.heroImage})`, filter: bio.heroImageFilter || "none" }}
              />
            </div>
          ) : null}

          <h1
            className="max-w-3xl text-4xl font-light tracking-tight sm:text-6xl"
            style={{ color: "#f0f0f0", letterSpacing: "-0.02em" }}
          >
            {bio.name || "Your Name"}
          </h1>
          {(bio.title || bio.location) ? (
            <p
              className="mt-4 text-sm font-light sm:text-base"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              {[bio.title, bio.location].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          {bio.summary ? (
            <p
              className="mt-5 max-w-2xl text-sm font-light leading-7"
              style={{ color: "rgba(255,255,255,0.32)" }}
            >
              {bio.summary}
            </p>
          ) : (
            <p className="mt-5 max-w-2xl text-sm font-light leading-7" style={{ color: "rgba(255,255,255,0.32)" }}>
              Create multiple resume tracks, then switch between them using tags above (for example #Technical and #Creative).
            </p>
          )}
          {bio.links.length ? (
            <ul className="mt-7 flex flex-wrap gap-3">
              {bio.links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-light transition hover:opacity-80"
                    style={{
                      color: "rgba(255,255,255,0.45)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "2px",
                    }}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Timeline Tour and Export Resume buttons */}
        <div className="pointer-events-auto absolute bottom-6 right-8 flex items-center gap-2 sm:bottom-10 sm:right-12">
          <button
            type="button"
            onClick={onTimelineTourAction}
            className="px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-light transition hover:opacity-90"
            style={{
              color: "#fef08a",
              background: isTimelineMode ? "rgba(250,204,21,0.16)" : "rgba(250,204,21,0.08)",
              border: "1px solid rgba(250,204,21,0.45)",
              borderRadius: "2px",
              boxShadow: isTimelineMode ? "0 0 28px rgba(250,204,21,0.32)" : "none",
            }}
          >
            {isTimelineMode ? "Restart Timeline Tour" : "Timeline Tour"}
          </button>
          <button
            type="button"
            onClick={onExportResumeAction}
            className="px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-light transition hover:opacity-90"
            style={{
              color: "rgba(255,255,255,0.75)",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.22)",
              borderRadius: "2px",
            }}
          >
            Export Resume
          </button>
        </div>

        {/* Hamburger menu for auth/editor links */}
        <div className="pointer-events-auto absolute top-6 right-8 sm:top-10 sm:right-12">
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-light transition hover:opacity-90"
            style={{
              color: "rgba(255,255,255,0.75)",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.22)",
              borderRadius: "2px",
            }}
            aria-label="Menu"
          >
            ☰
          </button>
          {isMenuOpen && (
            <div
              className="absolute top-full right-0 mt-2 border"
              style={{
                background: "#080809dd",
                borderColor: "rgba(255,255,255,0.12)",
                borderRadius: "2px",
                zIndex: 50,
              }}
            >
              {user ? (
                <>
                  <Link
                    href="/settings"
                    className="block px-4 py-2 text-[10px] uppercase tracking-[0.16em] transition hover:opacity-80"
                    style={{ color: "rgba(255,255,255,0.75)", borderBottom: "1px solid rgba(255,255,255,0.12)" }}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  <Link
                    href="/editor"
                    className="block px-4 py-2 text-[10px] uppercase tracking-[0.16em] transition hover:opacity-80"
                    style={{ color: "rgba(255,255,255,0.75)" }}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Editor
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/auth"
                    className="block px-4 py-2 text-[10px] uppercase tracking-[0.16em] transition hover:opacity-80"
                    style={{ color: "rgba(255,255,255,0.75)", borderBottom: "1px solid rgba(255,255,255,0.12)" }}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth?mode=signup"
                    className="block px-4 py-2 text-[10px] uppercase tracking-[0.16em] transition hover:opacity-80"
                    style={{ color: "rgba(255,255,255,0.75)" }}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
