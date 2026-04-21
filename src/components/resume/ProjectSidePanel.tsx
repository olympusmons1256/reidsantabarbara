import type { ConnectedResumeLink, Project, ProjectAsset } from "@/types/resume";

type ProjectSidePanelProps = {
  project: Project | null;
  activeAsset: ProjectAsset | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectAsset: (asset: ProjectAsset) => void;
  connectedLinks?: ConnectedResumeLink[];
  onOpenConnectedItem?: (variantId: string, itemId: string) => void;
};

const assetIcon = {
  image: "🖼",
  video: "🎬",
  doc: "📄",
} as const;

export function ProjectSidePanel({
  project,
  activeAsset,
  isOpen,
  onClose,
  onSelectAsset,
  connectedLinks = [],
  onOpenConnectedItem,
}: ProjectSidePanelProps) {
  return (
    <>
      {isOpen ? (
        <button
          type="button"
          aria-label="Close project panel"
          className="fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={onClose}
        />
      ) : null}

      <aside
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto transition-transform duration-500 sm:w-[28rem] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          background: "rgba(10,10,12,0.90)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderLeft: "1px solid var(--border)",
        }}
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-start justify-between gap-4 px-7 py-6"
          style={{
            background: "rgba(10,10,12,0.95)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.28em] font-light"
              style={{ color: "var(--label)" }}
            >
              Selected Project
            </p>
            <h3
              className="mt-2 text-base font-light leading-snug"
              style={{ color: "#f0f0f0", letterSpacing: "-0.01em" }}
            >
              {project?.title ?? "No project selected"}
            </h3>
          </div>
          <button
            type="button"
            className="mt-0.5 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] font-light transition"
            style={{
              color: "var(--label)",
              border: "1px solid var(--border)",
              borderRadius: "2px",
            }}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {project ? (
          <div className="space-y-8 px-7 py-7">
            {activeAsset ? (
              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.28em] font-light"
                  style={{ color: "var(--label)" }}
                >
                  Now Playing
                </p>
                <div
                  className="mt-3 overflow-hidden"
                  style={{ border: "1px solid var(--border)", borderRadius: "2px" }}
                >
                  {activeAsset.type === "video" ? (
                    <video
                      key={activeAsset.id}
                      className="h-52 w-full bg-black object-cover"
                      src={activeAsset.preview ?? activeAsset.href}
                      autoPlay
                      muted
                      loop
                      controls
                      playsInline
                    />
                  ) : null}

                  {activeAsset.type === "image" ? (
                    <div
                      className="h-52 w-full bg-cover bg-center"
                      role="img"
                      aria-label={activeAsset.label}
                      style={{
                        backgroundImage: `url(${activeAsset.preview ?? activeAsset.href})`,
                      }}
                    />
                  ) : null}

                  {activeAsset.type === "doc" ? (
                    <div
                      className="flex h-40 items-center justify-center p-4 text-center"
                      style={{ color: "var(--label)" }}
                    >
                      <p className="text-xs font-light leading-5">
                        Document — choose a video or image to preview here.
                      </p>
                    </div>
                  ) : null}
                </div>
                <p
                  className="mt-2 text-[10px] uppercase tracking-[0.18em] font-light"
                  style={{ color: "var(--label)" }}
                >
                  {activeAsset.label}
                </p>
              </div>
            ) : null}

            <div>
              <p
                className="text-[10px] uppercase tracking-[0.28em] font-light"
                style={{ color: "var(--label)" }}
              >
                Summary
              </p>
              <p
                className="mt-3 text-sm font-light leading-6"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                {project.summary}
              </p>
            </div>

            <div>
              <p
                className="text-[10px] uppercase tracking-[0.28em] font-light"
                style={{ color: "var(--label)" }}
              >
                Impact
              </p>
              <p
                className="mt-3 text-sm font-light leading-6"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                {project.impact}
              </p>
            </div>

            <div>
              <p
                className="text-[10px] uppercase tracking-[0.28em] font-light"
                style={{ color: "var(--label)" }}
              >
                Stack
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {project.stack.map((tech) => (
                  <li
                    key={tech}
                    className="px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] font-light"
                    style={{
                      color: "var(--label)",
                      border: "1px solid var(--border)",
                      borderRadius: "2px",
                    }}
                  >
                    {tech}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p
                className="text-[10px] uppercase tracking-[0.28em] font-light"
                style={{ color: "var(--label)" }}
              >
                Associated Assets
              </p>
              <ul className="mt-3 divide-y" style={{ borderColor: "var(--border)", border: "1px solid var(--border)", borderRadius: "2px" }}>
                {project.assets.map((asset) => {
                  const isPlaying = activeAsset?.id === asset.id;
                  return (
                    <li
                      key={asset.id}
                      style={{ borderColor: "var(--border)" }}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectAsset(asset)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left transition"
                        style={{
                          background: isPlaying ? "rgba(255,255,255,0.07)" : "transparent",
                          color: isPlaying ? "#f0f0f0" : "var(--label)",
                        }}
                      >
                        <span className="flex items-center gap-3">
                          <span className="text-sm" aria-hidden>{assetIcon[asset.type]}</span>
                          <span className="text-xs uppercase tracking-[0.14em] font-light">{asset.label}</span>
                        </span>
                        <span
                          className="text-[9px] uppercase tracking-[0.2em] font-light"
                          style={{ color: isPlaying ? "#f0f0f0" : "var(--label)" }}
                        >
                          {isPlaying ? "Playing" : "Play"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {connectedLinks.length ? (
              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.28em] font-light"
                  style={{ color: "var(--label)" }}
                >
                  Connected Work
                </p>
                <ul className="mt-3 space-y-2">
                  {connectedLinks.map((link) => (
                    <li key={link.id}>
                      <button
                        type="button"
                        onClick={() => onOpenConnectedItem?.(link.targetVariantId, link.targetItemId)}
                        className="w-full border px-4 py-3 text-left transition"
                        style={{ borderColor: "var(--border)", borderRadius: "2px" }}
                      >
                        <p className="text-[10px] uppercase tracking-[0.18em] font-light" style={{ color: "var(--label)" }}>
                          {link.targetVariantTitle} · {link.type}
                        </p>
                        <p className="mt-1 text-sm font-light" style={{ color: "#f0f0f0" }}>
                          {link.targetItemTitle}
                        </p>
                        <p className="mt-1 text-xs font-light" style={{ color: "rgba(255,255,255,0.38)" }}>
                          {link.label}
                        </p>
                        <p className="mt-2 text-xs font-light leading-5" style={{ color: "rgba(255,255,255,0.48)" }}>
                          {link.narrative || link.targetItemSummary}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-zinc-600">Click any project card to populate this panel.</p>
        )}
      </aside>
    </>
  );
}
