import type { Bio } from "@/types/resume";

type VideoBannerProps = {
  bio: Bio;
  isTimelineMode: boolean;
  onTimelineTourAction: () => void;
  variants?: Array<{ id: string; title: string; audience?: string }>;
  activeVariantId?: string;
  onVariantChange?: (variantId: string) => void;
};

export function VideoBanner({
  bio,
  isTimelineMode,
  onTimelineTourAction,
  variants = [],
  activeVariantId,
  onVariantChange,
}: VideoBannerProps) {
  return (
    <section className="relative w-full overflow-hidden" style={{ background: "#080809" }}>
      {/* Video layer */}
      <div className="absolute inset-0">
        <video
          className="h-full w-full object-cover"
          style={{ opacity: 0.38 }}
          autoPlay
          loop
          muted
          playsInline
          poster="https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1600&q=80"
        >
          <source
            src="https://cdn.coverr.co/videos/coverr-aerial-view-of-a-busy-city-street-1579/1080p.mp4"
            type="video/mp4"
          />
        </video>
      </div>

      {/* Turrell-style vignette: deep edges, soft luminous centre */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 60%, transparent 0%, rgba(8,8,9,0.55) 60%, rgba(8,8,9,0.92) 100%)",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col justify-end px-8 pb-14 pt-32 sm:px-12 sm:pb-20 sm:pt-44">
        {variants.length > 1 ? (
          <div className="mb-8 flex flex-wrap items-center gap-2">
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
                  {variant.title}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
        <p
          className="mb-5 text-[10px] uppercase tracking-[0.32em]"
          style={{ color: "var(--label)" }}
        >
          Resume Reel
        </p>
        <h1
          className="max-w-3xl text-4xl font-light tracking-tight sm:text-6xl"
          style={{ color: "#f0f0f0", letterSpacing: "-0.02em" }}
        >
          {bio.name}
        </h1>
        <p
          className="mt-4 text-sm font-light sm:text-base"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          {bio.title}&nbsp;&nbsp;·&nbsp;&nbsp;{bio.location}
        </p>
        <p
          className="mt-5 max-w-2xl text-sm font-light leading-7"
          style={{ color: "rgba(255,255,255,0.32)" }}
        >
          {bio.summary}
        </p>
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
          </div>

          {bio.heroImage ? (
            <div className="relative h-28 w-28 shrink-0 overflow-hidden sm:h-36 sm:w-36" style={{ borderRadius: "2px", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 0 40px rgba(255,255,255,0.08)" }}>
              <div
                className="h-full w-full bg-cover bg-center"
                role="img"
                aria-label={`${bio.name} profile image`}
                style={{ backgroundImage: `url(${bio.heroImage})` }}
              />
            </div>
          ) : null}
        </div>

        <div className="pointer-events-auto absolute bottom-6 right-8 sm:bottom-10 sm:right-12">
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
        </div>
      </div>
    </section>
  );
}
