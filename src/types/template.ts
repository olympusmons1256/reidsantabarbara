export type TemplateProfile = {
  name: string;
  title: string;
  location: string;
  email: string;
  summary: string;
  heroImage?: string;
  heroImageFilter?: string;
  bannerBackgroundVideo?: string;
  bannerBackgroundImage?: string;
  bannerVideoOpacity?: number;
  bannerOverlayOpacity?: number;
  bannerVideoFilter?: string;
  bannerVideoUseAudio?: boolean;
  bannerVideoAudioVolume?: number;
  bannerVideoDuckedVolume?: number;
  links: Array<{ label: string; href: string }>;
};

export type TemplateTagDimension = {
  id: string;
  label: string;
  allowMultiple: boolean;
  options: string[];
};

export const TEMPLATE_PROFILE_SCOPE_FIELDS = [
  "name",
  "title",
  "location",
  "email",
  "summary",
  "heroImage",
  "heroImageFilter",
  "bannerBackgroundVideo",
  "bannerBackgroundImage",
  "links",
] as const;

export type TemplateProfileScopeField = (typeof TEMPLATE_PROFILE_SCOPE_FIELDS)[number];

export type TemplateAssetType = "image" | "video" | "doc" | "iframe" | "gallery";

export type TemplateAssetAspectRatio = "auto" | "16/9" | "4/3" | "1/1" | "3/4" | "9/16" | "21/9";

export type TemplateAssetFit = "cover" | "contain";

export type TemplateGalleryLayout = "masonry" | "carousel";

export type TemplateGalleryEntryAsset = {
  id: string;
  label: string;
  description?: string;
  type: Exclude<TemplateAssetType, "gallery">;
  subType?: "cover" | "supporting";
  url: string;
  preview?: string;
  aspectRatio?: TemplateAssetAspectRatio;
  fit?: TemplateAssetFit;
  focusX?: number;
  focusY?: number;
  zoom?: number;
};

export type TemplateAsset = {
  id: string;
  label: string;
  description?: string;
  type: TemplateAssetType;
  subType?: "cover" | "supporting";
  url: string;
  preview?: string;
  aspectRatio?: TemplateAssetAspectRatio;
  fit?: TemplateAssetFit;
  focusX?: number;
  focusY?: number;
  zoom?: number;
  galleryLayout?: TemplateGalleryLayout;
  coverAssetId?: string;
  assets?: TemplateGalleryEntryAsset[];
};

export type TemplateFocusMedia = {
  focusAudio?: string;
  backgroundVideo?: string;
  backgroundImage?: string;
};

export type TemplateCredit = {
  id: string;
  role: string;
  name: string;
  href?: string;
  logoUrl?: string;
};

export type TemplateItem = {
  id: string;
  title: string;
  dateRange?: string;
  summary: string;
  detail: string;
  focusMedia?: TemplateFocusMedia;
  assetLayout?: "list" | "masonry" | "carousel";
  coverAssetId?: string;
  tags: Record<string, string[]>;
  assets: TemplateAsset[];
  credits?: TemplateCredit[];
  type?: "standard" | "innovation" | "group";
  parentGroupId?: string;
  sourceContext?: string;
};

export type TemplateSection = {
  id: string;
  type?: "experience" | "education" | "custom";
  title: string;
  subtitle: string;
  itemsSubtitle?: string;
  metadataItemsText?: string;
  dateRange?: string;
  description: string;
  focusMedia?: TemplateFocusMedia;
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
  profileScope?: TemplateProfileScopeField[];
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
  is_published?: boolean;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
};
