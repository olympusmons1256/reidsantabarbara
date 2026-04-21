import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ActivationType,
  CompanyExperience,
  ParentGroupFocusTarget,
  Project,
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
  sortLabels,
  timelineTourEntryIds,
  timelineTourDurations,
  connectionCounts,
}: ExperienceCardsProps) {
  const isTimelineMode = sortMode === "timeline";
  const sectionRef = useRef<HTMLElement | null>(null);

  const flattenedProjects = useMemo(
    () =>
      experiences.flatMap((company) =>
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

  const groups =
    isTimelineMode
      ? []
      : sortMode === "company"
      ? experiences.map((company) => ({
          id: company.id,
          title: company.company,
          subtitle: `${company.role} · ${company.period}`,
          description: company.description,
          focusMedia: company.focusMedia,
          projects: company.projects.map((project) => ({
            project,
            contextLabel: undefined,
          })),
        }))
      : sortMode === "activation"
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
            focusMedia: activationFocusMedia[activationType as keyof typeof activationFocusMedia],
            projects: items.map((item) => ({
              project: item.project,
              contextLabel: `${item.companyName} · ${item.companyPeriod}`,
            })),
          }))
        : Array.from(
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
            focusMedia: roleFocusMedia[roleType as keyof typeof roleFocusMedia],
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
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState<number | null>(null);
  const tourTimersRef = useRef<number[]>([]);
  const tourSessionRef = useRef(0);
  const handlersRef = useRef({ onSelectProject, onFocusProject, onFocusParentGroup });

  useEffect(() => {
    handlersRef.current = { onSelectProject, onFocusProject, onFocusParentGroup };
  }, [onSelectProject, onFocusProject, onFocusParentGroup]);

  const activeTourEntry = tourStepIndex !== null ? timelineEntries[tourStepIndex] : null;

  const sortOptions: Array<{ label: string; value: ProjectSortMode }> = [
    { label: "Company", value: "company" },
    { label: sortLabels?.activation ?? "Activation Type", value: "activation" },
    { label: sortLabels?.role ?? "Role Type", value: "role" },
  ];

  const experienceHeadingByMode: Record<ProjectSortMode, string> = {
    company: "By Company",
    activation: `By ${sortLabels?.activation ?? "Activation Type"}`,
    role: `By ${sortLabels?.role ?? "Role"}`,
    timeline: "Project Timeline",
  };

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
    const orderedStops = (timelineTourEntryIds ?? [])
      .map((entryId) => stopByEntryId.get(entryId))
      .filter((stop): stop is HTMLElement => Boolean(stop));
    const effectiveStops = orderedStops.length ? orderedStops : stops;

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
      const duration = (entryId && timelineTourDurations?.[entryId]) || 1900;
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
    <section ref={sectionRef} className="mx-auto mt-10 w-full max-w-6xl px-8 pb-16 sm:mt-12 sm:px-12">
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
            {experienceHeadingByMode[sortMode]}
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
                className="px-4 py-2 text-[11px] uppercase tracking-[0.18em] font-light transition"
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
                <p className="mt-0.5 text-xs font-light" style={{ color: "rgba(255,255,255,0.45)" }}>
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
                    }}
                    onMouseLeave={() => {
                      onFocusProject(null);
                      onFocusParentGroup(null);
                      setHoveredProjectId(null);
                    }}
                    className="w-full text-left transition"
                    style={{
                      background: isActive || isHovered ? "rgba(255,255,255,0.06)" : "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "2px",
                      boxShadow:
                        isActive
                          ? `inset 0 0 0 1px ${entry.project.theme.accent}88`
                          : isHovered
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
                      <h3 className="mt-2 text-sm font-light" style={{ color: isActive ? "#f0f0f0" : "#d4d4d8" }}>
                        {entry.project.title}
                      </h3>
                      <p className="mt-1 text-[11px] font-light" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {entry.companyRole}
                      </p>
                      <p
                        className="mt-3 text-xs font-light leading-5"
                        style={{ color: "rgba(255,255,255,0.35)" }}
                      >
                        {entry.project.summary}
                      </p>

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
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <h3
                    className="text-base font-light tracking-tight"
                    style={{ color: "#e8e8e8" }}
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
                    style={{ color: "rgba(255,255,255,0.38)" }}
                  >
                    {group.description}
                  </p>
                ) : null}
              </header>

              <ul className="grid gap-px p-px md:grid-cols-2" style={{ background: "var(--border)" }}>
                {group.projects.map(({ project, contextLabel }) => {
                  const isActive = selectedProjectId === project.id;
                  const connectionCount = connectionCounts?.[project.id] ?? 0;

                  return (
                    <li key={project.id}>
                      <button
                        type="button"
                        onClick={() => onSelectProject(project)}
                        onFocus={() => { onFocusProject(project); setHoveredProjectId(`${group.id}::${project.id}`); }}
                        onMouseEnter={() => { onFocusProject(project); setHoveredProjectId(`${group.id}::${project.id}`); }}
                        onBlur={() => { onFocusProject(null); setHoveredProjectId(null); }}
                        onMouseLeave={() => { onFocusProject(null); setHoveredProjectId(null); }}
                        className="w-full p-6 text-left transition"
                        style={{
                          background:
                            isActive || hoveredProjectId === `${group.id}::${project.id}`
                              ? "rgba(255,255,255,0.06)"
                              : "var(--background)",
                          boxShadow:
                            isActive
                              ? `inset 0 0 0 1px ${project.theme.accent}88`
                              : hoveredProjectId === `${group.id}::${project.id}`
                                ? `inset 0 0 0 1px ${project.theme.accent}44`
                                : "none",
                        }}
                      >
                        {contextLabel ? (
                          <p
                            className="mb-2 text-[10px] uppercase tracking-[0.2em] font-light"
                            style={{ color: "var(--label)" }}
                          >
                            {contextLabel}
                          </p>
                        ) : null}
                        <h4
                          className="text-sm font-light"
                          style={{ color: isActive ? "#f0f0f0" : "#d4d4d8" }}
                        >
                          {project.title}
                        </h4>
                        <p
                          className="mt-2.5 text-xs font-light leading-5"
                          style={{ color: "rgba(255,255,255,0.35)" }}
                        >
                          {project.summary}
                        </p>

                        {connectionCount > 0 ? (
                          <p className="mt-3 text-[10px] uppercase tracking-[0.18em] font-light" style={{ color: project.theme.accent }}>
                            Connected to {connectionCount} other resume {connectionCount === 1 ? "path" : "paths"}
                          </p>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-1.5">
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
                      </button>
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
