import { TEMPLATE_PROFILE_SCOPE_FIELDS, type ResumeTemplate } from "@/types/template";

export const blankTemplate: ResumeTemplate = {
  id: "template-starter",
  title: "My Resume Collection",
  profile: {
    name: "",
    title: "",
    location: "",
    email: "",
    summary: "",
    heroImage: "",
    heroImageFilter: "",
    bannerBackgroundVideo: "",
    bannerBackgroundImage: "",
    bannerVideoOpacity: 42,
    bannerOverlayOpacity: 72,
    bannerVideoFilter: "brightness(0.9) saturate(0.95)",
    bannerVideoUseAudio: false,
    bannerVideoAudioVolume: 20,
    bannerVideoDuckedVolume: 8,
    links: [],
  },
  defaultVariantId: "variant-primary",
  variants: [
    {
      id: "variant-primary",
      title: "Resume",
      audience: "",
      profileScope: [...TEMPLATE_PROFILE_SCOPE_FIELDS],
      tagDimensions: [
        {
          id: "company",
          label: "Company",
          allowMultiple: false,
          options: [],
        },
        {
          id: "activation",
          label: "Activation Type",
          allowMultiple: false,
          options: [],
        },
        {
          id: "role",
          label: "Role",
          allowMultiple: true,
          options: [],
        },
      ],
      sections: [],
      timelineTour: {
        enabled: true,
        steps: [],
      },
    },
  ],
  connections: [],
  updatedAt: "",
};
