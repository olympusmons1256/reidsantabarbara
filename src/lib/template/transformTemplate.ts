import type {
  ActivationType,
  Bio,
  CompanyExperience,
  ConnectedResumeLink,
  FocusMedia,
  Project,
  ProjectSortFilter,
  ProjectTheme,
  RoleType,
} from "@/types/resume";
import type {
  ResumeTemplate,
  TemplateAsset,
  TemplateGalleryEntryAsset,
  TemplateConnection,
  TemplateProfile,
  TemplateProfileScopeField,
  TemplateTagDimension,
  TemplateVariant,
} from "@/types/template";
import { TEMPLATE_PROFILE_SCOPE_FIELDS } from "@/types/template";

type LegacyTemplateShape = {
  id: string;
  title: string;
  profile: TemplateProfile;
  tagDimensions?: TemplateTagDimension[];
  sections?: TemplateVariant["sections"];
  timelineTour?: TemplateVariant["timelineTour"];
  updatedAt: string;
};

export type RuntimeResumeData = {
  bio: Bio;
  experiences: CompanyExperience[];
  activationFocusMedia: Record<ActivationType, FocusMedia>;
  roleFocusMedia: Record<RoleType, FocusMedia>;
  sortFilters: ProjectSortFilter[];
  sortLabels: {
    activation: string;
    role: string;
  };
  timelineTourEntryIds: string[];
  timelineTourDurations: Record<string, number>;
  variants: Array<{ id: string; title: string; audience?: string }>;
  activeVariantId: string;
  activeVariantTitle: string;
  connectionMap: Record<string, ConnectedResumeLink[]>;
  connectionCounts: Record<string, number>;
};

const themePresets: ProjectTheme[] = [
  { accent: "#38bdf8", gradientFrom: "#0f172a", gradientTo: "#0c4a6e" },
  { accent: "#f59e0b", gradientFrom: "#1c1917", gradientTo: "#78350f" },
  { accent: "#a78bfa", gradientFrom: "#2e1065", gradientTo: "#5b21b6" },
  { accent: "#22c55e", gradientFrom: "#052e16", gradientTo: "#166534" },
  { accent: "#ec4899", gradientFrom: "#500724", gradientTo: "#831843" },
  { accent: "#22d3ee", gradientFrom: "#083344", gradientTo: "#0f766e" },
];

function pickTheme(index: number): ProjectTheme {
  return themePresets[index % themePresets.length] ?? themePresets[0];
}

function matchesDimension(dimension: TemplateTagDimension, pattern: RegExp): boolean {
  return pattern.test(dimension.id) || pattern.test(dimension.label);
}

function normalizeProfileScope(scope?: TemplateProfileScopeField[]): TemplateProfileScopeField[] {
  if (!scope?.length) {
    return [...TEMPLATE_PROFILE_SCOPE_FIELDS];
  }

  const normalized = TEMPLATE_PROFILE_SCOPE_FIELDS.filter((field) => scope.includes(field));
  return normalized.length ? normalized : [...TEMPLATE_PROFILE_SCOPE_FIELDS];
}

function buildScopedBio(
  profile: TemplateProfile,
  scope?: TemplateProfileScopeField[]
): Bio {
  const profileScope = normalizeProfileScope(scope);
  const includes = (field: TemplateProfileScopeField) => profileScope.includes(field);

  return {
    name: includes("name") ? profile.name || "Untitled" : "",
    title: includes("title") ? profile.title || "" : "",
    location: includes("location") ? profile.location || "" : "",
    email: includes("email") ? profile.email || "" : "",
    heroImage: includes("heroImage") ? profile.heroImage || "" : "",
    heroImageFilter:
      includes("heroImage") && includes("heroImageFilter") ? profile.heroImageFilter || "" : "",
    bannerBackgroundVideo: includes("bannerBackgroundVideo") ? profile.bannerBackgroundVideo || "" : "",
    bannerBackgroundImage: includes("bannerBackgroundImage") ? profile.bannerBackgroundImage || "" : "",
    bannerVideoOpacity: includes("bannerBackgroundVideo")
      ? typeof profile.bannerVideoOpacity === "number"
        ? Math.min(100, Math.max(0, profile.bannerVideoOpacity))
        : 42
      : 42,
    bannerOverlayOpacity: includes("bannerBackgroundVideo") || includes("bannerBackgroundImage")
      ? typeof profile.bannerOverlayOpacity === "number"
        ? Math.min(100, Math.max(0, profile.bannerOverlayOpacity))
        : 72
      : 72,
    bannerVideoFilter: includes("bannerBackgroundVideo") ? profile.bannerVideoFilter || "brightness(0.9) saturate(0.95)" : "",
    bannerVideoUseAudio: includes("bannerBackgroundVideo") ? Boolean(profile.bannerVideoUseAudio) : false,
    bannerVideoAudioVolume: includes("bannerBackgroundVideo")
      ? typeof profile.bannerVideoAudioVolume === "number"
        ? Math.min(100, Math.max(0, profile.bannerVideoAudioVolume))
        : 20
      : 20,
    bannerVideoDuckedVolume: includes("bannerBackgroundVideo")
      ? typeof profile.bannerVideoDuckedVolume === "number"
        ? Math.min(100, Math.max(0, profile.bannerVideoDuckedVolume))
        : 8
      : 8,
    summary: includes("summary") ? profile.summary || "" : "",
    links: includes("links") ? profile.links ?? [] : [],
  };
}

function normalizeAssetAspectRatio(value: string | undefined): TemplateAsset["aspectRatio"] {
  return value === "auto" || value === "16/9" || value === "4/3" || value === "1/1" || value === "3/4" || value === "9/16" || value === "21/9"
    ? value
    : "16/9";
}

function normalizeAssetFit(value: string | undefined): TemplateAsset["fit"] {
  return value === "contain" ? "contain" : "cover";
}

function parseMetadataItems(text: string | undefined): string[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeGalleryChildAsset(asset: Partial<TemplateGalleryEntryAsset>, index: number): TemplateGalleryEntryAsset {
  const normalizedType = asset.type === "video"
    ? "video"
    : asset.type === "doc" || String(asset.type ?? "").toLowerCase() === "pdf" || String(asset.type ?? "").toLowerCase() === "document"
      ? "doc"
      : "image";

  return {
    id: asset.id || `gallery-asset-${index + 1}`,
    label: asset.label || `Gallery Asset ${index + 1}`,
    description: asset.description || "",
    type: normalizedType,
    subType: asset.subType === "cover" ? "cover" : "supporting",
    url: asset.url || "",
    preview: asset.preview || "",
    aspectRatio: normalizeAssetAspectRatio(asset.aspectRatio),
    fit: normalizeAssetFit(asset.fit),
    focusX: typeof asset.focusX === "number" ? Math.min(100, Math.max(0, asset.focusX)) : 50,
    focusY: typeof asset.focusY === "number" ? Math.min(100, Math.max(0, asset.focusY)) : 50,
    zoom: typeof asset.zoom === "number" ? Math.min(200, Math.max(100, asset.zoom)) : 100,
  };
}

function normalizeTemplateAssetList(rawAssets: Array<Partial<TemplateAsset>> | undefined): TemplateAsset[] {
  const sourceAssets = (rawAssets ?? []) as Array<Partial<TemplateAsset> & { type?: string }>;
  const explicitGalleryAssets = sourceAssets.filter((asset) => String(asset.type ?? "") === "gallery");
  const legacyGalleryAsset = explicitGalleryAssets.length ? null : sourceAssets.find((asset) => String(asset.type ?? "") === "masonry");

  if (legacyGalleryAsset) {
    const galleryChildren = sourceAssets
      .filter((asset) => asset !== legacyGalleryAsset && String(asset.type ?? "") !== "masonry")
      .map((asset, index) =>
        normalizeGalleryChildAsset(
          {
            ...asset,
            type: asset.type === "video" || asset.type === "doc" ? asset.type : "image",
          },
          index
        )
      );

    return [
      {
        id: legacyGalleryAsset.id || "gallery-1",
        label: legacyGalleryAsset.label || "Gallery",
        description: legacyGalleryAsset.description || "",
        type: "gallery",
        subType: legacyGalleryAsset.subType === "cover" ? "cover" : "supporting",
        url: "",
        preview: "",
        aspectRatio: normalizeAssetAspectRatio(legacyGalleryAsset.aspectRatio),
        fit: normalizeAssetFit(legacyGalleryAsset.fit),
        focusX: typeof legacyGalleryAsset.focusX === "number" ? Math.min(100, Math.max(0, legacyGalleryAsset.focusX)) : 50,
        focusY: typeof legacyGalleryAsset.focusY === "number" ? Math.min(100, Math.max(0, legacyGalleryAsset.focusY)) : 50,
        zoom: typeof legacyGalleryAsset.zoom === "number" ? Math.min(200, Math.max(100, legacyGalleryAsset.zoom)) : 100,
        galleryLayout: legacyGalleryAsset.galleryLayout === "carousel" ? "carousel" : "masonry",
        coverAssetId:
          legacyGalleryAsset.coverAssetId && galleryChildren.some((asset) => asset.id === legacyGalleryAsset.coverAssetId)
            ? legacyGalleryAsset.coverAssetId
            : galleryChildren.find((asset) => asset.subType === "cover")?.id ?? galleryChildren[0]?.id,
        assets: galleryChildren,
      },
    ];
  }

  return sourceAssets.map((asset, index) => {
    const rawType = String(asset.type ?? "").toLowerCase();
    const type = asset.type === "gallery"
      ? "gallery"
      : asset.type === "video"
        ? "video"
        : asset.type === "doc" || rawType === "pdf" || rawType === "document"
          ? "doc"
          : "image";
    const galleryChildren = (asset.assets ?? []).map((childAsset, childIndex) => normalizeGalleryChildAsset(childAsset, childIndex));

    return {
      id: asset.id || `asset-${index + 1}`,
      label: asset.label || `Asset ${index + 1}`,
      description: asset.description || "",
      type,
      subType: asset.subType === "cover" ? "cover" : "supporting",
      url: type === "gallery" ? "" : asset.url || "",
      preview: asset.preview || "",
      aspectRatio: normalizeAssetAspectRatio(asset.aspectRatio),
      fit: normalizeAssetFit(asset.fit),
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

export function normalizeTemplate(template: ResumeTemplate | LegacyTemplateShape): ResumeTemplate {
  if ("variants" in template && Array.isArray(template.variants) && template.variants.length > 0) {
    return {
      ...template,
      profile: {
        ...template.profile,
        heroImage: template.profile.heroImage ?? "",
        heroImageFilter: template.profile.heroImageFilter ?? "",
        bannerBackgroundVideo: template.profile.bannerBackgroundVideo ?? "",
        bannerBackgroundImage: template.profile.bannerBackgroundImage ?? "",
        bannerVideoOpacity:
          typeof template.profile.bannerVideoOpacity === "number"
            ? Math.min(100, Math.max(0, template.profile.bannerVideoOpacity))
            : 42,
        bannerOverlayOpacity:
          typeof template.profile.bannerOverlayOpacity === "number"
            ? Math.min(100, Math.max(0, template.profile.bannerOverlayOpacity))
            : 72,
        bannerVideoFilter: template.profile.bannerVideoFilter ?? "brightness(0.9) saturate(0.95)",
        bannerVideoUseAudio: Boolean(template.profile.bannerVideoUseAudio),
        bannerVideoAudioVolume:
          typeof template.profile.bannerVideoAudioVolume === "number"
            ? Math.min(100, Math.max(0, template.profile.bannerVideoAudioVolume))
            : 20,
        bannerVideoDuckedVolume:
          typeof template.profile.bannerVideoDuckedVolume === "number"
            ? Math.min(100, Math.max(0, template.profile.bannerVideoDuckedVolume))
            : 8,
        links: template.profile.links ?? [],
      },
      variants: template.variants.map((variant) => ({
        ...variant,
        profileScope: normalizeProfileScope(variant.profileScope),
        sections: variant.sections.map((section) => ({
          ...section,
          itemsSubtitle: section.itemsSubtitle ?? "",
          metadataItemsText: section.metadataItemsText ?? "",
          dateRange: section.dateRange ?? "",
          items: section.items.map((item) => {
            const normalizedAssets = normalizeTemplateAssetList(item.assets);
            const coverAssetId =
              item.coverAssetId && normalizedAssets.some((asset) => asset.id === item.coverAssetId)
                ? item.coverAssetId
                : normalizedAssets.find((asset) => asset.subType === "cover")?.id ?? normalizedAssets[0]?.id;

            return {
              ...item,
              dateRange: item.dateRange ?? "",
              assets: normalizedAssets,
              coverAssetId,
            };
          }),
        })),
      })),
      connections: template.connections ?? [],
      defaultVariantId: template.defaultVariantId ?? template.variants[0]?.id,
    };
  }

  const legacy = template as LegacyTemplateShape;
  const primaryVariantId = "variant-primary";

  return {
    id: legacy.id,
    title: legacy.title,
    profile: {
      ...legacy.profile,
      heroImage: legacy.profile.heroImage ?? "",
      heroImageFilter: legacy.profile.heroImageFilter ?? "",
      bannerBackgroundVideo: legacy.profile.bannerBackgroundVideo ?? "",
      bannerBackgroundImage: legacy.profile.bannerBackgroundImage ?? "",
      bannerVideoOpacity:
        typeof legacy.profile.bannerVideoOpacity === "number"
          ? Math.min(100, Math.max(0, legacy.profile.bannerVideoOpacity))
          : 42,
      bannerOverlayOpacity:
        typeof legacy.profile.bannerOverlayOpacity === "number"
          ? Math.min(100, Math.max(0, legacy.profile.bannerOverlayOpacity))
          : 72,
      bannerVideoFilter: legacy.profile.bannerVideoFilter ?? "brightness(0.9) saturate(0.95)",
      bannerVideoUseAudio: Boolean(legacy.profile.bannerVideoUseAudio),
      bannerVideoAudioVolume:
        typeof legacy.profile.bannerVideoAudioVolume === "number"
          ? Math.min(100, Math.max(0, legacy.profile.bannerVideoAudioVolume))
          : 20,
      bannerVideoDuckedVolume:
        typeof legacy.profile.bannerVideoDuckedVolume === "number"
          ? Math.min(100, Math.max(0, legacy.profile.bannerVideoDuckedVolume))
          : 8,
      links: legacy.profile.links ?? [],
    },
    defaultVariantId: primaryVariantId,
    variants: [
      {
        id: primaryVariantId,
        title: legacy.title || "Primary Resume",
        audience: "General",
        profileScope: [...TEMPLATE_PROFILE_SCOPE_FIELDS],
        tagDimensions: legacy.tagDimensions ?? [],
        sections: (legacy.sections ?? []).map((section) => ({
          ...section,
          itemsSubtitle: section.itemsSubtitle ?? "",
          metadataItemsText: section.metadataItemsText ?? "",
          dateRange: section.dateRange ?? "",
          items: (section.items ?? []).map((item) => ({
            ...item,
            dateRange: item.dateRange ?? "",
          })),
        })),
        timelineTour: legacy.timelineTour ?? { enabled: true, steps: [] },
      },
    ],
    connections: [],
    updatedAt: legacy.updatedAt,
  };
}

export function transformTemplateToRuntimeResume(
  sourceTemplate: ResumeTemplate,
  preferredVariantId?: string | null
): RuntimeResumeData {
  const template = normalizeTemplate(sourceTemplate);
  const activeVariant =
    template.variants.find((variant) => variant.id === preferredVariantId) ??
    template.variants.find((variant) => variant.id === template.defaultVariantId) ??
    template.variants[0];

  if (!activeVariant) {
    return {
      bio: buildScopedBio(template.profile),
      experiences: [],
      activationFocusMedia: {},
      roleFocusMedia: {},
      sortFilters: [
        { id: "company", label: "Company" },
        { id: "activation", label: "Project Type" },
        { id: "role", label: "Role" },
      ],
      sortLabels: { activation: "Activation Type", role: "Role" },
      timelineTourEntryIds: [],
      timelineTourDurations: {},
      variants: [],
      activeVariantId: "",
      activeVariantTitle: "",
      connectionMap: {},
      connectionCounts: {},
    };
  }

  const companyDimension =
    activeVariant.tagDimensions.find((dimension) => matchesDimension(dimension, /company|organization|employer/i)) ??
    activeVariant.tagDimensions[0];

  const nonCompanyDimensions = activeVariant.tagDimensions.filter(
    (dimension) => dimension.id !== companyDimension?.id
  );

  const activationDimension =
    activeVariant.tagDimensions.find((dimension) => matchesDimension(dimension, /activation|industry|practice|focus|track/i)) ??
    nonCompanyDimensions[0] ??
    companyDimension;

  const roleDimension =
    activeVariant.tagDimensions.find((dimension) => matchesDimension(dimension, /role|discipline|function|capability|skill/i)) ??
    nonCompanyDimensions.find((dimension) => dimension.id !== activationDimension?.id) ??
    activationDimension ??
    companyDimension;

  const activationFocusMedia: Record<ActivationType, FocusMedia> = {};
  const roleFocusMedia: Record<RoleType, FocusMedia> = {};

  const sortFilters: ProjectSortFilter[] = [
    { id: "company", label: "Company" },
    ...activeVariant.tagDimensions
      .filter((dimension) => dimension.id !== companyDimension?.id)
      .map((dimension) => ({
        id: dimension.id,
        label: dimension.label?.trim() || dimension.id,
      })),
  ];

  const experiencesByCompany = new Map<string, CompanyExperience>();
  let companyOrder = 0;

  const ensureCompanyExperience = (
    companyKey: string,
    companyName: string,
    section: TemplateVariant["sections"][number],
    sectionTheme: ProjectTheme
  ): CompanyExperience => {
    const existing = experiencesByCompany.get(companyKey);
    if (existing) {
      return existing;
    }

    const created: CompanyExperience = {
      id: companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || `company-${companyOrder + 1}`,
      company: companyName || section.title,
      role: section.subtitle || activeVariant.title,
      period: section.dateRange?.trim() || activeVariant.audience || "Custom",
      description: section.description,
      itemsSubtitle: section.itemsSubtitle?.trim() || "",
      metadataItems: parseMetadataItems(section.metadataItemsText),
      focusMedia: {
        focusAudio: section.focusMedia?.focusAudio || undefined,
        theme: {
          ...sectionTheme,
          backgroundVideo: section.focusMedia?.backgroundVideo || undefined,
          backgroundImage: section.focusMedia?.backgroundImage || undefined,
        },
      },
      groupContainers: [],
      projects: [],
    };

    experiencesByCompany.set(companyKey, created);
    companyOrder += 1;
    return created;
  };

  activeVariant.sections.forEach((section, sectionIndex) => {
    const sectionTheme = pickTheme(sectionIndex);
    const sectionGroupItems = section.items.filter((item) => item.type === "group");
    const sectionGroupsById = new Map(sectionGroupItems.map((item) => [item.id, item]));
    const sectionGroupsByTitle = new Map(
      sectionGroupItems
        .map((item) => [item.title?.trim().toLowerCase(), item] as const)
        .filter(([title]) => Boolean(title))
    );
    const sectionGroupsByCompany = new Map<string, typeof sectionGroupItems>();
    sectionGroupItems.forEach((groupItem) => {
      const groupCompanyTag = companyDimension ? groupItem.tags[companyDimension.id]?.[0] : undefined;
      const groupCompanyName = groupCompanyTag?.trim() || section.title;
      const existing = sectionGroupsByCompany.get(groupCompanyName) ?? [];
      sectionGroupsByCompany.set(groupCompanyName, [...existing, groupItem]);

      const companyKey = groupCompanyName || section.id;
      const companyExperience = ensureCompanyExperience(companyKey, groupCompanyName, section, pickTheme(companyOrder));
      const groupContainerId = groupItem.id?.trim() || `group-${section.id}`;

      if (!(companyExperience.groupContainers ?? []).some((container) => container.id === groupContainerId)) {
        companyExperience.groupContainers = [
          ...(companyExperience.groupContainers ?? []),
          {
            id: groupContainerId,
            title: groupItem.title?.trim() || "Subsection",
            dateRange: groupItem.dateRange?.trim() || undefined,
            summary: groupItem.summary || groupItem.detail || undefined,
          },
        ];
      }
    });
    const projectItems = section.items.filter((item) => item.type !== "group");

    projectItems.forEach((item, itemIndex) => {
      const theme = pickTheme(sectionIndex + itemIndex);
      const companyTag = companyDimension ? item.tags[companyDimension.id]?.[0] : undefined;
      const companyName = companyTag?.trim() || section.title;
      const companyKey = companyName || section.id;

      const parentGroupTag =
        item.tags.parentGroup?.[0] ??
        item.tags.group?.[0] ??
        item.tags.subsection?.[0] ??
        item.tags.program?.[0];
      const explicitParentGroupItem =
        (item.parentGroupId ? sectionGroupsById.get(item.parentGroupId) : undefined) ??
        (parentGroupTag ? sectionGroupsByTitle.get(parentGroupTag.trim().toLowerCase()) : undefined);
      const parentGroupCandidatesForCompany = sectionGroupsByCompany.get(companyName) ?? [];
      const inferredParentGroupItem =
        parentGroupCandidatesForCompany.length === 1
          ? parentGroupCandidatesForCompany[0]
          : sectionGroupItems.length === 1
            ? sectionGroupItems[0]
            : undefined;
      const parentGroupItem = explicitParentGroupItem ?? inferredParentGroupItem;

      ensureCompanyExperience(companyKey, companyName, section, pickTheme(companyOrder));

      const activationType = item.tags[activationDimension?.id ?? ""]?.[0] ?? "general";
      const roleTypes = item.tags[roleDimension?.id ?? ""]?.length
        ? item.tags[roleDimension.id]
        : ["general"];

      if (!activationFocusMedia[activationType]) {
        activationFocusMedia[activationType] = { theme };
      }

      roleTypes.forEach((roleType) => {
        if (!roleFocusMedia[roleType]) {
          roleFocusMedia[roleType] = { theme };
        }
      });

      const project: Project = {
        id: item.id,
        title: item.title,
        dateRange: item.dateRange?.trim() || undefined,
        summary: item.summary || item.detail || "",
        impact: item.detail || item.summary || "",
        stack: [],
        activationType,
        roleTypes,
        focusAudio: item.focusMedia?.focusAudio || undefined,
        assetLayout: item.assetLayout ?? "list",
        coverAssetId: item.coverAssetId,
        credits: (item.credits ?? []).filter((credit) => credit.name?.trim() || credit.role?.trim()),
        type: item.type ?? "standard",
        parentGroupId: parentGroupItem?.id,
        parentGroupTitle: parentGroupItem?.title?.trim() || undefined,
        parentGroupDateRange: parentGroupItem?.dateRange?.trim() || undefined,
        parentGroupSummary: parentGroupItem?.summary || parentGroupItem?.detail || undefined,
        sourceContext: item.sourceContext?.trim() || undefined,
        tags: item.tags,
        theme: {
          ...theme,
          backgroundVideo: item.focusMedia?.backgroundVideo || undefined,
          backgroundImage: item.focusMedia?.backgroundImage || undefined,
        },
        assets: item.assets.map((asset) => ({
          id: asset.id,
          label: asset.label,
          description: asset.description,
          type: asset.type,
          subType: asset.subType,
          href: asset.url,
          preview: asset.preview,
          aspectRatio: asset.aspectRatio,
          fit: asset.fit === "contain" ? "contain" : "cover",
          focusX: typeof asset.focusX === "number" ? Math.min(100, Math.max(0, asset.focusX)) : 50,
          focusY: typeof asset.focusY === "number" ? Math.min(100, Math.max(0, asset.focusY)) : 50,
          zoom: typeof asset.zoom === "number" ? Math.min(200, Math.max(100, asset.zoom)) : 100,
          galleryLayout: asset.type === "gallery" ? asset.galleryLayout === "carousel" ? "carousel" : "masonry" : undefined,
          coverAssetId:
            asset.type === "gallery" && asset.assets?.some((childAsset) => childAsset.id === asset.coverAssetId)
              ? asset.coverAssetId
              : asset.type === "gallery"
                ? asset.assets?.find((childAsset) => childAsset.subType === "cover")?.id ?? asset.assets?.[0]?.id
                : undefined,
          assets:
            asset.type === "gallery"
              ? (asset.assets ?? []).map((childAsset) => ({
                  id: childAsset.id,
                  label: childAsset.label,
                  description: childAsset.description,
                  type: childAsset.type,
                  subType: childAsset.subType,
                  href: childAsset.url,
                  preview: childAsset.preview,
                  aspectRatio: childAsset.aspectRatio,
                  fit: childAsset.fit === "contain" ? "contain" : "cover",
                  focusX: typeof childAsset.focusX === "number" ? Math.min(100, Math.max(0, childAsset.focusX)) : 50,
                  focusY: typeof childAsset.focusY === "number" ? Math.min(100, Math.max(0, childAsset.focusY)) : 50,
                  zoom: typeof childAsset.zoom === "number" ? Math.min(200, Math.max(100, childAsset.zoom)) : 100,
                }))
              : undefined,
        })),
      };

      const group = experiencesByCompany.get(companyKey);
      if (group) {
        group.projects.push(project);
        if (!group.description && section.description) {
          group.description = section.description;
        }
        if (!group.itemsSubtitle && section.itemsSubtitle?.trim()) {
          group.itemsSubtitle = section.itemsSubtitle.trim();
        }
        if ((!group.metadataItems || !group.metadataItems.length) && section.metadataItemsText?.trim()) {
          group.metadataItems = parseMetadataItems(section.metadataItemsText);
        }
      }
    });

    if (!projectItems.length) {
      const companyKey = section.title || section.id;
      ensureCompanyExperience(companyKey, section.title, section, sectionTheme);
    }
  });

  const experiences: CompanyExperience[] = Array.from(experiencesByCompany.values());

  const timelineTourEntryIds = activeVariant.timelineTour.steps.map(
    (step) => `${step.sectionId}::${step.itemId}`
  );
  const timelineTourDurations: Record<string, number> = Object.fromEntries(
    activeVariant.timelineTour.steps.map((step) => [`${step.sectionId}::${step.itemId}`, step.durationMs])
  );

  const itemLookup = new Map<
    string,
    { variant: TemplateVariant; sectionTitle: string; itemTitle: string; itemSummary: string }
  >();
  template.variants.forEach((variant) => {
    variant.sections.forEach((section) => {
      section.items.forEach((item) => {
        itemLookup.set(`${variant.id}::${section.id}::${item.id}`, {
          variant,
          sectionTitle: section.title,
          itemTitle: item.title,
          itemSummary: item.summary || item.detail || "",
        });
      });
    });
  });

  const connectionMap: Record<string, ConnectedResumeLink[]> = {};

  const appendConnection = (
    owningItemId: string,
    targetVariantId: string,
    targetSectionId: string,
    targetItemId: string,
    connection: TemplateConnection
  ) => {
    const target = itemLookup.get(`${targetVariantId}::${targetSectionId}::${targetItemId}`);
    if (!target) {
      return;
    }

    connectionMap[owningItemId] = [
      ...(connectionMap[owningItemId] ?? []),
      {
        id: connection.id,
        label: connection.label,
        type: connection.type,
        narrative: connection.narrative,
        targetVariantId,
        targetVariantTitle: target.variant.title,
        targetSectionTitle: target.sectionTitle,
        targetItemId,
        targetItemTitle: target.itemTitle,
        targetItemSummary: target.itemSummary,
      },
    ];
  };

  template.connections.forEach((connection) => {
    if (connection.sourceVariantId === activeVariant.id) {
      appendConnection(
        connection.sourceItemId,
        connection.targetVariantId,
        connection.targetSectionId,
        connection.targetItemId,
        connection
      );
    }

    if (connection.targetVariantId === activeVariant.id) {
      appendConnection(
        connection.targetItemId,
        connection.sourceVariantId,
        connection.sourceSectionId,
        connection.sourceItemId,
        connection
      );
    }
  });

  const connectionCounts = Object.fromEntries(
    Object.entries(connectionMap).map(([itemId, links]) => [itemId, links.length])
  );

  return {
    bio: buildScopedBio(template.profile, activeVariant.profileScope),
    experiences,
    activationFocusMedia,
    roleFocusMedia,
    sortFilters,
    sortLabels: {
      activation: activationDimension?.label || "Activation Type",
      role: roleDimension?.label || "Role",
    },
    timelineTourEntryIds,
    timelineTourDurations,
    variants: template.variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      audience: variant.audience,
    })),
    activeVariantId: activeVariant.id,
    activeVariantTitle: activeVariant.title,
    connectionMap,
    connectionCounts,
  };
}
