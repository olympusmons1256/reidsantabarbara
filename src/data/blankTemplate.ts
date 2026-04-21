import type { ResumeTemplate } from "@/types/template";

export const blankTemplate: ResumeTemplate = {
  id: "template-starter",
  title: "Untitled Resume Template",
  profile: {
    name: "",
    title: "",
    location: "",
    email: "",
    summary: "",
    heroImage: "",
    links: [],
  },
  defaultVariantId: "variant-primary",
  variants: [
    {
      id: "variant-primary",
      title: "Primary Resume",
      audience: "General",
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
      sections: [
        {
          id: "section-1",
          title: "Section 1",
          subtitle: "",
          description: "",
          items: [],
        },
      ],
      timelineTour: {
        enabled: true,
        steps: [],
      },
    },
  ],
  connections: [],
  updatedAt: new Date().toISOString(),
};
