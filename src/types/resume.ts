export type ProjectAssetType = "image" | "video" | "doc" | "iframe" | "gallery";

export type ProjectAssetAspectRatio = "auto" | "16/9" | "4/3" | "1/1" | "3/4" | "9/16" | "21/9";

export type ProjectAssetFit = "cover" | "contain";

export type ProjectGalleryLayout = "masonry" | "carousel";

export type ProjectGalleryEntryAsset = {
  id: string;
  label: string;
  description?: string;
  type: Exclude<ProjectAssetType, "gallery">;
  subType?: "cover" | "supporting";
  href: string;
  preview?: string;
  mimeType?: string;
  aspectRatio?: ProjectAssetAspectRatio;
  fit?: ProjectAssetFit;
  focusX?: number;
  focusY?: number;
  zoom?: number;
};

export type ProjectAsset = {
  id: string;
  label: string;
  description?: string;
  type: ProjectAssetType;
  subType?: "cover" | "supporting";
  href: string;
  preview?: string;
  mimeType?: string;
  aspectRatio?: ProjectAssetAspectRatio;
  fit?: ProjectAssetFit;
  focusX?: number;
  focusY?: number;
  zoom?: number;
  galleryLayout?: ProjectGalleryLayout;
  coverAssetId?: string;
  assets?: ProjectGalleryEntryAsset[];
};

export type ActivationType = string;

export type RoleType = string;

export type ProjectSortMode = string;

export type ProjectSortFilter = {
  id: string;
  label: string;
};

export type ProjectTheme = {
  accent: string;
  gradientFrom: string;
  gradientTo: string;
  backgroundVideo?: string;
  backgroundImage?: string;
};

export type ConnectedResumeLink = {
  id: string;
  label: string;
  type: string;
  narrative: string;
  targetVariantId: string;
  targetVariantTitle: string;
  targetSectionTitle: string;
  targetItemId: string;
  targetItemTitle: string;
  targetItemSummary: string;
};

export type FocusMedia = {
  focusAudio?: string;
  theme: ProjectTheme;
};

export type ParentGroupFocusTarget = {
  id: string;
  label: string;
  media?: FocusMedia;
};

export type ProjectCredit = {
  id: string;
  role: string;
  name: string;
  href?: string;
  logoUrl?: string;
};

export type Project = {
  id: string;
  title: string;
  dateRange?: string;
  summary: string;
  impact: string;
  stack: string[];
  activationType: ActivationType;
  roleTypes: RoleType[];
  focusAudio?: string;
  theme: ProjectTheme;
  assetLayout?: "list" | "masonry" | "carousel";
  coverAssetId?: string;
  assets: ProjectAsset[];
  credits?: ProjectCredit[];
  type?: "standard" | "innovation";
  parentGroupId?: string;
  parentGroupTitle?: string;
  parentGroupDateRange?: string;
  parentGroupSummary?: string;
  sourceContext?: string;
  tags?: Record<string, string[]>;
};

export type CompanyExperience = {
  id: string;
  sectionType?: "experience" | "education" | "custom";
  company: string;
  role: string;
  period: string;
  description: string;
  itemsSubtitle?: string;
  metadataItems?: string[];
  focusMedia?: FocusMedia;
  groupContainers?: Array<{
    id: string;
    title: string;
    dateRange?: string;
    summary?: string;
  }>;
  projects: Project[];
};

export type Bio = {
  name: string;
  title: string;
  location: string;
  email: string;
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
  summary: string;
};
