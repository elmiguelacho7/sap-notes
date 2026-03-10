/**
 * 1) Query profile by JWT user id (no auth API).
 * 2) Optional: listUsers to find administrator@funonso.com.
 * Run: node --env-file=.env.local scripts/verify-admin-sql.mjs
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

const JWT_USER_ID = "1acc2b99-6fe0-49f5-b28d-15f33d85abcb2".slice(0, 36);

async function main() {
  console.log("=== Profile for JWT user id (1acc2b99-6fe0-49f5-b28d-15f33d85abcb2) ===\n");
  const { data: prof, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, app_role, is_active")
    .eq("id", JWT_USER_ID)
    .maybeSingle();
  if (error) {
    console.log("Error:", error.message);
  } else {
    console.log(JSON.stringify(prof ?? { message: "No profile row for this id" }, null, 2));
    if (prof) {
      console.log("\nConclusion: This is the profile for the user who called /api/notes with the JWT (sub = this id).");
      console.log("app_role:", prof.app_role);
      console.log("Email (login identity):", prof.email);
    }
  }

  console.log("\n=== administrator@funonso.com in listUsers (first 1000) ===\n");
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const au = (list?.users ?? []).find((u) => u.email?.toLowerCase() === "administrator@funonso.com");
  if (au) {
    const { data: p2 } = await supabase.from("profiles").select("id, email, full_name, app_role, is_active").eq("id", au.id).maybeSingle();
    console.log(JSON.stringify({ auth_id: au.id, auth_email: au.email, profile: p2 }, null, 2));
    console.log("\nSame as JWT id?", au.id === JWT_USER_ID);
  } else {
    console.log("Not in first 1000. Run the SQL in Supabase Dashboard to confirm by email.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
