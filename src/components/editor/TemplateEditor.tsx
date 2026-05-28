"use client";

import { useEffect, useMemo, useRef, useState, type FocusEvent, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { blankTemplate } from "@/data/blankTemplate";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { deleteTemplate as deleteStoredTemplate, getTemplateById, listTemplates, saveTemplate, setTemplatePublishState, uploadHeroImage, uploadSourceDocument, uploadTemplateAsset, uploadBannerVideo } from "@/lib/supabase/templateStore";
import { normalizeTemplate } from "@/lib/template/transformTemplate";
import { TEMPLATE_PROFILE_SCOPE_FIELDS } from "@/types/template";
import type {
  ResumeTemplate,
  StoredTemplateRecord,
  TemplateAsset,
  TemplateCredit,
  TemplateGalleryEntryAsset,
  TemplateConnection,
  TemplateItem,
  TemplateProfileScopeField,
  TemplateSection,
  TemplateTourStep,
  TemplateVariant,
} from "@/types/template";

const LOCAL_TEMPLATE_KEY = "resume-template-draft";
const LOCAL_INTAKE_KEY = "resume-intake-draft";
const LOCAL_LAST_TEMPLATE_ID_KEY = "resume-last-template-id";
const LOCAL_EDITOR_COLLAPSE_KEY = "resume-editor-collapse-v1";

const PROFILE_SCOPE_OPTIONS: Array<{ field: TemplateProfileScopeField; label: string }> = [
  { field: "name", label: "Name" },
  { field: "title", label: "Title" },
  { field: "location", label: "Location" },
  { field: "email", label: "Email" },
  { field: "summary", label: "Summary" },
  { field: "heroImage", label: "Hero image" },
  { field: "heroImageFilter", label: "Hero image filter" },
  { field: "bannerBackgroundVideo", label: "Banner video" },
  { field: "bannerBackgroundImage", label: "Banner image" },
  { field: "links", label: "Links" },
];

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function toDimensionId(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseTagInput(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,\n]/)
        .map((token) => token.trim())
        .filter(Boolean)
    )
  );
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function clampZoom(value: number): number {
  return Math.min(200, Math.max(100, value));
}

function parseDateForSort(dateStr?: string): number {
  if (!dateStr) return -Infinity;
  const cleanStr = dateStr.toLowerCase().replace("present", "2099");
  const yearMatch = cleanStr.match(/\b(20\d{2}|19\d{2})\b/);
  return yearMatch ? parseInt(yearMatch[1], 10) : -Infinity;
}

function sortSectionsByDateDesc(sections: TemplateSection[]): TemplateSection[] {
  return [...sections].sort((a, b) => {
    const aEnd = parseDateForSort(a.dateRange?.split("-").pop()?.trim());
    const bEnd = parseDateForSort(b.dateRange?.split("-").pop()?.trim());
    return bEnd - aEnd;
  });
}

function inferUploadedAssetType(file: File): Exclude<TemplateAsset["type"], "gallery"> {
  const mimeType = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (mimeType === "application/pdf" || name.endsWith(".pdf")) {
    return "doc";
  }

  if (mimeType.startsWith("video/")) {
    return "video";
  }

  return "image";
}

function inferAssetTypeFromUrl(rawUrl: string): Exclude<TemplateAsset["type"], "gallery"> {
  const url = rawUrl.toLowerCase();

  if (url.endsWith(".pdf") || url.includes("application/pdf")) {
    return "doc";
  }

  if (
    url.endsWith(".mp4") ||
    url.endsWith(".webm") ||
    url.endsWith(".mov") ||
    url.endsWith(".m4v") ||
    url.includes("youtube.com") ||
    url.includes("youtu.be") ||
    url.includes("vimeo.com")
  ) {
    return "video";
  }

  if (
    url.includes("matterport.com") ||
    url.includes("my.matterport.com") ||
    url.includes("/show/")
  ) {
    return "iframe";
  }

  return "image";
}

function getAssetLabelFromUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return "Asset";
  }

  try {
    const parsed = new URL(trimmed);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const filename = segments[segments.length - 1];
    return filename ? decodeURIComponent(filename) : parsed.hostname;
  } catch {
    const segments = trimmed.split("/").filter(Boolean);
    return segments[segments.length - 1] || trimmed;
  }
}

function getTemplateAssetPreviewSource(asset: { url: string; preview?: string }): string {
  return (asset.preview ?? asset.url ?? "").trim();
}

function getGalleryEditorKey(sectionId: string, itemId: string, assetId: string): string {
  return `${sectionId}::${itemId}::${assetId}`;
}

function createGalleryEntryAsset(type: TemplateGalleryEntryAsset["type"] = "image"): TemplateGalleryEntryAsset {
  return {
    id: uid("gallery-asset"),
    label: "Gallery Asset",
    description: "",
    type,
    subType: "supporting",
    url: "",
    preview: "",
    aspectRatio: "16/9",
    fit: "cover",
    focusX: 50,
    focusY: 50,
    zoom: 100,
  };
}

function getGalleryCoverAsset(asset: Pick<TemplateAsset, "coverAssetId" | "assets">): TemplateGalleryEntryAsset | undefined {
  const children = asset.assets ?? [];
  return (
    (asset.coverAssetId ? children.find((entry) => entry.id === asset.coverAssetId) : undefined) ??
    children.find((entry) => entry.subType === "cover") ??
    children[0]
  );
}

function createTemplateAsset(type: TemplateAsset["type"] = "image"): TemplateAsset {
  if (type === "gallery") {
    return {
      id: uid("asset"),
      label: "New Gallery",
      description: "",
      type: "gallery",
      subType: "supporting",
      url: "",
      preview: "",
      aspectRatio: "16/9",
      fit: "cover",
      focusX: 50,
      focusY: 50,
      zoom: 100,
      galleryLayout: "masonry",
      coverAssetId: undefined,
      assets: [],
    };
  }

  return {
    id: uid("asset"),
    label: "New Asset",
    description: "",
    type,
    subType: "supporting",
    url: "",
    preview: "",
    aspectRatio: "16/9",
    fit: "cover",
    focusX: 50,
    focusY: 50,
    zoom: 100,
  };
}

function convertTemplateAssetType(asset: TemplateAsset, nextType: TemplateAsset["type"]): TemplateAsset {
  if (nextType === asset.type) {
    return asset;
  }

  if (nextType === "gallery") {
    const firstGalleryEntry = asset.type === "gallery"
      ? undefined
      : {
          id: uid("gallery-asset"),
          label: asset.label || "Gallery Asset 1",
          description: asset.description || "",
          type: asset.type === "video" || asset.type === "doc" || asset.type === "iframe" ? asset.type : "image",
          subType: "cover" as const,
          url: asset.url,
          preview: asset.preview,
          aspectRatio: asset.aspectRatio,
          fit: asset.fit,
          focusX: asset.focusX,
          focusY: asset.focusY,
          zoom: asset.zoom,
        } satisfies TemplateGalleryEntryAsset;

    const galleryAssets = asset.type === "gallery" ? asset.assets ?? [] : firstGalleryEntry ? [firstGalleryEntry] : [];

    return {
      ...asset,
      type: "gallery",
      label: asset.type === "gallery" ? asset.label : asset.label || "Gallery",
      url: "",
      preview: "",
      galleryLayout: asset.galleryLayout ?? "masonry",
      coverAssetId: getGalleryCoverAsset({ coverAssetId: asset.coverAssetId, assets: galleryAssets })?.id,
      assets: galleryAssets,
    };
  }

  const representativeAsset = asset.type === "gallery" ? getGalleryCoverAsset(asset) : undefined;

  return {
    ...asset,
    type: nextType,
    url: representativeAsset?.url ?? asset.url,
    preview: representativeAsset?.preview ?? asset.preview,
    aspectRatio: representativeAsset?.aspectRatio ?? asset.aspectRatio,
    fit: representativeAsset?.fit ?? asset.fit,
    focusX: representativeAsset?.focusX ?? asset.focusX,
    focusY: representativeAsset?.focusY ?? asset.focusY,
    zoom: representativeAsset?.zoom ?? asset.zoom,
    galleryLayout: undefined,
    coverAssetId: undefined,
    assets: undefined,
  };
}

type IntakeDocument = {
  name: string;
  content: string;
  url?: string;
};

type SourceDiagnostics = {
  totalSources: number;
  successfulSources: number;
  usableSources: number;
  details: Array<{ url: string; status: "ok" | "failed"; contentLength: number; note?: string }>;
};

type EditorFieldContext = {
  path: string;
  label: string;
  value: string;
};

type EditorChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  fieldUpdates?: Array<{ path: string; label: string; value: string }>;
  applied?: boolean;
};

type ReusableUploadedAsset = {
  key: string;
  label: string;
  type: Exclude<TemplateAsset["type"], "gallery">;
  url: string;
  preview?: string;
};

export function TemplateEditor() {
  const [template, setTemplate] = useState<ResumeTemplate>(blankTemplate);
  const [activeVariantId, setActiveVariantId] = useState(blankTemplate.defaultVariantId ?? blankTemplate.variants[0]?.id ?? "");
  const [status, setStatus] = useState("Idle");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<StoredTemplateRecord[]>([]);
  const [templateTitleEdits, setTemplateTitleEdits] = useState<Record<string, string>>({});
  const [hasAttemptedTemplateLoad, setHasAttemptedTemplateLoad] = useState(false);
  const [openVariantByTemplateId, setOpenVariantByTemplateId] = useState<Record<string, string>>({});

  const [intakeLinkedIn, setIntakeLinkedIn] = useState("");
  const [intakeWebSources, setIntakeWebSources] = useState("");
  const [intakeResumeText, setIntakeResumeText] = useState("");
  const [intakeAdditionalContext, setIntakeAdditionalContext] = useState("");
  const [intakeDocuments, setIntakeDocuments] = useState<IntakeDocument[]>([]);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [suggestingItemKey, setSuggestingItemKey] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<EditorFieldContext | null>(null);
  const [selectedFields, setSelectedFields] = useState<EditorFieldContext[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<EditorChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatDeepSearch, setChatDeepSearch] = useState(true);
  const [lastGeneratedSummary, setLastGeneratedSummary] = useState<{
    variants: number;
    sections: number;
    items: number;
  } | null>(null);
  const [lastSourceDiagnostics, setLastSourceDiagnostics] = useState<SourceDiagnostics | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [intakeShowContext, setIntakeShowContext] = useState(false);
  const [hasHydratedAuth, setHasHydratedAuth] = useState(false);
  const [showResumePreview, setShowResumePreview] = useState(false);
  const chatSessionIdRef = useRef(uid("chat-session"));
  const [dimensionIdDrafts, setDimensionIdDrafts] = useState<Record<string, string>>({});
  const [activeEditorGalleryChildIds, setActiveEditorGalleryChildIds] = useState<Record<string, string>>({});
  const [hasHydratedEditorCollapse, setHasHydratedEditorCollapse] = useState(false);
  const [editorCollapseState, setEditorCollapseState] = useState<{
    collapsedSections: Record<string, true>;
    expandedItems: Record<string, true>;
  }>({
    collapsedSections: {},
    expandedItems: {},
  });
  const assetDragStateRef = useRef<{
    sectionId: string;
    itemId: string;
    assetId: string;
    galleryChildId?: string;
    startClientX: number;
    startClientY: number;
    startFocusX: number;
    startFocusY: number;
  } | null>(null);

  const supabaseEnabled = Boolean(getSupabaseBrowserClient());
  const activeVariant = template.variants.find((variant) => variant.id === activeVariantId) ?? template.variants[0] ?? null;
  const reusableUploadedAssets = useMemo<ReusableUploadedAsset[]>(() => {
    const options: ReusableUploadedAsset[] = [];
    const seen = new Set<string>();

    const addReusableAsset = (urlRaw: string | undefined, typeHint?: Exclude<TemplateAsset["type"], "gallery">, preview?: string) => {
      const url = (urlRaw ?? "").trim();
      if (!url) {
        return;
      }

      const type = typeHint ?? inferAssetTypeFromUrl(url);
      const dedupeKey = `${type}::${url}`;
      if (seen.has(dedupeKey)) {
        return;
      }
      seen.add(dedupeKey);

      options.push({
        key: dedupeKey,
        label: getAssetLabelFromUrl(url),
        type,
        url,
        preview,
      });
    };

    addReusableAsset(template.profile.heroImage, "image");
    addReusableAsset(template.profile.bannerBackgroundImage, "image");
    addReusableAsset(template.profile.bannerBackgroundVideo, "video");

    template.variants.forEach((variant) => {
      variant.sections.forEach((section) => {
        addReusableAsset(section.focusMedia?.backgroundImage, "image");
        addReusableAsset(section.focusMedia?.backgroundVideo, "video");

        section.items.forEach((item) => {
          addReusableAsset(item.focusMedia?.backgroundImage, "image");
          addReusableAsset(item.focusMedia?.backgroundVideo, "video");

          item.assets.forEach((asset) => {
            if (asset.type === "gallery") {
              (asset.assets ?? []).forEach((childAsset) => {
                addReusableAsset(childAsset.url, childAsset.type, childAsset.preview);
              });
              return;
            }

            addReusableAsset(asset.url, asset.type, asset.preview);
          });
        });
      });
    });

    return options;
  }, [template]);
  const hasPersistedTemplateId =
    Boolean(template.id) && template.id !== blankTemplate.id && !template.id.startsWith("template-");
  const previewQuery = new URLSearchParams();
  if (hasPersistedTemplateId) {
    previewQuery.set("templateId", template.id);
  }
  if (activeVariantId) {
    previewQuery.set("variantId", activeVariantId);
  }
  const previewHref = previewQuery.toString() ? `/?${previewQuery.toString()}` : "/";
  const currentSavedTemplate = hasPersistedTemplateId
    ? savedTemplates.find((row) => row.id === template.id)
    : null;
  const isPublished = Boolean(currentSavedTemplate?.is_published);
  const publishedQuery = new URLSearchParams();
  if (hasPersistedTemplateId) {
    publishedQuery.set("templateId", template.id);
  }
  if (activeVariantId) {
    publishedQuery.set("variantId", activeVariantId);
  }
  const relativePublishedHref = publishedQuery.toString() ? `/?${publishedQuery.toString()}` : "/";
  const publishedHref = typeof window !== "undefined"
    ? `${window.location.origin}${relativePublishedHref}`
    : relativePublishedHref;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        void handleSaveTemplate();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const rawIntake = window.localStorage.getItem(LOCAL_INTAKE_KEY);
      if (rawIntake) {
        const intake = JSON.parse(rawIntake) as { webSources?: string; resumeText?: string; additionalContext?: string; linkedIn?: string };
        if (intake.linkedIn) setIntakeLinkedIn(intake.linkedIn);
        if (intake.webSources) setIntakeWebSources(intake.webSources);
        if (intake.resumeText) setIntakeResumeText(intake.resumeText);
        if (intake.additionalContext) setIntakeAdditionalContext(intake.additionalContext);
      }
    } catch {
      // Ignore malformed intake draft.
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_TEMPLATE_KEY, JSON.stringify(template));
      if (template.id && template.id !== blankTemplate.id && !template.id.startsWith("template-")) {
        window.localStorage.setItem(LOCAL_LAST_TEMPLATE_ID_KEY, template.id);
      }
    }
  }, [template]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_INTAKE_KEY, JSON.stringify({
        linkedIn: intakeLinkedIn,
        webSources: intakeWebSources,
        resumeText: intakeResumeText,
        additionalContext: intakeAdditionalContext,
      }));
    }
  }, [intakeLinkedIn, intakeWebSources, intakeResumeText, intakeAdditionalContext]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(LOCAL_EDITOR_COLLAPSE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          collapsedSections?: Record<string, true>;
          collapsedItems?: Record<string, true>;
          expandedItems?: Record<string, true>;
        };

        setEditorCollapseState({
          collapsedSections: parsed.collapsedSections ?? {},
          expandedItems: parsed.expandedItems ?? {},
        });
      }
    } catch {
      // Ignore malformed collapse state.
    } finally {
      setHasHydratedEditorCollapse(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !hasHydratedEditorCollapse) {
      return;
    }

    window.localStorage.setItem(LOCAL_EDITOR_COLLAPSE_KEY, JSON.stringify(editorCollapseState));
  }, [editorCollapseState, hasHydratedEditorCollapse]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setIsAuthenticated(false);
      setHasHydratedAuth(true);
      return;
    }

    let isMounted = true;

    const syncAuthState = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (isMounted) {
        setIsAuthenticated(Boolean(user));
        setHasHydratedAuth(true);
      }
    };

    void syncAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setIsAuthenticated(Boolean(session?.user));
        setHasHydratedAuth(true);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !hasHydratedAuth || isAuthenticated) {
      return;
    }

    setSavedTemplates([]);
    setTemplateTitleEdits({});
    setOpenVariantByTemplateId({});
    setHasAttemptedTemplateLoad(false);

    const raw = window.localStorage.getItem(LOCAL_TEMPLATE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = normalizeTemplate(JSON.parse(raw) as ResumeTemplate);
      setTemplate(parsed);
      setActiveVariantId(parsed.defaultVariantId ?? parsed.variants[0]?.id ?? "");
      setHasUnsavedChanges(false);
      setStatus("Loaded local draft.");
    } catch {
      // Ignore malformed local draft.
    }
  }, [hasHydratedAuth, isAuthenticated]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasHydratedAuth || !isAuthenticated) {
      return;
    }

    let cancelled = false;

    const hydrateFromDatabase = async () => {
      try {
        setStatus("Loading templates...");
        setHasAttemptedTemplateLoad(true);

        const rows = await listTemplates();
        if (cancelled) {
          return;
        }

        setSavedTemplates(rows);
        setTemplateTitleEdits(Object.fromEntries(rows.map((row) => [row.id, row.title])));
        setOpenVariantByTemplateId(
          Object.fromEntries(
            rows.map((row) => {
              const normalized = normalizeTemplate(row.data);
              return [row.id, normalized.defaultVariantId ?? normalized.variants[0]?.id ?? ""];
            })
          )
        );

        if (!rows.length) {
          setStatus("No templates found for your account yet. Start a new template and save it.");
          return;
        }

        const lastTemplateId = window.localStorage.getItem(LOCAL_LAST_TEMPLATE_ID_KEY);
        const selectedRow = rows.find((row) => row.id === lastTemplateId) ?? rows[0];

        if (selectedRow) {
          const normalized = normalizeTemplate(selectedRow.data);
          setTemplate(normalized);
          setActiveVariantId(normalized.defaultVariantId ?? normalized.variants[0]?.id ?? "");
          setHasUnsavedChanges(false);
          window.localStorage.setItem(LOCAL_LAST_TEMPLATE_ID_KEY, selectedRow.id);
          setStatus(`Loaded templates (${rows.length}). Active: ${selectedRow.title}`);
          return;
        }

        setStatus(`Templates loaded (${rows.length}).`);
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : "Load failed.");
        }
      }
    };

    void hydrateFromDatabase();

    return () => {
      cancelled = true;
    };
  }, [hasHydratedAuth, isAuthenticated]);

  const updateTemplate = (updater: (current: ResumeTemplate) => ResumeTemplate) => {
    setTemplate((current) => ({
      ...updater(current),
      updatedAt: new Date().toISOString(),
    }));
    setHasUnsavedChanges(true);
  };

  const updateActiveVariant = (updater: (variant: TemplateVariant) => TemplateVariant) => {
    if (!activeVariant) {
      return;
    }

    updateTemplate((current) => ({
      ...current,
      variants: current.variants.map((variant) =>
        variant.id === activeVariant.id ? updater(variant) : variant
      ),
    }));
  };

  const updateSection = (sectionId: string, updater: (section: TemplateSection) => TemplateSection) => {
    updateActiveVariant((variant) => ({
      ...variant,
      sections: variant.sections.map((section) => (section.id === sectionId ? updater(section) : section)),
    }));
  };

  const updateItem = (sectionId: string, itemId: string, updater: (item: TemplateItem) => TemplateItem) => {
    updateSection(sectionId, (section) => ({
      ...section,
      items: section.items.map((item) => (item.id === itemId ? updater(item) : item)),
    }));
  };

  const captureFieldFocus = (event: FocusEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
      return;
    }

    const path = target.dataset.fieldPath;
    if (!path) {
      return;
    }

    const nextField = {
      path,
      label: target.dataset.fieldLabel || path,
      value: target.value,
    };

    setFocusedField(nextField);
    setSelectedFields((current) => {
      const withoutExisting = current.filter((entry) => entry.path !== nextField.path);
      return [...withoutExisting, nextField];
    });
  };

  const removeSelectedField = (path: string) => {
    setSelectedFields((current) => current.filter((entry) => entry.path !== path));
  };

  const buildCompletedResumeContext = () => {
    const completedProfile = Object.fromEntries(
      Object.entries(template.profile).filter(([key, value]) => {
        if (key === "links") {
          return Array.isArray(value) && value.length > 0;
        }
        return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
      })
    );

    const completedVariants = template.variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      audience: variant.audience,
      dimensions: variant.tagDimensions.map((dimension) => ({
        id: dimension.id,
        label: dimension.label,
        options: dimension.options,
      })),
      sections: variant.sections
        .map((section) => ({
          id: section.id,
          title: section.title,
          subtitle: section.subtitle,
          description: section.description,
          focusMedia: section.focusMedia,
          items: section.items
            .map((item) => ({
              id: item.id,
              title: item.title,
              dateRange: item.dateRange,
              summary: item.summary,
              detail: item.detail,
              assetLayout: item.assetLayout,
              coverAssetId: item.coverAssetId,
              focusMedia: item.focusMedia,
              tags: item.tags,
              assets: item.assets.map((asset, assetIndex) => ({
                order: assetIndex + 1,
                id: asset.id,
                label: asset.label,
                description: asset.description,
                type: asset.type,
                url: asset.url,
                preview: asset.preview,
                subType: asset.subType,
                galleryLayout: asset.galleryLayout,
                coverAssetId: asset.coverAssetId,
                aspectRatio: asset.aspectRatio,
                fit: asset.fit,
                focusX: asset.focusX,
                focusY: asset.focusY,
                zoom: asset.zoom,
                assets: (asset.assets ?? []).map((childAsset, childIndex) => ({
                  order: childIndex + 1,
                  id: childAsset.id,
                  label: childAsset.label,
                  description: childAsset.description,
                  type: childAsset.type,
                  url: childAsset.url,
                  preview: childAsset.preview,
                  aspectRatio: childAsset.aspectRatio,
                })),
              })),
            }))
            .filter((item) =>
              [item.title, item.summary, item.detail].some((value) => (value || "").trim().length > 0) ||
              Object.values(item.tags).some((values) => values.length > 0) ||
              item.assets.length > 0
            ),
        }))
        .filter((section) =>
          [section.title, section.subtitle, section.description].some((value) => (value || "").trim().length > 0) ||
          section.items.length > 0
        ),
    }));

    return {
      profile: completedProfile,
      variants: completedVariants,
    };
  };

  const sendEditorChat = async (override?: { prompt?: string; selectedFields?: EditorFieldContext[] }) => {
    const prompt = (override?.prompt ?? chatInput).trim();
    if (!prompt) {
      return;
    }

    const copilotDocuments = intakeDocuments
      .filter((document) => document.content?.trim().length > 0)
      .slice(0, 4)
      .map((document) => ({
        name: document.name,
        content: document.content.slice(0, 12000),
        url: document.url,
      }));

    const effectiveSelectedFields = override?.selectedFields
      ? override.selectedFields
      : selectedFields.length
        ? selectedFields
        : focusedField
          ? [focusedField]
          : [];
    const retainedField = focusedField ?? effectiveSelectedFields[effectiveSelectedFields.length - 1] ?? null;

    const userMessage: EditorChatMessage = {
      id: uid("chat-user"),
      role: "user",
      text: prompt,
    };

    setChatMessages((current) => [...current, userMessage]);
    if (!override?.prompt) {
      setChatInput("");
    }

    try {
      setIsChatLoading(true);
      const response = await fetch("/api/ai/editor-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: prompt,
          chatSessionId: chatSessionIdRef.current,
          chatHistory: chatMessages.slice(-30).map((entry) => ({
            role: entry.role,
            text: entry.text,
          })),
          searchOptions: {
            deepSearch: chatDeepSearch,
          },
          selectedFields: effectiveSelectedFields,
          focusedField,
          profile: {
            name: template.profile.name,
            title: template.profile.title,
            summary: template.profile.summary,
          },
          variant: activeVariant
            ? {
                id: activeVariant.id,
                title: activeVariant.title,
                audience: activeVariant.audience,
              }
            : null,
          completedResumeContext: buildCompletedResumeContext(),
          intakeContext: {
            linkedIn: intakeLinkedIn.trim() || null,
            webSources: intakeWebSources.trim() || null,
            resumeText: intakeResumeText.trim() || null,
            additionalContext: intakeAdditionalContext.trim() || null,
            documents: copilotDocuments,
          },
        }),
      });

      const payload = (await response.json()) as {
        reply?: string;
        fieldUpdates?: Array<{ path: string; label: string; value: string }>;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Chat request failed.");
      }

      setChatMessages((current) => [
        ...current,
        {
          id: uid("chat-assistant"),
          role: "assistant",
          text: payload.reply || "I could not generate a response.",
          fieldUpdates: payload.fieldUpdates ?? [],
          applied: false,
        },
      ]);
    } catch (error) {
      setChatMessages((current) => [
        ...current,
        {
          id: uid("chat-assistant"),
          role: "assistant",
          text: error instanceof Error ? error.message : "Chat request failed.",
        },
      ]);
    } finally {
      setSelectedFields(retainedField ? [retainedField] : []);
      setFocusedField(retainedField);
      setIsChatLoading(false);
    }
  };

  const applyChatFieldUpdates = (messageId: string) => {
    const message = chatMessages.find((entry) => entry.id === messageId);
    const updates = message?.fieldUpdates ?? [];
    if (!updates.length) {
      return;
    }

    const parseVariantPath = (path: string) => {
      const parts = path.split(":");
      return parts;
    };

    const applyOne = (current: ResumeTemplate, path: string, rawValue: string): ResumeTemplate => {
      if (path === "template.title") {
        return {
          ...current,
          title: rawValue,
        };
      }

      if (path.startsWith("profile.")) {
        const key = path.replace("profile.", "") as keyof ResumeTemplate["profile"];
        if (["name", "title", "location", "email", "summary", "heroImage", "heroImageFilter", "bannerBackgroundVideo", "bannerBackgroundImage", "bannerVideoFilter"].includes(key)) {
          return {
            ...current,
            profile: {
              ...current.profile,
              [key]: rawValue,
            },
          };
        }

        if (["bannerVideoOpacity", "bannerOverlayOpacity", "bannerVideoAudioVolume", "bannerVideoDuckedVolume"].includes(key)) {
          const parsed = Number(rawValue);
          if (!Number.isFinite(parsed)) {
            return current;
          }

          return {
            ...current,
            profile: {
              ...current.profile,
              [key]: Math.min(100, Math.max(0, parsed)),
            },
          };
        }

        if (key === "bannerVideoUseAudio") {
          return {
            ...current,
            profile: {
              ...current.profile,
              bannerVideoUseAudio: ["true", "1", "yes", "on"].includes(rawValue.trim().toLowerCase()),
            },
          };
        }

        return current;
      }

      const parts = parseVariantPath(path);
      if (parts[0] !== "variant") {
        return current;
      }

      const variantId = parts[1];
      if (!variantId) {
        return current;
      }

      return {
        ...current,
        variants: current.variants.map((variant) => {
          if (variant.id !== variantId) {
            return variant;
          }

          if (parts[2] === "title") {
            return { ...variant, title: rawValue };
          }

          if (parts[2] === "audience") {
            return { ...variant, audience: rawValue };
          }

          const validSectionItemPairs = new Set(
            variant.sections.flatMap((section) =>
              section.items.map((item) => `${section.id}::${item.id}`)
            )
          );
          const firstSectionItemPair = variant.sections
            .flatMap((section) => section.items.map((item) => `${section.id}::${item.id}`))[0];

          const normalizeTimelineStepsFromUnknown = (
            source: unknown,
            fallbackSteps: TemplateTourStep[]
          ): TemplateTourStep[] | null => {
            if (!Array.isArray(source)) {
              return null;
            }

            const normalized = source
              .map((entry, index) => {
                const token = (entry && typeof entry === "object") ? (entry as Record<string, unknown>) : {};
                const stepId = typeof token.id === "string" && token.id.trim() ? token.id.trim() : uid("step");
                const labelRaw = typeof token.label === "string" ? token.label.trim() : "";
                const durationRaw = Number(token.durationMs);
                const fallback = fallbackSteps[index];

                let sectionId = typeof token.sectionId === "string" ? token.sectionId.trim() : "";
                let itemId = typeof token.itemId === "string" ? token.itemId.trim() : "";

                const sectionItemRaw = typeof token.sectionItem === "string" ? token.sectionItem.trim() : "";
                if ((!sectionId || !itemId) && sectionItemRaw.includes("::")) {
                  const [nextSectionId, nextItemId] = sectionItemRaw.split("::");
                  sectionId = nextSectionId?.trim() ?? sectionId;
                  itemId = nextItemId?.trim() ?? itemId;
                }

                const maybePair = `${sectionId}::${itemId}`;
                if (!validSectionItemPairs.has(maybePair)) {
                  if (fallback && validSectionItemPairs.has(`${fallback.sectionId}::${fallback.itemId}`)) {
                    sectionId = fallback.sectionId;
                    itemId = fallback.itemId;
                  } else if (firstSectionItemPair) {
                    const [defaultSectionId, defaultItemId] = firstSectionItemPair.split("::");
                    sectionId = defaultSectionId;
                    itemId = defaultItemId;
                  } else {
                    return null;
                  }
                }

                return {
                  id: stepId,
                  label: labelRaw || `Step ${index + 1}`,
                  sectionId,
                  itemId,
                  durationMs: Number.isFinite(durationRaw) ? Math.max(400, Math.min(12000, Math.round(durationRaw))) : (fallback?.durationMs ?? 1800),
                } satisfies TemplateTourStep;
              })
              .filter((step): step is TemplateTourStep => Boolean(step));

            return normalized.length ? normalized : null;
          };

          if (parts[2] === "timelineTour") {
            if (parts[3] === "enabled") {
              return {
                ...variant,
                timelineTour: {
                  ...variant.timelineTour,
                  enabled: ["true", "1", "yes", "on"].includes(rawValue.trim().toLowerCase()),
                },
              };
            }

            if (parts[3] === "stepsJson") {
              try {
                const parsed = JSON.parse(rawValue) as unknown;
                const normalizedSteps = normalizeTimelineStepsFromUnknown(parsed, variant.timelineTour.steps);
                if (!normalizedSteps) {
                  return variant;
                }

                return {
                  ...variant,
                  timelineTour: {
                    ...variant.timelineTour,
                    steps: normalizedSteps,
                  },
                };
              } catch {
                return variant;
              }
            }

            if (parts[3] === "step") {
              const stepId = parts[4];
              const field = parts[5];
              if (!stepId || !field) {
                return variant;
              }

              return {
                ...variant,
                timelineTour: {
                  ...variant.timelineTour,
                  steps: variant.timelineTour.steps.map((step) => {
                    if (step.id !== stepId) {
                      return step;
                    }

                    if (field === "label") {
                      return { ...step, label: rawValue };
                    }

                    if (field === "durationMs") {
                      const parsedDuration = Number(rawValue);
                      if (!Number.isFinite(parsedDuration)) {
                        return step;
                      }
                      return { ...step, durationMs: Math.max(400, Math.min(12000, Math.round(parsedDuration))) };
                    }

                    if (field === "sectionItem") {
                      const [sectionId, itemId] = rawValue.split("::");
                      const pair = `${sectionId ?? ""}::${itemId ?? ""}`;
                      if (!validSectionItemPairs.has(pair)) {
                        return step;
                      }
                      return { ...step, sectionId, itemId };
                    }

                    return step;
                  }),
                },
              };
            }

            return variant;
          }

          if (parts[2] === "dimension") {
            const dimensionId = parts[3];
            const field = parts[4];
            if (!dimensionId || !field) {
              return variant;
            }

            return {
              ...variant,
              tagDimensions: variant.tagDimensions.map((dimension) => {
                if (dimension.id !== dimensionId) {
                  return dimension;
                }

                if (field === "label") {
                  return { ...dimension, label: rawValue };
                }

                if (field === "id") {
                  const nextId = toDimensionId(rawValue);
                  return nextId ? { ...dimension, id: nextId } : dimension;
                }

                if (field === "options") {
                  return { ...dimension, options: parseTagInput(rawValue) };
                }

                return dimension;
              }),
            };
          }

          if (parts[2] !== "section") {
            return variant;
          }

          const sectionId = parts[3];
          if (!sectionId) {
            return variant;
          }

          return {
            ...variant,
            sections: variant.sections.map((section) => {
              if (section.id !== sectionId) {
                return section;
              }

              if (parts[4] === "title") {
                return { ...section, title: rawValue };
              }

              if (parts[4] === "subtitle") {
                return { ...section, subtitle: rawValue };
              }

              if (parts[4] === "dateRange") {
                return { ...section, dateRange: rawValue };
              }

              if (parts[4] === "description") {
                return { ...section, description: rawValue };
              }

              if (parts[4] === "metadataItemsText") {
                return { ...section, metadataItemsText: rawValue };
              }

              if (parts[4] === "focusAudio") {
                return {
                  ...section,
                  focusMedia: {
                    ...(section.focusMedia ?? {}),
                    focusAudio: rawValue,
                  },
                };
              }

              if (parts[4] === "backgroundVideo") {
                return {
                  ...section,
                  focusMedia: {
                    ...(section.focusMedia ?? {}),
                    backgroundVideo: rawValue,
                  },
                };
              }

              if (parts[4] === "backgroundImage") {
                return {
                  ...section,
                  focusMedia: {
                    ...(section.focusMedia ?? {}),
                    backgroundImage: rawValue,
                  },
                };
              }

              if (parts[4] !== "item") {
                return section;
              }

              const itemId = parts[5];
              if (!itemId) {
                return section;
              }

              return {
                ...section,
                items: section.items.map((item) => {
                  if (item.id !== itemId) {
                    return item;
                  }

                  if (parts[6] === "title") {
                    return { ...item, title: rawValue };
                  }

                  if (parts[6] === "dateRange") {
                    return { ...item, dateRange: rawValue };
                  }

                  if (parts[6] === "summary") {
                    return { ...item, summary: rawValue };
                  }

                  if (parts[6] === "detail") {
                    return { ...item, detail: rawValue };
                  }

                  if (parts[6] === "assetLayout" && ["list", "masonry", "carousel"].includes(rawValue)) {
                    return { ...item, assetLayout: rawValue as "list" | "masonry" | "carousel" };
                  }

                  if (parts[6] === "coverAssetId") {
                    return { ...item, coverAssetId: rawValue };
                  }

                  if (parts[6] === "focusAudio") {
                    return {
                      ...item,
                      focusMedia: {
                        ...(item.focusMedia ?? {}),
                        focusAudio: rawValue,
                      },
                    };
                  }

                  if (parts[6] === "backgroundVideo") {
                    return {
                      ...item,
                      focusMedia: {
                        ...(item.focusMedia ?? {}),
                        backgroundVideo: rawValue,
                      },
                    };
                  }

                  if (parts[6] === "backgroundImage") {
                    return {
                      ...item,
                      focusMedia: {
                        ...(item.focusMedia ?? {}),
                        backgroundImage: rawValue,
                      },
                    };
                  }

                  if (parts[6] === "tag") {
                    const tagId = parts[7];
                    if (!tagId) {
                      return item;
                    }
                    return {
                      ...item,
                      tags: {
                        ...item.tags,
                        [tagId]: parseTagInput(rawValue),
                      },
                    };
                  }

                  if (parts[6] !== "asset") {
                    return item;
                  }

                  const assetId = parts[7];
                  const assetField = parts[8];
                  if (!assetId || !assetField) {
                    return item;
                  }

                  return {
                    ...item,
                    assets: item.assets.map((asset) => {
                      if (asset.id !== assetId) {
                        return asset;
                      }

                      if (assetField === "label") {
                        return { ...asset, label: rawValue };
                      }

                      if (assetField === "url") {
                        return { ...asset, url: rawValue };
                      }

                      if (assetField === "description") {
                        return { ...asset, description: rawValue };
                      }

                      if (assetField === "type" && ["image", "video", "doc", "gallery", "masonry"].includes(rawValue)) {
                        return convertTemplateAssetType(asset, rawValue === "masonry" ? "gallery" : rawValue as TemplateAsset["type"]);
                      }

                      if (assetField === "galleryLayout" && ["masonry", "carousel"].includes(rawValue)) {
                        return { ...asset, galleryLayout: rawValue as "masonry" | "carousel" };
                      }

                      if (assetField === "coverAssetId") {
                        return { ...asset, coverAssetId: rawValue };
                      }

                      if (assetField === "fit" && ["cover", "contain"].includes(rawValue)) {
                        return { ...asset, fit: rawValue as "cover" | "contain" };
                      }

                      if (
                        assetField === "aspectRatio" &&
                        ["auto", "16/9", "4/3", "1/1", "3/4", "9/16", "21/9"].includes(rawValue)
                      ) {
                        return {
                          ...asset,
                          aspectRatio: rawValue as "auto" | "16/9" | "4/3" | "1/1" | "3/4" | "9/16" | "21/9",
                        };
                      }

                      if (assetField === "subType" && ["cover", "supporting"].includes(rawValue)) {
                        return { ...asset, subType: rawValue as "cover" | "supporting" };
                      }

                      if (
                        assetField === "aspectRatio" &&
                        ["auto", "16/9", "4/3", "1/1", "3/4", "9/16", "21/9"].includes(rawValue)
                      ) {
                        return {
                          ...asset,
                          aspectRatio: rawValue as "auto" | "16/9" | "4/3" | "1/1" | "3/4" | "9/16" | "21/9",
                        };
                      }

                      if (assetField === "focusX") {
                        const focusX = Number(rawValue);
                        return Number.isFinite(focusX)
                          ? { ...asset, focusX: Math.min(100, Math.max(0, focusX)) }
                          : asset;
                      }

                      if (assetField === "focusY") {
                        const focusY = Number(rawValue);
                        return Number.isFinite(focusY)
                          ? { ...asset, focusY: Math.min(100, Math.max(0, focusY)) }
                          : asset;
                      }

                      if (assetField === "zoom") {
                        const zoom = Number(rawValue);
                        return Number.isFinite(zoom)
                          ? { ...asset, zoom: Math.min(200, Math.max(100, zoom)) }
                          : asset;
                      }

                      return asset;
                    }),
                  };
                }),
              };
            }),
          };
        }),
      };
    };

    updateTemplate((current) => updates.reduce((next, update) => applyOne(next, update.path, update.value), current));
    setChatMessages((current) =>
      current.map((entry) => (entry.id === messageId ? { ...entry, applied: true } : entry))
    );
    setStatus(`Applied ${updates.length} suggested update${updates.length === 1 ? "" : "s"}.`);
  };

  const handleSaveTemplate = async (): Promise<StoredTemplateRecord | null> => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return null;
    }

    try {
      setStatus("Saving template...");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus("Sign in first to save templates.");
        return null;
      }

      const saved = await saveTemplate({
        id: template.id.startsWith("template-") ? undefined : template.id,
        ownerId: user.id,
        title: template.title,
        template,
      });

      const normalized = normalizeTemplate(saved.data);
      setTemplate({ ...normalized, id: saved.id });
      setSavedTemplates((current) => [saved, ...current.filter((row) => row.id !== saved.id)]);
      setTemplateTitleEdits((current) => ({ ...current, [saved.id]: saved.title }));
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LOCAL_LAST_TEMPLATE_ID_KEY, saved.id);
      }
      setHasUnsavedChanges(false);
      setStatus("Template saved.");
      return saved;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed.");
      return null;
    }
  };

  const handleTogglePublish = async () => {
    if (isPublishing) {
      return;
    }

    setIsPublishing(true);
    try {
      let persistedId = hasPersistedTemplateId ? template.id : "";
      if (!persistedId) {
        const saved = await handleSaveTemplate();
        persistedId = saved?.id ?? "";
      }

      if (!persistedId) {
        setStatus("Save a template first, then publish.");
        return;
      }

      const nextPublished = !isPublished;
      const updated = await setTemplatePublishState({ id: persistedId, isPublished: nextPublished });
      setSavedTemplates((current) => [updated, ...current.filter((row) => row.id !== updated.id)]);

      setStatus(nextPublished ? "Resume published. Share link copied." : "Resume unpublished.");

      if (nextPublished && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(publishedHref);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Publish action failed.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyPublishedLink = async () => {
    if (!isPublished) {
      setStatus("Publish this template first to generate a shareable link.");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setStatus("Clipboard is unavailable in this browser.");
      return;
    }

    try {
      await navigator.clipboard.writeText(publishedHref);
      setStatus("Published link copied.");
    } catch {
      setStatus("Could not copy link.");
    }
  };

  const handleLoadTemplates = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }

    try {
      setStatus("Loading templates...");
      setHasAttemptedTemplateLoad(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSavedTemplates([]);
        setStatus("Sign in first, then click Load Templates.");
        return;
      }

      const rows = await listTemplates();
      setSavedTemplates(rows);
      setTemplateTitleEdits(Object.fromEntries(rows.map((row) => [row.id, row.title])));
      setOpenVariantByTemplateId(
        Object.fromEntries(
          rows.map((row) => {
            const normalized = normalizeTemplate(row.data);
            return [row.id, normalized.defaultVariantId ?? normalized.variants[0]?.id ?? ""];
          })
        )
      );
      if (!rows.length) {
        setStatus("No templates found for your account yet.");
        return;
      }

      setStatus(`Templates loaded (${rows.length}).`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Load failed.");
    }
  };

  const loadTemplateIntoEditor = async (id: string) => {
    try {
      setStatus("Loading template...");
      const row = await getTemplateById(id);
      if (!row) {
        setStatus("Template not found.");
        return;
      }
      const normalized = normalizeTemplate(row.data);
      setTemplate(normalized);
      setActiveVariantId(normalized.defaultVariantId ?? normalized.variants[0]?.id ?? "");
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LOCAL_LAST_TEMPLATE_ID_KEY, id);
      }
      setHasUnsavedChanges(false);
      setStatus("Template loaded into editor.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Template load failed.");
    }
  };

  const handleRenameSavedTemplate = async (row: StoredTemplateRecord) => {
    const nextTitle = (templateTitleEdits[row.id] ?? row.title).trim();
    if (!nextTitle) {
      setStatus("Template title cannot be empty.");
      return;
    }

    if (nextTitle === row.title) {
      setStatus("Template title is unchanged.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }

    try {
      setStatus("Renaming template...");
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const saved = await saveTemplate({
        id: row.id,
        ownerId: row.owner_id ?? user?.id ?? null,
        title: nextTitle,
        template: normalizeTemplate(row.data),
      });

      setSavedTemplates((current) => current.map((entry) => (entry.id === row.id ? saved : entry)));
      setTemplateTitleEdits((current) => ({ ...current, [row.id]: nextTitle }));

      if (template.id === row.id) {
        setTemplate((current) => ({ ...current, title: nextTitle }));
      }

      setStatus("Template renamed.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Rename failed.");
    }
  };

  const handleDeleteSavedTemplate = async (row: StoredTemplateRecord) => {
    if (!window.confirm(`Delete template \"${row.title}\"? This cannot be undone.`)) {
      return;
    }

    try {
      setStatus("Deleting template...");
      await deleteStoredTemplate(row.id);

      setSavedTemplates((current) => current.filter((entry) => entry.id !== row.id));
      setTemplateTitleEdits((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      setOpenVariantByTemplateId((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });

      if (typeof window !== "undefined") {
        const lastId = window.localStorage.getItem(LOCAL_LAST_TEMPLATE_ID_KEY);
        if (lastId === row.id) {
          window.localStorage.removeItem(LOCAL_LAST_TEMPLATE_ID_KEY);
        }
      }

      if (template.id === row.id) {
        const fresh = normalizeTemplate({
          ...blankTemplate,
          id: uid("template"),
          title: "Untitled Resume Collection",
          updatedAt: new Date().toISOString(),
        });
        setTemplate(fresh);
        setActiveVariantId(fresh.defaultVariantId ?? fresh.variants[0]?.id ?? "");
        setHasUnsavedChanges(true);
      }

      setStatus("Template deleted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Delete failed.");
    }
  };

  const uploadAssetFile = async (file: File, sectionId: string, itemId: string, assetId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }

    try {
      setStatus("Uploading media...");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus("Sign in first to upload media.");
        return;
      }

      const uploaded = await uploadTemplateAsset({ ownerId: user.id, file });
      const inferredType = inferUploadedAssetType(file);
      updateItem(sectionId, itemId, (current) => ({
        ...current,
        assets: current.assets.map((asset) =>
          asset.id === assetId
            ? {
                ...asset,
                type: inferredType,
                url: uploaded.publicUrl,
                preview: uploaded.publicUrl,
              }
            : asset
        ),
      }));
      setStatus("Media uploaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    }
  };

  const uploadGalleryAssetFile = async (
    file: File,
    sectionId: string,
    itemId: string,
    assetId: string,
    galleryChildId: string
  ) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }

    try {
      setStatus("Uploading gallery media...");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus("Sign in first to upload media.");
        return;
      }

      const uploaded = await uploadTemplateAsset({ ownerId: user.id, file });
      const inferredType = inferUploadedAssetType(file);
      updateItem(sectionId, itemId, (current) => ({
        ...current,
        assets: current.assets.map((asset) =>
          asset.id !== assetId
            ? asset
            : {
                ...asset,
                assets: (asset.assets ?? []).map((childAsset) =>
                  childAsset.id === galleryChildId
                    ? {
                        ...childAsset,
                        type: inferredType,
                        url: uploaded.publicUrl,
                        preview: uploaded.publicUrl,
                      }
                    : childAsset
                ),
              }
        ),
      }));
      setStatus("Gallery media uploaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    }
  };

  const uploadGalleryAssetFiles = async (
    files: FileList | File[],
    sectionId: string,
    itemId: string,
    assetId: string
  ) => {
    const uploadQueue = Array.from(files);
    if (!uploadQueue.length) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }

    try {
      setStatus(`Uploading ${uploadQueue.length} gallery asset${uploadQueue.length === 1 ? "" : "s"}...`);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus("Sign in first to upload media.");
        return;
      }

      const uploadedChildren = await Promise.all(
        uploadQueue.map(async (file, index) => {
          const uploaded = await uploadTemplateAsset({ ownerId: user.id, file });
          const inferredType = inferUploadedAssetType(file);
          return {
            ...createGalleryEntryAsset(inferredType),
            label: file.name.replace(/\.[^.]+$/, "") || `Gallery Asset ${index + 1}`,
            type: inferredType,
            url: uploaded.publicUrl,
            preview: uploaded.publicUrl,
          } satisfies TemplateGalleryEntryAsset;
        })
      );

      const firstNewChildId = uploadedChildren[0]?.id;

      updateItem(sectionId, itemId, (current) => ({
        ...current,
        assets: current.assets.map((asset) => {
          if (asset.id !== assetId || asset.type !== "gallery") {
            return asset;
          }

          const nextAssets = [...(asset.assets ?? []), ...uploadedChildren];

          return {
            ...asset,
            assets: nextAssets,
            coverAssetId: asset.coverAssetId ?? firstNewChildId,
          };
        }),
      }));

      setStatus(`Added ${uploadedChildren.length} gallery asset${uploadedChildren.length === 1 ? "" : "s"}.`);

      if (firstNewChildId && typeof window !== "undefined") {
        window.setTimeout(() => {
          const nextInput = document.querySelector<HTMLInputElement>(`[data-gallery-child-id="${firstNewChildId}"]`);
          nextInput?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          nextInput?.focus();
        }, 0);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    }
  };

  const uploadHeroImageFile = async (file: File) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }

    try {
      setStatus("Uploading hero image...");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus("Sign in first to upload profile images.");
        return;
      }

      const uploaded = await uploadHeroImage({ ownerId: user.id, file });
      updateTemplate((current) => ({
        ...current,
        profile: {
          ...current.profile,
          heroImage: uploaded.publicUrl,
        },
      }));
      setStatus("Hero image uploaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Hero image upload failed.");
    }
  };

  const uploadBannerVideoFile = async (file: File) => {
    console.log("[uploadBannerVideoFile] Starting upload for file:", file.name, file.size, file.type);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      console.error("[uploadBannerVideoFile] Supabase not configured");
      setStatus("Supabase is not configured.");
      return;
    }

    try {
      console.log("[uploadBannerVideoFile] Getting user...");
      setStatus("Uploading banner video...");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("[uploadBannerVideoFile] No user logged in");
        setStatus("Sign in first to upload banner videos.");
        return;
      }

      console.log("[uploadBannerVideoFile] Calling uploadBannerVideo API...");
      const uploaded = await uploadBannerVideo({ ownerId: user.id, file });
      console.log("[uploadBannerVideoFile] Upload successful:", uploaded);
      updateTemplate((current) => ({
        ...current,
        profile: {
          ...current.profile,
          bannerBackgroundVideo: uploaded.publicUrl,
        },
      }));
      setStatus("Banner video uploaded.");
    } catch (error) {
      console.error("[uploadBannerVideoFile] Error:", error);
      setStatus(error instanceof Error ? error.message : "Banner video upload failed.");
    }
  };

  const summarizeTemplate = (nextTemplate: ResumeTemplate) => {
    const variants = nextTemplate.variants.length;
    const sections = nextTemplate.variants.reduce((count, variant) => count + variant.sections.length, 0);
    const items = nextTemplate.variants.reduce(
      (count, variant) => count + variant.sections.reduce((sectionCount, section) => sectionCount + section.items.length, 0),
      0
    );

    return { variants, sections, items };
  };

  const isTextLikeName = (name: string) => {
    const lower = name.toLowerCase();
    return (
      lower.endsWith(".md") ||
      lower.endsWith(".txt") ||
      lower.endsWith(".json") ||
      lower.endsWith(".csv") ||
      lower.endsWith(".yaml") ||
      lower.endsWith(".yml") ||
      lower.endsWith(".xml") ||
      lower.endsWith(".html") ||
      lower.endsWith(".htm") ||
      lower.endsWith(".rtf")
    );
  };

  const parseFileContent = async (file: File) => {
    const isZip = file.type === "application/zip" || file.name.toLowerCase().endsWith(".zip");
    if (isZip) {
      try {
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const entryNames = Object.keys(zip.files);
        const textEntries = entryNames.filter((name) => {
          const entry = zip.files[name];
          return !entry.dir && isTextLikeName(name);
        });

        if (!textEntries.length) {
          return `Zip attached: ${file.name}. No text-like files found in archive.`;
        }

        let remaining = 16000;
        const chunks: string[] = [];

        for (const name of textEntries) {
          if (remaining <= 0) {
            break;
          }
          const entry = zip.files[name];
          const text = await entry.async("text");
          const clipped = text.slice(0, Math.max(0, remaining - 64));
          if (!clipped.trim()) {
            continue;
          }
          const block = `\n\n[${name}]\n${clipped}`;
          chunks.push(block);
          remaining -= block.length;
        }

        if (!chunks.length) {
          return `Zip attached: ${file.name}. Text-like files were empty.`;
        }

        return `Zip extracted from ${file.name}:${chunks.join("")}`.slice(0, 16000);
      } catch {
        return `Zip attached: ${file.name}. Could not extract archive in browser; file still uploaded for reference.`;
      }
    }

    const isTextLike =
      file.type.startsWith("text/") ||
      isTextLikeName(file.name);

    if (!isTextLike) {
      return `Document attached: ${file.name} (${file.type || "binary"}).`;
    }

    const raw = await file.text();
    return raw.slice(0, 16000);
  };

  const resetTemplate = () => {
    if (
      !window.confirm(
        "Clear the current template and start over? Intake data will be preserved so you can regenerate."
      )
    ) {
      return;
    }
    setTemplate(blankTemplate);
    setActiveVariantId(blankTemplate.defaultVariantId ?? blankTemplate.variants[0]?.id ?? "");
    setLastGeneratedSummary(null);
    setLastSourceDiagnostics(null);
    setHasUnsavedChanges(true);
    setStatus("Template cleared. Intake data preserved.");
  };

  const startNewTemplate = () => {
    if (!window.confirm("Start a brand-new template? This keeps your existing templates in the database.")) {
      return;
    }

    const fresh = normalizeTemplate({
      ...blankTemplate,
      id: uid("template"),
      title: "Untitled Resume Collection",
      updatedAt: new Date().toISOString(),
    });

    setTemplate(fresh);
    setActiveVariantId(fresh.defaultVariantId ?? fresh.variants[0]?.id ?? "");
    setLastGeneratedSummary(null);
    setLastSourceDiagnostics(null);
    setHasUnsavedChanges(true);
    setStatus("Started a new template draft. Click Save Template to create it in the database.");
  };

  const removeDocument = (index: number) => {
    setIntakeDocuments((current) => current.filter((_, i) => i !== index));
    setStatus(`Removed document ${index + 1}.`);
  };

  const hasContentForGeneration = (): boolean => {
    const hasResume = intakeResumeText.trim().length > 0;
    const hasLinkedIn = intakeLinkedIn.trim().length > 0;
    const hasDocuments = intakeDocuments.length > 0;
    const hasWebSources = intakeWebSources
      .trim()
      .split("\n")
      .filter((u) => u.trim()).length > 0;
    return hasResume || hasLinkedIn || hasDocuments || hasWebSources;
  };

  const ingestSourceDocuments = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    const supabase = getSupabaseBrowserClient();

    try {
      setStatus("Ingesting source documents...");
      let ownerId: string | null = null;

      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        ownerId = user?.id ?? null;
      }

      const docs = await Promise.all(
        Array.from(files).map(async (file) => {
          const content = await parseFileContent(file);
          let url: string | undefined;

          if (ownerId) {
            try {
              const uploaded = await uploadSourceDocument({ ownerId, file });
              url = uploaded.publicUrl;
            } catch {
              // Keep going even if storage upload fails.
            }
          }

          return {
            name: file.name,
            content,
            url,
          } satisfies IntakeDocument;
        })
      );

      setIntakeDocuments((current) => [...current, ...docs]);
      setStatus(`Ingested ${docs.length} document${docs.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to ingest documents.");
    }
  };

  const generateDraftFromIntake = async () => {
    if (!hasContentForGeneration()) {
      setStatus(
        "Please provide at least one content source: resume text, LinkedIn URL, web URLs, or documents."
      );
      return;
    }

    try {
      setIsGeneratingDraft(true);
      setLastGeneratedSummary(null);
      setLastSourceDiagnostics(null);
      setStatus("Generating AI draft...");

      const response = await fetch("/api/ai/resume-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intake: {
            fullName: template.profile.name,
            linkedinUrl: intakeLinkedIn,
            websiteUrls: intakeWebSources
              .split("\n")
              .map((value) => value.trim())
              .filter(Boolean),
            resumeText: intakeResumeText,
            additionalContext: intakeAdditionalContext,
            documents: intakeDocuments,
          },
          currentTemplate: template,
        }),
      });

      const payload = (await response.json()) as {
        template?: ResumeTemplate;
        sourceDiagnostics?: SourceDiagnostics;
        error?: string;
      };

      if (!response.ok || !payload.template) {
        throw new Error(payload.error || "Failed to generate AI draft.");
      }

      const normalized = normalizeTemplate(payload.template);
      setTemplate(normalized);
      const mostPopulatedVariant = normalized.variants.reduce<TemplateVariant | null>((winner, candidate) => {
        if (!winner) {
          return candidate;
        }
        const winnerItems = winner.sections.reduce((count, section) => count + section.items.length, 0);
        const candidateItems = candidate.sections.reduce((count, section) => count + section.items.length, 0);
        if (candidate.sections.length > winner.sections.length) {
          return candidate;
        }
        if (candidate.sections.length === winner.sections.length && candidateItems > winnerItems) {
          return candidate;
        }
        return winner;
      }, null);

      setActiveVariantId(
        mostPopulatedVariant?.id ?? normalized.defaultVariantId ?? normalized.variants[0]?.id ?? ""
      );
      const summary = summarizeTemplate(normalized);
      const diagnostics = payload.sourceDiagnostics ?? null;
      setLastGeneratedSummary(summary);
      setLastSourceDiagnostics(diagnostics);

      const baseStatus = `Draft generated: ${summary.variants} variant${summary.variants === 1 ? "" : "s"}, ${summary.sections} section${summary.sections === 1 ? "" : "s"}, ${summary.items} item${summary.items === 1 ? "" : "s"}.`;
      const sourceStatus = diagnostics
        ? ` Sources: ${diagnostics.usableSources}/${diagnostics.totalSources} usable (${diagnostics.successfulSources} fetched).`
        : "";
      setStatus(`${baseStatus}${sourceStatus}`);

      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          const anchor = document.getElementById("sections-editor-anchor");
          anchor?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to generate AI draft.";
      let userFriendlyMsg = errorMsg;
      if (errorMsg.includes("token")) {
        userFriendlyMsg = `Token limit exceeded. Try with less content. Details: ${errorMsg}`;
      } else if (errorMsg.includes("model") || errorMsg.includes("api")) {
        userFriendlyMsg = `AI model temporarily unavailable. Try again in a moment. Details: ${errorMsg}`;
      } else if (errorMsg.includes("parse") || errorMsg.includes("malformed")) {
        userFriendlyMsg = `Invalid resume format. Try reformatting or providing plain text. Details: ${errorMsg}`;
      }
      setStatus(userFriendlyMsg);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const addVariant = () => {
    const variantId = uid("variant");
    const variant: TemplateVariant = {
      id: variantId,
      title: `Variant ${template.variants.length + 1}`,
      audience: "",
      profileScope: [...TEMPLATE_PROFILE_SCOPE_FIELDS],
      tagDimensions: [
        { id: "company", label: "Company", allowMultiple: false, options: [] },
        { id: "activation", label: "Activation Type", allowMultiple: false, options: [] },
        { id: "role", label: "Role", allowMultiple: true, options: [] },
      ],
      sections: [],
      timelineTour: { enabled: true, steps: [] },
    };

    updateTemplate((current) => ({
      ...current,
      defaultVariantId: current.defaultVariantId ?? variantId,
      variants: [...current.variants, variant],
    }));
    setActiveVariantId(variantId);
  };

  const toggleVariantProfileScope = (field: TemplateProfileScopeField, enabled: boolean) => {
    updateActiveVariant((variant) => {
      const currentScope = variant.profileScope?.length
        ? variant.profileScope
        : [...TEMPLATE_PROFILE_SCOPE_FIELDS];

      const nextScope = enabled
        ? Array.from(new Set([...currentScope, field]))
        : currentScope.filter((entry) => entry !== field);

      return {
        ...variant,
        profileScope: nextScope.length ? nextScope : ["name"],
      };
    });
  };

  const addDimension = () => {
    const baseId = toDimensionId("new-filter") || uid("dimension");
    updateActiveVariant((variant) => ({
      ...variant,
      tagDimensions: [
        ...variant.tagDimensions,
        {
          id: variant.tagDimensions.some((dimension) => dimension.id === baseId)
            ? `${baseId}-${variant.tagDimensions.length + 1}`
            : baseId,
          label: "New Filter",
          allowMultiple: false,
          options: [],
        },
      ],
    }));
  };

  const renameDimensionId = (fromId: string, nextRawId: string) => {
    updateActiveVariant((variant) => {
      const normalizedId = toDimensionId(nextRawId);
      if (!normalizedId) {
        return variant;
      }

      if (normalizedId !== fromId && variant.tagDimensions.some((dimension) => dimension.id === normalizedId)) {
        return variant;
      }

      return {
        ...variant,
        tagDimensions: variant.tagDimensions.map((dimension) =>
          dimension.id === fromId
            ? {
                ...dimension,
                id: normalizedId,
              }
            : dimension
        ),
        sections: variant.sections.map((section) => ({
          ...section,
          items: section.items.map((item) => {
            if (!(fromId in item.tags) || fromId === normalizedId) {
              return item;
            }

            const { [fromId]: migratedValues = [], ...restTags } = item.tags;
            return {
              ...item,
              tags: {
                ...restTags,
                [normalizedId]: migratedValues,
              },
            };
          }),
        })),
      };
    });
  };

  const commitDimensionIdDraft = (dimensionId: string) => {
    const draft = (dimensionIdDrafts[dimensionId] ?? "").trim();
    if (!draft) {
      setDimensionIdDrafts((current) => {
        const next = { ...current };
        delete next[dimensionId];
        return next;
      });
      return;
    }

    renameDimensionId(dimensionId, draft);

    setDimensionIdDrafts((current) => {
      const next = { ...current };
      delete next[dimensionId];
      return next;
    });
  };

  const updateItemDimensionTags = (sectionId: string, itemId: string, dimensionId: string, rawValue: string) => {
    const values = parseTagInput(rawValue);

    updateActiveVariant((variant) => ({
      ...variant,
      tagDimensions: variant.tagDimensions.map((dimension) =>
        dimension.id === dimensionId
          ? {
              ...dimension,
              options: Array.from(new Set([...(dimension.options ?? []), ...values])),
            }
          : dimension
      ),
      sections: variant.sections.map((section) => {
        if (section.id !== sectionId) {
          return section;
        }

        return {
          ...section,
          items: section.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  tags: {
                    ...item.tags,
                    [dimensionId]: values,
                  },
                }
              : item
          ),
        };
      }),
    }));
  };

  const updateAssetLayout = (
    sectionId: string,
    itemId: string,
    assetId: string,
    patch: Partial<Pick<TemplateAsset, "aspectRatio" | "fit" | "focusX" | "focusY" | "zoom">>,
    galleryChildId?: string
  ) => {
    updateItem(sectionId, itemId, (current) => ({
      ...current,
      assets: current.assets.map((asset) => {
        if (asset.id !== assetId) {
          return asset;
        }

        if (!galleryChildId) {
          return { ...asset, ...patch };
        }

        return {
          ...asset,
          assets: (asset.assets ?? []).map((childAsset) =>
            childAsset.id === galleryChildId ? { ...childAsset, ...patch } : childAsset
          ),
        };
      }),
    }));
  };

  const beginAssetDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    sectionId: string,
    itemId: string,
    assetId: string,
    galleryChildId?: string
  ) => {
    const baseAsset = activeVariant?.sections
      .find((section) => section.id === sectionId)
      ?.items.find((item) => item.id === itemId)
      ?.assets.find((asset) => asset.id === assetId);

    const targetAsset = galleryChildId
      ? baseAsset?.assets?.find((asset) => asset.id === galleryChildId)
      : baseAsset;

    if (!targetAsset) {
      return;
    }

    assetDragStateRef.current = {
      sectionId,
      itemId,
      assetId,
      galleryChildId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFocusX: targetAsset.focusX ?? 50,
      startFocusY: targetAsset.focusY ?? 50,
    };
  };

  const updateAssetDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = assetDragStateRef.current;
    if (!drag) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const deltaXPercent = ((event.clientX - drag.startClientX) / rect.width) * 100;
    const deltaYPercent = ((event.clientY - drag.startClientY) / rect.height) * 100;

    // Inverted from pointer absolute mapping so content follows drag direction.
    const nextFocusX = clampPercent(drag.startFocusX - deltaXPercent);
    const nextFocusY = clampPercent(drag.startFocusY - deltaYPercent);

    updateAssetLayout(drag.sectionId, drag.itemId, drag.assetId, {
      focusX: nextFocusX,
      focusY: nextFocusY,
    }, drag.galleryChildId);
  };

  const endAssetDrag = () => {
    assetDragStateRef.current = null;
  };

  const addSection = (sectionType: "experience" | "education" | "custom" = "experience") => {
    const defaultTitle = sectionType === "education" ? "Education" : "New Section";
    const defaultSubtitle = sectionType === "education" ? "Institution · Program" : "";

    updateActiveVariant((variant) => ({
      ...variant,
      sections: [
        ...variant.sections,
        {
          id: uid("section"),
          type: sectionType,
          title: defaultTitle,
          subtitle: defaultSubtitle,
          itemsSubtitle: "",
          metadataItemsText: "",
          dateRange: "",
          description: "",
          focusMedia: { focusAudio: "", backgroundVideo: "", backgroundImage: "" },
          items: [],
        },
      ],
    }));
  };

  const removeSection = (sectionId: string) => {
    if (!activeVariant) {
      return;
    }

    const section = activeVariant.sections.find((entry) => entry.id === sectionId);
    if (!section) {
      return;
    }

    const confirmed = window.confirm(`Delete section \"${section.title || "Untitled section"}\" and all its items/assets? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    const sectionCollapsePrefix = `${activeVariant.id}::${sectionId}`;
    setEditorCollapseState((current) => {
      const nextCollapsedSections = { ...current.collapsedSections };
      const nextExpandedItems = { ...current.expandedItems };

      delete nextCollapsedSections[sectionCollapsePrefix];
      Object.keys(nextExpandedItems).forEach((key) => {
        if (key.startsWith(`${sectionCollapsePrefix}::`)) {
          delete nextExpandedItems[key];
        }
      });

      return {
        collapsedSections: nextCollapsedSections,
        expandedItems: nextExpandedItems,
      };
    });

    updateActiveVariant((variant) => ({
      ...variant,
      sections: variant.sections.filter((entry) => entry.id !== sectionId),
      timelineTour: {
        ...variant.timelineTour,
        steps: variant.timelineTour.steps.filter((step) => step.sectionId !== sectionId),
      },
    }));
    setStatus(`Deleted section: ${section.title || "Untitled section"}.`);
  };

  const addItem = (sectionId: string) => {
    const tagDefaults = Object.fromEntries((activeVariant?.tagDimensions ?? []).map((dimension) => [dimension.id, []]));
    updateSection(sectionId, (section) => ({
      ...section,
      items: [
        ...section.items,
        {
          id: uid("item"),
          title: "New Item",
          type: "standard",
          parentGroupId: undefined,
          dateRange: "",
          summary: "",
          detail: "",
          focusMedia: { focusAudio: "", backgroundVideo: "", backgroundImage: "" },
          assetLayout: "list",
          coverAssetId: undefined,
          tags: tagDefaults,
          assets: [],
        },
      ],
    }));
  };

  const removeItem = (sectionId: string, itemId: string) => {
    const section = activeVariant?.sections.find((entry) => entry.id === sectionId);
    const item = section?.items.find((entry) => entry.id === itemId);
    if (!section || !item || !activeVariant) {
      return;
    }

    const confirmed = window.confirm(`Delete item \"${item.title || "Untitled item"}\"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    const itemCollapseKey = `${activeVariant.id}::${sectionId}::${itemId}`;
    setEditorCollapseState((current) => {
      const nextExpandedItems = { ...current.expandedItems };
      delete nextExpandedItems[itemCollapseKey];
      return {
        ...current,
        expandedItems: nextExpandedItems,
      };
    });

    updateActiveVariant((variant) => ({
      ...variant,
      sections: variant.sections.map((currentSection) =>
        currentSection.id === sectionId
          ? { ...currentSection, items: currentSection.items.filter((entry) => entry.id !== itemId) }
          : currentSection
      ),
      timelineTour: {
        ...variant.timelineTour,
        steps: variant.timelineTour.steps.filter((step) => !(step.sectionId === sectionId && step.itemId === itemId)),
      },
    }));
    setStatus(`Deleted item: ${item.title || "Untitled item"}.`);
  };

  const addCredit = (sectionId: string, itemId: string) => {
    updateItem(sectionId, itemId, (item) => ({
      ...item,
      credits: [
        ...(item.credits ?? []),
        { id: uid("credit"), role: "", name: "", href: "", logoUrl: "" } satisfies TemplateCredit,
      ],
    }));
  };

  const updateCredit = (sectionId: string, itemId: string, creditId: string, patch: Partial<TemplateCredit>) => {
    updateItem(sectionId, itemId, (item) => ({
      ...item,
      credits: (item.credits ?? []).map((credit) =>
        credit.id === creditId ? { ...credit, ...patch } : credit
      ),
    }));
  };

  const removeCredit = (sectionId: string, itemId: string, creditId: string) => {
    updateItem(sectionId, itemId, (item) => ({
      ...item,
      credits: (item.credits ?? []).filter((credit) => credit.id !== creditId),
    }));
  };

  const addAsset = (sectionId: string, itemId: string) => {
    updateItem(sectionId, itemId, (item) => {
      const isFirstAsset = item.assets.length === 0;
      const nextAsset = {
        ...createTemplateAsset("image"),
        subType: isFirstAsset ? "cover" as const : "supporting" as const,
      };

      return {
        ...item,
        assets: [...item.assets, nextAsset],
        coverAssetId: item.coverAssetId ?? item.assets[0]?.id ?? nextAsset.id,
      };
    });
  };

  const removeAsset = (sectionId: string, itemId: string, assetId: string) => {
    updateItem(sectionId, itemId, (item) => {
      const nextAssets = item.assets.filter((asset) => asset.id !== assetId);
      const nextCoverAssetId = item.coverAssetId === assetId ? nextAssets[0]?.id : item.coverAssetId;
      const effectiveCoverAssetId = nextCoverAssetId ?? nextAssets[0]?.id;

      return {
        ...item,
        assets: nextAssets.map((asset) => ({
          ...asset,
          subType: (effectiveCoverAssetId && asset.id === effectiveCoverAssetId) ? "cover" : "supporting",
        })),
        coverAssetId: nextCoverAssetId,
      };
    });
  };

  const connectExistingAssetToItemAsset = (sectionId: string, itemId: string, assetId: string, sourceAssetKey: string) => {
    const sourceAsset = reusableUploadedAssets.find((candidate) => candidate.key === sourceAssetKey);
    if (!sourceAsset) {
      return;
    }

    updateItem(sectionId, itemId, (item) => ({
      ...item,
      assets: item.assets.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              type: sourceAsset.type,
              url: sourceAsset.url,
              preview: sourceAsset.preview ?? sourceAsset.url,
            }
          : asset
      ),
    }));
    setStatus(`Connected existing asset: ${sourceAsset.label}`);
  };

  const connectExistingAssetToGalleryChild = (
    sectionId: string,
    itemId: string,
    assetId: string,
    childAssetId: string,
    sourceAssetKey: string
  ) => {
    const sourceAsset = reusableUploadedAssets.find((candidate) => candidate.key === sourceAssetKey);
    if (!sourceAsset) {
      return;
    }

    updateItem(sectionId, itemId, (item) => ({
      ...item,
      assets: item.assets.map((asset) => {
        if (asset.id !== assetId || asset.type !== "gallery") {
          return asset;
        }

        return {
          ...asset,
          assets: (asset.assets ?? []).map((entry) =>
            entry.id === childAssetId
              ? {
                  ...entry,
                  type: sourceAsset.type,
                  url: sourceAsset.url,
                  preview: sourceAsset.preview ?? sourceAsset.url,
                }
              : entry
          ),
        };
      }),
    }));
    setStatus(`Connected existing asset: ${sourceAsset.label}`);
  };

  const addGalleryAssetEntry = (sectionId: string, itemId: string, assetId: string) => {
    let nextEntryId: string | null = null;

    updateItem(sectionId, itemId, (item) => ({
      ...item,
      assets: item.assets.map((asset) => {
        if (asset.id !== assetId || asset.type !== "gallery") {
          return asset;
        }

        const nextEntry = {
          ...createGalleryEntryAsset("image"),
          label: `Gallery Asset ${(asset.assets ?? []).length + 1}`,
        };
        const nextAssets = [...(asset.assets ?? []), nextEntry];
        nextEntryId = nextEntry.id;

        return {
          ...asset,
          assets: nextAssets,
          coverAssetId: asset.coverAssetId ?? nextEntry.id,
        };
      }),
    }));

    setStatus("Gallery media added.");

    if (nextEntryId && typeof window !== "undefined") {
      const key = getGalleryEditorKey(sectionId, itemId, assetId);
      setActiveEditorGalleryChildIds((current) => ({ ...current, [key]: nextEntryId ?? "" }));

      window.setTimeout(() => {
        const nextInput = document.querySelector<HTMLInputElement>(`[data-gallery-child-id="${nextEntryId}"]`);
        nextInput?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        nextInput?.focus();
        nextInput?.select();
      }, 0);
    }
  };

  const removeGalleryAssetEntry = (sectionId: string, itemId: string, assetId: string, childAssetId: string) => {
    updateItem(sectionId, itemId, (item) => ({
      ...item,
      assets: item.assets.map((asset) => {
        if (asset.id !== assetId || asset.type !== "gallery") {
          return asset;
        }

        const nextAssets = (asset.assets ?? []).filter((entry) => entry.id !== childAssetId);

        return {
          ...asset,
          assets: nextAssets,
          coverAssetId: asset.coverAssetId === childAssetId ? nextAssets[0]?.id : asset.coverAssetId,
        };
      }),
    }));
  };

  const moveGalleryAssetEntryToIndex = (
    sectionId: string,
    itemId: string,
    assetId: string,
    childAssetId: string,
    targetIndex: number
  ) => {
    updateItem(sectionId, itemId, (item) => ({
      ...item,
      assets: item.assets.map((asset) => {
        if (asset.id !== assetId || asset.type !== "gallery") {
          return asset;
        }

        const currentAssets = [...(asset.assets ?? [])];
        const currentIndex = currentAssets.findIndex((entry) => entry.id === childAssetId);
        if (currentIndex < 0) {
          return asset;
        }

        const nextIndex = Math.max(0, Math.min(currentAssets.length - 1, targetIndex));

        if (nextIndex === currentIndex) {
          return asset;
        }

        const [movedEntry] = currentAssets.splice(currentIndex, 1);
        if (!movedEntry) {
          return asset;
        }
        currentAssets.splice(nextIndex, 0, movedEntry);

        return {
          ...asset,
          assets: currentAssets,
        };
      }),
    }));
  };

  const suggestMissingItemFields = async (sectionId: string, itemId: string) => {
    if (!activeVariant) {
      return;
    }

    const section = activeVariant.sections.find((entry) => entry.id === sectionId);
    const item = section?.items.find((entry) => entry.id === itemId);
    if (!section || !item) {
      return;
    }

    const suggestionKey = `${sectionId}::${itemId}`;

    try {
      setSuggestingItemKey(suggestionKey);
      setStatus("Generating field suggestions...");

      const peerItems = activeVariant.sections
        .flatMap((entry) => entry.items)
        .filter((entry) => entry.id !== itemId)
        .map((entry) => ({
          title: entry.title,
          summary: entry.summary,
          detail: entry.detail,
        }));

      const response = await fetch("/api/ai/item-suggestion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profile: {
            name: template.profile.name,
            title: template.profile.title,
            summary: template.profile.summary,
          },
          variant: {
            title: activeVariant.title,
            audience: activeVariant.audience,
          },
          section: {
            title: section.title,
            subtitle: section.subtitle,
            description: section.description,
          },
          item: {
            title: item.title,
            dateRange: item.dateRange,
            summary: item.summary,
            detail: item.detail,
            assets: item.assets,
            credits: (item.credits ?? []).map((credit) => ({
              role: credit.role,
              name: credit.name,
            })),
          },
          peerItems,
        }),
      });

      const payload = (await response.json()) as {
        suggestion?: {
          sectionDescription?: string;
          summary?: string;
          detail?: string;
          assetDescriptions?: Array<{ assetId: string; description: string }>;
        };
        error?: string;
      };

      if (!response.ok || !payload.suggestion) {
        throw new Error(payload.error || "Could not generate suggestions.");
      }

      const suggestion = payload.suggestion;

      updateActiveVariant((variant) => ({
        ...variant,
        sections: variant.sections.map((entry) => {
          if (entry.id !== sectionId) {
            return entry;
          }

          return {
            ...entry,
            description: entry.description.trim() ? entry.description : (suggestion.sectionDescription ?? "").trim() || entry.description,
            items: entry.items.map((candidate) => {
              if (candidate.id !== itemId) {
                return candidate;
              }

              return {
                ...candidate,
                summary: candidate.summary.trim() ? candidate.summary : (suggestion.summary ?? "").trim() || candidate.summary,
                detail: candidate.detail.trim() ? candidate.detail : (suggestion.detail ?? "").trim() || candidate.detail,
                assets: candidate.assets.map((asset) => {
                  const suggestionForAsset = suggestion.assetDescriptions?.find((entry) => entry.assetId === asset.id);
                  if (asset.description?.trim() || !suggestionForAsset?.description?.trim()) {
                    return asset;
                  }

                  return {
                    ...asset,
                    description: suggestionForAsset.description.trim(),
                  };
                }),
              };
            }),
          };
        }),
      }));

      setStatus("Suggestions applied to empty fields.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Suggestion generation failed.");
    } finally {
      setSuggestingItemKey(null);
    }
  };

  const addTourStep = () => {
    const first = activeVariant?.sections.flatMap((section) => section.items.map((item) => ({ section, item })))[0];
    if (!activeVariant || !first) {
      return;
    }

    const step: TemplateTourStep = {
      id: uid("step"),
      label: `Step ${activeVariant.timelineTour.steps.length + 1}`,
      sectionId: first.section.id,
      itemId: first.item.id,
      durationMs: 1800,
    };

    updateActiveVariant((variant) => ({
      ...variant,
      timelineTour: { ...variant.timelineTour, steps: [...variant.timelineTour.steps, step] },
    }));
  };

  const suggestTimelineTour = () => {
    if (!activeVariant) {
      return;
    }

    const timelineField: EditorFieldContext = {
      path: `variant:${activeVariant.id}:timelineTour:stepsJson`,
      label: "Timeline tour steps (JSON)",
      value: JSON.stringify(activeVariant.timelineTour.steps, null, 2),
    };

    void sendEditorChat({
      prompt: "Generate a timeline tour based on major resume milestones. Return concise, chronological steps with clear labels and realistic durations. Prioritize signature projects and turning points.",
      selectedFields: [timelineField],
    });
  };

  const addConnection = () => {
    if (template.variants.length < 2) {
      setStatus("Add at least two variants before creating a connection.");
      return;
    }

    const sourceVariant = template.variants[0];
    const targetVariant = template.variants[1];
    const sourceSection = sourceVariant.sections[0];
    const targetSection = targetVariant.sections[0];
    const sourceItem = sourceSection?.items[0];
    const targetItem = targetSection?.items[0];
    if (!sourceSection || !targetSection || !sourceItem || !targetItem) {
      setStatus("Each of two variants needs at least one item before creating a connection.");
      return;
    }

    const connection: TemplateConnection = {
      id: uid("connection"),
      label: "Shared Thread",
      type: "career pivot",
      narrative: "Describe the connective tissue between these two resume items.",
      sourceVariantId: sourceVariant.id,
      sourceSectionId: sourceSection.id,
      sourceItemId: sourceItem.id,
      targetVariantId: targetVariant.id,
      targetSectionId: targetSection.id,
      targetItemId: targetItem.id,
    };

    updateTemplate((current) => ({ ...current, connections: [...current.connections, connection] }));
  };

  const getVariantItemOptions = (variantId: string) => {
    const variant = template.variants.find((entry) => entry.id === variantId);
    if (!variant) {
      return [] as Array<{ value: string; label: string }>;
    }
    return variant.sections.flatMap((section) =>
      section.items.map((item) => ({ value: `${section.id}::${item.id}`, label: `${section.title} — ${item.title}` }))
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
    <main onFocusCapture={captureFieldFocus} className="flex w-full flex-col gap-6">
      <header className="glass sticky top-2 z-40 px-4 py-3 sm:px-6" style={{ borderRadius: "2px", background: "rgba(10, 10, 14, 0.98)", backdropFilter: "none" }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: "var(--label)" }}>Template Builder</p>
            <p className="mt-1 text-xs" style={{ color: "var(--label)" }}>{template.title || "Untitled template"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={previewHref} className="px-3 py-2 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid #86efac55", borderRadius: "2px", color: "#86efac" }}>
              Back to Resume
            </Link>
            <button type="button" onClick={handleSaveTemplate} className="flex items-center gap-1.5 px-3 py-2 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid #fef08a55", borderRadius: "2px", color: "#fef08a" }}>
              {hasUnsavedChanges ? <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-300" title="Unsaved changes" /> : null}
              Save Template
            </button>
            <button
              type="button"
              onClick={handleTogglePublish}
              disabled={isPublishing}
              className="px-3 py-2 text-[11px] uppercase tracking-[0.16em]"
              style={{
                border: `1px solid ${isPublished ? "#fda4af66" : "#93c5fd66"}`,
                borderRadius: "2px",
                color: isPublished ? "#fda4af" : "#bfdbfe",
                opacity: isPublishing ? 0.7 : 1,
              }}
            >
              {isPublishing ? "Working..." : isPublished ? "Unpublish" : "Publish"}
            </button>
            <button
              type="button"
              onClick={handleCopyPublishedLink}
              disabled={!isPublished}
              className="px-3 py-2 text-[11px] uppercase tracking-[0.16em]"
              style={{ border: "1px solid #86efac55", borderRadius: "2px", color: "#86efac", opacity: isPublished ? 1 : 0.5 }}
            >
              Copy Link
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--label)" }}>{status}</p>
        {isPublished ? (
          <div className="mt-2 flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--label)" }}>Published URL</p>
            <input
              readOnly
              value={publishedHref}
              className="min-w-0 flex-1 border bg-transparent px-2 py-1 text-[11px]"
              style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
            />
          </div>
        ) : null}

        <details className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
          <summary className="cursor-pointer list-none text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>
            Template settings
          </summary>

          <div className="mt-3">
            <h1 className="text-2xl font-light" style={{ color: "#f0f0f0" }}>Generic Resume Collection Editor</h1>
            <p className="mt-2 text-sm" style={{ color: "var(--label)" }}>
              Build shared identity, multiple resume variants, explicit connections, media, and guided timeline tours.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
              <input
                value={template.title}
                onChange={(event) => updateTemplate((current) => ({ ...current, title: event.target.value }))}
                data-field-path="template.title"
                data-field-label="Template title"
                placeholder="Template title"
                className="border bg-transparent px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
              />
              <button
                type="button"
                onClick={startNewTemplate}
                className="px-3 py-2 text-[11px] uppercase tracking-[0.16em]"
                style={{ border: "1px solid #c4b5fd55", borderRadius: "2px", color: "#c4b5fd" }}
              >
                New Template
              </button>
            </div>

            {/* Authentication & Template Controls */}
            <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          {!supabaseEnabled ? (
            <p className="text-sm" style={{ color: "#fda4af" }}>Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {!isAuthenticated ? (
                  <Link href="/auth" className="px-3 py-2 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>
                    Sign In / Sign Up
                  </Link>
                ) : null}
                <button type="button" onClick={handleLoadTemplates} className="px-3 py-2 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>Refresh Templates</button>
                <button type="button" onClick={resetTemplate} className="px-3 py-2 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid #fda4af55", borderRadius: "2px", color: "#fda4af" }}>Clear Draft</button>
              </div>
              <p className="text-xs" style={{ color: "var(--label)" }}>{status}</p>
              
              {/* Saved Templates List */}
              {savedTemplates.length ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>Your Templates</p>
                  <ul className="space-y-2 text-xs" style={{ color: "var(--label)" }}>
                    {savedTemplates.map((row) => {
                      const normalizedRow = normalizeTemplate(row.data);
                      const selectedVariantId =
                        openVariantByTemplateId[row.id] ?? normalizedRow.defaultVariantId ?? normalizedRow.variants[0]?.id ?? "";

                      return (
                        <li key={row.id} className="flex items-center justify-between gap-2 border px-3 py-2" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
                          <input
                            value={templateTitleEdits[row.id] ?? row.title}
                            onChange={(event) =>
                              setTemplateTitleEdits((current) => ({
                                ...current,
                                [row.id]: event.target.value,
                              }))
                            }
                            className="min-w-0 flex-1 border bg-transparent px-2 py-1 text-xs"
                            style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
                            aria-label={`Template title for ${row.title}`}
                          />
                          <span className="flex items-center gap-2">
                            {normalizedRow.variants.length ? (
                            <select
                              value={selectedVariantId}
                              onChange={(event) =>
                                setOpenVariantByTemplateId((current) => ({
                                  ...current,
                                  [row.id]: event.target.value,
                                }))
                              }
                              className="px-2 py-1 uppercase tracking-[0.12em]"
                              style={{ border: "1px solid var(--border)", borderRadius: "2px", background: "transparent", color: "#e4e4e7" }}
                            >
                              {normalizedRow.variants.map((variant) => (
                                <option key={variant.id} value={variant.id}>
                                  {variant.title}
                                </option>
                              ))}
                            </select>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => {
                                void handleRenameSavedTemplate(row);
                              }}
                              className="px-2 py-1 uppercase tracking-[0.14em]"
                              style={{ border: "1px solid #86efac55", borderRadius: "2px", color: "#86efac" }}
                            >
                              Rename
                            </button>
                            <button type="button" onClick={() => { void loadTemplateIntoEditor(row.id); }} className="px-2 py-1 uppercase tracking-[0.14em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>Load</button>
                            <a href={`/?templateId=${row.id}&variantId=${encodeURIComponent(selectedVariantId)}`} target="_blank" rel="noreferrer" className="px-2 py-1 uppercase tracking-[0.14em]" style={{ border: "1px solid #fef08a55", borderRadius: "2px", color: "#fef08a" }}>Open Resume</a>
                            <button
                              type="button"
                              onClick={() => {
                                void handleDeleteSavedTemplate(row);
                              }}
                              className="px-2 py-1 uppercase tracking-[0.14em]"
                              style={{ border: "1px solid #fda4af55", borderRadius: "2px", color: "#fda4af" }}
                            >
                              Delete
                            </button>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              {hasAttemptedTemplateLoad && !savedTemplates.length ? (
                <p className="text-xs" style={{ color: "var(--label)" }}>
                  No templates to display. Make sure you are signed in as the same user that owns the templates.
                </p>
              ) : null}
            </div>
          )}
            </div>
          </div>
        </details>
      </header>

      <section className="glass px-6 py-5" style={{ borderRadius: "2px" }}>
        <h2 className="text-sm uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>Profile</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[ ["name", template.profile.name], ["title", template.profile.title], ["location", template.profile.location], ["email", template.profile.email] ].map(([field, value]) => (
            <input key={field} value={value} onChange={(event) => updateTemplate((current) => ({ ...current, profile: { ...current.profile, [field]: event.target.value } }))} data-field-path={`profile.${String(field)}`} data-field-label={`Profile ${String(field)}`} placeholder={String(field)} className="border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
          ))}
          <input value={intakeLinkedIn} onChange={(event) => setIntakeLinkedIn(event.target.value)} placeholder="LinkedIn URL" className="border bg-transparent px-3 py-2 text-sm sm:col-span-2" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            value={template.profile.heroImage ?? ""}
            onChange={(event) => updateTemplate((current) => ({ ...current, profile: { ...current.profile, heroImage: event.target.value } }))}
            data-field-path="profile.heroImage"
            data-field-label="Profile hero image"
            placeholder="Hero image URL"
            className="border bg-transparent px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
          />
          <label className="flex cursor-pointer items-center justify-center border px-3 py-2 text-[11px] uppercase tracking-[0.16em]" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>
            Upload Hero
            <input type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; void uploadHeroImageFile(file); }} />
          </label>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select
            value={template.profile.heroImageFilter ?? ""}
            onChange={(event) => updateTemplate((current) => ({ ...current, profile: { ...current.profile, heroImageFilter: event.target.value } }))}
            data-field-path="profile.heroImageFilter"
            data-field-label="Profile hero image filter"
            className="border bg-transparent px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
          >
            <option value="">Hero image filter: none</option>
            <option value="grayscale(0.15) brightness(0.78) contrast(1.08) saturate(0.75)">Dark cinematic</option>
            <option value="grayscale(0.35) brightness(0.72) contrast(1.12) saturate(0.5)">Muted noir</option>
            <option value="sepia(0.2) brightness(0.8) contrast(1.05) saturate(0.7)">Warm low-key</option>
          </select>
          <input
            value={template.profile.heroImageFilter ?? ""}
            onChange={(event) => updateTemplate((current) => ({ ...current, profile: { ...current.profile, heroImageFilter: event.target.value } }))}
            data-field-path="profile.heroImageFilter"
            data-field-label="Profile hero image filter css"
            placeholder="Custom CSS filter"
            className="border bg-transparent px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
          />
        </div>
        {template.profile.heroImage ? (
          <div className="mt-3 h-24 w-24 overflow-hidden border" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
            <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${template.profile.heroImage})`, filter: template.profile.heroImageFilter || "none" }} />
          </div>
        ) : null}

        <div className="mt-3 rounded border p-3" style={{ borderColor: "var(--border)" }}>
          <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>Hero Banner Background Media</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={template.profile.bannerBackgroundVideo ?? ""}
              onChange={(event) => updateTemplate((current) => ({ ...current, profile: { ...current.profile, bannerBackgroundVideo: event.target.value } }))}
              data-field-path="profile.bannerBackgroundVideo"
              data-field-label="Profile banner background video"
              placeholder="Banner background video URL (mp4/webm/YouTube)"
              className="border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
            />
            <label className="flex cursor-pointer items-center justify-center border px-3 py-2 text-[11px] uppercase tracking-[0.16em]" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>
              Upload Video
              <input type="file" accept="video/mp4,video/webm,.mp4,.webm" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; void uploadBannerVideoFile(file); }} />
            </label>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input
              value={template.profile.bannerBackgroundImage ?? ""}
              onChange={(event) => updateTemplate((current) => ({ ...current, profile: { ...current.profile, bannerBackgroundImage: event.target.value } }))}
              data-field-path="profile.bannerBackgroundImage"
              data-field-label="Profile banner background image"
              placeholder="Banner background image URL"
              className="border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
            />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-xs" style={{ color: "var(--label)" }}>
              Banner video visibility
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(template.profile.bannerVideoOpacity ?? 42)}
                onChange={(event) =>
                  updateTemplate((current) => ({
                    ...current,
                    profile: {
                      ...current.profile,
                      bannerVideoOpacity: Math.min(100, Math.max(0, Number(event.target.value))),
                    },
                  }))
                }
                data-field-path="profile.bannerVideoOpacity"
                data-field-label="Banner video opacity"
                className="w-28 sm:w-36"
              />
              <span className="w-10 text-right">{Math.round(template.profile.bannerVideoOpacity ?? 42)}%</span>
            </label>

            <label className="flex items-center gap-2 text-xs" style={{ color: "var(--label)" }}>
              Banner dimming overlay
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(template.profile.bannerOverlayOpacity ?? 72)}
                onChange={(event) =>
                  updateTemplate((current) => ({
                    ...current,
                    profile: {
                      ...current.profile,
                      bannerOverlayOpacity: Math.min(100, Math.max(0, Number(event.target.value))),
                    },
                  }))
                }
                data-field-path="profile.bannerOverlayOpacity"
                data-field-label="Banner overlay opacity"
                className="w-28 sm:w-36"
              />
              <span className="w-10 text-right">{Math.round(template.profile.bannerOverlayOpacity ?? 72)}%</span>
            </label>

            <input
              value={template.profile.bannerVideoFilter ?? "brightness(0.9) saturate(0.95)"}
              onChange={(event) =>
                updateTemplate((current) => ({
                  ...current,
                  profile: {
                    ...current.profile,
                    bannerVideoFilter: event.target.value,
                  },
                }))
              }
              data-field-path="profile.bannerVideoFilter"
              data-field-label="Banner video filter"
              placeholder="Banner video CSS filter"
              className="border bg-transparent px-3 py-2 text-sm sm:col-span-2"
              style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
            />
          </div>

          <div className="mt-3 rounded border p-3" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            <label className="flex items-center gap-2 text-xs" style={{ color: "var(--label)" }}>
              <input
                type="checkbox"
                checked={Boolean(template.profile.bannerVideoUseAudio)}
                onChange={(event) =>
                  updateTemplate((current) => ({
                    ...current,
                    profile: {
                      ...current.profile,
                      bannerVideoUseAudio: event.target.checked,
                    },
                  }))
                }
                data-field-path="profile.bannerVideoUseAudio"
                data-field-label="Use banner video audio"
              />
              Use banner video audio as master background track
            </label>
            {template.profile.bannerVideoUseAudio && template.profile.bannerBackgroundVideo && /youtube\.com|youtu\.be|m\.youtube\.com/i.test(template.profile.bannerBackgroundVideo) ? (
              <div className="mt-2 rounded bg-red-950 p-2 text-xs" style={{ color: "#fca5a5" }}>
                ⚠️ YouTube URLs don't support audio extraction. Use a direct video file URL (mp4/webm) for audio to play.
              </div>
            ) : null}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-xs" style={{ color: "var(--label)" }}>
                Base volume
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(template.profile.bannerVideoAudioVolume ?? 20)}
                  onChange={(event) =>
                    updateTemplate((current) => ({
                      ...current,
                      profile: {
                        ...current.profile,
                        bannerVideoAudioVolume: Math.min(100, Math.max(0, Number(event.target.value))),
                      },
                    }))
                  }
                  data-field-path="profile.bannerVideoAudioVolume"
                  data-field-label="Banner video base audio volume"
                  className="w-28 sm:w-36"
                />
                <span className="w-10 text-right">{Math.round(template.profile.bannerVideoAudioVolume ?? 20)}%</span>
              </label>

              <label className="flex items-center gap-2 text-xs" style={{ color: "var(--label)" }}>
                Ducked volume
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(template.profile.bannerVideoDuckedVolume ?? 8)}
                  onChange={(event) =>
                    updateTemplate((current) => ({
                      ...current,
                      profile: {
                        ...current.profile,
                        bannerVideoDuckedVolume: Math.min(100, Math.max(0, Number(event.target.value))),
                      },
                    }))
                  }
                  data-field-path="profile.bannerVideoDuckedVolume"
                  data-field-label="Banner video ducked audio volume"
                  className="w-28 sm:w-36"
                />
                <span className="w-10 text-right">{Math.round(template.profile.bannerVideoDuckedVolume ?? 8)}%</span>
              </label>
            </div>
          </div>

          <p className="mt-2 text-xs" style={{ color: "var(--label)" }}>
            Activation: save the template, then open preview/home. For variant-specific resumes, keep "Banner video" and/or "Banner image" enabled in that variant&apos;s profile scope. Banner audio ducking works for direct media URLs (mp4/webm); YouTube audio cannot be programmatically mixed.
          </p>
        </div>

        <textarea value={template.profile.summary} onChange={(event) => updateTemplate((current) => ({ ...current, profile: { ...current.profile, summary: event.target.value } }))} data-field-path="profile.summary" data-field-label="Profile summary" placeholder="Profile summary" className="mt-3 w-full border bg-transparent px-3 py-2 text-sm" rows={4} style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />

        {/* AI Generation Context — collapsible */}
        <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={() => setIntakeShowContext((v) => !v)}
            className="flex w-full items-center justify-between text-xs uppercase tracking-[0.18em]"
            style={{ color: "var(--label)" }}
          >
            <span>AI Generation Context</span>
            <span>{intakeShowContext ? "▲ hide" : "▼ show"}</span>
          </button>
          {intakeShowContext ? (
            <div className="mt-3 space-y-3">
              <p className="text-xs" style={{ color: "var(--label)" }}>
                Provide additional signals for AI draft generation — resume text, source URLs, documents, and extra context.
              </p>
              <textarea value={intakeWebSources} onChange={(event) => setIntakeWebSources(event.target.value)} placeholder="Associated web content URLs (one per line)" className="w-full border bg-transparent px-3 py-2 text-sm" rows={3} style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
              <textarea value={intakeResumeText} onChange={(event) => setIntakeResumeText(event.target.value)} placeholder="Paste your paper resume or existing profile text" className="w-full border bg-transparent px-3 py-2 text-sm" rows={6} style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
              <textarea value={intakeAdditionalContext} onChange={(event) => setIntakeAdditionalContext(event.target.value)} placeholder="Additional context (career goals, target role, preferred structure, constraints)" className="w-full border bg-transparent px-3 py-2 text-sm" rows={3} style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer items-center justify-center border px-3 py-2 text-[11px] uppercase tracking-[0.16em]" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>
                  Add Source Documents
                  <input type="file" multiple className="hidden" onChange={(event) => { void ingestSourceDocuments(event.target.files); }} />
                </label>
                <p className="text-xs" style={{ color: "var(--label)" }}>Text files and zips are parsed for context.</p>
              </div>
              {intakeDocuments.length ? (
                <ul className="space-y-1 text-xs" style={{ color: "var(--label)" }}>
                  {intakeDocuments.map((document, index) => (
                    <li key={`${document.name}-${index}`} className="flex items-center justify-between gap-2 border px-2 py-1" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
                      <span>{document.name}{document.url ? " (uploaded)" : ""}</span>
                      <button type="button" onClick={() => removeDocument(index)} className="text-[10px] uppercase tracking-[0.12em] hover:opacity-70" style={{ color: "#fda4af" }}>Remove</button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {lastSourceDiagnostics ? (
                <div className="space-y-1 text-xs" style={{ color: "var(--label)" }}>
                  <p>Source diagnostics: {lastSourceDiagnostics.usableSources}/{lastSourceDiagnostics.totalSources} usable, {lastSourceDiagnostics.successfulSources} fetched.</p>
                  {lastSourceDiagnostics.details.map((detail, index) => (
                    <p key={`${detail.url}-${index}`}>• {detail.url} — {detail.status}, {detail.contentLength} chars{detail.note ? ` (${detail.note})` : ""}</p>
                  ))}
                </div>
              ) : null}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { void generateDraftFromIntake(); }}
                  disabled={isGeneratingDraft || !hasContentForGeneration()}
                  className="px-3 py-2 text-[11px] uppercase tracking-[0.16em]"
                  style={{ border: "1px solid #fef08a55", borderRadius: "2px", color: "#fef08a", opacity: isGeneratingDraft || !hasContentForGeneration() ? 0.5 : 1 }}
                >
                  {isGeneratingDraft ? "Generating..." : "Generate AI Draft"}
                </button>
                {lastGeneratedSummary ? (
                  <p className="text-xs" style={{ color: "#86efac" }}>
                    Draft ready: {lastGeneratedSummary.variants}v · {lastGeneratedSummary.sections}s · {lastGeneratedSummary.items}i
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="glass px-6 py-5" style={{ borderRadius: "2px" }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>Resume Variants</h2>
            <p className="mt-1 text-xs" style={{ color: "var(--label)" }}>Create separate creative, technical, or audience-specific resume narratives.</p>
          </div>
          <button type="button" onClick={addVariant} className="px-3 py-1 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>Add Variant</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {template.variants.map((variant) => (
            <button key={variant.id} type="button" onClick={() => setActiveVariantId(variant.id)} className="px-3 py-1 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: activeVariantId === variant.id ? "#f0f0f0" : "var(--label)", background: activeVariantId === variant.id ? "rgba(255,255,255,0.08)" : "transparent" }}>{variant.title}</button>
          ))}
        </div>
        {activeVariant ? (
          <>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <input value={activeVariant.title} onChange={(event) => updateActiveVariant((variant) => ({ ...variant, title: event.target.value }))} data-field-path={`variant:${activeVariant.id}:title`} data-field-label="Variant title" placeholder="Variant title" className="border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
              <input value={activeVariant.audience ?? ""} onChange={(event) => updateActiveVariant((variant) => ({ ...variant, audience: event.target.value }))} data-field-path={`variant:${activeVariant.id}:audience`} data-field-label="Variant audience" placeholder="Audience / perspective" className="border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
            </div>

            <div className="mt-3 border p-3" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
              <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>
                Variant Profile Scope
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--label)" }}>
                Choose which top-level profile fields this variant should use in resume output.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {PROFILE_SCOPE_OPTIONS.map((option) => {
                  const scope = activeVariant.profileScope?.length
                    ? activeVariant.profileScope
                    : TEMPLATE_PROFILE_SCOPE_FIELDS;

                  return (
                    <label key={option.field} className="flex items-center gap-2 text-xs" style={{ color: "#e4e4e7" }}>
                      <input
                        type="checkbox"
                        checked={scope.includes(option.field)}
                        onChange={(event) => toggleVariantProfileScope(option.field, event.target.checked)}
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
      </section>

      <section className="glass px-6 py-5" style={{ borderRadius: "2px" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>Sort Filters · {activeVariant?.title ?? "No Variant"}</h2>
          <button type="button" onClick={addDimension} className="px-3 py-1 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>Add Filter</button>
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--label)" }}>
          Filters below apply only to the currently selected variant.
        </p>
        <div className="mt-4 space-y-3">
          {(activeVariant?.tagDimensions ?? []).map((dimension) => (
            <div key={dimension.id} className="border p-3" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
              <div className="grid gap-2 sm:grid-cols-3">
                <input value={dimension.label} onChange={(event) => updateActiveVariant((variant) => ({ ...variant, tagDimensions: variant.tagDimensions.map((item) => item.id === dimension.id ? { ...item, label: event.target.value } : item) }))} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:dimension:${dimension.id}:label`} data-field-label="Sort filter label" className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                <input
                  value={dimensionIdDrafts[dimension.id] ?? dimension.id}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setDimensionIdDrafts((current) => ({
                      ...current,
                      [dimension.id]: nextValue,
                    }));
                  }}
                  onBlur={() => commitDimensionIdDraft(dimension.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitDimensionIdDraft(dimension.id);
                    }
                  }}
                  data-field-path={`variant:${activeVariant?.id ?? "unknown"}:dimension:${dimension.id}:id`}
                  data-field-label="Sort filter id"
                  placeholder="filter-id (spaces allowed)"
                  className="border bg-transparent px-2 py-1 text-sm"
                  style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
                />
                <label className="flex items-center gap-2 text-xs" style={{ color: "var(--label)" }}><input type="checkbox" checked={dimension.allowMultiple} onChange={(event) => updateActiveVariant((variant) => ({ ...variant, tagDimensions: variant.tagDimensions.map((item) => item.id === dimension.id ? { ...item, allowMultiple: event.target.checked } : item) }))} />Allow multiple values</label>
              </div>
              <input value={dimension.options.join(", ")} onChange={(event) => updateActiveVariant((variant) => ({ ...variant, tagDimensions: variant.tagDimensions.map((item) => item.id === dimension.id ? { ...item, options: parseTagInput(event.target.value) } : item) }))} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:dimension:${dimension.id}:options`} data-field-label="Sort filter options" placeholder="option-a, option-b" className="mt-2 w-full border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
            </div>
          ))}
        </div>
      </section>

      <section id="sections-editor-anchor" className="glass px-6 py-5" style={{ borderRadius: "2px" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>Sections + Items + Media</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => addSection("education")} className="px-3 py-1 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid #93c5fd66", borderRadius: "2px", color: "#bfdbfe" }}>Add Education</button>
            <button type="button" onClick={() => addSection("experience")} className="px-3 py-1 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>Add Section</button>
          </div>
        </div>
        <div className="mt-4 space-y-4">
          {sortSectionsByDateDesc(activeVariant?.sections ?? []).map((section) => (
            <article key={section.id} className="border p-4" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
              <details
                open={activeVariant ? !editorCollapseState.collapsedSections[`${activeVariant.id}::${section.id}`] : true}
                onToggle={(event) => {
                  if (!activeVariant) {
                    return;
                  }
                  const collapseKey = `${activeVariant.id}::${section.id}`;
                  const isExpanded = event.currentTarget.open;
                  setEditorCollapseState((current) => {
                    const nextCollapsedSections = { ...current.collapsedSections };
                    if (isExpanded) {
                      delete nextCollapsedSections[collapseKey];
                    } else {
                      nextCollapsedSections[collapseKey] = true;
                    }
                    return {
                      ...current,
                      collapsedSections: nextCollapsedSections,
                    };
                  });
                }}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left">
                  <p className="truncate text-xs uppercase tracking-[0.16em]" style={{ color: "#f0f0f0" }}>{section.title || "Untitled section"}</p>
                  <span className="flex items-center gap-2">
                    <p className="shrink-0 text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--label)" }}>{section.items.length} item{section.items.length === 1 ? "" : "s"}</p>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        removeSection(section.id);
                      }}
                      className="px-2 py-1 text-[10px] uppercase tracking-[0.14em]"
                      style={{ border: "1px solid #fda4af66", borderRadius: "2px", color: "#fda4af" }}
                    >
                      Delete Section
                    </button>
                  </span>
                </summary>
                <div className="mt-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={section.title} onChange={(event) => updateSection(section.id, (current) => ({ ...current, title: event.target.value }))} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:title`} data-field-label="Section title" placeholder="Section title" className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                <input value={section.subtitle} onChange={(event) => updateSection(section.id, (current) => ({ ...current, subtitle: event.target.value }))} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:subtitle`} data-field-label="Section subtitle" placeholder="Section subtitle" className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
              </div>
              <select value={section.type ?? "experience"} onChange={(event) => updateSection(section.id, (current) => ({ ...current, type: event.target.value as "experience" | "education" | "custom" }))} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:type`} data-field-label="Section type" className="mt-2 w-full border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}><option value="experience">experience</option><option value="education">education</option><option value="custom">custom</option></select>
              <input value={section.dateRange ?? ""} onChange={(event) => updateSection(section.id, (current) => ({ ...current, dateRange: event.target.value }))} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:dateRange`} data-field-label="Section date range" placeholder="Section date range (e.g. 2020 - Present)" className="mt-2 w-full border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
              <textarea value={section.description} onChange={(event) => updateSection(section.id, (current) => ({ ...current, description: event.target.value }))} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:description`} data-field-label="Section description" placeholder="Section description" className="mt-2 w-full border bg-transparent px-2 py-1 text-sm" rows={2} style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <input
                  value={section.focusMedia?.focusAudio ?? ""}
                  onChange={(event) => updateSection(section.id, (current) => ({
                    ...current,
                    focusMedia: {
                      ...(current.focusMedia ?? {}),
                      focusAudio: event.target.value,
                    },
                  }))}
                  data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:focusAudio`}
                  data-field-label="Section audio"
                  placeholder="Section audio URL"
                  className="border bg-transparent px-2 py-1 text-sm"
                  style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
                />
                <input
                  value={section.focusMedia?.backgroundVideo ?? ""}
                  onChange={(event) => updateSection(section.id, (current) => ({
                    ...current,
                    focusMedia: {
                      ...(current.focusMedia ?? {}),
                      backgroundVideo: event.target.value,
                    },
                  }))}
                  data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:backgroundVideo`}
                  data-field-label="Section background video"
                  placeholder="Section BG video URL"
                  className="border bg-transparent px-2 py-1 text-sm"
                  style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
                />
                <input
                  value={section.focusMedia?.backgroundImage ?? ""}
                  onChange={(event) => updateSection(section.id, (current) => ({
                    ...current,
                    focusMedia: {
                      ...(current.focusMedia ?? {}),
                      backgroundImage: event.target.value,
                    },
                  }))}
                  data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:backgroundImage`}
                  data-field-label="Section background image"
                  placeholder="Section BG image URL"
                  className="border bg-transparent px-2 py-1 text-sm"
                  style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
                />
              </div>
              <input value={section.itemsSubtitle ?? ""} onChange={(event) => updateSection(section.id, (current) => ({ ...current, itemsSubtitle: event.target.value }))} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:itemsSubtitle`} data-field-label="Section items subtitle" placeholder="Items subtitle (e.g. Select works)" className="mt-3 w-full border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
              <textarea value={section.metadataItemsText ?? ""} onChange={(event) => updateSection(section.id, (current) => ({ ...current, metadataItemsText: event.target.value }))} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:metadataItemsText`} data-field-label="Section additional credits" placeholder="Section-level additional credits (one per line, e.g. Show Name — 2019)" className="mt-2 w-full border bg-transparent px-2 py-1 text-sm" rows={3} style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
              {!section.items.length ? (
                <div className="mt-3 border border-dashed px-3 py-3" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
                  <p className="text-xs" style={{ color: "var(--label)" }}>
                    No items in this section yet. Add your first item to set title, dates, summary, and media assets.
                  </p>
                  <button
                    type="button"
                    onClick={() => addItem(section.id)}
                    className="mt-2 px-3 py-1 text-[11px] uppercase tracking-[0.16em]"
                    style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}
                  >
                    Add First Item
                  </button>
                </div>
              ) : null}
              <div className="mt-3 space-y-0">
                {section.items.map((item) => (
                  <details
                    key={item.id}
                    open={activeVariant ? Boolean(editorCollapseState.expandedItems[`${activeVariant.id}::${section.id}::${item.id}`]) : false}
                    onToggle={(event) => {
                      if (!activeVariant) {
                        return;
                      }
                      const collapseKey = `${activeVariant.id}::${section.id}::${item.id}`;
                      const isExpanded = event.currentTarget.open;
                      setEditorCollapseState((current) => {
                        const nextExpandedItems = { ...current.expandedItems };
                        if (isExpanded) {
                          nextExpandedItems[collapseKey] = true;
                        } else {
                          delete nextExpandedItems[collapseKey];
                        }
                        return {
                          ...current,
                          expandedItems: nextExpandedItems,
                        };
                      });
                    }}
                    className="-mt-px border first:mt-0"
                    style={{ borderColor: "var(--border)", borderRadius: "0" }}
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-left">
                      <p className="truncate text-xs uppercase tracking-[0.14em]" style={{ color: "#f0f0f0" }}>{item.title || "Untitled item"}</p>
                      <span className="flex items-center gap-2">
                        <p className="shrink-0 text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--label)" }}>{item.assets.length} asset{item.assets.length === 1 ? "" : "s"}</p>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            addAsset(section.id, item.id);
                          }}
                          className="px-2 py-1 text-[10px] uppercase tracking-[0.14em]"
                          style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}
                        >
                          Add Asset
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            removeItem(section.id, item.id);
                          }}
                          className="px-2 py-1 text-[10px] uppercase tracking-[0.14em]"
                          style={{ border: "1px solid #fda4af66", borderRadius: "2px", color: "#fda4af" }}
                        >
                          Delete Item
                        </button>
                      </span>
                    </summary>
                    <div className="px-3 pb-3 pt-1">
                    <input value={item.title} onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, title: event.target.value }))} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:item:${item.id}:title`} data-field-label="Item title" placeholder="Item title" className="w-full border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--label)" }}>Item Type</p>
                        <select
                          value={item.type ?? "standard"}
                          onChange={(event) => {
                            const nextType = event.target.value === "innovation"
                              ? "innovation"
                              : event.target.value === "group"
                                ? "group"
                                : "standard";
                            updateItem(section.id, item.id, (current) => ({
                              ...current,
                              type: nextType,
                              parentGroupId: nextType === "group" ? undefined : current.parentGroupId,
                              sourceContext: nextType === "innovation" ? current.sourceContext : "",
                            }));
                          }}
                          className="w-full border bg-transparent px-2 py-1 text-sm"
                          style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
                        >
                          <option value="standard">Standard</option>
                          <option value="innovation">Innovation</option>
                          <option value="group">Group Container</option>
                        </select>
                      </div>

                      {(section.items.filter((entry) => entry.type === "group" && entry.id !== item.id)).length > 0 && item.type !== "group" ? (
                        <div>
                          <p className="mb-1 text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--label)" }}>Parent Group</p>
                          <select
                            value={item.parentGroupId ?? ""}
                            onChange={(event) =>
                              updateItem(section.id, item.id, (current) => ({
                                ...current,
                                parentGroupId: event.target.value || undefined,
                              }))
                            }
                            className="w-full border bg-transparent px-2 py-1 text-sm"
                            style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
                          >
                            <option value="">No parent group</option>
                            {section.items
                              .filter((entry) => entry.type === "group" && entry.id !== item.id)
                              .map((groupItem) => (
                                <option key={groupItem.id} value={groupItem.id}>
                                  {groupItem.title || "Untitled group"}
                                </option>
                              ))}
                          </select>
                        </div>
                      ) : null}
                    </div>

                    {item.type === "group" ? (
                      <p className="mt-2 text-[11px] font-light" style={{ color: "rgba(255,255,255,0.42)" }}>
                        Group containers render as subsection headers and can own child items via Parent Group.
                      </p>
                    ) : null}

                    {item.type === "innovation" && (
                      <input
                        value={item.sourceContext ?? ""}
                        onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, sourceContext: event.target.value }))}
                        placeholder="Development context (optional)"
                        className="mt-2 w-full border bg-transparent px-2 py-1 text-sm"
                        style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
                      />
                    )}
                    <input value={item.dateRange ?? ""} onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, dateRange: event.target.value }))} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:item:${item.id}:dateRange`} data-field-label="Item date range" placeholder="Item date range (e.g. Jan 2022 - Mar 2024)" className="mt-2 w-full border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                    <textarea value={item.summary} onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, summary: event.target.value }))} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:item:${item.id}:summary`} data-field-label="Item summary" placeholder="Item summary" className="mt-2 w-full border bg-transparent px-2 py-1 text-sm" rows={3} style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                    <textarea value={item.detail} onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, detail: event.target.value }))} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:item:${item.id}:detail`} data-field-label="Item detail" placeholder="Detailed narrative" className="mt-2 w-full border bg-transparent px-2 py-1 text-sm" rows={4} style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                    {/* Credits */}
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--label)" }}>Credits</p>
                      <button type="button" onClick={() => addCredit(section.id, item.id)} className="px-2 py-1 text-[10px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>Add Credit</button>
                    </div>
                    {(item.credits ?? []).length > 0 && (
                      <div className="mt-2 space-y-2">
                        {(item.credits ?? []).map((credit) => (
                          <div key={credit.id} className="grid gap-1.5 border p-2 sm:grid-cols-4" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
                            <input
                              value={credit.role}
                              onChange={(event) => updateCredit(section.id, item.id, credit.id, { role: event.target.value })}
                              placeholder="Role (e.g. Producer)"
                              className="border bg-transparent px-2 py-1 text-sm"
                              style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
                            />
                            <input
                              value={credit.name}
                              onChange={(event) => updateCredit(section.id, item.id, credit.id, { name: event.target.value })}
                              placeholder="Name"
                              className="border bg-transparent px-2 py-1 text-sm"
                              style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
                            />
                            <input
                              value={credit.href ?? ""}
                              onChange={(event) => updateCredit(section.id, item.id, credit.id, { href: event.target.value })}
                              placeholder="Link URL (optional)"
                              className="border bg-transparent px-2 py-1 text-sm"
                              style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
                            />
                            <div className="flex gap-1.5">
                              <input
                                value={credit.logoUrl ?? ""}
                                onChange={(event) => updateCredit(section.id, item.id, credit.id, { logoUrl: event.target.value })}
                                placeholder="Logo URL (optional)"
                                className="min-w-0 flex-1 border bg-transparent px-2 py-1 text-sm"
                                style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
                              />
                              <button type="button" onClick={() => removeCredit(section.id, item.id, credit.id)} className="shrink-0 border px-2 py-1 text-[10px] uppercase tracking-[0.16em]" style={{ borderColor: "#fda4af55", borderRadius: "2px", color: "#fda4af" }}>✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <input
                        value={item.focusMedia?.focusAudio ?? ""}
                        onChange={(event) => updateItem(section.id, item.id, (current) => ({
                          ...current,
                          focusMedia: {
                            ...(current.focusMedia ?? {}),
                            focusAudio: event.target.value,
                          },
                        }))}
                        data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:item:${item.id}:focusAudio`}
                        data-field-label="Item audio"
                        placeholder="Item audio URL"
                        className="border bg-transparent px-2 py-1 text-sm"
                        style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
                      />
                      <input
                        value={item.focusMedia?.backgroundVideo ?? ""}
                        onChange={(event) => updateItem(section.id, item.id, (current) => ({
                          ...current,
                          focusMedia: {
                            ...(current.focusMedia ?? {}),
                            backgroundVideo: event.target.value,
                          },
                        }))}
                        data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:item:${item.id}:backgroundVideo`}
                        data-field-label="Item background video"
                        placeholder="Item BG video URL"
                        className="border bg-transparent px-2 py-1 text-sm"
                        style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
                      />
                      <input
                        value={item.focusMedia?.backgroundImage ?? ""}
                        onChange={(event) => updateItem(section.id, item.id, (current) => ({
                          ...current,
                          focusMedia: {
                            ...(current.focusMedia ?? {}),
                            backgroundImage: event.target.value,
                          },
                        }))}
                        data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:item:${item.id}:backgroundImage`}
                        data-field-label="Item background image"
                        placeholder="Item BG image URL"
                        className="border bg-transparent px-2 py-1 text-sm"
                        style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void suggestMissingItemFields(section.id, item.id);
                      }}
                      disabled={suggestingItemKey === `${section.id}::${item.id}`}
                      className="mt-2 px-2 py-1 text-[10px] uppercase tracking-[0.14em]"
                      style={{ border: "1px solid #fef08a55", borderRadius: "2px", color: "#fef08a", opacity: suggestingItemKey === `${section.id}::${item.id}` ? 0.6 : 1 }}
                    >
                      {suggestingItemKey === `${section.id}::${item.id}` ? "Suggesting..." : "Suggest Missing Fields"}
                    </button>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {(activeVariant?.tagDimensions ?? []).map((dimension) => (
                        <input key={`${item.id}-${dimension.id}`} value={(item.tags[dimension.id] ?? []).join(", ")} onChange={(event) => updateItemDimensionTags(section.id, item.id, dimension.id, event.target.value)} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:item:${item.id}:tag:${dimension.id}`} data-field-label={`${dimension.label} tag values`} placeholder={`${dimension.label} values`} className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--label)" }}>Media Assets</p>
                      <button type="button" onClick={() => addAsset(section.id, item.id)} className="px-2 py-1 text-[10px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>Add Asset</button>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <select
                        value={item.coverAssetId ?? ""}
                        onChange={(event) =>
                          updateItem(section.id, item.id, (current) => {
                            const explicitCoverAssetId = event.target.value || undefined;
                            const effectiveCoverAssetId = explicitCoverAssetId ?? current.assets[0]?.id;

                            return {
                              ...current,
                              coverAssetId: explicitCoverAssetId,
                              assets: current.assets.map((candidate) => ({
                                ...candidate,
                                subType: (effectiveCoverAssetId && candidate.id === effectiveCoverAssetId) ? "cover" : "supporting",
                              })),
                            };
                          })
                        }
                        data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:item:${item.id}:coverAssetId`}
                        data-field-label="Item cover asset"
                        className="border bg-transparent px-2 py-1 text-sm"
                        style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
                      >
                        <option value="">Cover asset: first media</option>
                        {item.assets.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.label || candidate.id}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-2 space-y-3">
                      {item.assets.map((asset) => {
                        const galleryAssets = asset.assets ?? [];
                        const galleryEditorKey = getGalleryEditorKey(section.id, item.id, asset.id);
                        const selectedGalleryChildId = activeEditorGalleryChildIds[galleryEditorKey]
                          ?? asset.coverAssetId
                          ?? getGalleryCoverAsset(asset)?.id
                          ?? galleryAssets[0]?.id
                          ?? null;
                        const selectedGalleryChild = selectedGalleryChildId
                          ? galleryAssets.find((childAsset) => childAsset.id === selectedGalleryChildId) ?? null
                          : null;

                        return (
                          <div key={asset.id} className="grid gap-2 border p-3 sm:grid-cols-4" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
                            {/* Row 1: label | type | (layout if gallery, else subType) | aspect+remove */}
                            <input value={asset.label} onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, assets: current.assets.map((token) => token.id === asset.id ? { ...token, label: event.target.value } : token) }))} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:item:${item.id}:asset:${asset.id}:label`} data-field-label="Asset label" placeholder="Label" className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                            <select value={asset.type} onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, assets: current.assets.map((token) => token.id === asset.id ? convertTemplateAssetType(token, event.target.value as TemplateAsset["type"]) : token) }))} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:item:${item.id}:asset:${asset.id}:type`} data-field-label="Asset type" className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}><option value="image">image</option><option value="video">video</option><option value="doc">doc</option><option value="iframe">iframe</option><option value="gallery">gallery</option></select>
                            {asset.type === "gallery" ? (
                              <select value={asset.galleryLayout ?? "masonry"} onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, assets: current.assets.map((token) => token.id === asset.id ? { ...token, galleryLayout: event.target.value as "masonry" | "carousel" } : token) }))} className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}>
                                <option value="masonry">masonry</option>
                                <option value="carousel">carousel</option>
                              </select>
                            ) : (
                              <div className="flex items-center border px-2 py-1 text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "var(--label)" }}>
                                Cover set above
                              </div>
                            )}
                            <div className="flex gap-2 sm:items-stretch">
                              {asset.type !== "gallery" ? (
                                <select value={asset.aspectRatio ?? "16/9"} onChange={(event) => updateAssetLayout(section.id, item.id, asset.id, { aspectRatio: event.target.value as "auto" | "16/9" | "4/3" | "1/1" | "3/4" | "9/16" | "21/9" })} className="min-w-0 flex-1 border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}>
                                  <option value="auto">auto ratio</option>
                                  <option value="16/9">16:9</option>
                                  <option value="4/3">4:3</option>
                                  <option value="1/1">1:1</option>
                                  <option value="3/4">3:4</option>
                                  <option value="9/16">9:16</option>
                                  <option value="21/9">21:9</option>
                                </select>
                              ) : <div className="flex-1" />}
                              <button type="button" onClick={() => removeAsset(section.id, item.id, asset.id)} className="shrink-0 border px-2 py-1 text-[10px] uppercase tracking-[0.16em]" style={{ borderColor: "#fda4af55", borderRadius: "2px", color: "#fda4af" }}>Remove</button>
                            </div>

                            <textarea value={asset.description ?? ""} onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, assets: current.assets.map((token) => token.id === asset.id ? { ...token, description: event.target.value } : token) }))} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:item:${item.id}:asset:${asset.id}:description`} data-field-label="Asset description" placeholder="Asset description / context" className="border bg-transparent px-2 py-1 text-sm sm:col-span-4" rows={2} style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />

                            {asset.type === "gallery" ? (
                              <>
                                {/* Gallery toolbar: cover + upload + add */}
                                <div className="sm:col-span-4 flex flex-wrap items-center gap-2">
                                  <select
                                    value={asset.coverAssetId ?? ""}
                                    onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, assets: current.assets.map((token) => token.id === asset.id ? { ...token, coverAssetId: event.target.value || undefined } : token) }))}
                                    className="flex-1 border bg-transparent px-2 py-1 text-sm"
                                    style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7", minWidth: "8rem" }}
                                  >
                                    <option value="">Cover: first child</option>
                                    {galleryAssets.map((childAsset) => (
                                      <option key={childAsset.id} value={childAsset.id}>{childAsset.label || childAsset.id}</option>
                                    ))}
                                  </select>
                                  <label className="cursor-pointer border px-2 py-1.5 text-[10px] uppercase tracking-[0.16em]" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>
                                    Upload media
                                    <input type="file" multiple accept="image/*,video/*,.pdf,application/pdf" className="hidden" onChange={(event) => { const files = event.target.files; if (!files?.length) return; void uploadGalleryAssetFiles(files, section.id, item.id, asset.id); event.currentTarget.value = ""; }} />
                                  </label>
                                  <button type="button" onClick={() => addGalleryAssetEntry(section.id, item.id, asset.id)} className="border px-2 py-1.5 text-[10px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>+ Blank</button>
                                </div>

                                <div className="sm:col-span-4 border p-3" style={{ borderColor: "rgba(255,255,255,0.08)", borderRadius: "2px" }}>
                                  <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--label)" }}>Gallery preview — {asset.galleryLayout === "carousel" ? "carousel" : "masonry"}</p>
                                  <div className="mt-3 overflow-y-auto border bg-black/60 p-2" style={{ borderColor: "var(--border)", borderRadius: "2px", minHeight: "28rem" }}>
                                    {galleryAssets.length ? (
                                      asset.galleryLayout === "carousel" ? (
                                        <div className="flex gap-2 overflow-x-auto pb-1">
                                          {galleryAssets.map((childAsset) => {
                                            const previewSrc = getTemplateAssetPreviewSource(childAsset);
                                            const isActiveChild = childAsset.id === (asset.coverAssetId ?? getGalleryCoverAsset(asset)?.id);

                                            return (
                                              <button
                                                type="button"
                                                key={`${childAsset.id}-preview`}
                                                onClick={() => setActiveEditorGalleryChildIds((current) => ({ ...current, [galleryEditorKey]: childAsset.id }))}
                                                className="min-w-[11rem] shrink-0 overflow-hidden border"
                                                style={{
                                                  borderColor: isActiveChild ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.12)",
                                                  borderRadius: "2px",
                                                  aspectRatio: childAsset.aspectRatio && childAsset.aspectRatio !== "auto" ? childAsset.aspectRatio : "16/9",
                                                }}
                                              >
                                                {childAsset.type === "image" && previewSrc ? (
                                                  <img src={previewSrc} alt={childAsset.label || "Gallery preview"} className="pointer-events-none h-full w-full" style={{ objectFit: childAsset.fit ?? "cover", objectPosition: `${childAsset.focusX ?? 50}% ${childAsset.focusY ?? 50}%` }} />
                                                ) : childAsset.type === "video" && previewSrc ? (
                                                  <video src={previewSrc} className="pointer-events-none h-full w-full" muted loop autoPlay playsInline style={{ objectFit: childAsset.fit ?? "cover", objectPosition: `${childAsset.focusX ?? 50}% ${childAsset.focusY ?? 50}%` }} />
                                                ) : childAsset.type === "doc" && previewSrc && isPdfSource(previewSrc, childAsset.mimeType) ? (
                                                  <iframe src={`${previewSrc}#toolbar=0&navpanes=0&scrollbar=0`} title={childAsset.label || "Gallery document preview"} className="pointer-events-none h-full w-full bg-black" />
                                                ) : childAsset.type === "iframe" && previewSrc ? (
                                                  <iframe src={previewSrc} title={childAsset.label || "Gallery embed preview"} className="pointer-events-none h-full w-full bg-black" style={{ border: 0 }} />
                                                ) : (
                                                  <div className="flex h-full w-full items-center justify-center px-3 text-center text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--label)" }}>
                                                    {childAsset.type === "doc" ? "PDF / Doc" : childAsset.type === "iframe" ? "Embed" : "No preview"}
                                                  </div>
                                                )}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div className="columns-2 gap-0.5">
                                          {galleryAssets.map((childAsset) => {
                                            const previewSrc = getTemplateAssetPreviewSource(childAsset);
                                            const isActiveChild = childAsset.id === (asset.coverAssetId ?? getGalleryCoverAsset(asset)?.id);

                                            return (
                                              <button
                                                type="button"
                                                key={`${childAsset.id}-preview`}
                                                onClick={() => setActiveEditorGalleryChildIds((current) => ({ ...current, [galleryEditorKey]: childAsset.id }))}
                                                className="mb-0.5 block w-full break-inside-avoid overflow-hidden"
                                                style={{
                                                  outline: isActiveChild ? "2px solid rgba(255,255,255,0.55)" : "none",
                                                  outlineOffset: "-2px",
                                                }}
                                              >
                                                {childAsset.type === "image" && previewSrc ? (
                                                  <img src={previewSrc} alt={childAsset.label || "Gallery preview"} className="pointer-events-none block w-full" />
                                                ) : childAsset.type === "video" && previewSrc ? (
                                                  <video src={previewSrc} className="pointer-events-none block w-full" muted loop autoPlay playsInline />
                                                ) : childAsset.type === "doc" && previewSrc ? (
                                                  <iframe src={`${previewSrc}#toolbar=0&navpanes=0&scrollbar=0`} title={childAsset.label || "Gallery document preview"} className="pointer-events-none h-40 w-full bg-black" />
                                                ) : childAsset.type === "iframe" && previewSrc ? (
                                                  <iframe src={previewSrc} title={childAsset.label || "Gallery embed preview"} className="pointer-events-none h-40 w-full bg-black" style={{ border: 0 }} />
                                                ) : previewSrc ? (
                                                  <iframe src={`${previewSrc}#toolbar=0&navpanes=0&scrollbar=0`} title={childAsset.label || "Gallery document preview"} className="pointer-events-none h-40 w-full bg-black" />
                                                ) : (
                                                  <div className="flex h-24 w-full items-center justify-center text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--label)", background: "#111" }}>
                                                    {childAsset.type === "doc" ? "PDF / Doc" : childAsset.type === "iframe" ? "Embed" : "No preview"}
                                                  </div>
                                                )}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )
                                    ) : (
                                      <div className="flex min-h-[8rem] items-center justify-center text-center text-xs" style={{ color: "var(--label)" }}>
                                        Upload multiple files into this gallery to preview the {asset.galleryLayout === "carousel" ? "carousel" : "masonry"} layout here.
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="sm:col-span-4 space-y-2">
                                  {galleryAssets.length ? (
                                    <>
                                      <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--label)" }}>
                                        Drag cards to reorder (matches side panel order)
                                      </p>
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        {galleryAssets.map((childAsset, childIndex) => {
                                          const isSelected = childAsset.id === selectedGalleryChild?.id;
                                          const isCover = childAsset.id === (asset.coverAssetId ?? getGalleryCoverAsset(asset)?.id);

                                          return (
                                            <div
                                              key={`${childAsset.id}-selector`}
                                              draggable
                                              onDragStart={(event) => {
                                                event.dataTransfer.effectAllowed = "move";
                                                event.dataTransfer.setData("text/gallery-child-id", childAsset.id);
                                              }}
                                              onDragOver={(event) => {
                                                event.preventDefault();
                                                event.dataTransfer.dropEffect = "move";
                                              }}
                                              onDrop={(event) => {
                                                event.preventDefault();
                                                const draggedId = event.dataTransfer.getData("text/gallery-child-id");
                                                if (!draggedId || draggedId === childAsset.id) {
                                                  return;
                                                }
                                                moveGalleryAssetEntryToIndex(section.id, item.id, asset.id, draggedId, childIndex);
                                              }}
                                              className="flex cursor-move items-center gap-2 border px-2 py-2"
                                              style={{ borderColor: isSelected ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.08)", borderRadius: "2px" }}
                                            >
                                              <button
                                                type="button"
                                                onClick={() => setActiveEditorGalleryChildIds((current) => ({ ...current, [galleryEditorKey]: childAsset.id }))}
                                                className="min-w-0 flex-1 text-left"
                                              >
                                                <p className="truncate text-xs uppercase tracking-[0.14em]" style={{ color: "#f0f0f0" }}>{childAsset.label || "Untitled"}</p>
                                                <p className="mt-1 text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--label)" }}>
                                                  #{childIndex + 1} · {childAsset.type}{isCover ? " · cover" : ""}
                                                </p>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  removeGalleryAssetEntry(section.id, item.id, asset.id, childAsset.id);
                                                  if (selectedGalleryChild?.id === childAsset.id) {
                                                    const fallback = galleryAssets.find((entry) => entry.id !== childAsset.id);
                                                    setActiveEditorGalleryChildIds((current) => {
                                                      const next = { ...current };
                                                      if (fallback) {
                                                        next[galleryEditorKey] = fallback.id;
                                                      } else {
                                                        delete next[galleryEditorKey];
                                                      }
                                                      return next;
                                                    });
                                                  }
                                                }}
                                                className="shrink-0 border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
                                                style={{ borderColor: "#fda4af55", borderRadius: "2px", color: "#fda4af" }}
                                              >
                                                Remove
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>

                                      {selectedGalleryChild ? (
                                        <div className="grid gap-2 border p-3 sm:grid-cols-4" style={{ borderColor: "rgba(255,255,255,0.08)", borderRadius: "2px" }}>
                                          <select
                                            value=""
                                            onChange={(event) => {
                                              const sourceAssetKey = event.target.value;
                                              if (!sourceAssetKey) {
                                                return;
                                              }
                                              connectExistingAssetToGalleryChild(section.id, item.id, asset.id, selectedGalleryChild.id, sourceAssetKey);
                                              event.currentTarget.value = "";
                                            }}
                                            className="border bg-transparent px-2 py-1 text-sm sm:col-span-4"
                                            style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
                                          >
                                            <option value="">Connect previously uploaded asset…</option>
                                            {reusableUploadedAssets.map((sourceAsset) => (
                                              <option key={`gallery-child-link-${sourceAsset.key}`} value={sourceAsset.key}>
                                                {sourceAsset.type} · {sourceAsset.label}
                                              </option>
                                            ))}
                                          </select>
                                          <input value={selectedGalleryChild.label} onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, assets: current.assets.map((token) => token.id !== asset.id ? token : { ...token, assets: (token.assets ?? []).map((entry) => entry.id === selectedGalleryChild.id ? { ...entry, label: event.target.value } : entry) }) }))} data-gallery-child-id={selectedGalleryChild.id} placeholder="Gallery asset label" className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                                          <select value={selectedGalleryChild.type} onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, assets: current.assets.map((token) => token.id !== asset.id ? token : { ...token, assets: (token.assets ?? []).map((entry) => entry.id === selectedGalleryChild.id ? { ...entry, type: event.target.value as TemplateGalleryEntryAsset["type"] } : entry) }) }))} className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}><option value="image">image</option><option value="video">video</option><option value="doc">doc</option><option value="iframe">iframe</option></select>
                                          <select value={selectedGalleryChild.aspectRatio ?? "16/9"} onChange={(event) => updateAssetLayout(section.id, item.id, asset.id, { aspectRatio: event.target.value as "auto" | "16/9" | "4/3" | "1/1" | "3/4" | "9/16" | "21/9" }, selectedGalleryChild.id)} className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}><option value="auto">aspect ratio: auto</option><option value="16/9">16:9 landscape</option><option value="4/3">4:3 landscape</option><option value="1/1">1:1 square</option><option value="3/4">3:4 portrait</option><option value="9/16">9:16 portrait</option><option value="21/9">21:9 cinematic</option></select>
                                          <button type="button" onClick={() => updateItem(section.id, item.id, (current) => ({ ...current, assets: current.assets.map((token) => token.id !== asset.id ? token : { ...token, coverAssetId: selectedGalleryChild.id }) }))} className="border px-2 py-1 text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: selectedGalleryChild.id === (asset.coverAssetId ?? getGalleryCoverAsset(asset)?.id) ? "rgba(255,255,255,0.35)" : "var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>{selectedGalleryChild.id === (asset.coverAssetId ?? getGalleryCoverAsset(asset)?.id) ? "Cover child" : "Set as cover"}</button>

                                          <input value={selectedGalleryChild.url} onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, assets: current.assets.map((token) => token.id !== asset.id ? token : { ...token, assets: (token.assets ?? []).map((entry) => entry.id === selectedGalleryChild.id ? { ...entry, url: event.target.value } : entry) }) }))} placeholder="https://..." className="border bg-transparent px-2 py-1 text-sm sm:col-span-3" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                                          <input type="file" accept="image/*,video/*,.pdf,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; void uploadGalleryAssetFile(file, section.id, item.id, asset.id, selectedGalleryChild.id); }} className="border bg-transparent px-2 py-1 text-xs" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                                          <textarea value={selectedGalleryChild.description ?? ""} onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, assets: current.assets.map((token) => token.id !== asset.id ? token : { ...token, assets: (token.assets ?? []).map((entry) => entry.id === selectedGalleryChild.id ? { ...entry, description: event.target.value } : entry) }) }))} placeholder="Gallery asset description / context" className="border bg-transparent px-2 py-1 text-sm sm:col-span-4" rows={2} style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />

                                          {selectedGalleryChild.type !== "doc" && selectedGalleryChild.type !== "iframe" ? (
                                            <>
                                              <select value={selectedGalleryChild.fit ?? "cover"} onChange={(event) => updateAssetLayout(section.id, item.id, asset.id, { fit: event.target.value as "cover" | "contain" }, selectedGalleryChild.id)} className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}><option value="cover">cover (crop)</option><option value="contain">contain (fit all)</option></select>
                                              <label className="flex items-center gap-2 text-xs sm:col-span-2" style={{ color: "var(--label)" }}>
                                                Zoom
                                                <input type="range" min={100} max={200} value={selectedGalleryChild.zoom ?? 100} onChange={(event) => updateAssetLayout(section.id, item.id, asset.id, { zoom: clampZoom(Number(event.target.value)) }, selectedGalleryChild.id)} className="w-28 sm:w-32" />
                                                <span className="w-10 text-right">{Math.round(selectedGalleryChild.zoom ?? 100)}%</span>
                                              </label>
                                            </>
                                          ) : <div className="sm:col-span-3" />}
                                        </div>
                                      ) : null}
                                    </>
                                  ) : (
                                    <div className="border px-3 py-3 text-xs" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "var(--label)" }}>
                                      Add child media to this gallery. The selected cover child becomes the primary asset for carousel previews.
                                    </div>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <select
                                  value=""
                                  onChange={(event) => {
                                    const sourceAssetKey = event.target.value;
                                    if (!sourceAssetKey) {
                                      return;
                                    }
                                    connectExistingAssetToItemAsset(section.id, item.id, asset.id, sourceAssetKey);
                                    event.currentTarget.value = "";
                                  }}
                                  className="border bg-transparent px-2 py-1 text-sm sm:col-span-4"
                                  style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
                                >
                                  <option value="">Connect previously uploaded asset…</option>
                                  {reusableUploadedAssets.map((sourceAsset) => (
                                    <option key={`asset-link-${sourceAsset.key}`} value={sourceAsset.key}>
                                      {sourceAsset.type} · {sourceAsset.label}
                                    </option>
                                  ))}
                                </select>
                                <input value={asset.url} onChange={(event) => updateItem(section.id, item.id, (current) => ({ ...current, assets: current.assets.map((token) => token.id === asset.id ? { ...token, url: event.target.value } : token) }))} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:item:${item.id}:asset:${asset.id}:url`} data-field-label="Asset URL" placeholder="https://..." className="border bg-transparent px-2 py-1 text-sm sm:col-span-3" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                                <input type="file" accept="image/*,video/*,.pdf,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; void uploadAssetFile(file, section.id, item.id, asset.id); }} className="border bg-transparent px-2 py-1 text-xs" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />

                                {asset.type !== "doc" && asset.type !== "iframe" ? (
                                  <>
                                    <select
                                      value={asset.fit ?? "cover"}
                                      onChange={(event) => updateAssetLayout(section.id, item.id, asset.id, { fit: event.target.value as "cover" | "contain" })}
                                      data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:item:${item.id}:asset:${asset.id}:fit`}
                                      data-field-label="Asset fit mode"
                                      className="border bg-transparent px-2 py-1 text-sm"
                                      style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
                                    >
                                      <option value="cover">cover (crop)</option>
                                      <option value="contain">contain (fit all)</option>
                                    </select>
                                    <label className="flex items-center gap-2 text-xs sm:col-span-2" style={{ color: "var(--label)" }}>
                                      Zoom
                                      <input type="range" min={100} max={200} value={asset.zoom ?? 100} onChange={(event) => updateAssetLayout(section.id, item.id, asset.id, { zoom: clampZoom(Number(event.target.value)) })} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:section:${section.id}:item:${item.id}:asset:${asset.id}:zoom`} data-field-label="Asset zoom" className="w-28 sm:w-32" />
                                      <span className="w-10 text-right">{Math.round(asset.zoom ?? 100)}%</span>
                                    </label>
                                  </>
                                ) : <div className="sm:col-span-3" />}

                                {asset.type === "iframe" && (asset.preview ?? asset.url) ? (
                                  <div className="sm:col-span-4">
                                    <p className="mb-1 text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--label)" }}>Embed preview</p>
                                    <div
                                      className="w-full overflow-hidden border bg-black"
                                      style={{ borderColor: "var(--border)", borderRadius: "2px", aspectRatio: asset.aspectRatio && asset.aspectRatio !== "auto" ? asset.aspectRatio : "16/9" }}
                                    >
                                      <iframe src={asset.preview ?? asset.url} title={asset.label || "Asset embed preview"} className="h-full w-full" style={{ border: 0 }} />
                                    </div>
                                  </div>
                                ) : (asset.type === "image" || asset.type === "video") && (asset.preview ?? asset.url) ? (
                                  <div className="sm:col-span-4">
                                    <p className="mb-1 text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--label)" }}>
                                      Visual framing (drag to position)
                                    </p>
                                    <div
                                      className="w-full cursor-grab overflow-hidden border bg-black active:cursor-grabbing"
                                      style={{ borderColor: "var(--border)", borderRadius: "2px", aspectRatio: asset.aspectRatio && asset.aspectRatio !== "auto" ? asset.aspectRatio : "16/9" }}
                                      onPointerDown={(event) => {
                                        event.currentTarget.setPointerCapture(event.pointerId);
                                        beginAssetDrag(event, section.id, item.id, asset.id);
                                      }}
                                      onPointerMove={(event) => {
                                        if (event.buttons !== 1) {
                                          return;
                                        }
                                        updateAssetDrag(event);
                                      }}
                                      onPointerUp={endAssetDrag}
                                      onPointerCancel={endAssetDrag}
                                      onPointerLeave={(event) => {
                                        if (event.buttons === 0) {
                                          endAssetDrag();
                                        }
                                      }}
                                    >
                                      {asset.type === "image" ? (
                                        <img src={asset.preview ?? asset.url} alt={asset.label || "Asset preview"} className="h-full w-full select-none" draggable={false} style={{ objectFit: asset.fit ?? "cover", objectPosition: `${asset.focusX ?? 50}% ${asset.focusY ?? 50}%`, transform: `scale(${(asset.zoom ?? 100) / 100})`, transformOrigin: "center center" }} />
                                      ) : (
                                        <video src={asset.preview ?? asset.url} className="h-full w-full" muted loop autoPlay playsInline style={{ objectFit: asset.fit ?? "cover", objectPosition: `${asset.focusX ?? 50}% ${asset.focusY ?? 50}%`, transform: `scale(${(asset.zoom ?? 100) / 100})`, transformOrigin: "center center" }} />
                                      )}
                                    </div>
                                    <p className="mt-1 text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--label)" }}>
                                      Focus {Math.round(asset.focusX ?? 50)} / {Math.round(asset.focusY ?? 50)}
                                    </p>
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </details>
                ))}
              </div>
              <button type="button" onClick={() => addItem(section.id)} className="mt-3 px-3 py-1 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>Add Item</button>
                </div>
              </details>
            </article>
          ))}
          <div className="flex justify-end">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => addSection("education")} className="px-3 py-1 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid #93c5fd66", borderRadius: "2px", color: "#bfdbfe" }}>Add Education</button>
              <button type="button" onClick={() => addSection("experience")} className="px-3 py-1 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>Add Section</button>
            </div>
          </div>
        </div>
      </section>

      <section className="glass px-6 py-5" style={{ borderRadius: "2px" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>Timeline Tour Configuration</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={suggestTimelineTour} className="px-3 py-1 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid #86efac55", borderRadius: "2px", color: "#86efac" }}>Suggest Timeline Tour</button>
            <button type="button" onClick={addTourStep} className="px-3 py-1 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>Add Tour Step</button>
          </div>
        </div>
        {activeVariant ? (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-xs" style={{ color: "var(--label)" }}>
                <input
                  type="checkbox"
                  checked={activeVariant.timelineTour.enabled}
                  onChange={(event) => updateActiveVariant((variant) => ({ ...variant, timelineTour: { ...variant.timelineTour, enabled: event.target.checked } }))}
                  data-field-path={`variant:${activeVariant.id}:timelineTour:enabled`}
                  data-field-label="Timeline tour enabled"
                />
                Tour enabled
              </label>
              <p className="text-[11px]" style={{ color: "var(--label)" }}>
                Tip: select timeline fields, then ask Copilot to generate or refine milestone sequencing.
              </p>
            </div>
            <textarea
              value={JSON.stringify(activeVariant.timelineTour.steps, null, 2)}
              data-field-path={`variant:${activeVariant.id}:timelineTour:stepsJson`}
              data-field-label="Timeline tour steps (JSON)"
              className="mt-2 w-full border bg-transparent px-2 py-1 text-xs"
              rows={6}
              readOnly
              spellCheck={false}
              style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}
            />
          </>
        ) : null}
        <div className="mt-3 space-y-2">
          {(activeVariant?.timelineTour.steps ?? []).map((step, index) => {
            const options = getVariantItemOptions(activeVariant?.id ?? "");
            return (
              <div key={step.id} className="grid gap-2 border p-3 sm:grid-cols-4" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
                <input value={step.label} onChange={(event) => updateActiveVariant((variant) => ({ ...variant, timelineTour: { ...variant.timelineTour, steps: variant.timelineTour.steps.map((token, tokenIndex) => tokenIndex === index ? { ...token, label: event.target.value } : token) } }))} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:timelineTour:step:${step.id}:label`} data-field-label={`Timeline step ${index + 1} label`} className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                <select value={`${step.sectionId}::${step.itemId}`} onChange={(event) => { const [sectionId, itemId] = event.target.value.split("::"); updateActiveVariant((variant) => ({ ...variant, timelineTour: { ...variant.timelineTour, steps: variant.timelineTour.steps.map((token, tokenIndex) => tokenIndex === index ? { ...token, sectionId, itemId } : token) } })); }} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:timelineTour:step:${step.id}:sectionItem`} data-field-label={`Timeline step ${index + 1} target`} className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                <input type="number" value={step.durationMs} onChange={(event) => updateActiveVariant((variant) => ({ ...variant, timelineTour: { ...variant.timelineTour, steps: variant.timelineTour.steps.map((token, tokenIndex) => tokenIndex === index ? { ...token, durationMs: Number(event.target.value) || 0 } : token) } }))} data-field-path={`variant:${activeVariant?.id ?? "unknown"}:timelineTour:step:${step.id}:durationMs`} data-field-label={`Timeline step ${index + 1} duration (ms)`} className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                <label className="flex items-center justify-between gap-2 text-xs" style={{ color: "var(--label)" }}>
                  <span>Step {index + 1}</span>
                  <button type="button" onClick={() => updateActiveVariant((variant) => ({ ...variant, timelineTour: { ...variant.timelineTour, steps: variant.timelineTour.steps.filter((token) => token.id !== step.id) } }))} className="border px-2 py-1 text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: "#fda4af55", borderRadius: "2px", color: "#fda4af" }}>Remove</button>
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass px-6 py-5" style={{ borderRadius: "2px" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>Resume Connections</h2>
            <p className="mt-1 text-xs" style={{ color: "var(--label)" }}>Bridge items across creative, technical, or audience-specific resumes.</p>
          </div>
          <button type="button" onClick={addConnection} className="px-3 py-1 text-[11px] uppercase tracking-[0.16em]" style={{ border: "1px solid var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>Add Connection</button>
        </div>
        <div className="mt-4 space-y-3">
          {template.connections.map((connection) => {
            const sourceOptions = getVariantItemOptions(connection.sourceVariantId);
            const targetOptions = getVariantItemOptions(connection.targetVariantId);
            return (
              <div key={connection.id} className="border p-3" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={connection.label} onChange={(event) => updateTemplate((current) => ({ ...current, connections: current.connections.map((token) => token.id === connection.id ? { ...token, label: event.target.value } : token) }))} placeholder="Connection label" className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                  <input value={connection.type} onChange={(event) => updateTemplate((current) => ({ ...current, connections: current.connections.map((token) => token.id === connection.id ? { ...token, type: event.target.value } : token) }))} placeholder="Connection type" className="border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                </div>
                <textarea value={connection.narrative} onChange={(event) => updateTemplate((current) => ({ ...current, connections: current.connections.map((token) => token.id === connection.id ? { ...token, narrative: event.target.value } : token) }))} placeholder="Narrative bridge between these two resume items" className="mt-2 w-full border bg-transparent px-2 py-1 text-sm" rows={3} style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }} />
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>Source</p>
                    <select value={connection.sourceVariantId} onChange={(event) => updateTemplate((current) => ({ ...current, connections: current.connections.map((token) => token.id === connection.id ? { ...token, sourceVariantId: event.target.value } : token) }))} className="w-full border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}>{template.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.title}</option>)}</select>
                    <select value={`${connection.sourceSectionId}::${connection.sourceItemId}`} onChange={(event) => { const [sourceSectionId, sourceItemId] = event.target.value.split("::"); updateTemplate((current) => ({ ...current, connections: current.connections.map((token) => token.id === connection.id ? { ...token, sourceSectionId, sourceItemId } : token) })); }} className="w-full border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}>{sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>Target</p>
                    <select value={connection.targetVariantId} onChange={(event) => updateTemplate((current) => ({ ...current, connections: current.connections.map((token) => token.id === connection.id ? { ...token, targetVariantId: event.target.value } : token) }))} className="w-full border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}>{template.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.title}</option>)}</select>
                    <select value={`${connection.targetSectionId}::${connection.targetItemId}`} onChange={(event) => { const [targetSectionId, targetItemId] = event.target.value.split("::"); updateTemplate((current) => ({ ...current, connections: current.connections.map((token) => token.id === connection.id ? { ...token, targetSectionId, targetItemId } : token) })); }} className="w-full border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}>{targetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass px-6 py-5" style={{ borderRadius: "2px" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm uppercase tracking-[0.18em]" style={{ color: "var(--label)" }}>
            {showResumePreview ? "Resume Preview" : "JSON Preview"}
          </h2>
          <button
            type="button"
            onClick={() => setShowResumePreview((value) => !value)}
            className="px-3 py-1 text-[11px] uppercase tracking-[0.16em]"
            style={{ border: "1px solid #86efac55", borderRadius: "2px", color: "#86efac" }}
          >
            {showResumePreview ? "Show JSON" : "Show Resume Preview"}
          </button>
        </div>

        {showResumePreview ? (
          <>
            <p className="mt-2 text-xs" style={{ color: "var(--label)" }}>
              Previewing {hasPersistedTemplateId ? "saved template data from the database" : "your current local draft"}.
            </p>
            <div className="mt-3 h-[860px] overflow-hidden border" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
              <iframe title="Resume preview" src={previewHref} className="h-full w-full border-0" />
            </div>
          </>
        ) : (
          <pre className="mt-3 overflow-x-auto text-xs" style={{ color: "#c4c4c8" }}>{JSON.stringify(template, null, 2)}</pre>
        )}
      </section>
    </main>

    <aside className="glass sticky top-6 flex max-h-[calc(100vh-3rem)] flex-col overflow-hidden px-4 py-4" style={{ borderRadius: "2px" }}>
      <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--label)" }}>Editor Copilot</p>
      <p className="mt-2 text-xs" style={{ color: "var(--label)" }}>
        Click fields to automatically build multi-field context, then ask for cross-field guidance.
      </p>

      {/* Scrollable panels */}
      <div className="mt-3 flex-1 space-y-3 overflow-y-auto pr-0.5">

        <div className="rounded border p-2" style={{ borderColor: "var(--border)", minHeight: "74px" }}>
          <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--label)" }}>Focused Field</p>
          <p className="mt-1 text-xs" style={{ color: "#e4e4e7" }}>{focusedField?.label ?? "None focused"}</p>
          {focusedField ? (
            <p className="mt-1 line-clamp-2 text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>
              {focusedField.value || "(empty)"}
            </p>
          ) : null}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedFields([])}
              disabled={!selectedFields.length}
              className="px-2 py-1 text-[10px] uppercase tracking-[0.14em]"
              style={{ border: "1px solid #fda4af55", borderRadius: "2px", color: "#fda4af", opacity: selectedFields.length ? 1 : 0.5 }}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="rounded border p-2" style={{ borderColor: "var(--border)", minHeight: "92px" }}>
          <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--label)" }}>Selected Fields ({selectedFields.length})</p>
          {selectedFields.length ? (
            <ul className="mt-2 space-y-1">
              {selectedFields.map((field) => (
                <li key={field.path} className="flex items-center justify-between gap-2 rounded border px-2 py-1" style={{ borderColor: "var(--border)" }}>
                  <span className="min-w-0 truncate text-[11px]" style={{ color: "#e4e4e7" }}>{field.label}</span>
                  <button
                    type="button"
                    onClick={() => removeSelectedField(field.path)}
                    className="text-[10px] uppercase tracking-[0.12em]"
                    style={{ color: "#fda4af" }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs" style={{ color: "var(--label)" }}>No fields selected yet.</p>
          )}
        </div>

        <div className="rounded border p-2" style={{ borderColor: "var(--border)", minHeight: "92px" }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--label)" }}>
              Attached Documents ({intakeDocuments.length})
            </p>
            <label className="cursor-pointer border px-2 py-1 text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#f0f0f0" }}>
              Attach
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  void ingestSourceDocuments(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: "var(--label)" }}>
            Attached docs are included in copilot context.
          </p>
          {intakeDocuments.length ? (
            <ul className="mt-2 space-y-1">
              {intakeDocuments.map((document, index) => (
                <li key={`${document.name}-${index}`} className="flex items-center justify-between gap-2 rounded border px-2 py-1" style={{ borderColor: "var(--border)" }}>
                  <span className="min-w-0 truncate text-[11px]" style={{ color: "#e4e4e7" }}>
                    {document.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeDocument(index)}
                    className="shrink-0 text-[10px] uppercase tracking-[0.12em]"
                    style={{ color: "#fda4af" }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs" style={{ color: "var(--label)" }}>
              No documents attached yet.
            </p>
          )}
        </div>

        <div className="overflow-y-auto rounded border p-2" style={{ borderColor: "var(--border)", minHeight: "120px" }}>
          {chatMessages.length || isChatLoading ? (
            <ul className="space-y-2">
              {chatMessages.map((message) => (
                <li key={message.id} className="rounded border px-2 py-2 text-xs" style={{ borderColor: "var(--border)", color: message.role === "assistant" ? "#e4e4e7" : "#fef08a" }}>
                  <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--label)" }}>{message.role}</p>
                  <p className="mt-1 whitespace-pre-wrap">{message.text}</p>
                  {message.role === "assistant" && (message.fieldUpdates?.length ?? 0) > 0 ? (
                    <div className="mt-2">
                      <p className="text-[10px]" style={{ color: "var(--label)" }}>
                        {message.fieldUpdates?.length} field update{(message.fieldUpdates?.length ?? 0) === 1 ? "" : "s"} ready.
                      </p>
                      <button
                        type="button"
                        onClick={() => applyChatFieldUpdates(message.id)}
                        disabled={Boolean(message.applied)}
                        className="mt-1 px-2 py-1 text-[10px] uppercase tracking-[0.12em]"
                        style={{ border: "1px solid #86efac55", borderRadius: "2px", color: "#86efac", opacity: message.applied ? 0.6 : 1 }}
                      >
                        {message.applied ? "Applied" : "Apply to Field(s)"}
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
              {isChatLoading && (
                <li className="rounded border px-2 py-2 text-xs" style={{ borderColor: "var(--border)", color: "#a1a1a1" }}>
                  <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--label)" }}>assistant</p>
                  <p className="mt-1 flex items-center gap-1">
                    <span>Thinking</span>
                    <span className="inline-flex gap-0.5">
                      <span className="inline-block h-1 w-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="inline-block h-1 w-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="inline-block h-1 w-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  </p>
                </li>
              )}
            </ul>
          ) : (
            <p className="text-xs" style={{ color: "var(--label)" }}>No messages yet.</p>
          )}
        </div>

      </div>{/* end scroll */}

      {/* Pinned input area */}
      <textarea
        value={chatInput}
        onChange={(event) => setChatInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (!isChatLoading && chatInput.trim()) void sendEditorChat();
          }
        }}
        placeholder="Ask about the selected field(s)… Enter to send, Shift+Enter for newline"
        className="mt-3 w-full border bg-transparent px-2 py-2 text-sm"
        rows={3}
        style={{ borderColor: "var(--border)", borderRadius: "2px", color: "#e4e4e7" }}
      />
      <label className="mt-2 flex items-center gap-2 text-[11px]" style={{ color: "var(--label)" }}>
        <input
          type="checkbox"
          checked={chatDeepSearch}
          onChange={(event) => setChatDeepSearch(event.target.checked)}
          className="h-3.5 w-3.5"
        />
        Deep web search (slower, better for multi-year/event lists)
      </label>
      <button
        type="button"
        onClick={() => {
          void sendEditorChat();
        }}
        disabled={isChatLoading || !chatInput.trim()}
        className="mt-2 w-full px-3 py-2 text-[11px] uppercase tracking-[0.16em]"
        style={{ border: "1px solid #fef08a55", borderRadius: "2px", color: "#fef08a", opacity: isChatLoading || !chatInput.trim() ? 0.5 : 1 }}
      >
        {isChatLoading ? "Sending..." : "Send"}
      </button>
    </aside>
      </div>
    </div>
  );
}
