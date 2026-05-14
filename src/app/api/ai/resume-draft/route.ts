import { NextResponse } from "next/server";
import { blankTemplate } from "@/data/blankTemplate";
import { normalizeTemplate } from "@/lib/template/transformTemplate";
import { TEMPLATE_PROFILE_SCOPE_FIELDS } from "@/types/template";
import type { ResumeTemplate, TemplateAsset, TemplateGalleryEntryAsset, TemplateItem, TemplateSection, TemplateVariant } from "@/types/template";

type IntakeDocument = {
  name: string;
  content: string;
  url?: string;
};

type IntakePayload = {
  fullName?: string;
  linkedinUrl?: string;
  websiteUrls?: string[];
  resumeText?: string;
  additionalContext?: string;
  documents?: IntakeDocument[];
};

type RequestBody = {
  intake: IntakePayload;
  currentTemplate?: ResumeTemplate;
};

type ResolvedWebSource = {
  url: string;
  status: "ok" | "failed";
  content: string;
  contentLength: number;
  note?: string;
};

type SourceDiagnostics = {
  totalSources: number;
  successfulSources: number;
  usableSources: number;
  details: Array<{ url: string; status: "ok" | "failed"; contentLength: number; note?: string }>;
};

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseJsonLdBlocks(html: string): unknown[] {
  const matches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const parsed: unknown[] = [];

  for (const match of matches) {
    const payload = match[1]?.trim();
    if (!payload) {
      continue;
    }
    try {
      parsed.push(JSON.parse(payload));
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }

  return parsed;
}

function flattenUnknown(input: unknown): unknown[] {
  if (!input) {
    return [];
  }
  if (Array.isArray(input)) {
    return input.flatMap((item) => flattenUnknown(item));
  }
  if (typeof input === "object") {
    const record = input as Record<string, unknown>;
    const out: unknown[] = [record];
    if (Array.isArray(record["@graph"])) {
      out.push(...flattenUnknown(record["@graph"]));
    }
    return out;
  }
  return [];
}

function extractLinkedInSignals(html: string): string {
  const blocks = parseJsonLdBlocks(html);
  const nodes = blocks.flatMap((block) => flattenUnknown(block));
  const snippets: string[] = [];

  for (const node of nodes) {
    const record = node as Record<string, unknown>;
    const type = record["@type"];
    const typeLabel = Array.isArray(type) ? type.join(",") : String(type ?? "");
    if (!typeLabel) {
      continue;
    }

    const name = typeof record.name === "string" ? record.name : "";
    const description = typeof record.description === "string" ? record.description : "";
    const headline = typeof record.headline === "string" ? record.headline : "";
    const jobTitle = typeof record.jobTitle === "string" ? record.jobTitle : "";
    const knowsAbout = Array.isArray(record.knowsAbout)
      ? record.knowsAbout.filter((v): v is string => typeof v === "string").join(", ")
      : "";

    const joined = [name, headline, jobTitle, description, knowsAbout].filter(Boolean).join(" | ");
    if (joined) {
      snippets.push(`${typeLabel}: ${joined}`);
    }
  }

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  const metaDescription = html
    .match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i)?.[1]
    ?.replace(/\s+/g, " ")
    .trim() ?? "";

  return [title ? `Title: ${title}` : "", metaDescription ? `Meta: ${metaDescription}` : "", ...snippets]
    .filter(Boolean)
    .join("\n")
    .slice(0, 8000);
}

async function fetchUrlText(url: string): Promise<ResolvedWebSource> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ResumeDraftBot/1.0)",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        url,
        status: "failed",
        content: `Unable to fetch source (${response.status}).`,
        contentLength: 0,
        note: "http-error",
      };
    }

    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();
    const isHtml = contentType.includes("text/html") || /<html|<body|<head/i.test(raw);
    const isLinkedIn = /linkedin\.com\/in\//i.test(url);
    const linkedInSignals = isLinkedIn && isHtml ? extractLinkedInSignals(raw) : "";
    const stripped = isHtml ? stripHtml(raw) : raw;
    const text = [linkedInSignals, stripped].filter(Boolean).join("\n\n");

    if (!text.trim()) {
      return {
        url,
        status: "failed",
        content: "Source returned empty content.",
        contentLength: 0,
        note: "empty-content",
      };
    }

    const clipped = text.slice(0, 12000);
    const note =
      clipped.length < 300
        ? "very-limited-content"
        : isLinkedIn && !linkedInSignals
          ? "linkedin-structured-signals-not-found"
          : undefined;

    return {
      url,
      status: "ok",
      content: clipped,
      contentLength: clipped.length,
      note,
    };
  } catch (error) {
    return {
      url,
      status: "failed",
      content: error instanceof Error ? error.message : "Request failed.",
      contentLength: 0,
      note: "fetch-error",
    };
  }
}

async function resolveWebSources(intake: IntakePayload): Promise<ResolvedWebSource[]> {
  const urls = Array.from(
    new Set(
      [intake.linkedinUrl, ...(intake.websiteUrls ?? [])]
        .map((value) => (value || "").trim())
        .filter(Boolean)
        .filter((value) => /^https?:\/\//i.test(value))
    )
  ).slice(0, 6);

  if (!urls.length) {
    return [];
  }

  const resolved = await Promise.all(urls.map((url) => fetchUrlText(url)));
  return resolved;
}

function safeId(value: string, fallback: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return normalized || fallback;
}

function normalizeAspectRatio(value: string | undefined): TemplateAsset["aspectRatio"] {
  return value === "auto" || value === "16/9" || value === "4/3" || value === "1/1" || value === "3/4" || value === "9/16" || value === "21/9"
    ? value
    : "16/9";
}

function normalizeFit(value: string | undefined): TemplateAsset["fit"] {
  return value === "contain" ? "contain" : "cover";
}

function ensureGalleryChildAsset(asset: Partial<TemplateGalleryEntryAsset>, assetIndex: number): TemplateGalleryEntryAsset {
  return {
    id: asset.id || `gallery-asset-${assetIndex + 1}`,
    label: asset.label || `Gallery Asset ${assetIndex + 1}`,
    description: asset.description || "",
    type: asset.type === "video" || asset.type === "doc" ? asset.type : "image",
    subType: asset.subType === "cover" ? "cover" : "supporting",
    url: asset.url || "",
    preview: asset.preview || "",
    aspectRatio: normalizeAspectRatio(asset.aspectRatio),
    fit: normalizeFit(asset.fit),
    focusX: typeof asset.focusX === "number" ? Math.min(100, Math.max(0, asset.focusX)) : 50,
    focusY: typeof asset.focusY === "number" ? Math.min(100, Math.max(0, asset.focusY)) : 50,
    zoom: typeof asset.zoom === "number" ? Math.min(200, Math.max(100, asset.zoom)) : 100,
  };
}

function ensureAssetList(assets: Array<Partial<TemplateAsset>> | undefined, index: number): TemplateAsset[] {
  const sourceAssets = (assets ?? []) as Array<Partial<TemplateAsset> & { type?: string }>;
  const explicitGalleryAssets = sourceAssets.filter((asset) => String(asset.type ?? "") === "gallery");
  const legacyGalleryAsset = explicitGalleryAssets.length ? null : sourceAssets.find((asset) => String(asset.type ?? "") === "masonry");

  if (legacyGalleryAsset) {
    const galleryChildren = sourceAssets
      .filter((asset) => asset !== legacyGalleryAsset && String(asset.type ?? "") !== "masonry")
      .map((asset, assetIndex) => ensureGalleryChildAsset({ ...asset, type: asset.type === "video" || asset.type === "doc" ? asset.type : "image" }, assetIndex));

    return [{
      id: legacyGalleryAsset.id || `asset-${index + 1}-gallery`,
      label: legacyGalleryAsset.label || "Gallery",
      description: legacyGalleryAsset.description || "",
      type: "gallery",
      subType: legacyGalleryAsset.subType === "cover" ? "cover" : "supporting",
      url: "",
      preview: "",
      aspectRatio: normalizeAspectRatio(legacyGalleryAsset.aspectRatio),
      fit: normalizeFit(legacyGalleryAsset.fit),
      focusX: typeof legacyGalleryAsset.focusX === "number" ? Math.min(100, Math.max(0, legacyGalleryAsset.focusX)) : 50,
      focusY: typeof legacyGalleryAsset.focusY === "number" ? Math.min(100, Math.max(0, legacyGalleryAsset.focusY)) : 50,
      zoom: typeof legacyGalleryAsset.zoom === "number" ? Math.min(200, Math.max(100, legacyGalleryAsset.zoom)) : 100,
      galleryLayout: legacyGalleryAsset.galleryLayout === "carousel" ? "carousel" : "masonry",
      coverAssetId:
        legacyGalleryAsset.coverAssetId && galleryChildren.some((asset) => asset.id === legacyGalleryAsset.coverAssetId)
          ? legacyGalleryAsset.coverAssetId
          : galleryChildren.find((asset) => asset.subType === "cover")?.id ?? galleryChildren[0]?.id,
      assets: galleryChildren,
    }];
  }

  return sourceAssets.map((asset, assetIndex) => {
    const type = asset.type === "gallery" ? "gallery" : asset.type === "video" || asset.type === "doc" ? asset.type : "image";
    const galleryChildren = (asset.assets ?? []).map((childAsset, childIndex) => ensureGalleryChildAsset(childAsset, childIndex));

    return {
      id: asset.id || `asset-${index + 1}-${assetIndex + 1}`,
      label: asset.label || `Asset ${assetIndex + 1}`,
      description: asset.description || "",
      type,
      subType: asset.subType === "cover" ? "cover" : "supporting",
      url: type === "gallery" ? "" : asset.url || "",
      preview: asset.preview || "",
      aspectRatio: normalizeAspectRatio(asset.aspectRatio),
      fit: normalizeFit(asset.fit),
      focusX: typeof asset.focusX === "number" ? Math.min(100, Math.max(0, asset.focusX)) : 50,
      focusY: typeof asset.focusY === "number" ? Math.min(100, Math.max(0, asset.focusY)) : 50,
      zoom: typeof asset.zoom === "number" ? Math.min(200, Math.max(100, asset.zoom)) : 100,
      galleryLayout: type === "gallery" ? (asset.galleryLayout === "carousel" ? "carousel" : "masonry") : undefined,
      coverAssetId:
        type === "gallery"
          ? asset.coverAssetId && galleryChildren.some((childAsset) => childAsset.id === asset.coverAssetId)
            ? asset.coverAssetId
            : galleryChildren.find((childAsset) => childAsset.subType === "cover")?.id ?? galleryChildren[0]?.id
          : undefined,
      assets: type === "gallery" ? galleryChildren : undefined,
    } satisfies TemplateAsset;
  });
}

function ensureItem(item: Partial<TemplateItem>, index: number): TemplateItem {
  const normalizedAssets = ensureAssetList(item.assets, index);

  const coverAssetId =
    item.coverAssetId && normalizedAssets.some((asset) => asset.id === item.coverAssetId)
      ? item.coverAssetId
      : normalizedAssets.find((asset) => asset.subType === "cover")?.id ?? normalizedAssets[0]?.id;

  return {
    id: item.id || `item-${index + 1}`,
    title: item.title || `Experience ${index + 1}`,
    dateRange: item.dateRange || "",
    summary: item.summary || "",
    detail: item.detail || "",
    assetLayout:
      item.assetLayout === "masonry" || item.assetLayout === "carousel" || item.assetLayout === "list"
        ? item.assetLayout
        : "list",
    coverAssetId,
    tags: item.tags ?? {},
    assets: normalizedAssets,
  };
}

function ensureSection(section: Partial<TemplateSection>, index: number): TemplateSection {
  const items = (section.items ?? []).map((item, itemIndex) => ensureItem(item, itemIndex));
  return {
    id: section.id || `section-${index + 1}`,
    title: section.title || `Section ${index + 1}`,
    subtitle: section.subtitle || "",
    dateRange: section.dateRange || "",
    description: section.description || "",
    items,
  };
}

function ensureVariant(variant: Partial<TemplateVariant>, index: number): TemplateVariant {
  const sections = (variant.sections ?? []).map((section, sectionIndex) => ensureSection(section, sectionIndex));

  const fallbackDims = blankTemplate.variants[0]?.tagDimensions ?? [
    { id: "company", label: "Company", allowMultiple: false, options: [] },
    { id: "activation", label: "Activation Type", allowMultiple: false, options: [] },
    { id: "role", label: "Role", allowMultiple: true, options: [] },
  ];

  return {
    id: variant.id || `variant-${index + 1}`,
    title: variant.title || `Resume ${index + 1}`,
    audience: variant.audience || "",
    profileScope: variant.profileScope?.length ? variant.profileScope : [...TEMPLATE_PROFILE_SCOPE_FIELDS],
    tagDimensions: (variant.tagDimensions?.length ? variant.tagDimensions : fallbackDims).map((dimension) => ({
      id: safeId(dimension.id || dimension.label || "dimension", `dimension-${Math.random().toString(36).slice(2, 6)}`),
      label: dimension.label || "Dimension",
      allowMultiple: Boolean(dimension.allowMultiple),
      options: dimension.options ?? [],
    })),
    sections,
    timelineTour: {
      enabled: variant.timelineTour?.enabled ?? true,
      steps: variant.timelineTour?.steps ?? [],
    },
  };
}

function sanitizeTemplate(input: Partial<ResumeTemplate>, fallback: ResumeTemplate): ResumeTemplate {
  const variants = (input.variants ?? []).map((variant, index) => ensureVariant(variant, index));

  const merged: ResumeTemplate = {
    id: input.id || fallback.id,
    title: input.title || fallback.title,
    profile: {
      name: input.profile?.name || fallback.profile.name,
      title: input.profile?.title || fallback.profile.title,
      location: input.profile?.location || fallback.profile.location,
      email: input.profile?.email || fallback.profile.email,
      summary: input.profile?.summary || fallback.profile.summary,
      heroImage: input.profile?.heroImage || fallback.profile.heroImage || "",
      heroImageFilter: input.profile?.heroImageFilter || fallback.profile.heroImageFilter || "",
      bannerBackgroundVideo: input.profile?.bannerBackgroundVideo || fallback.profile.bannerBackgroundVideo || "",
      bannerBackgroundImage: input.profile?.bannerBackgroundImage || fallback.profile.bannerBackgroundImage || "",
      bannerVideoOpacity:
        typeof input.profile?.bannerVideoOpacity === "number"
          ? Math.min(100, Math.max(0, input.profile.bannerVideoOpacity))
          : typeof fallback.profile.bannerVideoOpacity === "number"
            ? Math.min(100, Math.max(0, fallback.profile.bannerVideoOpacity))
            : 42,
      bannerOverlayOpacity:
        typeof input.profile?.bannerOverlayOpacity === "number"
          ? Math.min(100, Math.max(0, input.profile.bannerOverlayOpacity))
          : typeof fallback.profile.bannerOverlayOpacity === "number"
            ? Math.min(100, Math.max(0, fallback.profile.bannerOverlayOpacity))
            : 72,
      bannerVideoFilter: input.profile?.bannerVideoFilter || fallback.profile.bannerVideoFilter || "brightness(0.9) saturate(0.95)",
      bannerVideoUseAudio: Boolean(input.profile?.bannerVideoUseAudio ?? fallback.profile.bannerVideoUseAudio ?? false),
      bannerVideoAudioVolume:
        typeof input.profile?.bannerVideoAudioVolume === "number"
          ? Math.min(100, Math.max(0, input.profile.bannerVideoAudioVolume))
          : typeof fallback.profile.bannerVideoAudioVolume === "number"
            ? Math.min(100, Math.max(0, fallback.profile.bannerVideoAudioVolume))
            : 20,
      bannerVideoDuckedVolume:
        typeof input.profile?.bannerVideoDuckedVolume === "number"
          ? Math.min(100, Math.max(0, input.profile.bannerVideoDuckedVolume))
          : typeof fallback.profile.bannerVideoDuckedVolume === "number"
            ? Math.min(100, Math.max(0, fallback.profile.bannerVideoDuckedVolume))
            : 8,
      links: input.profile?.links ?? fallback.profile.links,
    },
    defaultVariantId:
      input.defaultVariantId || variants[0]?.id || fallback.defaultVariantId || fallback.variants[0]?.id,
    variants: variants.length ? variants : fallback.variants,
    connections: input.connections ?? fallback.connections,
    updatedAt: new Date().toISOString(),
  };

  return normalizeTemplate(merged);
}

function ensureMinimumScaffold(template: ResumeTemplate): ResumeTemplate {
  const normalized = normalizeTemplate(template);
  const primary = normalized.variants.find((variant) => variant.id === normalized.defaultVariantId) ?? normalized.variants[0];

  if (!primary) {
    return normalized;
  }

  const hasAnySections = primary.sections.length > 0;
  if (hasAnySections) {
    return normalized;
  }

  const scaffold: TemplateSection[] = [
    {
      id: "section-summary",
      title: "Summary",
      subtitle: "Professional Snapshot",
      description: "Core professional profile and value proposition.",
      items: [
        {
          id: "item-summary",
          title: "Professional Summary",
          summary: normalized.profile.summary || "Add a concise, outcomes-focused summary.",
          detail: "",
          tags: {},
          assets: [],
        },
      ],
    },
    {
      id: "section-experience",
      title: "Experience",
      subtitle: "Work History",
      description: "Professional experience entries.",
      items: [
        {
          id: "item-experience-1",
          title: "Role Entry",
          summary: "Add role, company, and time period.",
          detail: "",
          tags: {},
          assets: [],
        },
      ],
    },
    {
      id: "section-skills",
      title: "Skills",
      subtitle: "Capabilities",
      description: "Technical and professional skills.",
      items: [
        {
          id: "item-skills",
          title: "Key Skills",
          summary: "List key tools, technologies, and strengths.",
          detail: "",
          tags: {},
          assets: [],
        },
      ],
    },
    {
      id: "section-projects",
      title: "Projects",
      subtitle: "Selected Work",
      description: "Representative projects and impact.",
      items: [
        {
          id: "item-project-1",
          title: "Project Entry",
          summary: "Add project context, contribution, and outcomes.",
          detail: "",
          tags: {},
          assets: [],
        },
      ],
    },
    {
      id: "section-education",
      title: "Education",
      subtitle: "Academic Background",
      description: "Education and certifications.",
      items: [
        {
          id: "item-education-1",
          title: "Education Entry",
          summary: "Add school, credential, and year.",
          detail: "",
          tags: {},
          assets: [],
        },
      ],
    },
  ];

  return {
    ...normalized,
    variants: normalized.variants.map((variant) =>
      variant.id === primary.id
        ? {
            ...variant,
            sections: scaffold,
          }
        : variant
    ),
  };
}

function sectionKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function toTitleCase(input: string): string {
  return input
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isLikelyHeadingLine(line: string): boolean {
  const normalized = line.replace(/[|•·]/g, " ").trim();
  if (!normalized) {
    return false;
  }

  const withoutPunctuation = normalized.replace(/[^a-zA-Z\s]/g, "").trim();
  const words = withoutPunctuation.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 8) {
    return false;
  }

  const upperWords = words.filter((word) => word === word.toUpperCase()).length;
  const upperRatio = upperWords / words.length;
  return upperRatio >= 0.75;
}

function looksPlaceholderText(value: string): boolean {
  const text = value.trim();
  if (!text) {
    return true;
  }
  return /company name|institution name|start date|end date|add your|add a concise|add role|add school|add project context|list your|list key tools|describe a significant project|to be detailed|update this section|core value proposition|professional summary|role entry|project entry|education entry|most recent role|previous role|notable project|degree or certification|tools & technologies|core skills/i.test(
    text
  );
}

const roleKeywordMatchers: Array<{ label: string; pattern: RegExp }> = [
  { label: "Founder", pattern: /\b(co-?founder|founder)\b/i },
  { label: "Leadership", pattern: /\b(ceo|cto|coo|cfo|chief|head|vp|vice president|president|lead)\b/i },
  { label: "Technical Direction", pattern: /\b(technical director|director of technology|engineer|engineering|architect|developer)\b/i },
  { label: "Creative Direction", pattern: /\b(creative director|art director|creative)\b/i },
  { label: "Production", pattern: /\b(production|producer|operations|program manager|project manager|manager)\b/i },
  { label: "Design", pattern: /\b(design|designer|lighting design|ux|ui)\b/i },
];

function normalizeCompanyName(value: string): string {
  return value
    .replace(/^at\s+/i, "")
    .replace(/[|•]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[,;:\-–—\s]+$/g, "")
    .trim();
}

function looksLikeRolePhrase(value: string): boolean {
  if (!value.trim()) {
    return false;
  }
  return roleKeywordMatchers.some((matcher) => matcher.pattern.test(value));
}

function inferRoleTags(item: TemplateItem): string[] {
  const text = `${item.title} ${item.summary} ${item.detail}`;
  const roles = roleKeywordMatchers
    .filter((matcher) => matcher.pattern.test(text))
    .map((matcher) => matcher.label);

  return Array.from(new Set(roles));
}

function isGenericCompanyValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return /^(general|other|misc|miscellaneous|n\/a|na|unknown|company|organization|professional|experience)$/i.test(
    normalized
  );
}

function inferCompanyFromItem(item: TemplateItem, companyDimensionId?: string): string | null {
  const existingCompany = companyDimensionId ? item.tags?.[companyDimensionId]?.[0] : undefined;
  if (existingCompany?.trim() && !isGenericCompanyValue(existingCompany)) {
    return normalizeCompanyName(existingCompany);
  }

  const title = item.title.trim();

  const hyphenMatch = title.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (hyphenMatch) {
    const left = hyphenMatch[1]?.trim() ?? "";
    const right = hyphenMatch[2]?.trim() ?? "";

    if (left && right) {
      if (looksLikeRolePhrase(left) && !looksLikeRolePhrase(right)) {
        return normalizeCompanyName(right);
      }
      return normalizeCompanyName(left);
    }
  }

  const atMatch = `${item.title} ${item.summary}`.match(/\bat\s+([A-Z][A-Za-z0-9&().,'\-\s]{2,80})/);
  if (atMatch?.[1]) {
    return normalizeCompanyName(atMatch[1]);
  }

  const companyPrefix = title.match(/^([A-Z][A-Za-z0-9&().,'\-\s]{2,80})\s*[,:|]/);
  if (companyPrefix?.[1] && !looksLikeRolePhrase(companyPrefix[1])) {
    return normalizeCompanyName(companyPrefix[1]);
  }

  return null;
}

function isExperienceSectionTitle(title: string): boolean {
  return /^(experience|work experience|employment|professional experience|professional journey|work history|career history|resume)$/i.test(
    title.trim()
  );
}

function isDateOrDurationLine(line: string): boolean {
  const value = line.trim();
  if (!value) {
    return false;
  }

  return (
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\b/i.test(value) ||
    /\bpresent\b/i.test(value) ||
    /^\d+\s+years?(?:\s+\d+\s+months?)?$/i.test(value) ||
    /^\d+\s+months?$/i.test(value)
  );
}

function isLikelyLocationLine(line: string): boolean {
  const value = line.trim();
  if (!value || isDateOrDurationLine(value)) {
    return false;
  }

  if (/[.!?]$/.test(value)) {
    return false;
  }

  if (/\b(remote|hybrid|onsite|united states|usa|washington|seattle|new york|california)\b/i.test(value)) {
    return true;
  }

  const words = value.split(/\s+/).filter(Boolean);
  if (words.length > 6) {
    return false;
  }

  return words.every((word) => /^[A-Z][A-Za-z.'-]*,?$/.test(word));
}

function isLikelyRoleLine(line: string): boolean {
  const value = line.trim();
  if (!value || isDateOrDurationLine(value)) {
    return false;
  }
  return /\b(founder|co-?founder|ceo|cto|coo|cfo|partner|director|manager|designer|engineer|architect|producer|lead|president|consultant|developer)\b/i.test(
    value
  );
}

function isLikelyCompanyLine(line: string): boolean {
  const value = line.trim();
  if (!value || isDateOrDurationLine(value) || isLikelyRoleLine(value)) {
    return false;
  }

  if (/[.!?]$/.test(value)) {
    return false;
  }

  if (/\b(llc|inc\.?|corp\.?|corporation|group|studio|studios|theatre|company|design|labs?)\b/i.test(value)) {
    return true;
  }

  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 8) {
    return false;
  }

  return words.every((word) => /^[A-Z][A-Za-z0-9&().'/-]*,?$/.test(word));
}

function parseExperienceItems(lines: string[]): TemplateItem[] {
  const cleaned = lines.map((line) => line.trim()).filter(Boolean);
  if (!cleaned.length) {
    return [];
  }

  const companyIndexes = cleaned
    .map((line, index) => (isLikelyCompanyLine(line) ? index : -1))
    .filter((index) => index >= 0);

  if (!companyIndexes.length) {
    return [];
  }

  const items: TemplateItem[] = [];

  for (let c = 0; c < companyIndexes.length; c += 1) {
    const companyStart = companyIndexes[c];
    const companyEnd = companyIndexes[c + 1] ?? cleaned.length;
    const company = normalizeCompanyName(cleaned[companyStart]);
    const block = cleaned.slice(companyStart + 1, companyEnd).filter(Boolean);

    if (!company) {
      continue;
    }

    let roleIndexes = block.map((line, index) => (isLikelyRoleLine(line) ? index : -1)).filter((index) => index >= 0);
    if (!roleIndexes.length) {
      roleIndexes = [0];
    }

    for (let r = 0; r < roleIndexes.length; r += 1) {
      const roleStart = roleIndexes[r];
      const roleEnd = roleIndexes[r + 1] ?? block.length;
      const roleBlock = block.slice(roleStart, roleEnd).filter(Boolean);
      if (!roleBlock.length) {
        continue;
      }

      const firstLine = roleBlock[0];
      const role = isLikelyRoleLine(firstLine) ? firstLine : `${company} Role`;
      const metaLines = roleBlock.slice(1).filter((line) => isDateOrDurationLine(line) || isLikelyLocationLine(line));
      const narrativeLines = roleBlock.slice(1).filter((line) => !isDateOrDurationLine(line) && !isLikelyLocationLine(line));

      const summaryParts = [
        company,
        ...metaLines,
        ...(narrativeLines.length ? [narrativeLines[0]] : []),
      ].filter(Boolean);

      const detailParts = [company, ...roleBlock.slice(1)].filter(Boolean);

      items.push({
        id: `item-experience-${items.length + 1}`,
        title: role,
        summary: summaryParts.join(" • ").slice(0, 300),
        detail: detailParts.join(" ").slice(0, 1200),
        tags: {
          company: [company],
        },
        assets: [],
      });
    }
  }

  return items.slice(0, 16);
}

function enforceExperienceCompanyMapping(template: ResumeTemplate): ResumeTemplate {
  const normalized = normalizeTemplate(template);

  const variants = normalized.variants.map((variant) => {
    const companyDimension =
      variant.tagDimensions.find((dimension) => /company|organization/i.test(dimension.id) || /company|organization/i.test(dimension.label)) ??
      variant.tagDimensions[0];
    const roleDimension =
      variant.tagDimensions.find((dimension) => /role/i.test(dimension.id) || /role/i.test(dimension.label));

    if (!companyDimension) {
      return variant;
    }

    const experienceSections = variant.sections.filter((section) => isExperienceSectionTitle(section.title));
    if (!experienceSections.length) {
      return variant;
    }

    const firstExperienceIndex = variant.sections.findIndex((section) => isExperienceSectionTitle(section.title));
    const trailingNonExperienceSections = variant.sections
      .slice(firstExperienceIndex + 1)
      .filter((section) => !isExperienceSectionTitle(section.title));
    const experienceItems = experienceSections.flatMap((section) => section.items);

    const companyGroups = new Map<string, TemplateItem[]>();
    const inferredCompanies = new Set<string>();
    const inferredRoles = new Set<string>();

    for (const item of experienceItems) {
      const company = inferCompanyFromItem(item, companyDimension.id);
      if (!company) {
        continue;
      }

      const roles = roleDimension ? inferRoleTags(item) : [];
      roles.forEach((role) => inferredRoles.add(role));

      const nextItem: TemplateItem = {
        ...item,
        tags: {
          ...item.tags,
          [companyDimension.id]: [company],
          ...(roleDimension
            ? {
                [roleDimension.id]: roles.length
                  ? roles
                  : item.tags?.[roleDimension.id] ?? [],
              }
            : {}),
        },
      };

      if (!companyGroups.has(company)) {
        companyGroups.set(company, []);
      }
      companyGroups.get(company)?.push(nextItem);
      inferredCompanies.add(company);
    }

    if (companyGroups.size < 2) {
      return {
        ...variant,
        sections: variant.sections.map((section) => {
          if (!isExperienceSectionTitle(section.title)) {
            return section;
          }

          return {
            ...section,
            items: section.items.map((item) => {
              const company = inferCompanyFromItem(item, companyDimension.id);
              const roles = roleDimension ? inferRoleTags(item) : [];
              return {
                ...item,
                tags: {
                  ...item.tags,
                  ...(company ? { [companyDimension.id]: [company] } : {}),
                  ...(roleDimension
                    ? {
                        [roleDimension.id]: roles.length
                          ? roles
                          : item.tags?.[roleDimension.id] ?? [],
                      }
                    : {}),
                },
              };
            }),
          };
        }),
      };
    }

    const companySections = Array.from(companyGroups.entries()).map(([company, items], index) => ({
      id: `section-company-${safeId(company, `company-${index + 1}`)}`,
      title: company,
      subtitle: "Experience",
      description: "Roles and accomplishments",
      items,
    }));

    const nextSections = [
      ...variant.sections.slice(0, firstExperienceIndex),
      ...companySections,
      ...trailingNonExperienceSections,
    ];

    const nextTagDimensions = variant.tagDimensions.map((dimension) => {
      if (dimension.id === companyDimension.id) {
        return {
          ...dimension,
          options: Array.from(new Set([...(dimension.options ?? []), ...inferredCompanies])),
        };
      }

      if (roleDimension && dimension.id === roleDimension.id) {
        return {
          ...dimension,
          options: Array.from(new Set([...(dimension.options ?? []), ...inferredRoles])),
        };
      }

      return dimension;
    });

    return {
      ...variant,
      sections: nextSections,
      tagDimensions: nextTagDimensions,
    };
  });

  return {
    ...normalized,
    variants,
  };
}

function parseResumeTextSections(resumeText: string): TemplateSection[] {
  const lines = resumeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  const headingMatchers: Array<{ title: string; test: (line: string) => boolean }> = [
    { title: "Summary", test: (line) => /^(summary|professional summary|profile|objective)$/i.test(line) },
    { title: "Experience", test: (line) => /^(experience|work experience|employment|professional experience)$/i.test(line) },
    { title: "Skills", test: (line) => /^(skills|technical skills|core competencies|competencies)$/i.test(line) },
    { title: "Projects", test: (line) => /^(projects|selected projects|project experience)$/i.test(line) },
    { title: "Education", test: (line) => /^(education|certifications|training)$/i.test(line) },
    { title: "Contact", test: (line) => /^(contact|contact info|contact information)$/i.test(line) },
    { title: "Biography", test: (line) => /^(biography|bio|about)$/i.test(line) },
    { title: "Selected Works", test: (line) => /^(selected works|selected work|portfolio)$/i.test(line) },
    { title: "Experience", test: (line) => /^(resume|career history)$/i.test(line) },
  ];

  const buckets = new Map<string, string[]>();
  let currentSection = "Summary";
  buckets.set(currentSection, []);

  for (const line of lines) {
    const matched = headingMatchers.find((matcher) => matcher.test(line));
    const dynamicHeading = !matched && isLikelyHeadingLine(line) ? toTitleCase(line) : null;

    if (matched || dynamicHeading) {
      currentSection = matched?.title ?? dynamicHeading ?? "Summary";
      if (!buckets.has(currentSection)) {
        buckets.set(currentSection, []);
      }
      continue;
    }

    if (!buckets.has(currentSection)) {
      buckets.set(currentSection, []);
    }
    buckets.get(currentSection)?.push(line);
  }

  const sections: TemplateSection[] = [];
  for (const [title, contentLines] of buckets.entries()) {
    const normalizedLines = contentLines
      .map((line) => line.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);

    if (!normalizedLines.length) {
      continue;
    }

    const items = isExperienceSectionTitle(title)
      ? parseExperienceItems(normalizedLines)
      : (() => {
          const chunks: string[] = [];
          let chunk: string[] = [];
          for (const line of normalizedLines) {
            const startsNewChunk =
              /^([A-Z][^:]{2,60}):/.test(line) ||
              /\b\d{4}\b/.test(line) ||
              /^[-•*]/.test(line);

            if (startsNewChunk && chunk.length) {
              chunks.push(chunk.join(" "));
              chunk = [line];
            } else {
              chunk.push(line);
            }
          }
          if (chunk.length) {
            chunks.push(chunk.join(" "));
          }

          return chunks.slice(0, 8).map((text, index) => {
            const titleMatch = text.match(/^([^:]{3,80}):\s*(.*)$/);
            const itemTitle = titleMatch?.[1]?.trim() || `${title} ${index + 1}`;
            const body = titleMatch?.[2]?.trim() || text;
            return {
              id: `item-${sectionKey(title)}-${index + 1}`,
              title: itemTitle,
              summary: body.slice(0, 300),
              detail: body.slice(0, 1200),
              tags: {},
              assets: [],
            };
          });
        })();

    sections.push({
      id: `section-${sectionKey(title)}`,
      title,
      subtitle: "",
      description: "",
      items: items.length
        ? items
        : [
            {
              id: `item-${sectionKey(title)}-1`,
              title: `${title} Entry`,
              summary: normalizedLines.join(" ").slice(0, 300),
              detail: normalizedLines.join(" ").slice(0, 1200),
              tags: {},
              assets: [],
            },
          ],
    });
  }

  return sections;
}

function applyResumeTextFallback(template: ResumeTemplate, resumeText?: string): ResumeTemplate {
  const text = (resumeText || "").trim();
  if (!text) {
    return template;
  }

  const parsedSections = parseResumeTextSections(text);
  if (!parsedSections.length) {
    return template;
  }

  const normalized = normalizeTemplate(template);
  const primary = normalized.variants.find((variant) => variant.id === normalized.defaultVariantId) ?? normalized.variants[0];
  if (!primary) {
    return normalized;
  }

  const existingByTitle = new Map(primary.sections.map((section) => [section.title.toLowerCase(), section]));

  const isPlaceholderSection = (section: TemplateSection) => {
    if (!section.items.length) {
      return true;
    }
    const placeholderCount = section.items.filter((item) => {
      const mergedText = `${item.title} ${item.summary} ${item.detail}`.trim();
      const looksGenericTitle =
        /^experience\s+\d+$/i.test(item.title) ||
        /^summary\s+\d+$/i.test(item.title) ||
        /^skills\s+\d+$/i.test(item.title) ||
        /^projects\s+\d+$/i.test(item.title) ||
        /^education\s+\d+$/i.test(item.title) ||
        /^item\s+\d+$/i.test(item.title);

      return looksGenericTitle || looksPlaceholderText(mergedText);
    }).length;

    return placeholderCount / section.items.length >= 0.5;
  };

  const mergedSections = parsedSections.map((parsedSection) => {
    const existing = existingByTitle.get(parsedSection.title.toLowerCase());
    if (!existing) {
      return parsedSection;
    }

    const existingIsScaffold = isPlaceholderSection(existing);

    if (existingIsScaffold || existing.items.length === 0) {
      return {
        ...existing,
        items: parsedSection.items,
      };
    }

    return existing;
  });

  const mergedWithRemainder = [
    ...mergedSections,
    ...primary.sections.filter(
      (section) =>
        !parsedSections.some((parsed) => parsed.title.toLowerCase() === section.title.toLowerCase()) &&
        !isPlaceholderSection(section)
    ),
  ];

  return {
    ...normalized,
    variants: normalized.variants.map((variant) =>
      variant.id === primary.id
        ? {
            ...variant,
            sections: mergedWithRemainder,
          }
        : variant
    ),
  };
}

function applyIntakeProfileFallback(template: ResumeTemplate, intake: IntakePayload): ResumeTemplate {
  const normalized = normalizeTemplate(template);
  const existingLinks = normalized.profile.links ?? [];
  const hasLinkedInLink = existingLinks.some((link) => /linkedin\.com/i.test(link.href || ""));
  const linkedinUrl = (intake.linkedinUrl || "").trim();

  return {
    ...normalized,
    profile: {
      ...normalized.profile,
      name: (intake.fullName || "").trim() || normalized.profile.name,
      links:
        linkedinUrl && !hasLinkedInLink
          ? [...existingLinks, { label: "LinkedIn", href: linkedinUrl }]
          : existingLinks,
    },
  };
}

function extractJsonObject(content: string): string {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Model did not return JSON content.");
  }
  return content.slice(start, end + 1);
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.LLM_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing LLM_API_KEY. Add it to your environment." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as RequestBody;
    const intake = body.intake ?? {};
    const currentTemplate = normalizeTemplate(body.currentTemplate ?? blankTemplate);

    const model = process.env.LLM_MODEL ?? "claude-sonnet-4-6";
    const apiBase = (process.env.LLM_API_BASE_URL ?? "https://api.anthropic.com/v1").replace(/\/$/, "");
    const isAnthropic = apiBase.includes("anthropic.com");

    const systemPrompt = `You are a resume architecture assistant. Build a clean, structured JSON ResumeTemplate object.
Requirements:
- Output JSON only — no markdown fences, no prose before or after.
- Schema keys: id,title,profile,defaultVariantId,variants,connections,updatedAt.
- profile keys: name,title,location,email,summary,heroImage,links[] with label/href.
- variants should logically separate audiences (e.g. technical vs creative) when evidence exists.
- Create sections and items from provided context and documents.
- Keep language concise and professional.
- Leave unknown fields as empty strings/arrays, never hallucinate companies or dates.
- Use stable slug-like IDs.
- Connections should link equivalent or related items across variants when relevant.
- Even when source evidence is sparse, still return a useful scaffold with at least these sections in the primary variant: Summary, Experience, Skills, Projects, Education.
- If LinkedIn/public URL signals are available, prioritize section titles and grouping that mirror detected headings/signals.
- For work history, map each distinct company into its own section tile and assign each role item to that company using the company tag dimension.
- For each work-history item, assign role-type tags (for example Founder, Leadership, Technical Direction, Design, Production) when evidence is present.`;

    const resolvedSources = await resolveWebSources(intake);
    const diagnostics: SourceDiagnostics = {
      totalSources: resolvedSources.length,
      successfulSources: resolvedSources.filter((source) => source.status === "ok").length,
      usableSources: resolvedSources.filter((source) => source.status === "ok" && source.contentLength >= 300).length,
      details: resolvedSources.map((source) => ({
        url: source.url,
        status: source.status,
        contentLength: source.contentLength,
        note: source.note,
      })),
    };

    const userMessage = JSON.stringify({
      intake,
      currentTemplate,
      resolvedSources,
      sourceUsagePolicy: {
        note:
          "Use resolvedSources content as grounding context when status is ok. If LinkedIn or URLs fail, continue using provided resume text/documents without hallucinating.",
      },
    });

    let completionResponse: Response;
    if (isAnthropic) {
      const candidateModels = Array.from(
        new Set([
          model,
          "claude-sonnet-4-6",
          "claude-opus-4-7",
          "claude-opus-4-6",
        ])
      );

      let lastErrorText = "";
      let successfulResponse: Response | null = null;

      for (const candidateModel of candidateModels) {
        const response = await fetch(`${apiBase}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: candidateModel,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: "user", content: userMessage }],
          }),
        });

        if (response.ok) {
          successfulResponse = response;
          break;
        }

        const errorText = await response.text();
        lastErrorText = `${response.status} ${errorText}`;
        const isModelMissing =
          response.status === 404 ||
          /not_found_error|model/i.test(errorText);

        if (!isModelMissing) {
          return NextResponse.json(
            { error: `LLM request failed: ${response.status} ${errorText}` },
            { status: 502 }
          );
        }
      }

      if (!successfulResponse) {
        return NextResponse.json(
          {
            error: `LLM request failed after model fallbacks. Last error: ${lastErrorText || "unknown"}`,
          },
          { status: 502 }
        );
      }

      completionResponse = successfulResponse;
    } else {
      completionResponse = await fetch(`${apiBase}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      });
    }

    if (!completionResponse.ok) {
      const errorText = await completionResponse.text();
      return NextResponse.json(
        { error: `LLM request failed: ${completionResponse.status} ${errorText}` },
        { status: 502 }
      );
    }

    let content: string | undefined;
    if (isAnthropic) {
      const anthropicData = (await completionResponse.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      content = anthropicData.content?.find((b) => b.type === "text")?.text;
    } else {
      const openaiData = (await completionResponse.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      content = openaiData.choices?.[0]?.message?.content;
    }

    if (!content) {
      return NextResponse.json({ error: "LLM returned empty content." }, { status: 502 });
    }

    let parsed: Partial<ResumeTemplate> | null = null;
    try {
      parsed = JSON.parse(extractJsonObject(content)) as Partial<ResumeTemplate>;
    } catch {
      parsed = null;
    }

    const baseTemplate = parsed ? sanitizeTemplate(parsed, currentTemplate) : currentTemplate;
    const template = enforceExperienceCompanyMapping(
      applyIntakeProfileFallback(
        applyResumeTextFallback(ensureMinimumScaffold(baseTemplate), intake.resumeText),
        intake
      )
    );

    return NextResponse.json({ template, sourceDiagnostics: diagnostics });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate template." },
      { status: 500 }
    );
  }
}
