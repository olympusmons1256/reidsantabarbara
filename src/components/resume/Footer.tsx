import type { Bio } from "@/types/resume";

type FooterProps = {
  bio?: Bio;
};

export function Footer({ bio }: FooterProps) {
  const safeBio: Bio = bio ?? {
    name: "",
    title: "",
    location: "",
    email: "",
    summary: "",
    links: [],
  };
  const year = new Date().getFullYear();
  const hasIdentity = Boolean(safeBio.name || safeBio.title || safeBio.location || safeBio.email);
  const hasLinks = safeBio.links.length > 0;

  return (
    <footer
      className="w-full"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-8 py-12 sm:flex-row sm:items-end sm:justify-between sm:px-12">
        {/* Left — identity */}
        <div>
          {hasIdentity ? (
            <>
              <p className="text-sm font-light tracking-tight" style={{ color: "#e4e4e7" }}>
                {safeBio.name || "Your Name"}
              </p>
              {(safeBio.title || safeBio.location) ? (
                <p className="mt-1 text-xs font-light" style={{ color: "var(--label)" }}>
                  {[safeBio.title, safeBio.location].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              {safeBio.email ? (
                <a
                  href={`mailto:${safeBio.email}`}
                  className="mt-1 inline-block text-xs font-light transition hover:opacity-80"
                  style={{ color: "var(--label)" }}
                >
                  {safeBio.email}
                </a>
              ) : null}
            </>
          ) : (
            <p className="text-xs font-light" style={{ color: "var(--label)" }}>
              Start in the editor to add your profile, resume variants, and project history.
            </p>
          )}
        </div>

        {/* Right — links + copyright */}
        <div className="flex flex-col items-start gap-4 sm:items-end">
          {hasLinks ? (
            <ul className="flex flex-wrap gap-4">
              {safeBio.links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] uppercase tracking-[0.2em] font-light transition hover:opacity-80"
                    style={{ color: "var(--label)" }}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <p
            className="text-[10px] uppercase tracking-[0.22em] font-light"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            © {year} {safeBio.name || "Resume Builder"}
          </p>
        </div>
      </div>
    </footer>
  );
}
