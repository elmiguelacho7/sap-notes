/**
 * Close identity for user id 1acc2b99-6fe0-49f5-b28d-15f33d85abcb2 / administrator@funonso.com.
 * 1) Fetches auth user by id (Admin API)
 * 2) Fetches profile by id
 * 3) If auth exists and profile missing (Case B), creates profile (consultant, is_active=false)
 * Run: node --env-file=.env.local scripts/close-identity-admin.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";

function loadEnvLocal() {
  for (const p of [".env.local", ".env"]) {
    if (existsSync(p)) {
      const content = readFileSync(p, "utf8");
      for (const line of content.split("\n")) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
      }
      return;
    }
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const USER_ID_RAW = "1acc2b99-6fe0-49f5-b28d-15f33d85abcb2";
// Auth API requires 36-char UUID; raw id has 37 chars (extra trailing '2').
const USER_ID = USER_ID_RAW.length === 36 ? USER_ID_RAW : USER_ID_RAW.slice(0, 36);
const EMAIL = "administrator@funonso.com";

async function main() {
  if (USER_ID_RAW.length !== 36) {
    console.log("Note: id normalized from 37 to 36 chars for Auth API (raw had trailing extra character).\n");
  }
  console.log("=== Query B (by id): auth user + profile ===\n");
  const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(USER_ID);
  if (authErr) {
    console.log("Auth getUserById error:", authErr.message);
    console.log("Result: no auth user found for this id in this project.\n");
  } else if (!authUser?.user) {
    console.log("Result: no auth user for id", USER_ID, "\n");
  } else {
    const u = authUser.user;
    const { data: profile } = await supabase.from("profiles").select("id, email, full_name, app_role, is_active").eq("id", u.id).maybeSingle();
    const row = {
      auth_id: u.id,
      auth_email: u.email ?? null,
      profile_id: profile?.id ?? null,
      profile_email: profile?.email ?? null,
      full_name: profile?.full_name ?? null,
      app_role: profile?.app_role ?? null,
      is_active: profile?.is_active ?? null,
    };
    console.log(JSON.stringify(row, null, 2));
    console.log("");

    if (!profile) {
      console.log("Case B: auth user exists, profile missing. Creating profile (consultant, is_active=false)...\n");
      const { data: inserted, error: insertErr } = await supabase.from("profiles").upsert(
        {
          id: u.id,
          email: u.email ?? "",
          full_name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
          app_role: "consultant",
          is_active: false,
        },
        { onConflict: "id" }
      ).select("id, email, full_name, app_role, is_active").single();
      if (insertErr) {
        console.error("Insert error:", insertErr.message);
      } else {
        console.log("Inserted profile:", JSON.stringify(inserted, null, 2));
      }
    } else {
      console.log("Profile exists. app_role =", profile.app_role, "→ Case C or D (no insert).\n");
    }
  }

  console.log("=== Query A (by email): administrator@funonso.com ===\n");
  let byEmail = null;
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data: list } = await supabase.auth.admin.listUsers({ perPage, page });
    const users = list?.users ?? [];
    byEmail = users.find((x) => x.email?.toLowerCase() === EMAIL.toLowerCase());
    if (byEmail || users.length < perPage) break;
    page++;
  }
  if (!byEmail) {
    console.log("No auth user found with email", EMAIL, "(after scanning all listUsers pages).\n");
  } else {
    const { data: p2 } = await supabase.from("profiles").select("id, email, full_name, app_role, is_active").eq("id", byEmail.id).maybeSingle();
    console.log(JSON.stringify({
      auth_id: byEmail.id,
      auth_email: byEmail.email,
      profile_id: p2?.id ?? null,
      profile_email: p2?.email ?? null,
      full_name: p2?.full_name ?? null,
      app_role: p2?.app_role ?? null,
      is_active: p2?.is_active ?? null,
    }, null, 2));
    console.log("");
  }

  console.log("=== Summary ===\n");
  const { data: auth } = await supabase.auth.admin.getUserById(USER_ID);
  const { data: prof } = await supabase.from("profiles").select("id, email, app_role, is_active").eq("id", USER_ID).maybeSingle();
  const caseB = auth?.user && !prof;
  const caseC = auth?.user && prof?.app_role === "superadmin";
  const caseD = auth?.user && prof && prof.app_role !== "superadmin";
  console.log("Auth user exists:", !!auth?.user);
  console.log("Profile exists:", !!prof);
  console.log("app_role:", prof?.app_role ?? "(no profile)");
  if (caseB) console.log("Case: B (profile was missing; fix applied if insert ran)");
  else if (caseC) console.log("Case: C — /api/notes returning global notes was correct");
  else if (caseD) console.log("Case: D — /api/notes should not return global notes for consultant");
  else console.log("Case: unclear (auth missing or run whoami + SQL for full picture)");
}

main().catch((e) => { console.error(e); process.exit(1); });
