import { createClient } from "@supabase/supabase-js";
import { fetch, Headers, Request, Response } from "undici";
import { reidSantabarbaraTemplate } from "../src/data/reidTemplate";

if (typeof globalThis.fetch === "undefined") {
  (globalThis as unknown as { fetch: typeof fetch }).fetch = fetch;
}
if (typeof globalThis.Headers === "undefined") {
  (globalThis as unknown as { Headers: typeof Headers }).Headers = Headers;
}
if (typeof globalThis.Request === "undefined") {
  (globalThis as unknown as { Request: typeof Request }).Request = Request;
}
if (typeof globalThis.Response === "undefined") {
  (globalThis as unknown as { Response: typeof Response }).Response = Response;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  console.error("\n📋 To get the service key:");
  console.error("   1. Go to: https://app.supabase.com/project/hqgisrfauiwpqetzuhar/settings/api");
  console.error("   2. Find 'Service Role' section");
  console.error("   3. Copy the key (starts with 'sbp_')");
  console.error("   4. Add to .env.local:");
  console.error("      SUPABASE_SERVICE_ROLE_KEY=sbp_your_key_here\n");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const setupReidProfile = async () => {
  console.log("🚀 Setting up Reid Santabarbara profile...\n");

  try {
    // 1. Create or fetch user
    console.log("📝 Step 1: Creating/checking auth user...");
    let userData: { user?: { id: string } } | null = null;
    let userError: { message?: string; code?: string } | null = null;
    try {
      const result = await supabase.auth.admin.createUser({
        email: "reidsantabarbara@gmail.com",
        password: "demo-password-12345",
        email_confirm: true,
        user_metadata: {
          name: "Reid Santabarbara",
        },
      });
      userData = result.data as { user?: { id: string } };
      userError = result.error as { message?: string; code?: string } | null;
    } catch (error) {
      userError = error as { message?: string; code?: string };
    }

    let userId: string;
    if (userError) {
      const isExistingUser =
        userError.code === "email_exists" ||
        userError.message?.toLowerCase().includes("already") ||
        userError.message?.toLowerCase().includes("registered") ||
        userError.message?.toLowerCase().includes("exists");

      if (isExistingUser) {
        console.log("✓ User already exists, fetching...");
        const { data: listData } = await supabase.auth.admin.listUsers();
        const user = listData.users?.find((u: any) => u.email === "reidsantabarbara@gmail.com");
        if (!user) throw new Error("Could not find user");
        userId = user.id;
      } else {
        throw userError;
      }
    } else if (userData?.user) {
      userId = userData.user.id;
    } else {
      throw new Error("Failed to create or fetch user");
    }

    console.log(`✓ User: ${userId}`);

    // 2. Create template
    console.log("📝 Step 2: Creating resume template...");
    const template = {
      ...reidSantabarbaraTemplate,
      id: `template-reid-${Date.now()}`,
    };

    const { data: templateData, error: templateError } = await supabase
      .from("resume_templates")
      .insert([
        {
          owner_id: userId,
          title: template.title,
          data: template,
        },
      ])
      .select();

    if (templateError) {
      throw templateError;
    }

    console.log(`✓ Template: ${templateData?.[0]?.id ?? "(created)"}`);

    // 3. Summary
    console.log("\n✅ Setup complete!\n");
    console.log("=" + "=".repeat(50));
    console.log("📋 Login Credentials:");
    console.log(`   Email:    reidsantabarbara@gmail.com`);
    console.log(`   Password: demo-password-12345`);
    console.log("\n📊 Created Data:");
    console.log(`   User ID:     ${userId}`);
    console.log(`   Template ID: ${templateData?.[0]?.id ?? "(created)"}`);
      const itemCount = (template.variants?.[0]?.sections || []).reduce(
        (sum: number, s: any) => sum + ((s.items?.length as number) || 0),
        0
      );
    console.log(`   Variants:    ${template.variants?.length || 0}`);
    console.log(`   Sections:    ${template.variants?.[0]?.sections.length || 0}`);
    console.log(`   Items:       ${itemCount}`);
    console.log("=" + "=".repeat(50));
    console.log("\n📝 Next Steps:");
    console.log("   1. Open http://localhost:3000/editor");
    console.log("   2. Click 'Load Templates' to see your template");
    console.log("   3. Click 'Load' to open in editor");
    console.log("   4. Test Phase 1 features:");
    console.log("      - Try 'Reset' button (preserves intake data)");
    console.log("      - Try removing documents");
    console.log("      - Generate new drafts with different content");
    console.log("   5. Click 'Open Resume' to view live resume\n");
  } catch (error) {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  }
};

setupReidProfile();
