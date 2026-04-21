# Resume Wireframe (Next.js)

This project is a wireframe for a resume-style portfolio page featuring:

- Full-width looping video banner at the top
- Optional hero/profile image in the header reel
- Company-based experience cards with nested project cards
- A right-side details panel that updates when a project is selected
- Timeline mode with a guided tour overlay
- A generic template editor for building resume data from scratch
- Multiple resume variants for different audiences or career tracks
- Explicit cross-variant connections that show how work in one path relates to another

## Local development

Use Node 20+

```bash
nvm use 20
npm install
npm run dev
```

Open http://localhost:3000.

Template editor: http://localhost:3000/editor

## Generic template editor

The editor at /editor provides a blank, fully customizable template flow:

- Shared profile fields, including a hero image
- Multiple resume variants with their own sections, tag dimensions, and timeline tour steps
- Custom sort/tag dimensions per variant (you define labels + options)
- Custom sections + items + media assets
- Explicit connections between items across variants
- Live draft persistence in browser local storage
- JSON preview of the generated template payload

Preview options:

- Use “Open Resume” from loaded templates to open /?templateId=<id>
- Add /?templateId=<id>&variantId=<variant-id> to open a specific resume variant directly
- Without templateId, the home page uses local draft fallback from editor

## Supabase auth + persistence + storage

1. Copy environment template:

```bash
cp .env.example .env.local
```

2. Fill Supabase values in .env.local:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

3. In Supabase SQL editor, run schema:

- supabase/schema.sql

This creates:

- resume_templates table (JSON template persistence)
- RLS policies scoped to authenticated users
- resume-media storage bucket (for user media uploads)

4. In editor UI:

- Sign in with email magic link
- Save/load templates to/from Supabase
- Upload media assets to Supabase Storage bucket resume-media

## Provider setup checklist

1. Create your local env file:

```bash
cp .env.example .env.local
```

2. Add Supabase public keys in .env.local.

3. For Cloudflare deployment, choose one auth path:

- Local/manual: run `npx wrangler login`
- CI/CD: set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`

4. In Cloudflare Pages/Workers project settings, add runtime env vars used by the app:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

## Deploy to Cloudflare

This project is configured with OpenNext for Cloudflare.

1. Build Cloudflare output:

```bash
npm run cf:build
```

2. Preview with Wrangler:

```bash
npm run cf:preview
```

3. Deploy:

```bash
npm run cf:deploy
```

Before first deploy, authenticate Wrangler:

```bash
npx wrangler login
```

### Cloudflare + media notes

- App hosting: OpenNext build deployed to Cloudflare Pages/Workers.
- Supabase Storage can be used as primary media origin.
- If you want edge media caching/CDN-control beyond Supabase defaults, add Cloudflare R2 + CDN routing in front of storage URLs as a next step.
