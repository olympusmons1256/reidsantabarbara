import type {
  ActivationType,
  Bio,
  CompanyExperience,
  ConnectedResumeLink,
  FocusMedia,
  Project,
  ProjectTheme,
  RoleType,
} from "@/types/resume";
import type {
  ResumeTemplate,
  TemplateConnection,
  TemplateProfile,
  TemplateTagDimension,
  TemplateVariant,
} from "@/types/template";

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

export function normalizeTemplate(template: ResumeTemplate | LegacyTemplateShape): ResumeTemplate {
  if ("variants" in template && Array.isArray(template.variants) && template.variants.length > 0) {
    return {
      ...template,
      profile: {
        ...template.profile,
        heroImage: template.profile.heroImage ?? "",
        links: template.profile.links ?? [],
      },
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
      links: legacy.profile.links ?? [],
    },
    defaultVariantId: primaryVariantId,
    variants: [
      {
        id: primaryVariantId,
        title: legacy.title || "Primary Resume",
        audience: "General",
        tagDimensions: legacy.tagDimensions ?? [],
        sections: legacy.sections ?? [],
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
      bio: {
        name: template.profile.name || "Untitled",
        title: template.profile.title || "",
        location: template.profile.location || "",
        email: template.profile.email || "",
        heroImage: template.profile.heroImage || "",
        summary: template.profile.summary || "",
        links: template.profile.links ?? [],
      },
      experiences: [],
      activationFocusMedia: {},
      roleFocusMedia: {},
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

  const activationDimension =
    activeVariant.tagDimensions.find((dimension) => dimension.id.toLowerCase().includes("activation")) ??
    activeVariant.tagDimensions[1] ??
    activeVariant.tagDimensions[0];

  const roleDimension =
    activeVariant.tagDimensions.find((dimension) => dimension.id.toLowerCase().includes("role")) ??
    activeVariant.tagDimensions[2] ??
    activeVariant.tagDimensions[0];

  const activationFocusMedia: Record<ActivationType, FocusMedia> = {};
  const roleFocusMedia: Record<RoleType, FocusMedia> = {};

  const experiences: CompanyExperience[] = activeVariant.sections.map((section, sectionIndex) => {
    const sectionTheme = pickTheme(sectionIndex);

    const projects: Project[] = section.items.map((item, itemIndex) => {
      const theme = pickTheme(sectionIndex + itemIndex);
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

      return {
        id: item.id,
        title: item.title,
        summary: item.summary || item.detail || "",
        impact: item.detail || item.summary || "",
        stack: [],
        activationType,
        roleTypes,
        theme,
        assets: item.assets.map((asset) => ({
          id: asset.id,
          label: asset.label,
          type: asset.type,
          href: asset.url,
          preview: asset.preview,
        })),
      };
    });

    return {
      id: section.id,
      company: section.title,
      role: section.subtitle || activeVariant.title,
      period: activeVariant.audience || "Custom",
      description: section.description,
      focusMedia: { theme: sectionTheme },
      projects,
    };
  });

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
    bio: {
      name: template.profile.name || "Untitled",
      title: template.profile.title || "",
      location: template.profile.location || "",
      email: template.profile.email || "",
      heroImage: template.profile.heroImage || "",
      summary: template.profile.summary || "",
      links: template.profile.links,
    },
    experiences,
    activationFocusMedia,
    roleFocusMedia,
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
