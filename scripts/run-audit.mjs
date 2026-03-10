/**
 * Run the user identity audit using Supabase Admin API + profiles table.
 * Run from project root with env loaded (e.g. from .env.local):
 *   node --env-file=.env.local scripts/run-audit.mjs
 *   or: npx dotenv -e .env.local -- node scripts/run-audit.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";

function loadEnvLocal() {
  const paths = [".env.local", ".env"];
  for (const p of paths) {
    if (existsSync(p)) {
      const content = readFileSync(p, "utf8");
      for (const line of content.split("\n")) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (m && !process.env[m[1]]) {
          const v = m[2].replace(/^["']|["']$/g, "").trim();
          process.env[m[1]] = v;
        }
      }
      return;
    }
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Use .env.local.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const TARGET_EMAILS = [
  "administrator@funonso.com",
  "mguerra.marin7@gmail.com",
  "isasis1207@gmail.com",
];

async function main() {
  console.log("Fetching auth.users (via listUsers) and public.profiles...\n");

  const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const authUsers = authData?.users ?? [];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, full_name, app_role, is_active");
  if (profilesError) {
    console.error("Profiles error:", profilesError);
    process.exit(1);
  }
  const profileList = profiles ?? [];
  const profileById = new Map(profileList.map((p) => [p.id, p]));

  // Query 4: Specific accounts
  console.log("========== Query 4: Specific accounts ==========");
  for (const email of TARGET_EMAILS) {
    const au = authUsers.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    const p = au ? profileById.get(au.id) : null;
    let status = "ok";
    if (!p && au) status = "auth_only_no_profile";
    else if (p && au && (au.email?.trim().toLowerCase() ?? "") !== (p.email?.trim().toLowerCase() ?? ""))
      status = "email_mismatch";
    console.log(JSON.stringify({
      email: au?.email ?? email,
      auth_id: au?.id ?? null,
      auth_full_name: au?.user_metadata?.full_name ?? null,
      profile_id: p?.id ?? null,
      profile_email: p?.email ?? null,
      profile_full_name: p?.full_name ?? null,
      app_role: p?.app_role ?? null,
      is_active: p?.is_active ?? null,
      status,
    }, null, 2));
    console.log("");
  }

  // Query 1: Auth users without profile
  console.log("========== Query 1: Auth users WITHOUT profile ==========");
  const authWithoutProfile = authUsers.filter((u) => !profileById.has(u.id));
  console.log("Count:", authWithoutProfile.length);
  authWithoutProfile.forEach((u) => {
    console.log(JSON.stringify({ auth_id: u.id, auth_email: u.email, auth_full_name: u.user_metadata?.full_name }));
  });
  console.log("");

  // Query 2: Profiles without auth user
  console.log("========== Query 2: Profiles WITHOUT auth user ==========");
  const authIds = new Set(authUsers.map((u) => u.id));
  const profilesWithoutAuth = profileList.filter((p) => !authIds.has(p.id));
  console.log("Count:", profilesWithoutAuth.length);
  profilesWithoutAuth.forEach((p) => {
    console.log(JSON.stringify({ profile_id: p.id, profile_email: p.email, profile_full_name: p.full_name, app_role: p.app_role, is_active: p.is_active }));
  });
  console.log("");

  // Query 3: Email mismatches
  console.log("========== Query 3: Email MISMATCH (auth vs profile) ==========");
  const mismatches = authUsers.filter((u) => {
    const p = profileById.get(u.id);
    if (!p) return false;
    const a = (u.email ?? "").trim().toLowerCase();
    const b = (p.email ?? "").trim().toLowerCase();
    return a !== b;
  });
  console.log("Count:", mismatches.length);
  mismatches.forEach((u) => {
    const p = profileById.get(u.id);
    console.log(JSON.stringify({ id: u.id, auth_email: u.email, profile_email: p?.email ?? null, full_name: p?.full_name, app_role: p?.app_role }));
  });
  console.log("");

  // Summary
  const adminAcc = authUsers.find((u) => u.email?.toLowerCase() === "administrator@funonso.com");
  const adminProfile = adminAcc ? profileById.get(adminAcc.id) : null;
  console.log("========== Summary ==========");
  console.log("administrator@funonso.com app_role:", adminProfile?.app_role ?? (adminAcc ? "no_profile" : "not_found_in_auth_list"));
  console.log("Auth users without profile:", authWithoutProfile.length);
  console.log("Profiles without auth user:", profilesWithoutAuth.length);
  console.log("Email mismatches:", mismatches.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
