import type { Bio } from "@/types/resume";

type BioSectionProps = {
  bio: Bio;
};

export function BioSection({ bio }: BioSectionProps) {
  return (
    <section className="mx-auto w-full max-w-6xl px-8 py-10 sm:px-12">
      <div
        className="glass rounded-none px-8 py-8"
        style={{ borderRadius: "2px" }}
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2
              className="text-2xl font-light tracking-tight"
              style={{ color: "#f0f0f0", letterSpacing: "-0.01em" }}
            >
              {bio.name}
            </h2>
            <p className="mt-1.5 text-sm font-light" style={{ color: "var(--label)" }}>
              {bio.title}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--label)" }}>
              {bio.location}&nbsp;&nbsp;·&nbsp;&nbsp;{bio.email}
            </p>
          </div>
          <ul className="flex flex-wrap items-start gap-2">
            {bio.links.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="inline-flex px-3 py-1 text-[11px] uppercase tracking-[0.18em] font-light transition"
                  style={{
                    color: "var(--label)",
                    border: "1px solid var(--border)",
                    borderRadius: "2px",
                  }}
                  target="_blank"
                  rel="noreferrer"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-7 rule" />
        <p
          className="mt-6 max-w-3xl text-sm font-light leading-7"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          {bio.summary}
        </p>
      </div>
    </section>
  );
}
