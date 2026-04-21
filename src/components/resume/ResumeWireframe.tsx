"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  activationFocusMedia as defaultActivationFocusMedia,
  bio as defaultBio,
  experiences as defaultExperiences,
  roleFocusMedia as defaultRoleFocusMedia,
} from "@/data/resumeData";
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

  return (
    project.assets.find((asset) => asset.type === "video") ??
    project.assets.find((asset) => asset.type === "image") ??
    project.assets[0] ??
    null
  );
}

const LOCAL_TEMPLATE_KEY = "resume-template-draft";

type RuntimeData = {
  bio: Bio;
  experiences: CompanyExperience[];
  activationFocusMedia: Record<ActivationType, FocusMedia>;
  roleFocusMedia: Record<RoleType, FocusMedia>;
  sortLabels?: {
    activation?: string;
    role?: string;
  };
  timelineTourEntryIds?: string[];
  timelineTourDurations?: Record<string, number>;
  variants?: Array<{ id: string; title: string; audience?: string }>;
  activeVariantId?: string;
  activeVariantTitle?: string;
  connectionMap?: Record<string, import("@/types/resume").ConnectedResumeLink[]>;
  connectionCounts?: Record<string, number>;
};

const defaultRuntimeData: RuntimeData = {
  bio: defaultBio,
  experiences: defaultExperiences,
  activationFocusMedia: defaultActivationFocusMedia,
  roleFocusMedia: defaultRoleFocusMedia,
  variants: [{ id: "default", title: "Resume" }],
  activeVariantId: "default",
  activeVariantTitle: "Resume",
  connectionMap: {},
  connectionCounts: {},
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const runtimeData: RuntimeData = useMemo(() => {
    if (!loadedTemplate) {
      return defaultRuntimeData;
    }

    return transformTemplateToRuntimeResume(loadedTemplate, activeVariantId) satisfies RuntimeResumeData;
  }, [loadedTemplate, activeVariantId]);

  const selectedProjectId = selectedProject?.id ?? null;
  const activeExperiences = runtimeData.experiences;
  const activeTheme = focusedProject?.theme ?? focusedParentGroup?.media?.theme ?? selectedProject?.theme;
  const activeBackgroundVideo =
    activeTrayAsset?.type === "video" ? (activeTrayAsset.preview ?? activeTrayAsset.href) : activeTheme?.backgroundVideo;
  const activeAudio = focusedProject?.focusAudio ?? focusedParentGroup?.media?.focusAudio ?? selectedProject?.focusAudio;

  useEffect(() => {
    const targetProject =
      pendingSelectedProjectId
        ? activeExperiences.flatMap((experience) => experience.projects).find((project) => project.id === pendingSelectedProjectId) ?? null
        : activeExperiences[0]?.projects[0] ?? null;

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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (!activeAudio) {
      return;
    }

    const audio = new Audio(activeAudio);
    audio.volume = 0.25;
    audio.currentTime = 0;
    audioRef.current = audio;
    void audio.play().catch(() => {
      // Ignore autoplay restrictions. Focus state still updates visual theme.
    });

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [activeAudio]);

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

      {/* Faint background video layer */}
      {activeBackgroundVideo ? (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" style={{ opacity: 0.07 }}>
          <video className="h-full w-full object-cover" autoPlay muted loop playsInline>
            <source src={activeBackgroundVideo} type="video/mp4" />
          </video>
        </div>
      ) : null}

      <div className="relative z-10">
        <VideoBanner
          bio={runtimeData.bio}
          isTimelineMode={sortMode === "timeline"}
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
          sortLabels={runtimeData.sortLabels}
          timelineTourEntryIds={runtimeData.timelineTourEntryIds}
          timelineTourDurations={runtimeData.timelineTourDurations}
          connectionCounts={runtimeData.connectionCounts}
        />
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
        <Footer />
      </div>
    </div>
  );

}
