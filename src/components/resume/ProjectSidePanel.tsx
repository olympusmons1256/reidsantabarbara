import { useEffect, useMemo, useState } from "react";
import type { ConnectedResumeLink, Project, ProjectAsset, ProjectGalleryEntryAsset } from "@/types/resume";

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
  image: "IMG",
  video: "VID",
  doc: "DOC",
  gallery: "GAL",
} as const;

type DisplayAsset = ProjectAsset | ProjectGalleryEntryAsset;

function getAssetAspectRatio(asset: { aspectRatio?: string }): string {
  return asset.aspectRatio && asset.aspectRatio !== "auto" ? asset.aspectRatio : "16/9";
}

function getAssetSource(asset: { href: string; preview?: string }): string {
  return (asset.preview?.trim() || asset.href?.trim() || "");
}

function getYouTubeVideoId(url: string): string | null {
  const trimmed = (url || "").trim();
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

function getYouTubeEmbedSrc(url: string, withControls = false): string | null {
  const id = getYouTubeVideoId(url);
  if (!id) {
    return null;
  }

  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=0&mute=1&controls=${withControls ? 1 : 0}&loop=1&playlist=${id}&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3&cc_load_policy=0&disablekb=1`;
}

function getGalleryCoverAsset(asset: Pick<ProjectAsset, "coverAssetId" | "assets"> | null | undefined): ProjectGalleryEntryAsset | null {
  const children = asset?.assets ?? [];
  return (
    (asset?.coverAssetId ? children.find((childAsset) => childAsset.id === asset.coverAssetId) : undefined) ??
    children.find((childAsset) => childAsset.subType === "cover") ??
    children[0] ??
    null
  );
}

function renderSingleAsset(asset: DisplayAsset, withControls = false) {
  const src = getAssetSource(asset);

  if (asset.type === "video" && src) {
    const youtubeEmbedSrc = getYouTubeEmbedSrc(src, withControls);
    if (youtubeEmbedSrc) {
      return (
        <iframe
          key={asset.id}
          className="h-full w-full bg-black"
          src={youtubeEmbedSrc}
          title={asset.label || "Video preview"}
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
          style={{ border: 0 }}
        />
      );
    }

    return (
      <video
        key={asset.id}
        className="h-full w-full bg-black"
        src={src}
        autoPlay
        muted
        loop
        controls={withControls}
        playsInline
        style={{
          objectFit: asset.fit ?? "cover",
          objectPosition: `${asset.focusX ?? 50}% ${asset.focusY ?? 50}%`,
          transform: `scale(${(asset.zoom ?? 100) / 100})`,
          transformOrigin: "center center",
        }}
      />
    );
  }

  if (asset.type === "image" && src) {
    return (
      <div className="h-full w-full overflow-hidden bg-black">
        <img
          src={src}
          alt={asset.label}
          className="h-full w-full"
          style={{
            objectFit: asset.fit ?? "cover",
            objectPosition: `${asset.focusX ?? 50}% ${asset.focusY ?? 50}%`,
            transform: `scale(${(asset.zoom ?? 100) / 100})`,
            transformOrigin: "center center",
          }}
        />
      </div>
    );
  }

  if (asset.type === "doc") {
    if (src) {
      return (
        <iframe
          title={asset.label || "Document preview"}
          src={`${src}#toolbar=0&navpanes=0&scrollbar=0`}
          className="h-full w-full bg-black"
        />
      );
    }

    return (
      <div
        className="flex h-full min-h-[10rem] items-center justify-center p-4 text-center"
        style={{ color: "var(--label)" }}
      >
        <p className="text-xs font-light leading-5">
          Document — open the source asset to review the full content.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[10rem] items-center justify-center p-4 text-center" style={{ color: "var(--label)" }}>
      <p className="text-xs font-light leading-5">No preview available for this asset yet.</p>
    </div>
  );
}

export function ProjectSidePanel({
  project,
  activeAsset,
  isOpen,
  onClose,
  onSelectAsset,
  connectedLinks = [],
  onOpenConnectedItem,
}: ProjectSidePanelProps) {
  const [activeGalleryChildId, setActiveGalleryChildId] = useState<string | null>(null);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [nowPlayingAspectRatio, setNowPlayingAspectRatio] = useState<string>("16/9");

  useEffect(() => {
    setActiveGalleryChildId(null);
    setNowPlayingAspectRatio("16/9");
  }, [activeAsset?.id]);

  useEffect(() => {
    setNowPlayingAspectRatio("16/9");
  }, [activeGalleryChildId]);

  useEffect(() => {
    if (!isOpen) {
      setIsPanelExpanded(false);
    }
  }, [isOpen]);

  const galleryChildren = activeAsset?.type === "gallery" ? activeAsset.assets ?? [] : [];
  const galleryCoverAsset = useMemo(
    () => (activeAsset?.type === "gallery" ? getGalleryCoverAsset(activeAsset) : null),
    [activeAsset]
  );
  const activeGalleryChild = useMemo(() => {
    if (activeAsset?.type !== "gallery") {
      return null;
    }

    return (
      (activeGalleryChildId ? galleryChildren.find((childAsset) => childAsset.id === activeGalleryChildId) : undefined) ??
      galleryCoverAsset ??
      galleryChildren[0] ??
      null
    );
  }, [activeAsset, activeGalleryChildId, galleryChildren, galleryCoverAsset]);

  const activeAssetAspectRatio = activeAsset?.type === "gallery"
    ? activeAsset.aspectRatio && activeAsset.aspectRatio !== "auto"
      ? activeAsset.aspectRatio
      : activeGalleryChild
        ? getAssetAspectRatio(activeGalleryChild)
        : "16/9"
    : activeAsset
      ? getAssetAspectRatio(activeAsset)
      : "16/9";
  const activeDocumentHref = activeAsset?.type === "gallery"
    ? activeGalleryChild?.type === "doc"
      ? activeGalleryChild.href
      : null
    : activeAsset?.type === "doc"
      ? activeAsset.href
      : null;

  const nowPlayingImageSrc = activeAsset?.type === "image" ? getAssetSource(activeAsset) : null;
  const nowPlayingImageNode = nowPlayingImageSrc && activeAsset?.type === "image" ? (
    <div className="h-full w-full overflow-hidden bg-black">
      <img
        src={nowPlayingImageSrc}
        alt={activeAsset.label}
        className="h-full w-full"
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            setNowPlayingAspectRatio(`${img.naturalWidth}/${img.naturalHeight}`);
          }
        }}
        style={{
          objectFit: activeAsset.fit ?? "contain",
          objectPosition: `${activeAsset.focusX ?? 50}% ${activeAsset.focusY ?? 50}%`,
          transform: `scale(${(activeAsset.zoom ?? 100) / 100})`,
          transformOrigin: "center center",
        }}
      />
    </div>
  ) : null;

  return (
    <>
      <aside
        className={isPanelExpanded
          ? `fixed inset-3 z-50 overflow-y-auto transition-all duration-300 sm:inset-6 ${
              isOpen ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"
            }`
          : `fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto transition-transform duration-500 sm:w-[28rem] ${
              isOpen ? "translate-x-0" : "translate-x-full"
            }`
        }
        style={{
          background: "rgba(10,10,12,0.90)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: isPanelExpanded ? "1px solid var(--border)" : "none",
          borderLeft: isPanelExpanded ? "1px solid var(--border)" : "1px solid var(--border)",
          borderRadius: isPanelExpanded ? "10px" : "0",
          boxShadow: isPanelExpanded ? "0 20px 80px rgba(0,0,0,0.45)" : "none",
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
          <div className="flex items-center gap-2">
            {activeAsset ? (
              <button
                type="button"
                aria-label={isPanelExpanded ? "Collapse panel" : "Expand panel"}
                onClick={() => setIsPanelExpanded((current) => !current)}
                className="mt-0.5 flex h-7 w-7 items-center justify-center transition"
                style={{ color: "var(--label)", border: "1px solid var(--border)", borderRadius: "2px" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {isPanelExpanded ? (
                    <>
                      <polyline points="9 3 3 3 3 9" /><polyline points="15 21 21 21 21 15" />
                      <line x1="3" y1="3" x2="10" y2="10" /><line x1="21" y1="21" x2="14" y2="14" />
                    </>
                  ) : (
                    <>
                      <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                    </>
                  )}
                </svg>
              </button>
            ) : null}
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
        </div>

        {project ? (
          <div className={isPanelExpanded ? "grid gap-8 px-7 py-7 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,1fr)]" : "space-y-8 px-7 py-7"}>
            <div className="space-y-8">
              {project.dateRange ? (
                <div>
                  <p
                    className="text-[10px] uppercase tracking-[0.28em] font-light"
                    style={{ color: "var(--label)" }}
                  >
                    Date Range
                  </p>
                  <p
                    className="mt-3 text-sm font-light leading-6"
                    style={{ color: "rgba(255,255,255,0.55)" }}
                  >
                    {project.dateRange}
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

              {activeAsset ? (
                <div>
                  <p
                    className="text-[10px] uppercase tracking-[0.28em] font-light"
                    style={{ color: "var(--label)" }}
                  >
                    Now Playing
                  </p>
                  {/* Viewer box — sized by aspect ratio only, never pushes grid */}
                  <div
                    className="mt-3 overflow-hidden"
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: "2px",
                      aspectRatio: activeAsset?.type === "image"
                        ? nowPlayingAspectRatio
                        : activeAsset?.type === "gallery"
                          ? nowPlayingAspectRatio
                          : activeAssetAspectRatio,
                    }}
                  >
                    {activeAsset.type === "gallery" ? (
                      activeAsset.galleryLayout === "carousel" ? (
                        <div className="flex h-full flex-col bg-black">
                          <div className="flex-1 overflow-hidden" style={{ aspectRatio: nowPlayingAspectRatio }}>
                            {activeGalleryChild ? (
                              activeGalleryChild.type === "image" && getAssetSource(activeGalleryChild) ? (
                                <div className="h-full w-full overflow-hidden bg-black">
                                  <img
                                    src={getAssetSource(activeGalleryChild)}
                                    alt={activeGalleryChild.label}
                                    className="h-full w-full"
                                    onLoad={(e) => {
                                      const img = e.currentTarget;
                                      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                                        setNowPlayingAspectRatio(`${img.naturalWidth}/${img.naturalHeight}`);
                                      }
                                    }}
                                    style={{
                                      objectFit: activeGalleryChild.fit ?? "contain",
                                      objectPosition: `${activeGalleryChild.focusX ?? 50}% ${activeGalleryChild.focusY ?? 50}%`,
                                      transform: `scale(${(activeGalleryChild.zoom ?? 100) / 100})`,
                                      transformOrigin: "center center",
                                    }}
                                  />
                                </div>
                              ) : renderSingleAsset(activeGalleryChild, true)
                            ) : renderSingleAsset({
                              id: `${activeAsset.id}-empty`,
                              label: activeAsset.label,
                              description: activeAsset.description,
                              type: "doc",
                              href: "",
                            })}
                          </div>
                          {galleryChildren.length ? (
                            <div className="flex gap-2 overflow-x-auto border-t p-2" style={{ borderColor: "var(--border)" }}>
                              {galleryChildren.map((childAsset) => (
                                <button
                                  key={childAsset.id}
                                  type="button"
                                  onClick={() => setActiveGalleryChildId(childAsset.id)}
                                  className="min-w-[5rem] overflow-hidden border text-left"
                                  style={{
                                    borderColor: childAsset.id === activeGalleryChild?.id ? "rgba(255,255,255,0.5)" : "var(--border)",
                                    borderRadius: "2px",
                                  }}
                                >
                                  <div
                                    style={{
                                      aspectRatio: childAsset.aspectRatio && childAsset.aspectRatio !== "auto" ? childAsset.aspectRatio : "1/1",
                                      overflow: "hidden",
                                    }}
                                  >
                                    {renderSingleAsset(childAsset)}
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        /* Masonry layout — viewer shows selected item only */
                        activeGalleryChild ? (
                          <div
                            className="h-full w-full overflow-hidden bg-black"
                            style={{ aspectRatio: "3 / 4" }}
                          >
                            {activeGalleryChild.type === "image" && getAssetSource(activeGalleryChild) ? (
                              <img
                                src={getAssetSource(activeGalleryChild)}
                                alt={activeGalleryChild.label}
                                className="h-full w-full"
                                onLoad={(e) => {
                                  const img = e.currentTarget;
                                  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                                    setNowPlayingAspectRatio(`${img.naturalWidth}/${img.naturalHeight}`);
                                  }
                                }}
                                style={{
                                  objectFit: activeGalleryChild.fit ?? "contain",
                                  objectPosition: `${activeGalleryChild.focusX ?? 50}% ${activeGalleryChild.focusY ?? 50}%`,
                                  transform: `scale(${(activeGalleryChild.zoom ?? 100) / 100})`,
                                  transformOrigin: "center center",
                                }}
                              />
                            ) : renderSingleAsset(activeGalleryChild, true)}
                          </div>
                        ) : (
                          <div className="flex h-full min-h-[8rem] items-center justify-center text-xs" style={{ color: "var(--label)", background: "#111" }}>
                            Select a photo below
                          </div>
                        )
                      )
                    ) : (nowPlayingImageNode ?? renderSingleAsset(activeAsset, true))}
                  </div>

                  {/* Masonry grid — separate block, never reflows viewer */}
                  {activeAsset.type === "gallery" && activeAsset.galleryLayout !== "carousel" && (
                    <div className="mt-2 bg-black" style={{ border: "1px solid var(--border)", borderRadius: "2px" }}>
                      {galleryChildren.length ? (
                        <div className="columns-2 gap-0.5 p-0.5">
                          {galleryChildren.map((childAsset) => {
                            const childSrc = getAssetSource(childAsset);
                            const isSelected = childAsset.id === activeGalleryChild?.id;
                            return (
                              <button
                                key={childAsset.id}
                                type="button"
                                onClick={() => setActiveGalleryChildId(childAsset.id)}
                                className="mb-0.5 block w-full break-inside-avoid overflow-hidden text-left"
                                style={{
                                  outline: isSelected ? "2px solid rgba(255,255,255,0.7)" : "none",
                                  outlineOffset: "-2px",
                                }}
                              >
                                <div>
                                  {childAsset.type === "image" && childSrc ? (
                                    <img
                                      src={childSrc}
                                      alt={childAsset.label}
                                      className="block w-full"
                                    />
                                  ) : childAsset.type === "video" && childSrc ? (
                                    <video
                                      src={childSrc}
                                      className="block w-full"
                                      muted
                                      loop
                                      autoPlay
                                      playsInline
                                    />
                                  ) : childSrc ? (
                                    <iframe
                                      title={childAsset.label || "Document preview"}
                                      src={`${childSrc}#toolbar=0&navpanes=0&scrollbar=0`}
                                      className="h-36 w-full bg-black"
                                      style={{ pointerEvents: "none" }}
                                    />
                                  ) : (
                                    <div className="flex h-24 items-center justify-center text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--label)", background: "#111" }}>
                                      {childAsset.type === "doc" ? "PDF / Doc" : "No preview"}
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex min-h-[8rem] items-center justify-center text-xs" style={{ color: "var(--label)" }}>No media in gallery yet.</div>
                      )}
                    </div>
                  )}
                  <p
                    className="mt-2 text-[10px] uppercase tracking-[0.18em] font-light"
                    style={{ color: "var(--label)" }}
                  >
                    {activeAsset.label}
                  </p>

                  {activeAsset.type === "gallery" && activeGalleryChild ? (
                    <p className="mt-2 text-[11px] font-light leading-5" style={{ color: "rgba(255,255,255,0.58)" }}>
                      {activeAsset.galleryLayout === "carousel" ? "Carousel cover" : "Gallery highlight"}: {activeGalleryChild.label}
                      {activeGalleryChild.description ? ` — ${activeGalleryChild.description}` : ""}
                    </p>
                  ) : null}
                  {activeAsset.description ? (
                    <p className="mt-2 text-xs font-light leading-5" style={{ color: "rgba(255,255,255,0.52)" }}>
                      {activeAsset.description}
                    </p>
                  ) : null}
                  {activeDocumentHref ? (
                    <div className="mt-3">
                      <a
                        href={activeDocumentHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex px-3 py-2 text-[10px] uppercase tracking-[0.18em]"
                        style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}
                      >
                        Open document
                      </a>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.28em] font-light"
                  style={{ color: "var(--label)" }}
                >
                  Narrative
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
            </div>

            <div className="space-y-8">
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
                          className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition"
                          style={{
                            background: isPlaying ? "rgba(255,255,255,0.07)" : "transparent",
                            color: isPlaying ? "#f0f0f0" : "var(--label)",
                          }}
                        >
                          <span className="min-w-0">
                            <span className="flex items-center gap-3">
                            <span className="text-[10px] uppercase tracking-[0.16em] font-light" aria-hidden>{assetIcon[asset.type]}</span>
                            <span className="text-xs uppercase tracking-[0.14em] font-light">{asset.label}</span>
                            </span>
                            {asset.description ? (
                              <span className="mt-1 block text-[11px] font-light leading-5" style={{ color: "rgba(255,255,255,0.45)" }}>
                                {asset.description}
                              </span>
                            ) : null}
                          </span>
                          <span
                            className="text-[9px] uppercase tracking-[0.2em] font-light"
                            style={{ color: isPlaying ? "#f0f0f0" : "var(--label)" }}
                          >
                            {isPlaying ? (asset.type === "gallery" ? "Open" : "Playing") : asset.type === "gallery" ? "Open" : "Play"}
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
          </div>
        ) : (
          <p className="text-sm text-zinc-600">Click any project card to populate this panel.</p>
        )}
      </aside>

    </>
  );
}
