import type { ProjectAsset } from "@/types/resume";

type AssetViewerModalProps = {
  asset: ProjectAsset | null;
  isOpen: boolean;
  accentColor?: string;
  onClose: () => void;
};

export function AssetViewerModal({ asset, isOpen, accentColor, onClose }: AssetViewerModalProps) {
  if (!isOpen || !asset) {
    return null;
  }

  const borderColor = accentColor ?? "#27272a";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 sm:p-10">
      <button
        type="button"
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.82)" }}
        aria-label="Close media viewer"
        onClick={onClose}
      />

      <div
        className="relative z-[71] w-full max-w-5xl text-white"
        style={{
          background: "#070709",
          border: `1px solid ${borderColor}44`,
          borderRadius: "2px",
          boxShadow: `0 0 80px ${borderColor}22`,
        }}
      >
        {/* Thin accent line at top */}
        <div style={{ height: "1px", background: `linear-gradient(90deg, transparent, ${borderColor}88, transparent)` }} />

        <div
          className="flex items-center justify-between gap-4 px-6 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.28em] font-light"
              style={{ color: "var(--label)" }}
            >
              Media Viewer
            </p>
            <h3
              className="mt-1 text-sm font-light"
              style={{ color: "#e8e8e8" }}
            >
              {asset.label}
            </h3>
          </div>
          <button
            type="button"
            className="px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] font-light transition"
            style={{ color: "var(--label)", border: "1px solid var(--border)", borderRadius: "2px" }}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="overflow-hidden" style={{ borderRadius: "0 0 2px 2px" }}>
          {asset.type === "video" ? (
            <video
              className="max-h-[72vh] w-full bg-black object-contain"
              src={asset.preview ?? asset.href}
              loop
              controls
              autoPlay
              muted
              playsInline
            />
          ) : null}

          {asset.type === "image" ? (
            <img
              className="max-h-[72vh] w-full bg-black object-contain"
              src={asset.preview ?? asset.href}
              alt={asset.label}
            />
          ) : null}

          {asset.type === "doc" ? (
            <div
              className="flex min-h-[40vh] flex-col items-center justify-center gap-6 p-10 text-center"
              style={{ background: "#070709" }}
            >
              <p
                className="max-w-sm text-xs font-light leading-6"
                style={{ color: "var(--label)" }}
              >
                This asset is a document. Open it in a new tab to view the full content.
              </p>
              <a
                href={asset.href}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] font-light transition"
                style={{ color: "#e8e8e8", border: "1px solid var(--border)", borderRadius: "2px" }}
              >
                Open document
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
