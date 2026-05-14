import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const targetEmail = process.argv[2];
const sourceTemplateId = process.argv[3];

if (!targetEmail || !sourceTemplateId) {
  console.error("Usage: node scripts/clone-template-to-user.mjs <targetEmail> <sourceTemplateId>");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ensureUser = async (email) => {
  try {
    const created = await supabase.auth.admin.createUser({
      email,
      password: "demo-password-12345",
      email_confirm: true,
      user_metadata: { name: "Reid Santabarbara" },
    });

    if (created.error) throw created.error;
    return { id: created.data.user.id, created: true };
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    const code = String(error?.code || "");
    const exists =
      code === "email_exists" ||
      message.includes("already") ||
      message.includes("registered") ||
      message.includes("exists");

    if (!exists) throw error;

    const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listed.error) throw listed.error;

    const user = listed.data.users.find((u) => u.email === email);
    if (!user) throw new Error("User exists but was not found in listUsers");

    return { id: user.id, created: false };
  }
};

const run = async () => {
  const user = await ensureUser(targetEmail);

  const source = await supabase
    .from("resume_templates")
    .select("title,data")
    .eq("id", sourceTemplateId)
    .single();

  if (source.error) throw source.error;

  const clonedData = {
    ...(source.data.data || {}),
    id: `template-reid-${Date.now()}`,
    updatedAt: new Date().toISOString(),
  };

  const inserted = await supabase
    .from("resume_templates")
    .insert([
      {
        owner_id: user.id,
        title: source.data.title,
        data: clonedData,
      },
    ])
    .select("id,owner_id,title")
    .single();

  if (inserted.error) throw inserted.error;

  console.log(JSON.stringify({
    userCreated: user.created,
    userId: user.id,
    email: targetEmail,
    sourceTemplateId,
    clonedTemplateId: inserted.data.id,
    title: inserted.data.title,
  }, null, 2));
};

run().catch((error) => {
  console.error("FAILED", error);
  process.exit(1);
});
