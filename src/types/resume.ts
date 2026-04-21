export type ProjectAsset = {
  id: string;
  label: string;
  type: "image" | "video" | "doc";
  href: string;
  preview?: string;
  mimeType?: string;
};

export type ActivationType = string;

export type RoleType = string;

export type ProjectSortMode = "company" | "activation" | "role" | "timeline";

export type ProjectTheme = {
  accent: string;
  gradientFrom: string;
  gradientTo: string;
  backgroundVideo?: string;
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

export type Project = {
  id: string;
  title: string;
  summary: string;
  impact: string;
  stack: string[];
  activationType: ActivationType;
  roleTypes: RoleType[];
  focusAudio?: string;
  theme: ProjectTheme;
  assets: ProjectAsset[];
};

export type CompanyExperience = {
  id: string;
  company: string;
  role: string;
  period: string;
  description: string;
  focusMedia?: FocusMedia;
  projects: Project[];
};

export type Bio = {
  name: string;
  title: string;
  location: string;
  email: string;
  heroImage?: string;
  links: Array<{ label: string; href: string }>;
  summary: string;
};
