export type TemplateProfile = {
  name: string;
  title: string;
  location: string;
  email: string;
  summary: string;
  heroImage?: string;
  links: Array<{ label: string; href: string }>;
};

export type TemplateTagDimension = {
  id: string;
  label: string;
  allowMultiple: boolean;
  options: string[];
};

export type TemplateAsset = {
  id: string;
  label: string;
  type: "image" | "video" | "doc";
  url: string;
  preview?: string;
};

export type TemplateItem = {
  id: string;
  title: string;
  summary: string;
  detail: string;
  tags: Record<string, string[]>;
  assets: TemplateAsset[];
};

export type TemplateSection = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  items: TemplateItem[];
};

export type TemplateTourStep = {
  id: string;
  label: string;
  sectionId: string;
  itemId: string;
  durationMs: number;
};

export type TemplateVariant = {
  id: string;
  title: string;
  audience?: string;
  tagDimensions: TemplateTagDimension[];
  sections: TemplateSection[];
  timelineTour: {
    enabled: boolean;
    steps: TemplateTourStep[];
  };
};

export type TemplateConnection = {
  id: string;
  label: string;
  type: string;
  narrative: string;
  sourceVariantId: string;
  sourceSectionId: string;
  sourceItemId: string;
  targetVariantId: string;
  targetSectionId: string;
  targetItemId: string;
};

export type ResumeTemplate = {
  id: string;
  title: string;
  profile: TemplateProfile;
  defaultVariantId?: string;
  variants: TemplateVariant[];
  connections: TemplateConnection[];
  updatedAt: string;
};

export type StoredTemplateRecord = {
  id: string;
  owner_id: string | null;
  title: string;
  data: ResumeTemplate;
  created_at: string;
  updated_at: string;
};
