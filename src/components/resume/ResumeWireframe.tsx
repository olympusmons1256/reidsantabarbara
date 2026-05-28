"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  activationFocusMedia as defaultActivationFocusMedia,
  bio as defaultBio,
  experiences as defaultExperiences,
  roleFocusMedia as defaultRoleFocusMedia,
} from "@/data/resumeData";
import { blankTemplate } from "@/data/blankTemplate";
import { getTemplateById } from "@/lib/supabase/templateStore";
import { normalizeTemplate, transformTemplateToRuntimeResume, type RuntimeResumeData } from "@/lib/template/transformTemplate";
import type {
  ActivationType,
  Bio,
  CompanyExperience,
  FocusMedia,
  ParentGroupFocusTarget,
  Project,
  ProjectAsset,
  ProjectSortFilter,
  ProjectSortMode,
  RoleType,
} from "@/types/resume";
import type { ResumeTemplate } from "@/types/template";
import { ExperienceCards } from "@/components/resume/ExperienceCards";
import { Footer } from "@/components/resume/Footer";
import { ProjectSidePanel } from "@/components/resume/ProjectSidePanel";
import { VideoBanner } from "@/components/resume/VideoBanner";

function getDefaultTrayAsset(project: Project | null): ProjectAsset | null {
  if (!project) {
    return null;
  }

  const coverById = project.coverAssetId
    ? project.assets.find((asset) => asset.id === project.coverAssetId)
    : null;
  if (coverById) {
    return coverById;
  }

  const coverBySubtype = project.assets.find((asset) => asset.subType === "cover");
  if (coverBySubtype) {
    return coverBySubtype;
  }

  return (
    project.assets.find((asset) => asset.type === "video") ??
    project.assets.find((asset) => asset.type === "image") ??
    project.assets[0] ??
    null
  );
}

function getGalleryCoverAsset(projectAsset: ProjectAsset | null): import("@/types/resume").ProjectGalleryEntryAsset | null {
  if (!projectAsset || projectAsset.type !== "gallery") {
    return null;
  }

  const children = projectAsset.assets ?? [];
  return (
    (projectAsset.coverAssetId ? children.find((asset) => asset.id === projectAsset.coverAssetId) : undefined) ??
    children.find((asset) => asset.subType === "cover") ??
    children[0] ??
    null
  );
}

function isYouTubeVideoUrl(url: string | null | undefined): boolean {
  const value = (url || "").trim();
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    return host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be";
  } catch {
    return false;
  }
}

function getYouTubeVideoId(url: string | null | undefined): string | null {
  const value = (url || "").trim();
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
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

function getYouTubeBackgroundEmbedSrc(url: string | null | undefined): string | null {
  const id = getYouTubeVideoId(url);
  if (!id) {
    return null;
  }

  return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&modestbranding=1&rel=0&playsinline=1`;
}

const LOCAL_TEMPLATE_KEY = "resume-template-draft";
const BANNER_AUDIO_GAIN_BOOST = 2.5;

function parseDateWindow(value: string | undefined): { start: number; end: number } {
  if (!value) {
    return { start: Number.NEGATIVE_INFINITY, end: Number.NEGATIVE_INFINITY };
  }

  const normalized = value.toLowerCase();
  const allYears = value.match(/(?:19|20)\d{2}/g)?.map((match) => Number(match)) ?? [];

  let start = Number.NEGATIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;

  const rangeStartMatch = value.match(/((?:19|20)\d{2})\s*(?:-|–|—|to|through|thru)/i);
  if (rangeStartMatch?.[1]) {
    start = Number(rangeStartMatch[1]);
  } else if (allYears.length > 0) {
    start = allYears[0];
  }

  if (/(present|current|ongoing|now)/i.test(normalized)) {
    end = Number.MAX_SAFE_INTEGER;
  } else if (allYears.length >= 2) {
    end = allYears[allYears.length - 1];
  } else if (allYears.length === 1) {
    end = allYears[0];
  }

  return { start, end };
}

function compareByDateWindowDesc(left: string | undefined, right: string | undefined): number {
  const leftWindow = parseDateWindow(left);
  const rightWindow = parseDateWindow(right);

  const endDelta = rightWindow.end - leftWindow.end;
  if (endDelta !== 0) {
    return endDelta;
  }

  const startDelta = rightWindow.start - leftWindow.start;
  if (startDelta !== 0) {
    return startDelta;
  }

  return 0;
}

function escapeHtml(value: string | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type RuntimeData = {
  bio: Bio;
  experiences: CompanyExperience[];
  activationFocusMedia: Record<ActivationType, FocusMedia>;
  roleFocusMedia: Record<RoleType, FocusMedia>;
  sortFilters?: ProjectSortFilter[];
  sortLabels?: {
    activation?: string;
    role?: string;
  };
  timelineTourEntryIds?: string[];
  timelineTourDurations?: Record<string, number>;
  timelineTourStepLabels?: string[];
  variants?: Array<{ id: string; title: string; audience?: string }>;
  activeVariantId?: string;
  activeVariantTitle?: string;
  connectionMap?: Record<string, import("@/types/resume").ConnectedResumeLink[]>;
  connectionCounts?: Record<string, number>;
};

const defaultRuntimeData: RuntimeData = {
  ...transformTemplateToRuntimeResume(blankTemplate),
  bio: defaultBio,
  experiences: defaultExperiences,
  activationFocusMedia: defaultActivationFocusMedia,
  roleFocusMedia: defaultRoleFocusMedia,
};

export function ResumeWireframe() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get("templateId");
  const queryVariantId = searchParams.get("variantId");

  const [loadedTemplate, setLoadedTemplate] = useState<ResumeTemplate | null>(null);
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [focusedProject, setFocusedProject] = useState<Project | null>(null);
  const [focusedParentGroup, setFocusedParentGroup] = useState<ParentGroupFocusTarget | null>(null);
  const [activeTrayAsset, setActiveTrayAsset] = useState<ProjectAsset | null>(null);
  const [sortMode, setSortMode] = useState<ProjectSortMode>("company");
  const [timelineTourRunId, setTimelineTourRunId] = useState(0);
  const [pendingSelectedProjectId, setPendingSelectedProjectId] = useState<string | null>(null);
  const parentAudioRef = useRef<HTMLAudioElement | null>(null);
  const childAudioRef = useRef<HTMLAudioElement | null>(null);
  const bannerAudioRef = useRef<HTMLAudioElement | null>(null);
  const bannerAudioContextRef = useRef<AudioContext | null>(null);
  const bannerAudioGainRef = useRef<GainNode | null>(null);
  const bannerAudioSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  const runtimeData: RuntimeData = useMemo(() => {
    if (!loadedTemplate) {
      return defaultRuntimeData;
    }

    return transformTemplateToRuntimeResume(loadedTemplate, activeVariantId) satisfies RuntimeResumeData;
  }, [loadedTemplate, activeVariantId]);

  const selectedProjectId = selectedProject?.id ?? null;
  const activeExperiences = runtimeData.experiences;
  const hasResumeItems = activeExperiences.some((experience) => experience.projects.length > 0);
  const selectedParentGroup = selectedProject
    ? activeExperiences.find((experience) => experience.projects.some((project) => project.id === selectedProject.id)) ?? null
    : null;
  const parentMedia = focusedParentGroup?.media ?? selectedParentGroup?.focusMedia ?? null;
  const childTheme = focusedProject?.theme ?? selectedProject?.theme;
  const activeTheme = childTheme ?? parentMedia?.theme;

  const parentBackgroundVideo = parentMedia?.theme.backgroundVideo;
  const parentBackgroundImage = parentMedia?.theme.backgroundImage;
  const activeGalleryCoverAsset = getGalleryCoverAsset(activeTrayAsset);

  const childBackgroundVideo =
    activeTrayAsset?.type === "video"
      ? (activeTrayAsset.preview ?? activeTrayAsset.href)
      : activeGalleryCoverAsset?.type === "video"
        ? (activeGalleryCoverAsset.preview ?? activeGalleryCoverAsset.href)
      : childTheme?.backgroundVideo;
  const childBackgroundImage =
    activeTrayAsset?.type === "image"
      ? (activeTrayAsset.preview ?? activeTrayAsset.href)
      : activeGalleryCoverAsset?.type === "image"
        ? (activeGalleryCoverAsset.preview ?? activeGalleryCoverAsset.href)
      : childTheme?.backgroundImage;
  const parentBackgroundYouTubeSrc = getYouTubeBackgroundEmbedSrc(parentBackgroundVideo);
  const childBackgroundYouTubeSrc = getYouTubeBackgroundEmbedSrc(childBackgroundVideo);

  const parentAudio = parentMedia?.focusAudio ?? null;
  const childAudio = focusedProject?.focusAudio ?? selectedProject?.focusAudio ?? null;
  const bannerAudioSource = runtimeData.bio.bannerBackgroundVideo?.trim() || null;
  const bannerAudioEnabled = Boolean(runtimeData.bio.bannerVideoUseAudio);
  const bannerAudioBaseVolume = Math.min(100, Math.max(0, runtimeData.bio.bannerVideoAudioVolume ?? 20)) / 100;
  const bannerAudioDuckedVolume = Math.min(100, Math.max(0, runtimeData.bio.bannerVideoDuckedVolume ?? 8)) / 100;

  const getExportGroups = () => {
    const flattenedProjects = activeExperiences.flatMap((company) =>
      company.projects.map((project) => ({
        project,
        companyName: company.company,
        companyPeriod: company.period,
      }))
    );

    if (sortMode === "company") {
      return [...activeExperiences]
        .sort((a, b) => compareByDateWindowDesc(a.period, b.period))
        .map((company) => ({
          title: company.company,
          subtitle: `${company.role} · ${company.period}`,
          projects: [...company.projects].sort((a, b) => compareByDateWindowDesc(a.dateRange, b.dateRange)),
        }));
    }

    if (sortMode === "timeline") {
      return [
        {
          title: "Timeline",
          subtitle: "Chronological project list",
          projects: flattenedProjects.map((entry) => ({
            ...entry.project,
            summary: `${entry.companyName}${entry.companyPeriod ? ` · ${entry.companyPeriod}` : ""}${entry.project.summary ? ` — ${entry.project.summary}` : ""}`,
          })),
        },
      ];
    }

    const grouped = new Map<string, typeof flattenedProjects>();

    const pushIntoGroup = (key: string, entry: (typeof flattenedProjects)[number]) => {
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)?.push(entry);
    };

    flattenedProjects.forEach((entry) => {
      if (sortMode === "activation") {
        pushIntoGroup(entry.project.activationType || "general", entry);
        return;
      }
      if (sortMode === "role") {
        if (!entry.project.roleTypes.length) {
          pushIntoGroup("general", entry);
          return;
        }
        entry.project.roleTypes.forEach((role) => pushIntoGroup(role || "general", entry));
        return;
      }

      const tagValues = entry.project.tags?.[sortMode] ?? [];
      const values = tagValues.length ? tagValues : ["general"];
      values.forEach((value) => pushIntoGroup(value || "general", entry));
    });

    return Array.from(grouped.entries())
      .map(([title, entries]) => ({
        title,
        subtitle: `${entries.length} project${entries.length === 1 ? "" : "s"}`,
        projects: [...entries]
          .sort((a, b) => compareByDateWindowDesc(a.project.dateRange, b.project.dateRange))
          .map((entry) => ({
            ...entry.project,
            summary: `${entry.companyName}${entry.companyPeriod ? ` · ${entry.companyPeriod}` : ""}${entry.project.summary ? ` — ${entry.project.summary}` : ""}`,
          })),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  };

  const handleExportResume = () => {
    const bio = runtimeData.bio;
    const pdfTitle = `${(bio.name || "Resume").replace(/\s+/g, "-")}.pdf`;

    // Use the same sort/grouping logic as the display
    let exportGroups = getExportGroups();

    // Sort education to bottom
    exportGroups = [
      ...exportGroups.filter((g) => g.title.toLowerCase() !== "education"),
      ...exportGroups.filter((g) => g.title.toLowerCase() === "education"),
    ];

    // Build export sections from the sorted groups
    const exportSections = exportGroups.map((group) => {
      const projects = group.projects || [];

      return `
        <section class="group">
          <header>
            <h3>${escapeHtml(group.title)}</h3>
            <p>${escapeHtml(group.subtitle || "")}</p>
          </header>
          ${projects
            .map(
              (project) => `
            <article class="project">
              <div class="project-head">
                <h4>${escapeHtml(project.title)}</h4>
                <span>${escapeHtml(project.dateRange || "")}</span>
              </div>
              ${project.summary ? `<p class="summary">${escapeHtml(project.summary)}</p>` : ""}
            </article>
          `
            )
            .join("")}
        </section>
      `;
      });

    const groupsMarkup = exportSections.join("");

    const printHtml = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(pdfTitle)}</title>
          <style>
            @page { size: auto; margin: 0.6in; }
            body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; }
            h1,h2,h3,h4,p { margin: 0; }
            .top { margin-bottom: 20px; }
            .top h1 { font-size: 24px; margin-bottom: 4px; }
            .top p { color: #444; font-size: 12px; }
            .summary { margin-top: 8px; font-size: 12px; line-height: 1.5; color: #222; }
            .group { margin-top: 20px; break-inside: avoid; }
            .group > header { border-bottom: 1px solid #ddd; padding-bottom: 6px; margin-bottom: 8px; }
            .group > header h3 { font-size: 14px; text-transform: uppercase; letter-spacing: .08em; }
            .group > header p { font-size: 11px; color: #666; margin-top: 2px; }
            .project { margin-bottom: 10px; break-inside: avoid; }
            .project-head { display: flex; justify-content: space-between; gap: 12px; }
            .project-head h4 { font-size: 13px; }
            .project-head span { font-size: 11px; color: #666; white-space: nowrap; }
            .subgroup { margin-top: 5px; font-size: 11px; color: #555; padding-left: 8px; border-left: 2px solid #ddd; }
            .innovations { margin-top: 10px; padding-top: 8px; border-top: 1px solid #eee; }
            .innovations-label { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: #999; margin-bottom: 6px; }
            .project { margin-bottom: 8px; break-inside: avoid; }
            .project-head { display: flex; justify-content: space-between; gap: 12px; }
            .project-head h4 { font-size: 12px; font-weight: 500; }
            .project-head span { font-size: 11px; color: #666; white-space: nowrap; }
          </style>
        </head>
        <body>
          <header class="top">
            <h1>${escapeHtml(bio.name || "Resume")}</h1>
            <p>${escapeHtml([bio.title, bio.location].filter(Boolean).join(" · "))}</p>
            ${bio.summary ? `<p class="summary">${escapeHtml(bio.summary)}</p>` : ""}
          </header>
          ${groupsMarkup || '<p class="summary">No projects are available in the current filter for export.</p>'}
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=1100,height=850");
    if (!printWindow) {
      return;
    }

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    const triggerPrint = () => {
      printWindow.print();
      window.setTimeout(() => {
        printWindow.close();
      }, 300);
    };

    if (printWindow.document.readyState === "complete") {
      window.setTimeout(triggerPrint, 120);
    } else {
      printWindow.addEventListener("load", () => window.setTimeout(triggerPrint, 120), { once: true });
    }
  };

  useEffect(() => {
    const targetProject =
      pendingSelectedProjectId
        ? activeExperiences.flatMap((experience) => experience.projects).find((project) => project.id === pendingSelectedProjectId) ?? null
        : null;

    const timerId = window.setTimeout(() => {
      setSelectedProject(targetProject);
      setActiveTrayAsset(getDefaultTrayAsset(targetProject));
      setFocusedProject(null);
      setFocusedParentGroup(null);
      setPendingSelectedProjectId(null);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [activeExperiences, pendingSelectedProjectId]);

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      if (templateId) {
        try {
          const row = await getTemplateById(templateId);
          if (row?.data) {
            const normalized = normalizeTemplate(row.data);
            if (!isCancelled) {
              setLoadedTemplate(normalized);
              setActiveVariantId(queryVariantId ?? normalized.defaultVariantId ?? normalized.variants[0]?.id ?? null);
            }
            return;
          }
        } catch {
          // Ignore fetch errors and continue to local/default fallback.
        }
      }

      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem(LOCAL_TEMPLATE_KEY);
        if (raw) {
          try {
            const parsed = normalizeTemplate(JSON.parse(raw) as ResumeTemplate);
            if (!isCancelled) {
              setLoadedTemplate(parsed);
              setActiveVariantId(queryVariantId ?? parsed.defaultVariantId ?? parsed.variants[0]?.id ?? null);
            }
            return;
          } catch {
            // Ignore parse errors and keep defaults.
          }
        }
      }

      if (!isCancelled) {
        setLoadedTemplate(null);
        setActiveVariantId(null);
      }
    };

    void load();

    return () => {
      isCancelled = true;
    };
  }, [queryVariantId, templateId]);

  useEffect(() => {
    const unlockBannerAudio = () => {
      const context = bannerAudioContextRef.current;
      if (context && context.state === "suspended") {
        void context.resume().catch(() => {
          // Ignore gesture unlock failures.
        });
      }
    };

    window.addEventListener("pointerdown", unlockBannerAudio, { passive: true });
    window.addEventListener("keydown", unlockBannerAudio);

    return () => {
      window.removeEventListener("pointerdown", unlockBannerAudio);
      window.removeEventListener("keydown", unlockBannerAudio);
    };
  }, []);

  useEffect(() => {
    if (parentAudioRef.current) {
      parentAudioRef.current.pause();
      parentAudioRef.current = null;
    }

    if (childAudioRef.current) {
      childAudioRef.current.pause();
      childAudioRef.current = null;
    }

    if (bannerAudioRef.current) {
      bannerAudioRef.current.pause();
      bannerAudioRef.current = null;
    }
    if (bannerAudioSourceNodeRef.current) {
      bannerAudioSourceNodeRef.current.disconnect();
      bannerAudioSourceNodeRef.current = null;
    }
    if (bannerAudioGainRef.current) {
      bannerAudioGainRef.current.disconnect();
      bannerAudioGainRef.current = null;
    }
    if (bannerAudioContextRef.current) {
      void bannerAudioContextRef.current.close().catch(() => {
        // Ignore close failures.
      });
      bannerAudioContextRef.current = null;
    }

    const hasChildMedia = Boolean(childAudio || childBackgroundVideo || childBackgroundImage);
    const hasForegroundAudio = Boolean(parentAudio || childAudio);
    const parentVolume = hasChildMedia ? 0.08 : 0.25;

    if (bannerAudioEnabled && bannerAudioSource && !isYouTubeVideoUrl(bannerAudioSource)) {
      const bannerAudio = new Audio();
      bannerAudio.crossOrigin = "anonymous";
      bannerAudio.loop = true;
      bannerAudio.volume = 1;
      bannerAudio.src = bannerAudioSource;
      bannerAudio.currentTime = 0;
      bannerAudioRef.current = bannerAudio;

      const baseGain = hasForegroundAudio ? bannerAudioDuckedVolume : bannerAudioBaseVolume;
      const boostedGain = Math.min(3, Math.max(0, baseGain * BANNER_AUDIO_GAIN_BOOST));

      try {
        const context = new AudioContext();
        const sourceNode = context.createMediaElementSource(bannerAudio);
        const gainNode = context.createGain();
        gainNode.gain.value = boostedGain;
        sourceNode.connect(gainNode);
        gainNode.connect(context.destination);

        bannerAudioContextRef.current = context;
        bannerAudioSourceNodeRef.current = sourceNode;
        bannerAudioGainRef.current = gainNode;

        if (context.state === "suspended") {
          void context.resume().catch(() => {
            // Gesture unlock may be required.
          });
        }
      } catch {
        // Fallback when Web Audio API wiring fails.
        bannerAudio.volume = Math.min(1, Math.max(0, baseGain));
      }

      // Attempt to play, with fallback error handling
      const playPromise = bannerAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay may be restricted by browser policy
        });
      }
    }

    if (parentAudio) {
      const parent = new Audio(parentAudio);
      parent.loop = true;
      parent.volume = parentVolume;
      parent.currentTime = 0;
      parentAudioRef.current = parent;
      void parent.play().catch(() => {
        // Ignore autoplay restrictions.
      });
    }

    if (childAudio) {
      const child = new Audio(childAudio);
      child.loop = true;
      child.volume = 0.25;
      child.currentTime = 0;
      childAudioRef.current = child;
      void child.play().catch(() => {
        // Ignore autoplay restrictions.
      });
    }

    return () => {
      if (bannerAudioRef.current) {
        bannerAudioRef.current.pause();
        bannerAudioRef.current.currentTime = 0;
      }
      if (bannerAudioSourceNodeRef.current) {
        bannerAudioSourceNodeRef.current.disconnect();
        bannerAudioSourceNodeRef.current = null;
      }
      if (bannerAudioGainRef.current) {
        bannerAudioGainRef.current.disconnect();
        bannerAudioGainRef.current = null;
      }
      if (bannerAudioContextRef.current) {
        void bannerAudioContextRef.current.close().catch(() => {
          // Ignore close failures.
        });
        bannerAudioContextRef.current = null;
      }
      if (parentAudioRef.current) {
        parentAudioRef.current.pause();
        parentAudioRef.current.currentTime = 0;
      }
      if (childAudioRef.current) {
        childAudioRef.current.pause();
        childAudioRef.current.currentTime = 0;
      }
    };
  }, [
    parentAudio,
    childAudio,
    childBackgroundVideo,
    childBackgroundImage,
    bannerAudioEnabled,
    bannerAudioSource,
    bannerAudioBaseVolume,
    bannerAudioDuckedVolume,
  ]);

  // Dynamically update banner audio volume based on foreground audio presence
  useEffect(() => {
    if (!bannerAudioRef.current || !bannerAudioEnabled) return;

    const hasForegroundAudio = Boolean(parentAudio || childAudio);
    const targetVolume = hasForegroundAudio ? bannerAudioDuckedVolume : bannerAudioBaseVolume;
    if (bannerAudioGainRef.current) {
      bannerAudioGainRef.current.gain.value = Math.min(3, Math.max(0, targetVolume * BANNER_AUDIO_GAIN_BOOST));
    } else {
      bannerAudioRef.current.volume = Math.min(1, Math.max(0, targetVolume));
    }
  }, [parentAudio, childAudio, bannerAudioBaseVolume, bannerAudioDuckedVolume, bannerAudioEnabled]);

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: "#080809" }}>
      {/* Ambient glow layer — changes with focus theme */}
      {activeTheme ? (
        <div
          className="pointer-events-none fixed inset-0 z-0 transition-all duration-700"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 15% 30%, ${activeTheme.gradientFrom}55 0%, ${activeTheme.gradientTo}1a 50%, transparent 80%)`,
          }}
        />
      ) : null}

      {/* Parent section background media */}
      {parentBackgroundImage ? (
        <div className="pointer-events-none fixed inset-0 z-0" style={{ opacity: childBackgroundVideo || childBackgroundImage ? 0.04 : 0.07 }}>
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${parentBackgroundImage})` }}
          />
        </div>
      ) : null}

      {parentBackgroundVideo ? (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" style={{ opacity: childBackgroundVideo || childBackgroundImage ? 0.04 : 0.07 }}>
          {parentBackgroundYouTubeSrc ? (
            <iframe
              className="h-full w-full"
              src={parentBackgroundYouTubeSrc}
              title="Parent background video"
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              style={{ border: 0 }}
            />
          ) : (
            <video className="h-full w-full object-cover" autoPlay muted loop playsInline>
              <source src={parentBackgroundVideo} type="video/mp4" />
            </video>
          )}
        </div>
      ) : null}

      {/* Child item background media (overrides parent layer visually) */}
      {childBackgroundImage ? (
        <div className="pointer-events-none fixed inset-0 z-0" style={{ opacity: 0.1 }}>
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${childBackgroundImage})` }}
          />
        </div>
      ) : null}

      {childBackgroundVideo ? (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" style={{ opacity: 0.1 }}>
          {childBackgroundYouTubeSrc ? (
            <iframe
              className="h-full w-full"
              src={childBackgroundYouTubeSrc}
              title="Child background video"
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              style={{ border: 0 }}
            />
          ) : (
            <video className="h-full w-full object-cover" autoPlay muted loop playsInline>
              <source src={childBackgroundVideo} type="video/mp4" />
            </video>
          )}
        </div>
      ) : null}

      <div className={`relative z-10 transition-all duration-500 ${selectedProject ? "sm:pr-[28rem]" : "sm:pr-0"}`}>
        <VideoBanner
          bio={runtimeData.bio}
          isTimelineMode={sortMode === "timeline"}
          onExportResumeAction={handleExportResume}
          variants={runtimeData.variants}
          activeVariantId={runtimeData.activeVariantId}
          onVariantChange={(variantId) => {
            setActiveVariantId(variantId);
            setSelectedProject(null);
            setActiveTrayAsset(null);
            setPendingSelectedProjectId(null);
            setSortMode("company");
          }}
          onTimelineTourAction={() => {
            setSortMode("timeline");
            setSelectedProject(null);
            setActiveTrayAsset(null);
            setTimelineTourRunId((runId) => runId + 1);
          }}
        />
        <ExperienceCards
          experiences={activeExperiences}
          selectedProjectId={selectedProjectId}
          onSelectProject={(project) => {
            setSelectedProject(project);
            setActiveTrayAsset(getDefaultTrayAsset(project));
          }}
          onFocusProject={setFocusedProject}
          onFocusParentGroup={setFocusedParentGroup}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          timelineTourRunId={timelineTourRunId}
          activationFocusMedia={runtimeData.activationFocusMedia}
          roleFocusMedia={runtimeData.roleFocusMedia}
          sortFilters={runtimeData.sortFilters}
          sortLabels={runtimeData.sortLabels}
          timelineTourEntryIds={runtimeData.timelineTourEntryIds}
          timelineTourDurations={runtimeData.timelineTourDurations}
          timelineTourStepLabels={runtimeData.timelineTourStepLabels}
          connectionCounts={runtimeData.connectionCounts}
        />
        {!hasResumeItems ? (
          <section className="mx-auto -mt-4 mb-10 w-full max-w-6xl px-8 sm:px-12">
            <div className="glass px-6 py-5" style={{ borderRadius: "2px" }}>
              <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--label)" }}>
                No Resume Content Yet
              </p>
              <p className="mt-2 text-sm font-light" style={{ color: "rgba(255,255,255,0.58)" }}>
                Build your profile, add resume variants (technical, creative, etc.), then create sections and projects in the editor.
              </p>
              <div className="mt-4">
                <Link
                  href="/editor"
                  className="inline-flex px-3 py-1 text-[11px] uppercase tracking-[0.18em]"
                  style={{ border: "1px solid #fef08a55", borderRadius: "2px", color: "#fef08a" }}
                >
                  Open Editor
                </Link>
              </div>
            </div>
          </section>
        ) : null}
        <ProjectSidePanel
          project={selectedProject}
          activeAsset={activeTrayAsset}
          isOpen={Boolean(selectedProject)}
          onClose={() => {
            setSelectedProject(null);
            setActiveTrayAsset(null);
          }}
          onSelectAsset={setActiveTrayAsset}
          connectedLinks={selectedProject ? runtimeData.connectionMap?.[selectedProject.id] ?? [] : []}
          onOpenConnectedItem={(variantId, itemId) => {
            setActiveVariantId(variantId);
            setPendingSelectedProjectId(itemId);
            setSortMode("company");
          }}
        />
        <Footer bio={runtimeData.bio} />
      </div>
    </div>
  );

}
