import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ActivationType,
  CompanyExperience,
  ParentGroupFocusTarget,
  Project,
  ProjectSortFilter,
  ProjectSortMode,
  RoleType,
  FocusMedia,
} from "@/types/resume";

type ExperienceCardsProps = {
  experiences: CompanyExperience[];
  selectedProjectId: string | null;
  onSelectProject: (project: Project) => void;
  onFocusProject: (project: Project | null) => void;
  onFocusParentGroup: (group: ParentGroupFocusTarget | null) => void;
  sortMode: ProjectSortMode;
  onSortModeChange: (mode: ProjectSortMode) => void;
  timelineTourRunId: number;
  activationFocusMedia: Record<ActivationType, FocusMedia>;
  roleFocusMedia: Record<RoleType, FocusMedia>;
  sortFilters?: ProjectSortFilter[];
  sortLabels?: {
    activation?: string;
    role?: string;
  };
  timelineTourEntryIds?: string[];
  timelineTourDurations?: Record<string, number>;
  connectionCounts?: Record<string, number>;
};

export function ExperienceCards({
  experiences,
  selectedProjectId,
  onSelectProject,
  onFocusProject,
  onFocusParentGroup,
  sortMode,
  onSortModeChange,
  timelineTourRunId,
  activationFocusMedia,
  roleFocusMedia,
  sortFilters,
  sortLabels,
  timelineTourEntryIds,
  timelineTourDurations,
  connectionCounts,
}: ExperienceCardsProps) {
  const innovationAccent = "#facc15";

  const getAssetSource = (asset: { href: string; preview?: string }): string => {
    return (asset.preview?.trim() || asset.href?.trim() || "");
  };

  const getProjectCoverAssetBackground = (project: Project): string | null => {
    const coverById = project.coverAssetId
      ? project.assets.find((asset) => asset.id === project.coverAssetId)
      : undefined;
    const coverBySubtype = project.assets.find((asset) => asset.subType === "cover");
    const preferredAsset =
      coverById ??
      coverBySubtype ??
      project.assets.find((asset) => asset.type === "image") ??
      project.assets[0];

    if (!preferredAsset) {
      return null;
    }

    if (preferredAsset.type === "image") {
      return getAssetSource(preferredAsset) || null;
    }

    if (preferredAsset.type === "gallery") {
      const children = preferredAsset.assets ?? [];
      const coverChild =
        (preferredAsset.coverAssetId
          ? children.find((asset) => asset.id === preferredAsset.coverAssetId)
          : undefined) ?? children.find((asset) => asset.subType === "cover") ?? children[0];

      if (!coverChild || coverChild.type !== "image") {
        return null;
      }

      return getAssetSource(coverChild) || null;
    }

    return null;
  };

  const getFirstProjectWithAssets = (projects: Array<{ project: Project; contextLabel: string | undefined }>): Project | null => {
    return projects.find((entry) => (entry.project.assets ?? []).length > 0)?.project ?? null;
  };

  const parseDateWindow = (value: string | undefined): { start: number; end: number } => {
    if (!value) {
      return { start: Number.NEGATIVE_INFINITY, end: Number.NEGATIVE_INFINITY };
    }

    const normalized = value.toLowerCase();
    const allYears = value.match(/(?:19|20)\d{2}/g)?.map((match) => Number(match)) ?? [];

    let start = Number.NEGATIVE_INFINITY;
    let end = Number.NEGATIVE_INFINITY;

    // Prefer explicit range starts (e.g. 2020–Present, 2009 - 2011, c. 2007 to 2008)
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
  };

  const compareByDateWindowDesc = (left: string | undefined, right: string | undefined): number => {
    const leftWindow = parseDateWindow(left);
    const rightWindow = parseDateWindow(right);

    // Primary: closest to present day by ending date
    const endDelta = rightWindow.end - leftWindow.end;
    if (endDelta !== 0) {
      return endDelta;
    }

    // Secondary: date started (latest first)
    const startDelta = rightWindow.start - leftWindow.start;
    if (startDelta !== 0) {
      return startDelta;
    }

    return 0;
  };

  const isTimelineMode = sortMode === "timeline";
  const sectionRef = useRef<HTMLElement | null>(null);

  const educationExperiences = useMemo(
    () => experiences.filter((company) => company.sectionType === "education"),
    [experiences]
  );
  const nonEducationExperiences = useMemo(
    () => experiences.filter((company) => company.sectionType !== "education"),
    [experiences]
  );
  const hasEducation = educationExperiences.length > 0;

  const flattenedProjects = useMemo(
    () =>
      nonEducationExperiences.flatMap((company) =>
        company.projects.map((project) => ({
          project,
          companyId: company.id,
          companyName: company.company,
          companyPeriod: company.period,
          companyRole: company.role,
          companyFocusMedia: company.focusMedia,
        }))
      ),
    [experiences]
  );

  const sortOptions = useMemo<Array<{ label: string; value: ProjectSortMode }>>(() => {
    const fallback: Array<{ label: string; value: ProjectSortMode }> = [
      { label: "Company", value: "company" },
      { label: sortLabels?.activation ?? "Project Type", value: "activation" },
      { label: sortLabels?.role ?? "Role", value: "role" },
    ];

    const provided = (sortFilters ?? []).filter((entry) => entry.id !== "timeline" && entry.id !== "education");
    const source = provided.length
      ? provided.map((entry) => ({ label: entry.label, value: entry.id }))
      : fallback;

    const seen = new Set<string>();
    const deduped = source.filter((entry) => {
      if (seen.has(entry.value)) {
        return false;
      }
      seen.add(entry.value);
      return true;
    });

    const base = deduped.length ? deduped : fallback;
    // Append Education tab only if education sections exist.
    if (hasEducation) {
      return [...base, { label: "Education", value: "education" }];
    }
    return base;
  }, [sortFilters, sortLabels?.activation, sortLabels?.role, hasEducation]);

  useEffect(() => {
    if (isTimelineMode) {
      return;
    }

    if (!sortOptions.some((option) => option.value === sortMode)) {
      onSortModeChange("company");
    }
  }, [isTimelineMode, onSortModeChange, sortMode, sortOptions]);

  const currentSortLabel = useMemo(() => {
    return sortOptions.find((option) => option.value === sortMode)?.label ?? "Company";
  }, [sortMode, sortOptions]);

  const isActivationGroupedMode = sortMode === "activation";
  const isRoleGroupedMode = sortMode === "role";
  const isEducationMode = sortMode === "education";

  // Education sections shown at bottom of every non-education, non-timeline tab.
  const educationGroups = useMemo(
    () =>
      [...educationExperiences]
        .sort((a, b) => compareByDateWindowDesc(a.period, b.period))
        .map((company) => ({
          id: company.id,
          title: company.company,
          subtitle: `${company.role} · ${company.period}`,
          description: company.description,
          itemsSubtitle: company.itemsSubtitle,
          metadataItems: company.metadataItems,
          focusMedia: company.focusMedia,
          groupContainers: company.groupContainers,
          isEducation: true,
          projects: [...company.projects]
            .sort((a, b) => compareByDateWindowDesc(a.dateRange, b.dateRange))
            .map((project) => ({ project, contextLabel: undefined })),
        })),
    [educationExperiences]
  );

  const groups =
    isTimelineMode
      ? []
      : isEducationMode
      ? educationGroups
      : sortMode === "company"
      ? [...nonEducationExperiences]
          .sort((a, b) => compareByDateWindowDesc(a.period, b.period))
          .map((company) => ({
          id: company.id,
          title: company.company,
          subtitle: `${company.role} · ${company.period}`,
          description: company.description,
          itemsSubtitle: company.itemsSubtitle,
          metadataItems: company.metadataItems,
          focusMedia: company.focusMedia,
          groupContainers: company.groupContainers,
          isEducation: false,
          projects: [...company.projects]
            .sort((a, b) => compareByDateWindowDesc(a.dateRange, b.dateRange))
            .map((project) => ({
              project,
              contextLabel: undefined,
            })),
        }))
      : isActivationGroupedMode
        ? Array.from(
            flattenedProjects.reduce(
              (acc, item) => {
                const key = item.project.activationType;

                if (!acc.has(key)) {
                  acc.set(key, []);
                }

                acc.get(key)?.push(item);
                return acc;
              },
              new Map<string, typeof flattenedProjects>()
            )
          ).map(([activationType, items]) => ({
            id: activationType,
            title: activationType[0].toUpperCase() + activationType.slice(1),
            subtitle: `${items.length} project${items.length === 1 ? "" : "s"}`,
            description: "",
            itemsSubtitle: undefined,
            metadataItems: undefined,
            groupContainers: undefined,
            isEducation: false,
            focusMedia: activationFocusMedia[activationType as keyof typeof activationFocusMedia],
            projects: items.map((item) => ({
              project: item.project,
              contextLabel: `${item.companyName} · ${item.companyPeriod}`,
            })),
          }))
        : isRoleGroupedMode
          ? Array.from(
            flattenedProjects.reduce(
              (acc, item) => {
                for (const roleType of item.project.roleTypes) {
                  if (!acc.has(roleType)) {
                    acc.set(roleType, []);
                  }
                  acc.get(roleType)?.push(item);
                }
                return acc;
              },
              new Map<string, typeof flattenedProjects>()
            )
          ).map(([roleType, items]) => ({
            id: roleType,
            title: roleType[0].toUpperCase() + roleType.slice(1),
            subtitle: `${items.length} project${items.length === 1 ? "" : "s"}`,
            description: "",
            itemsSubtitle: undefined,
            metadataItems: undefined,
            groupContainers: undefined,
            isEducation: false,
            focusMedia: roleFocusMedia[roleType as keyof typeof roleFocusMedia],
            projects: items.map((item) => ({
              project: item.project,
              contextLabel: `${item.companyName} · ${item.companyPeriod}`,
            })),
            }))
          : Array.from(
              flattenedProjects.reduce(
                (acc, item) => {
                  const values = item.project.tags?.[sortMode] ?? [];
                  const effectiveValues = values.length ? values : ["general"];

                  effectiveValues.forEach((value) => {
                    const key = (value || "").trim() || "general";
                    if (!acc.has(key)) {
                      acc.set(key, []);
                    }
                    acc.get(key)?.push(item);
                  });

                  return acc;
                },
                new Map<string, typeof flattenedProjects>()
              )
            ).map(([filterValue, items]) => ({
              id: filterValue,
              title: filterValue[0].toUpperCase() + filterValue.slice(1),
              subtitle: `${items.length} project${items.length === 1 ? "" : "s"}`,
              description: "",
              itemsSubtitle: undefined,
              metadataItems: undefined,
              groupContainers: undefined,
              isEducation: false,
              focusMedia: undefined,
              projects: items.map((item) => ({
                project: item.project,
                contextLabel: `${item.companyName} · ${item.companyPeriod}`,
              })),
            }));

  const timelineEntries = useMemo(
    () =>
      flattenedProjects.map((item, index) => ({
        id: `${item.companyId}::${item.project.id}`,
        order: index + 1,
        project: item.project,
        companyId: item.companyId,
        companyName: item.companyName,
        companyPeriod: item.companyPeriod,
        companyRole: item.companyRole,
        companyFocusMedia: item.companyFocusMedia,
      })),
    [flattenedProjects]
  );

  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [pressedProjectId, setPressedProjectId] = useState<string | null>(null);
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState<number | null>(null);
  const tourTimersRef = useRef<number[]>([]);
  const tourSessionRef = useRef(0);
  const handlersRef = useRef({ onSelectProject, onFocusProject, onFocusParentGroup });

  useEffect(() => {
    handlersRef.current = { onSelectProject, onFocusProject, onFocusParentGroup };
  }, [onSelectProject, onFocusProject, onFocusParentGroup]);

  const activeTourEntry = tourStepIndex !== null ? timelineEntries[tourStepIndex] : null;

  const experienceHeading = isTimelineMode
    ? "Project Timeline"
    : isEducationMode
      ? "Education"
      : sortMode === "company"
        ? "By Company"
        : `By ${currentSortLabel}`;

  useEffect(() => {
    if (!isTimelineMode || timelineTourRunId === 0 || !sectionRef.current) {
      return;
    }

    tourSessionRef.current += 1;
    const sessionId = tourSessionRef.current;
    tourTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    tourTimersRef.current = [];

    const stops = Array.from(sectionRef.current.querySelectorAll<HTMLElement>("[data-timeline-stop='true']"));
    if (!stops.length) {
      return;
    }

    const stopByEntryId = new Map(
      stops.map((stop) => [stop.dataset.timelineEntryId ?? "", stop])
    );
    const stopByItemId = new Map<string, HTMLElement>();
    stops.forEach((stop) => {
      const rawEntryId = stop.dataset.timelineEntryId ?? "";
      const itemId = rawEntryId.split("::").pop() ?? "";
      if (itemId && !stopByItemId.has(itemId)) {
        stopByItemId.set(itemId, stop);
      }
    });

    const orderedStopsWithDurationKey = (timelineTourEntryIds ?? [])
      .map((configuredEntryId) => {
        const exact = stopByEntryId.get(configuredEntryId);
        if (exact) {
          return { stop: exact, durationKey: configuredEntryId };
        }

        // Config stores sectionId::itemId while rendered timeline rows are keyed as
        // companyId::itemId. Fall back to itemId matching so configured tour order
        // and durations are honored.
        const configuredItemId = configuredEntryId.split("::").pop() ?? "";
        if (!configuredItemId) {
          return null;
        }

        const stop = stopByItemId.get(configuredItemId);
        return stop ? { stop, durationKey: configuredEntryId } : null;
      })
      .filter((entry): entry is { stop: HTMLElement; durationKey: string } => Boolean(entry));

    const effectiveStops = orderedStopsWithDurationKey.length
      ? orderedStopsWithDurationKey.map((entry) => entry.stop)
      : stops;
    const effectiveDurationKeys = orderedStopsWithDurationKey.length
      ? orderedStopsWithDurationKey.map((entry) => entry.durationKey)
      : effectiveStops.map((stop) => stop.dataset.timelineEntryId ?? "");

    const runStep = (index: number) => {
      if (sessionId !== tourSessionRef.current || index >= effectiveStops.length) {
        handlersRef.current.onFocusProject(null);
        handlersRef.current.onFocusParentGroup(null);
        setHoveredProjectId(null);
        setTourStepIndex(null);
        setIsTourActive(false);
        return;
      }

      const stop = effectiveStops[index];
      const entryId = stop.dataset.timelineEntryId;
      const entry = timelineEntries.find((item) => item.id === entryId);

      if (entry) {
        setTourStepIndex(index);
        handlersRef.current.onSelectProject(entry.project);
        handlersRef.current.onFocusProject(entry.project);
        handlersRef.current.onFocusParentGroup({
          id: entry.companyId,
          label: entry.companyName,
          media: entry.companyFocusMedia,
        });
        setHoveredProjectId(entry.id);
      }

      stop.scrollIntoView({ behavior: "smooth", block: "center" });
      const configuredDurationKey = effectiveDurationKeys[index];
      const duration =
        (configuredDurationKey && timelineTourDurations?.[configuredDurationKey]) ||
        (entryId && timelineTourDurations?.[entryId]) ||
        1900;
      const nextTimerId = window.setTimeout(() => runStep(index + 1), duration);
      tourTimersRef.current.push(nextTimerId);
    };

    const startTimerId = window.setTimeout(() => {
      if (sessionId !== tourSessionRef.current) {
        return;
      }

      setIsTourActive(true);
      setTourStepIndex(null);
      runStep(0);
    }, 450);
    tourTimersRef.current.push(startTimerId);

    return () => {
      if (sessionId === tourSessionRef.current) {
        tourSessionRef.current += 1;
      }
      tourTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      tourTimersRef.current = [];
    };
  }, [isTimelineMode, timelineEntries, timelineTourRunId, timelineTourEntryIds, timelineTourDurations]);

  return (
    <section ref={sectionRef} className="mx-auto mt-8 w-full max-w-6xl px-4 pb-12 sm:mt-10 sm:px-8 sm:pb-16 md:mt-12 md:px-12">
      {/* Section header + sort controls */}
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p
            className="text-[10px] uppercase tracking-[0.32em] font-light"
            style={{ color: "var(--label)" }}
          >
            Experience
          </p>
          <h2
            className="mt-2 text-2xl font-light tracking-tight"
            style={{ color: "#f0f0f0", letterSpacing: "-0.01em" }}
          >
            {experienceHeading}
          </h2>
        </div>

        <div
          className="flex flex-wrap gap-px p-px"
          style={{ background: "var(--border)", borderRadius: "3px" }}
        >
          {sortOptions.map((option) => {
            const isActive = sortMode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onSortModeChange(option.value)}
                className="cursor-pointer px-4 py-2 text-[11px] uppercase tracking-[0.18em] font-light transition"
                style={{
                  background: isActive ? "rgba(255,255,255,0.10)" : "var(--background)",
                  color: isActive ? "#f0f0f0" : "var(--label)",
                  borderRadius: "2px",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {isTimelineMode ? (
        <div className="relative pl-7 sm:pl-10">
          {isTourActive ? (
            <div
              className="fixed bottom-4 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2"
              style={{
                background: "rgba(8,8,9,0.9)",
                border: "1px solid var(--border)",
                borderRadius: "2px",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <p className="text-[10px] uppercase tracking-[0.2em] font-light" style={{ color: "#fef08a" }}>
                  Timeline Tour
                </p>
                <p className="mt-1 text-xs font-light" style={{ color: "var(--label)" }}>
                  Step {tourStepIndex !== null ? tourStepIndex + 1 : 0} of {timelineEntries.length}
                </p>
                <p className="mt-2 text-sm font-light" style={{ color: "#f0f0f0" }}>
                  {activeTourEntry ? activeTourEntry.companyName : "Preparing tour..."}
                </p>
                <p className="mt-0.5 text-xs font-light" style={{ color: "rgba(255,255,255,0.72)" }}>
                  {activeTourEntry ? activeTourEntry.project.title : ""}
                </p>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="h-1.5 w-40 overflow-hidden" style={{ background: "rgba(255,255,255,0.08)", borderRadius: "999px" }}>
                  <div
                    className="h-full"
                    style={{
                      width: `${timelineEntries.length ? (((tourStepIndex ?? -1) + 1) / timelineEntries.length) * 100 : 0}%`,
                      background: "linear-gradient(90deg, rgba(250,204,21,0.45), rgba(250,204,21,0.9))",
                      transition: "width 350ms ease",
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    tourSessionRef.current += 1;
                    tourTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
                    tourTimersRef.current = [];
                    setIsTourActive(false);
                    setTourStepIndex(null);
                    handlersRef.current.onFocusProject(null);
                    handlersRef.current.onFocusParentGroup(null);
                    setHoveredProjectId(null);
                    onSortModeChange("company");
                  }}
                  className="px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-light transition hover:opacity-80"
                  style={{
                    color: "var(--label)",
                    border: "1px solid var(--border)",
                    borderRadius: "2px",
                  }}
                >
                  Close Tour
                </button>
              </div>
            </div>
          ) : null}
          <div
            aria-hidden
            className="absolute bottom-0 left-2.5 top-0 sm:left-4"
            style={{ width: "1px", background: "var(--border)" }}
          />
          <ol className="space-y-4">
            {timelineEntries.map((entry) => {
              const isActive = selectedProjectId === entry.project.id;
              const isHovered = hoveredProjectId === entry.id;
              const isPressed = pressedProjectId === entry.id;
              const isInnovation = entry.project.type === "innovation";
              const connectionCount = connectionCounts?.[entry.project.id] ?? 0;

              return (
                <li key={entry.id} className="relative">
                  <span
                    aria-hidden
                    className="absolute -left-[29px] top-5 h-3 w-3 sm:-left-9"
                    style={{
                      background: isActive || isHovered ? entry.project.theme.accent : "rgba(255,255,255,0.2)",
                      borderRadius: "999px",
                      boxShadow: isActive || isHovered ? `0 0 18px ${entry.project.theme.accent}66` : "none",
                    }}
                  />

                  <button
                    type="button"
                    data-timeline-stop="true"
                    data-timeline-entry-id={entry.id}
                    onClick={() => onSelectProject(entry.project)}
                    onMouseDown={() => setPressedProjectId(entry.id)}
                    onMouseUp={() => setPressedProjectId(null)}
                    onFocus={() => {
                      onFocusProject(entry.project);
                      onFocusParentGroup({
                        id: entry.companyId,
                        label: entry.companyName,
                        media: entry.companyFocusMedia,
                      });
                      setHoveredProjectId(entry.id);
                    }}
                    onMouseEnter={() => {
                      onFocusProject(entry.project);
                      onFocusParentGroup({
                        id: entry.companyId,
                        label: entry.companyName,
                        media: entry.companyFocusMedia,
                      });
                      setHoveredProjectId(entry.id);
                    }}
                    onBlur={() => {
                      onFocusProject(null);
                      onFocusParentGroup(null);
                      setHoveredProjectId(null);
                      setPressedProjectId(null);
                    }}
                    onMouseLeave={() => {
                      onFocusProject(null);
                      onFocusParentGroup(null);
                      setHoveredProjectId(null);
                      setPressedProjectId(null);
                    }}
                    className="w-full cursor-pointer text-left transition"
                    style={{
                      background: isActive || isHovered || isPressed ? "rgba(255,255,255,0.06)" : "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "2px",
                      boxShadow:
                        isActive
                          ? `inset 0 0 0 1px ${entry.project.theme.accent}88`
                          : isHovered || isPressed
                            ? `inset 0 0 0 1px ${entry.project.theme.accent}44`
                            : "none",
                    }}
                  >
                    <div className="px-6 pb-6 pt-5">
                      <p
                        className="text-[10px] uppercase tracking-[0.2em] font-light"
                        style={{ color: "var(--label)" }}
                      >
                        {entry.order}. {entry.companyPeriod} · {entry.companyName}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        {entry.project.type === "innovation" && (
                          <div className="shrink-0 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: innovationAccent }} title={entry.project.sourceContext || "Innovation"} />
                        )}
                        <h3 className="text-sm font-light" style={{ color: isActive ? "#f0f0f0" : "#d4d4d8" }}>
                        {entry.project.title}
                      </h3>
                      </div>
                      {entry.project.dateRange ? (
                        <p className="mt-1 text-[11px] font-light" style={{ color: "rgba(255,255,255,0.62)" }}>
                          {entry.project.dateRange}
                        </p>
                      ) : null}
                        <p className="mt-1 text-[11px] font-light" style={{ color: "rgba(255,255,255,0.58)" }}>
                        {entry.companyRole}
                      </p>
                      <p
                        className="mt-3 text-xs font-light leading-5"
                          style={{ color: "rgba(255,255,255,0.66)" }}
                      >
                        {entry.project.summary}
                      </p>

                      {(entry.project.credits ?? []).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
                          {(entry.project.credits ?? []).map((credit) => (
                            <span key={credit.id} className="flex items-center gap-1.5">
                              {credit.logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={credit.logoUrl} alt="" className="h-3.5 w-3.5 rounded-sm object-contain opacity-60" />
                              ) : null}
                              <span className="text-[10px] font-light uppercase tracking-[0.14em]" style={{ color: "rgba(255,255,255,0.62)" }}>
                                {credit.role ? `${credit.role}: ` : ""}
                              </span>
                              {credit.href ? (
                                <a href={credit.href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] font-light" style={{ color: "rgba(255,255,255,0.78)", textDecorationLine: "underline", textUnderlineOffset: "2px" }}>
                                  {credit.name}
                                </a>
                              ) : (
                                <span className="text-[10px] font-light" style={{ color: "rgba(255,255,255,0.78)" }}>{credit.name}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}

                      {connectionCount > 0 ? (
                        <p className="mt-3 text-[10px] uppercase tracking-[0.18em] font-light" style={{ color: entry.project.theme.accent }}>
                          Connected to {connectionCount} other resume {connectionCount === 1 ? "path" : "paths"}
                        </p>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-1.5">
                        <span
                          className="px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] font-light"
                          style={{
                            color: isActive ? entry.project.theme.accent : "var(--label)",
                            border: `1px solid ${isActive ? entry.project.theme.accent + "55" : "var(--border)"}`,
                            borderRadius: "1px",
                          }}
                        >
                          {entry.project.activationType}
                        </span>
                        {entry.project.roleTypes.map((roleType) => (
                          <span
                            key={`${entry.id}-${roleType}`}
                            className="px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] font-light"
                            style={{
                              color: "var(--label)",
                              border: "1px solid var(--border)",
                              borderRadius: "1px",
                            }}
                          >
                            {roleType}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <article
              key={group.id}
              tabIndex={0}
              onMouseEnter={() =>
                onFocusParentGroup({
                  id: group.id,
                  label: group.title,
                  media: group.focusMedia,
                })
              }
              onMouseLeave={() => onFocusParentGroup(null)}
              onFocus={() =>
                onFocusParentGroup({
                  id: group.id,
                  label: group.title,
                  media: group.focusMedia,
                })
              }
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  onFocusParentGroup(null);
                }
              }}
              className="glass outline-none transition"
              style={{ borderRadius: "2px" }}
            >
              <header
                className="px-7 py-6"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                {(() => {
                  const groupProjectToOpen = getFirstProjectWithAssets(group.projects);
                  const canOpenGroupMedia = Boolean(groupProjectToOpen);

                  return (
                    <button
                      type="button"
                      disabled={!canOpenGroupMedia}
                      onClick={() => {
                        if (groupProjectToOpen) {
                          onSelectProject(groupProjectToOpen);
                        }
                      }}
                      className="w-full text-left"
                      style={{ cursor: canOpenGroupMedia ? "pointer" : "default" }}
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                        <h3
                          className="text-base font-light tracking-tight"
                          style={{ color: "#f0f0f0" }}
                        >
                          {group.title}
                        </h3>
                        <p
                          className="text-[11px] uppercase tracking-[0.18em] font-light"
                          style={{ color: "var(--label)" }}
                        >
                          {group.subtitle}
                        </p>
                      </div>
                      {group.description ? (
                        <p
                          className="mt-2.5 text-sm font-light leading-6"
                          style={{ color: "rgba(255,255,255,0.66)" }}
                        >
                          {group.description}
                        </p>
                      ) : null}
                    </button>
                  );
                })()}
              </header>

              {(() => {
                const renderProjectTile = (
                  project: Project,
                  contextLabel: string | undefined,
                  keyPrefix: string,
                  stretchToFill = false,
                ) => {
                  const isActive = selectedProjectId === project.id;
                  const projectInteractionId = `${group.id}::${project.id}`;
                  const isHovered = hoveredProjectId === projectInteractionId;
                  const isPressed = pressedProjectId === projectInteractionId;
                  const isInnovation = project.type === "innovation";
                  const connectionCount = connectionCounts?.[project.id] ?? 0;

                  return (
                    <li key={`${keyPrefix}-${project.id}`} className={stretchToFill ? "flex-1" : undefined}>
                      <button
                        type="button"
                        onClick={() => onSelectProject(project)}
                        onMouseDown={() => setPressedProjectId(projectInteractionId)}
                        onMouseUp={() => setPressedProjectId(null)}
                        onFocus={() => { onFocusProject(project); setHoveredProjectId(projectInteractionId); }}
                        onMouseEnter={() => { onFocusProject(project); setHoveredProjectId(projectInteractionId); }}
                        onBlur={() => { onFocusProject(null); setHoveredProjectId(null); setPressedProjectId(null); }}
                        onMouseLeave={() => { onFocusProject(null); setHoveredProjectId(null); setPressedProjectId(null); }}
                        className={`relative flex w-full cursor-pointer flex-col overflow-hidden p-6 text-left transition ${stretchToFill ? "h-full" : ""}`}
                        style={{
                          background:
                            isActive || isHovered || isPressed
                              ? "rgba(255,255,255,0.06)"
                              : "var(--background)",
                          boxShadow:
                            isActive
                              ? `inset 0 0 0 1px ${project.theme.accent}88`
                              : isHovered || isPressed
                                ? `inset 0 0 0 1px ${project.theme.accent}44`
                                : "none",
                        }}
                      >
                        <div className="relative z-[1] flex h-full flex-col">
                        {contextLabel ? (
                          <p
                            className="mb-2 text-[10px] uppercase tracking-[0.2em] font-light"
                            style={{ color: "var(--label)" }}
                          >
                            {contextLabel}
                          </p>
                        ) : null}
                        <div className="flex items-center gap-2">
                          {project.type === "innovation" && (
                            <div className="shrink-0 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: innovationAccent }} title={project.sourceContext || "Innovation"} />
                          )}
                          <h4
                            className="text-sm font-light"
                            style={{ color: isActive ? "#f0f0f0" : "#d4d4d8" }}
                          >
                            {project.title}
                          </h4>
                        </div>
                        {project.dateRange ? (
                          <p className="mt-1 text-[11px] font-light" style={{ color: "rgba(255,255,255,0.62)" }}>
                            {project.dateRange}
                          </p>
                        ) : null}
                        <p
                          className="mt-2.5 text-xs font-light leading-5"
                          style={{ color: "rgba(255,255,255,0.66)" }}
                        >
                          {project.summary}
                        </p>

                        {(project.credits ?? []).length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
                            {(project.credits ?? []).map((credit) => (
                              <span key={credit.id} className="flex items-center gap-1.5">
                                {credit.logoUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={credit.logoUrl} alt="" className="h-3.5 w-3.5 rounded-sm object-contain opacity-60" />
                                ) : null}
                                <span className="text-[10px] font-light uppercase tracking-[0.14em]" style={{ color: "rgba(255,255,255,0.62)" }}>
                                  {credit.role ? `${credit.role}: ` : ""}
                                </span>
                                {credit.href ? (
                                  <a href={credit.href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] font-light" style={{ color: "rgba(255,255,255,0.78)", textDecorationLine: "underline", textUnderlineOffset: "2px" }}>
                                    {credit.name}
                                  </a>
                                ) : (
                                  <span className="text-[10px] font-light" style={{ color: "rgba(255,255,255,0.78)" }}>{credit.name}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}

                        {connectionCount > 0 ? (
                          <p className="mt-3 text-[10px] uppercase tracking-[0.18em] font-light" style={{ color: project.theme.accent }}>
                            Connected to {connectionCount} other resume {connectionCount === 1 ? "path" : "paths"}
                          </p>
                        ) : null}

                        <div className="mt-auto pt-4 flex flex-wrap gap-1.5">
                          <span
                            className="px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] font-light"
                            style={{
                              color: isActive ? project.theme.accent : "var(--label)",
                              border: `1px solid ${isActive ? project.theme.accent + "55" : "var(--border)"}`,
                              borderRadius: "1px",
                            }}
                          >
                            {project.activationType}
                          </span>
                          {project.roleTypes.map((roleType) => (
                            <span
                              key={`${project.id}-${roleType}`}
                              className="px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] font-light"
                              style={{
                                color: "var(--label)",
                                border: "1px solid var(--border)",
                                borderRadius: "1px",
                              }}
                            >
                              {roleType}
                            </span>
                          ))}
                        </div>
                        </div>
                      </button>
                    </li>
                  );
                };

                const renderProjectGrid = (
                  projects: Array<{ project: Project; contextLabel: string | undefined }>,
                  keyPrefix: string,
                ) => {
                  const leftColumnProjects = projects.filter((_, index) => index % 2 === 0);
                  const rightColumnProjects = projects.filter((_, index) => index % 2 === 1);

                  return (
                    <>
                      <ul className="space-y-px p-px md:hidden" style={{ background: "var(--border)" }}>
                        {projects.map(({ project, contextLabel }) => renderProjectTile(project, contextLabel, `${keyPrefix}-mobile`))}
                      </ul>

                      <div className="hidden grid-cols-2 gap-px p-px md:grid" style={{ background: "var(--border)" }}>
                        <ul className="flex flex-col gap-px">
                          {leftColumnProjects.map(({ project, contextLabel }, index) => {
                            const isLastLeftColumnCard = index === leftColumnProjects.length - 1;
                            return renderProjectTile(project, contextLabel, `${keyPrefix}-left`, isLastLeftColumnCard);
                          })}
                        </ul>
                        <ul className="flex flex-col gap-px">
                          {rightColumnProjects.map(({ project, contextLabel }, index) => {
                            const isLastRightColumnCard = index === rightColumnProjects.length - 1;
                            return renderProjectTile(project, contextLabel, `${keyPrefix}-right`, isLastRightColumnCard);
                          })}
                        </ul>
                      </div>
                    </>
                  );
                };

                const subgroupById = new Map<
                  string,
                  {
                    id: string;
                    title: string;
                    dateRange?: string;
                    summary?: string;
                    projects: Array<{ project: Project; contextLabel: string | undefined }>;
                  }
                >();
                const innovationProjects = group.projects.filter((entry) => entry.project.type === "innovation");
                const standardProjects = group.projects.filter((entry) => entry.project.type !== "innovation");
                const ungroupedProjects: Array<{ project: Project; contextLabel: string | undefined }> = [];
                const shouldUseNestedProjectGroups = sortMode === "company";

                if (shouldUseNestedProjectGroups) {
                  (group.groupContainers ?? []).forEach((container) => {
                    const groupKey = container.id?.trim() || `title:${container.title.toLowerCase()}`;
                    if (!groupKey || subgroupById.has(groupKey)) {
                      return;
                    }

                    subgroupById.set(groupKey, {
                      id: groupKey,
                      title: container.title || "Subsection",
                      dateRange: container.dateRange,
                      summary: container.summary,
                      projects: [],
                    });
                  });

                  standardProjects.forEach((entry) => {
                    const subgroupId = entry.project.parentGroupId?.trim();
                    const subgroupTitle = entry.project.parentGroupTitle?.trim();
                    const groupKey = subgroupId || (subgroupTitle ? `title:${subgroupTitle.toLowerCase()}` : "");

                    if (!groupKey) {
                      ungroupedProjects.push(entry);
                      return;
                    }

                    if (!subgroupById.has(groupKey)) {
                      subgroupById.set(groupKey, {
                        id: groupKey,
                        title: subgroupTitle || "Subsection",
                        dateRange: entry.project.parentGroupDateRange,
                        summary: entry.project.parentGroupSummary,
                        projects: [],
                      });
                    }

                    subgroupById.get(groupKey)?.projects.push(entry);
                  });
                } else {
                  ungroupedProjects.push(...standardProjects);
                }

                const subgroups = Array.from(subgroupById.values()).sort((left, right) => {
                  const leftSortDate = left.dateRange || left.projects[0]?.project.dateRange;
                  const rightSortDate = right.dateRange || right.projects[0]?.project.dateRange;
                  return compareByDateWindowDesc(leftSortDate, rightSortDate);
                });
                const hasNestedProjectGroups = subgroups.length > 0;
                const hasWorkRows = standardProjects.length > 0 || ungroupedProjects.length > 0 || subgroups.length > 0;
                const showSelectWorksBar =
                  sortMode === "company"
                    ? Boolean(group.itemsSubtitle && (ungroupedProjects.length > 0 || subgroups.length > 0))
                    : hasWorkRows;

                return (
                  <>
                    {innovationProjects.length ? (
                      <section>
                        <div className="px-7 py-3" style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                          <p className="text-[10px] uppercase tracking-[0.22em] font-light" style={{ color: "var(--label)" }}>
                            Innovation
                          </p>
                        </div>
                        {renderProjectGrid(innovationProjects, `${group.id}-innovation`)}
                      </section>
                    ) : null}

                    {showSelectWorksBar ? (
                      <div className="px-7 py-3" style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                        <p className="text-[10px] uppercase tracking-[0.22em] font-light" style={{ color: "var(--label)" }}>
                          {group.itemsSubtitle?.trim() || "Select works"}
                        </p>
                      </div>
                    ) : null}

                    {!hasNestedProjectGroups && standardProjects.length > 0 ? renderProjectGrid(standardProjects, group.id) : null}

                    {hasNestedProjectGroups ? (
                      <div style={{ borderTop: "1px solid var(--border)" }}>
                        {ungroupedProjects.length ? (
                          <section>
                            {renderProjectGrid(ungroupedProjects, `${group.id}-ungrouped`)}
                          </section>
                        ) : null}

                        {subgroups.map((subgroup) => (
                          <section key={`${group.id}-${subgroup.id}`} style={{ borderTop: "1px solid var(--border)" }}>
                            <header className="px-7 py-4" style={{ background: "rgba(255,255,255,0.02)" }}>
                              {(() => {
                                const subgroupProjectToOpen = getFirstProjectWithAssets(subgroup.projects);
                                const canOpenSubgroupMedia = Boolean(subgroupProjectToOpen);

                                return (
                                  <button
                                    type="button"
                                    disabled={!canOpenSubgroupMedia}
                                    onClick={() => {
                                      if (subgroupProjectToOpen) {
                                        onSelectProject(subgroupProjectToOpen);
                                      }
                                    }}
                                    className="w-full text-left"
                                    style={{ cursor: canOpenSubgroupMedia ? "pointer" : "default" }}
                                  >
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                                      <h4 className="text-xs uppercase tracking-[0.18em] font-light" style={{ color: "#e8e8e8" }}>
                                        {subgroup.title}
                                      </h4>
                                      {subgroup.dateRange ? (
                                        <p className="text-[10px] uppercase tracking-[0.18em] font-light" style={{ color: "var(--label)" }}>
                                          {subgroup.dateRange}
                                        </p>
                                      ) : null}
                                    </div>
                                    {subgroup.summary ? (
                                      <p className="mt-1.5 text-xs font-light leading-5" style={{ color: "rgba(255,255,255,0.64)" }}>
                                        {subgroup.summary}
                                      </p>
                                    ) : null}
                                  </button>
                                );
                              })()}
                            </header>
                            <div className="px-7 py-3" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                              <p className="text-[10px] uppercase tracking-[0.22em] font-light" style={{ color: "var(--label)" }}>
                                Select works
                              </p>
                            </div>
                            {renderProjectGrid(subgroup.projects, `${group.id}-${subgroup.id}`)}
                          </section>
                        ))}
                      </div>
                    ) : null}

                    {group.metadataItems?.length ? (
                      <details open className="group px-7 py-4" style={{ borderTop: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                        <summary className="cursor-pointer list-none">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.22em] font-light" style={{ color: "var(--label)" }}>
                                Credits
                              </p>
                              <p className="mt-1 text-[11px] font-light" style={{ color: "rgba(255,255,255,0.7)" }}>
                                Additional work completed during this section.
                              </p>
                            </div>
                            <svg
                              aria-hidden
                              xmlns="http://www.w3.org/2000/svg"
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 transition-transform duration-150 group-open:rotate-90"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ color: "var(--label)" }}
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </div>
                        </summary>
                        <ul className="mt-3 space-y-1.5">
                          {group.metadataItems.map((line, index) => (
                            <li key={`${group.id}-meta-${index}`} className="text-xs font-light leading-5" style={{ color: "rgba(255,255,255,0.62)" }}>
                              {line}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </>
                );
              })()}
            </article>
          ))}
        </div>
      )}

      {/* Education footer — shown at bottom of every non-education, non-timeline tab */}
      {!isTimelineMode && !isEducationMode && hasEducation ? (
        <div className="mx-auto mt-12 w-full max-w-6xl px-4 pb-4 sm:px-8 md:px-12">
          <div className="mb-5 flex items-center gap-4">
            <div className="h-px flex-1" style={{ background: "var(--border)" }} />
            <p className="text-[10px] uppercase tracking-[0.32em] font-light" style={{ color: "var(--label)" }}>
              Education
            </p>
            <div className="h-px flex-1" style={{ background: "var(--border)" }} />
          </div>
          <div className="space-y-5">
            {educationGroups.map((group) => (
              <article
                key={group.id}
                tabIndex={0}
                onMouseEnter={() => onFocusParentGroup({ id: group.id, label: group.title, media: group.focusMedia })}
                onMouseLeave={() => onFocusParentGroup(null)}
                onFocus={() => onFocusParentGroup({ id: group.id, label: group.title, media: group.focusMedia })}
                onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { onFocusParentGroup(null); } }}
                className="glass outline-none transition"
                style={{ borderRadius: "2px" }}
              >
                <header className="px-7 py-6" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                    <h3 className="text-base font-light tracking-tight" style={{ color: "#f0f0f0" }}>{group.title}</h3>
                    <p className="text-[11px] uppercase tracking-[0.18em] font-light" style={{ color: "var(--label)" }}>{group.subtitle}</p>
                  </div>
                  {group.description ? (
                    <p className="mt-2.5 text-sm font-light leading-6" style={{ color: "rgba(255,255,255,0.66)" }}>{group.description}</p>
                  ) : null}
                </header>
                {group.metadataItems?.length ? (
                  <ul className="px-7 py-4 space-y-1.5">
                    {group.metadataItems.map((line, index) => (
                      <li key={`${group.id}-edu-meta-${index}`} className="text-xs font-light leading-5" style={{ color: "rgba(255,255,255,0.62)" }}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
