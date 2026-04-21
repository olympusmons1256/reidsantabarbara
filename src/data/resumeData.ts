import type { ActivationType, Bio, CompanyExperience, FocusMedia, RoleType } from "@/types/resume";

export const activationFocusMedia: Record<ActivationType, FocusMedia> = {
  spectacle: {
    focusAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
    theme: {
      accent: "#f43f5e",
      gradientFrom: "#4c0519",
      gradientTo: "#7f1d1d",
      backgroundVideo: "https://cdn.coverr.co/videos/coverr-lights-at-a-concert-1579/1080p.mp4",
    },
  },
  festival: {
    focusAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
    theme: {
      accent: "#f59e0b",
      gradientFrom: "#451a03",
      gradientTo: "#92400e",
      backgroundVideo: "https://cdn.coverr.co/videos/coverr-festival-crowd-1579/1080p.mp4",
    },
  },
  presentation: {
    focusAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3",
    theme: {
      accent: "#0ea5e9",
      gradientFrom: "#082f49",
      gradientTo: "#1d4ed8",
      backgroundVideo: "https://cdn.coverr.co/videos/coverr-presenting-business-data-1579/1080p.mp4",
    },
  },
  theatre: {
    focusAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3",
    theme: {
      accent: "#a78bfa",
      gradientFrom: "#2e1065",
      gradientTo: "#5b21b6",
      backgroundVideo: "https://cdn.coverr.co/videos/coverr-stage-lighting-1579/1080p.mp4",
    },
  },
};

export const roleFocusMedia: Record<RoleType, FocusMedia> = {
  "technical direction": {
    focusAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3",
    theme: {
      accent: "#22d3ee",
      gradientFrom: "#083344",
      gradientTo: "#0f766e",
      backgroundVideo: "https://cdn.coverr.co/videos/coverr-coding-dark-theme-1579/1080p.mp4",
    },
  },
  design: {
    focusAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3",
    theme: {
      accent: "#ec4899",
      gradientFrom: "#500724",
      gradientTo: "#831843",
      backgroundVideo: "https://cdn.coverr.co/videos/coverr-designing-an-interface-1579/1080p.mp4",
    },
  },
  "production management": {
    focusAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3",
    theme: {
      accent: "#22c55e",
      gradientFrom: "#052e16",
      gradientTo: "#166534",
      backgroundVideo: "https://cdn.coverr.co/videos/coverr-teamwork-at-work-1579/1080p.mp4",
    },
  },
};

export const bio: Bio = {
  name: "Reid Santa Barbara",
  title: "Product Engineer",
  location: "Santa Barbara, CA",
  email: "reid@example.com",
  summary:
    "I design and ship polished web experiences with a focus on clarity, performance, and measurable product outcomes.",
  links: [
    { label: "GitHub", href: "https://github.com" },
    { label: "LinkedIn", href: "https://linkedin.com" },
    { label: "Portfolio", href: "https://example.com" },
  ],
};

export const experiences: CompanyExperience[] = [
  {
    id: "northstar",
    company: "Northstar Labs",
    role: "Senior Frontend Engineer",
    period: "2023 — Present",
    description:
      "Led UI architecture for a B2B analytics platform and partnered with design to define reusable patterns.",
    focusMedia: {
      focusAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
      theme: {
        accent: "#38bdf8",
        gradientFrom: "#0f172a",
        gradientTo: "#0c4a6e",
        backgroundVideo: "https://cdn.coverr.co/videos/coverr-code-on-screen-1579/1080p.mp4",
      },
    },
    projects: [
      {
        id: "northstar-ops-dashboard",
        title: "Operations Command Dashboard",
        summary:
          "Built a real-time dashboard for account health and SLA tracking across 50+ enterprise tenants.",
        impact: "Reduced time-to-diagnosis by 37% for support incidents.",
        stack: ["Next.js", "TypeScript", "Tailwind", "Postgres"],
        activationType: "presentation",
        roleTypes: ["technical direction", "design"],
        focusAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        theme: {
          accent: "#0ea5e9",
          gradientFrom: "#0f172a",
          gradientTo: "#1e293b",
          backgroundVideo:
            "https://cdn.coverr.co/videos/coverr-computer-screen-with-code-1579/1080p.mp4",
        },
        assets: [
          {
            id: "ns-ops-ui",
            label: "UI Mockups",
            type: "image",
            href: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=2000&q=80",
            preview:
              "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80",
            mimeType: "image/jpeg",
          },
          {
            id: "ns-ops-reel",
            label: "Demo Reel Clip",
            type: "video",
            href: "https://cdn.coverr.co/videos/coverr-coding-on-a-computer-1579/1080p.mp4",
            preview:
              "https://cdn.coverr.co/videos/coverr-coding-on-a-computer-1579/1080p.mp4",
            mimeType: "video/mp4",
          },
          {
            id: "ns-ops-doc",
            label: "Case Study",
            type: "doc",
            href: "https://example.com/case-study",
          },
        ],
      },
      {
        id: "northstar-onboarding",
        title: "Guided Onboarding Experience",
        summary:
          "Created a step-based onboarding with contextual tips, checkpoints, and role-specific templates.",
        impact: "Improved activation by 24% in the first 2 weeks.",
        stack: ["React", "Server Actions", "Zod"],
        activationType: "spectacle",
        roleTypes: ["design", "production management"],
        focusAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        theme: {
          accent: "#8b5cf6",
          gradientFrom: "#312e81",
          gradientTo: "#4c1d95",
        },
        assets: [
          {
            id: "ns-onboard-flow",
            label: "Flow Diagram",
            type: "image",
            href: "https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=2000&q=80",
            preview:
              "https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=1200&q=80",
            mimeType: "image/jpeg",
          },
          {
            id: "ns-onboard-notes",
            label: "Launch Notes",
            type: "doc",
            href: "https://example.com/launch-notes",
          },
        ],
      },
    ],
  },
  {
    id: "harbor",
    company: "Harbor Digital",
    role: "Software Engineer",
    period: "2020 — 2023",
    description:
      "Shipped full-stack features for client-facing products in e-commerce and internal tooling.",
    focusMedia: {
      focusAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
      theme: {
        accent: "#f59e0b",
        gradientFrom: "#1c1917",
        gradientTo: "#78350f",
        backgroundVideo: "https://cdn.coverr.co/videos/coverr-digital-analytics-dashboard-1579/1080p.mp4",
      },
    },
    projects: [
      {
        id: "harbor-catalog",
        title: "Headless Product Catalog",
        summary:
          "Developed a performant product browsing experience with faceted search and personalized recommendations.",
        impact: "Increased conversion by 11% during holiday campaigns.",
        stack: ["Next.js", "GraphQL", "Redis"],
        activationType: "festival",
        roleTypes: ["technical direction", "production management"],
        focusAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
        theme: {
          accent: "#f59e0b",
          gradientFrom: "#451a03",
          gradientTo: "#78350f",
          backgroundVideo: "https://cdn.coverr.co/videos/coverr-working-late-2617/1080p.mp4",
        },
        assets: [
          {
            id: "harbor-catalog-ab",
            label: "A/B Results",
            type: "doc",
            href: "https://example.com/ab-results",
          },
          {
            id: "harbor-catalog-proto",
            label: "Interaction Prototype",
            type: "video",
            href: "https://cdn.coverr.co/videos/coverr-using-a-computer-in-a-modern-office-1579/1080p.mp4",
            preview:
              "https://cdn.coverr.co/videos/coverr-using-a-computer-in-a-modern-office-1579/1080p.mp4",
            mimeType: "video/mp4",
          },
        ],
      },
      {
        id: "harbor-design-system",
        title: "Design System Foundation",
        summary:
          "Established a component library and token system to standardize UI across four teams.",
        impact: "Cut UI implementation cycle time by 30%.",
        stack: ["Storybook", "TypeScript", "Figma"],
        activationType: "theatre",
        roleTypes: ["design", "technical direction"],
        focusAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
        theme: {
          accent: "#22c55e",
          gradientFrom: "#052e16",
          gradientTo: "#14532d",
        },
        assets: [
          {
            id: "harbor-ds-inventory",
            label: "Component Inventory",
            type: "image",
            href: "https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=2000&q=80",
            preview:
              "https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=1200&q=80",
            mimeType: "image/jpeg",
          },
          {
            id: "harbor-ds-guide",
            label: "Usage Guide",
            type: "doc",
            href: "https://example.com/design-system-guide",
          },
        ],
      },
    ],
  },
];
