/**
 * Reid Santabarbara's Complete Resume Template
 * 
 * This template represents a fully-fleshed example with:
 * - Comprehensive experience across startups and cultural organizations
 * - Multiple variants (Full Portfolio, Tech Focus)
 * - Detailed tags for sorting by company, role type, and project scale
 * - All sections populated with real resume content
 * 
 * Use this as reference for:
 * 1. How the template structure should look when complete
 * 2. How items should be tagged across dimensions
 * 3. What the UI should display
 */

export const reidSantabarbaraTemplate = {
  id: "template-reid-complete",
  title: "Reid Santabarbara - Portfolio",
  profile: {
    name: "Reid Santabarbara",
    title: "Immersive Experience Designer & Entrepreneur",
    location: "Seattle, WA",
    email: "reidsantabarbara@gmail.com",
    summary:
      "Immersive Experience Designer dedicated to storytelling. Expert in lighting design, and the strategic application of technology to create impactful live and digital spectacles. Passionate about fostering collaborative artistic endeavors and pushing the boundaries of experiential design and technical realization in the performing arts.",
    heroImage: "",
    links: [
      {
        label: "LinkedIn",
        href: "https://www.linkedin.com/in/reid-santabarbara-9a70364b/",
      },
      {
        label: "Phone",
        href: "tel:+1-206-948-2665",
      },
      {
        label: "Email",
        href: "mailto:reidsantabarbara@gmail.com",
      },
      {
        label: "Portfolio",
        href: "https://reidsantabarbara.com",
      },
    ],
  },
  defaultVariantId: "variant-primary",
  variants: [
    {
      id: "variant-primary",
      title: "Full Portfolio",
      audience: "General",
      tagDimensions: [
        {
          id: "company",
          label: "Company / Organization",
          allowMultiple: false,
          options: [
            "Odyssey",
            "Reid Santabarbara Design (RSD)",
            "Hotmax",
            "Ride-Show",
            "Connors & Co.",
            "Seattle Theatre Group",
            "Sub Pop",
            "Boeing",
            "Smithsonian",
          ],
        },
        {
          id: "role",
          label: "Role Type",
          allowMultiple: true,
          options: [
            "Leadership",
            "Technical Direction",
            "Design",
            "Creative Direction",
            "Production",
            "Founder",
            "Co-founder",
          ],
        },
        {
          id: "project-scale",
          label: "Project Scale",
          allowMultiple: false,
          options: [
            "Large-Scale Spectacle",
            "Enterprise",
            "Startup",
            "Educational",
            "Cultural",
          ],
        },
      ],
      sections: [
        {
          id: "section-summary",
          title: "Summary",
          subtitle: "Professional Overview",
          description: "Core expertise and vision",
          items: [
            {
              id: "item-summary-1",
              title: "Reid Santabarbara",
              summary:
                "Immersive Experience Designer with 18+ years creating large-scale spectacles, directing technical production, and building innovative technology platforms.",
              detail:
                "Reid brings a unique blend of technical mastery and artistic vision to the realm of performance and immersive experiences. He possesses a deep understanding of how technology can serve artistic expression. His work emphasizes the creation of engaging, large-scale spectacles and the development of new platforms for digital and embodied performance, fostering a collaborative approach to realizing ambitious creative visions.",
              tags: {},
              assets: [],
            },
          ],
        },
        {
          id: "section-experience",
          title: "Experience",
          subtitle: "Professional Journey",
          description: "Companies and organizations",
          items: [
            {
              id: "item-odyssey",
              title: "Odyssey - Co-founder & CTO",
              summary: "January 2020 - Present | Seattle, WA",
              detail:
                "Pioneering 3D streaming technology to support interactive art, expanding the scope of digital embodied experiences. Odyssey is a 3D streaming platform for pixel streaming Unreal Engine projects across the internet in photo-realistic 3D. Led Odyssey utilizing Lean Startup methodologies and a set of values rooted in equitable communication and empowerment of each team member, allowing them to be responsible T-shaped owners of their domain.",
              tags: {
                company: ["Odyssey"],
                role: ["Founder", "Leadership"],
                "project-scale": ["Startup"],
              },
              assets: [],
            },
            {
              id: "item-rsd",
              title: "Reid Santabarbara Design (RSD) - Founder & CEO",
              summary: "March 2013 - January 2020 | Seattle, WA",
              detail:
                "Founded RSD as an effort to solve the problems of the event industry. In our pursuit of solving these problems, we created novel approaches to design and management workflows. Ride-Show, Depthcast, and New Game+ were all answers to specific problems found while working on RSD projects. RSD was structured as a small business instead of a Lean Startup like other entrepreneurial endeavors, providing seven years of experience in business fundamentals.",
              tags: {
                company: ["Reid Santabarbara Design (RSD)"],
                role: ["Founder", "Leadership", "Design"],
                "project-scale": ["Startup"],
              },
              assets: [],
            },
            {
              id: "item-hotmax",
              title: "Hotmax, LLC - Partner",
              summary: "January 2018 - January 2020 | Seattle, WA",
              detail:
                "In response to virtual attendees outweighing in-person attendance at esports events, RSD partnered with Hotmax to develop augmented reality broadcasting software that combines the physical world and virtual world for screen-bound audiences.",
              tags: {
                company: ["Hotmax"],
                role: ["Leadership", "Technical Direction"],
                "project-scale": ["Startup"],
              },
              assets: [],
            },
            {
              id: "item-rideshow",
              title: "Ride-Show - Co-founder & CEO",
              summary: "March 2015 - March 2017 | Seattle, WA",
              detail:
                "Ride-Show was a SaaS B2B advertising startup for the live event industry that served geo-fenced ads to consumers of rideshare vehicles. As a supplement to a live event's Out of Home advertising campaign, Ride-Show served passengers dynamic content at eye-level about upcoming live events around them as they made their way throughout the city.",
              tags: {
                company: ["Ride-Show"],
                role: ["Founder", "Leadership"],
                "project-scale": ["Startup"],
              },
              assets: [],
            },
            {
              id: "item-connors",
              title:
                "Connors & Co. Events, Inc. - Creative Director / Production Manager",
              summary: "July 2013 - March 2016 | Seattle, WA",
              detail:
                "Creative Director (2015-2016) and Production Manager (2013-2015): Directed the artistic and technical execution of diverse live events, translating conceptual ideas into immersive realities and overseeing all facets of production.",
              tags: {
                company: ["Connors & Co."],
                role: ["Creative Direction", "Production", "Leadership"],
                "project-scale": ["Enterprise"],
              },
              assets: [],
            },
            {
              id: "item-stg",
              title:
                "Seattle Theatre Group, Moore Theatre - Lighting Designer & Master Electrician",
              summary: "March 2006 - September 2012 | Seattle, WA",
              detail:
                "Designed and implemented intricate lighting plots for numerous theatrical and musical productions, significantly enhancing artistic presentation and audience experience.",
              tags: {
                company: ["Seattle Theatre Group"],
                role: ["Design", "Technical Direction"],
                "project-scale": ["Cultural"],
              },
              assets: [],
            },
          ],
        },
        {
          id: "section-large-scale-spectacles",
          title: "Select Works: Large-Scale Spectacles",
          subtitle: "High-Impact Productions",
          description: "Major technical direction and production work",
          items: [
            {
              id: "item-smithsonian",
              title:
                "Smithsonian's 'Go For The Moon' - 50th Anniversary Spectacle",
              summary: "July 2019 | Washington D.C.",
              detail:
                "Technical Director for the public spectacle on the National Mall, featuring full-motion projection mapping of the Apollo 11 story onto the Washington Monument for over half a million viewers. Managed technical design and execution of this unprecedented large-scale, site-specific public environment.",
              tags: {
                company: ["Smithsonian"],
                role: ["Technical Direction"],
                "project-scale": ["Large-Scale Spectacle"],
              },
              assets: [],
            },
            {
              id: "item-boeing",
              title: "Boeing's 100th Anniversary Spectacle",
              summary: "July 2016 | Seattle, WA",
              detail:
                "Technical Director for the company's centennial celebration, featuring projection mapping of aircraft in motion. Managed all technical design and execution of the high-profile corporate spectacle.",
              tags: {
                company: ["Boeing"],
                role: ["Technical Direction"],
                "project-scale": ["Large-Scale Spectacle"],
              },
              assets: [],
            },
            {
              id: "item-subpop",
              title: "Sub Pop Records' 30th Anniversary Installation",
              summary: "August 2018 | Alki Beach, Seattle, WA",
              detail:
                'Technical Director for Sub Pop\'s "SPF30" festival, managing technical design and execution of the large-scale, site-specific public environment.',
              tags: {
                company: ["Sub Pop"],
                role: ["Technical Direction"],
                "project-scale": ["Large-Scale Spectacle"],
              },
              assets: [],
            },
          ],
        },
        {
          id: "section-education",
          title: "Education",
          subtitle: "Professional Development",
          description: "Formal education and certifications",
          items: [
            {
              id: "item-uw",
              title: "University of Washington Professional & Continuing Education",
              summary: "2011 - 2012",
              detail:
                "Integrated Lighting Design Certificate | Professional certification in advanced lighting design techniques and theatrical production.",
              tags: {},
              assets: [],
            },
          ],
        },
        {
          id: "section-skills",
          title: "Core Skills",
          subtitle: "Expertise Areas",
          description: "Key technical and soft skills",
          items: [
            {
              id: "item-skills-1",
              title: "Technical & Creative Leadership",
              summary:
                "Public Speaking, Teaching, Research, Strategic Direction, Lean Startup Methodologies",
              detail:
                "Experience leading cross-functional teams, communicating vision to stakeholders, and driving innovation in emerging technologies.",
              tags: {},
              assets: [],
            },
            {
              id: "item-skills-2",
              title: "Lighting Design & Technical Production",
              summary:
                "Intricate lighting design, technical direction, master electrician certification, theatrical production management",
              detail:
                "18+ years of experience designing and implementing complex lighting plots and managing technical aspects of large-scale productions.",
              tags: {},
              assets: [],
            },
            {
              id: "item-skills-3",
              title: "Immersive Experience Design",
              summary:
                "Large-scale spectacle design, projection mapping, site-specific installations, interactive technology integration",
              detail:
                "Expertise in creating engaging, immersive experiences that blend artistic vision with cutting-edge technology.",
              tags: {},
              assets: [],
            },
            {
              id: "item-skills-4",
              title: "Business & Product Development",
              summary:
                "Startup founding and scaling, SaaS product development, business fundamentals, product-market fit",
              detail:
                "Founded multiple startups (Odyssey, RSD, Ride-Show) and developed innovative solutions to industry problems.",
              tags: {},
              assets: [],
            },
          ],
        },
      ],
      timelineTour: {
        enabled: true,
        steps: [],
      },
    },
    {
      id: "variant-tech-focus",
      title: "Technical Focus",
      audience: "Tech Startups / Investors",
      tagDimensions: [
        {
          id: "company",
          label: "Company / Organization",
          allowMultiple: false,
          options: [
            "Odyssey",
            "Reid Santabarbara Design (RSD)",
            "Hotmax",
            "Ride-Show",
          ],
        },
        {
          id: "role",
          label: "Role Type",
          allowMultiple: true,
          options: ["Leadership", "Technical Direction", "Founder"],
        },
      ],
      sections: [
        {
          id: "section-summary",
          title: "Executive Summary",
          subtitle: "Technical Leadership",
          description: "CTO and Founder experience with emerging technologies",
          items: [
            {
              id: "item-summary-1",
              title: "Reid Santabarbara - CTO & Founder",
              summary:
                "Co-founder and CTO of Odyssey, pioneering 3D streaming technology for interactive art experiences.",
              detail:
                "Technical leader with expertise in streaming infrastructure, real-time rendering, pixel streaming, and interactive digital platforms. Founded multiple tech-focused startups solving specific industry problems through innovative technical solutions.",
              tags: {
                company: ["Odyssey"],
                role: ["Leadership", "Founder"],
              },
              assets: [],
            },
          ],
        },
        {
          id: "section-experience",
          title: "Technical Experience",
          subtitle: "Startup & Engineering Leadership",
          description: "Founded and led technology companies",
          items: [
            {
              id: "item-odyssey",
              title: "Odyssey - Co-founder & CTO",
              summary: "January 2020 - Present | 3D Streaming Platform",
              detail:
                "Led development and deployment of Odyssey, a 3D streaming platform for pixel streaming Unreal Engine projects. Architected technology infrastructure using Lean Startup methodologies. Emphasizes equitable communication and empowerment of team members as T-shaped domain owners.",
              tags: {
                company: ["Odyssey"],
                role: ["Leadership", "Founder"],
              },
              assets: [],
            },
            {
              id: "item-hotmax",
              title: "Hotmax - Technical Co-founder",
              summary: "January 2018 - January 2020 | AR Broadcasting Software",
              detail:
                "Developed augmented reality broadcasting software combining physical and virtual worlds for esports audiences. Created innovative solution to bridge gap between in-person and virtual event attendees.",
              tags: {
                company: ["Hotmax"],
                role: ["Founder", "Technical Direction"],
              },
              assets: [],
            },
            {
              id: "item-rideshow",
              title: "Ride-Show - Co-founder & CEO",
              summary: "March 2015 - March 2017 | SaaS B2B Advertising",
              detail:
                "Built and scaled SaaS platform for geo-fenced advertising to rideshare vehicle passengers. Implemented location-based technology and analytics infrastructure for live event promotion.",
              tags: {
                company: ["Ride-Show"],
                role: ["Founder", "Leadership"],
              },
              assets: [],
            },
          ],
        },
      ],
      timelineTour: {
        enabled: false,
        steps: [],
      },
    },
  ],
  connections: [],
  updatedAt: new Date().toISOString(),
};
