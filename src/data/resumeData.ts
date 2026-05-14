import type { ActivationType, Bio, CompanyExperience, FocusMedia, RoleType } from "@/types/resume";

export const activationFocusMedia: Record<ActivationType, FocusMedia> = {};

export const roleFocusMedia: Record<RoleType, FocusMedia> = {};

export const bio: Bio = {
  name: "",
  title: "",
  location: "",
  email: "",
  summary: "",
  links: [],
};

export const experiences: CompanyExperience[] = [];
