import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon || !service) {
  console.error("Missing required env vars.");
  process.exit(1);
}

const client = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

const email = `reid+verifytest${Date.now()}@gmail.com`;
const password = `Test-${Date.now()}-Aa1!`;

const signUp = await client.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: "http://localhost:3000/auth",
  },
});

if (signUp.error) {
  console.error("signUp error:", signUp.error.message);
  process.exit(1);
}

const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
if (list.error) {
  console.error("listUsers error:", list.error.message);
  process.exit(1);
}

const user = list.data.users.find((u) => u.email === email);

console.log(JSON.stringify({
  email,
  signUpEmailConfirmedAt: signUp.data.user?.email_confirmed_at ?? null,
  storedEmailConfirmedAt: user?.email_confirmed_at ?? null,
  userFound: Boolean(user),
}, null, 2));
