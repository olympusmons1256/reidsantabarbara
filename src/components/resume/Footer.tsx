import { bio } from "@/data/resumeData";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="w-full"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-8 py-12 sm:flex-row sm:items-end sm:justify-between sm:px-12">
        {/* Left — identity */}
        <div>
          <p
            className="text-sm font-light tracking-tight"
            style={{ color: "#e4e4e7" }}
          >
            {bio.name}
          </p>
          <p
            className="mt-1 text-xs font-light"
            style={{ color: "var(--label)" }}
          >
            {bio.title}&nbsp;&nbsp;·&nbsp;&nbsp;{bio.location}
          </p>
          <a
            href={`mailto:${bio.email}`}
            className="mt-1 inline-block text-xs font-light transition hover:opacity-80"
            style={{ color: "var(--label)" }}
          >
            {bio.email}
          </a>
        </div>

        {/* Right — links + copyright */}
        <div className="flex flex-col items-start gap-4 sm:items-end">
          <ul className="flex flex-wrap gap-4">
            {bio.links.map((link) => (
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
          <p
            className="text-[10px] uppercase tracking-[0.22em] font-light"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            © {year} {bio.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
