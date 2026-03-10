/**
 * Insert missing profiles for miguelacho2005@gmail.com and miguelacho@gmail.com.
 * Run: node --env-file=.env.local scripts/fix-two-profiles.mjs
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
  console.error("Missing env.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const TARGET_EMAILS = ["miguelacho2005@gmail.com", "miguelacho@gmail.com"];

async function main() {
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const users = (list?.users ?? []).filter((u) =>
    TARGET_EMAILS.includes(u.email?.toLowerCase() ?? "")
  );
  const { data: existing } = await supabase.from("profiles").select("id").in("id", users.map((u) => u.id));
  const existingIds = new Set((existing ?? []).map((p) => p.id));
  const toInsert = users.filter((u) => !existingIds.has(u.id));
  if (toInsert.length === 0) {
    console.log("No missing profiles for these two emails (already exist or users not in list).");
    return;
  }
  const rows = toInsert.map((u) => ({
    id: u.id,
    email: u.email ?? "",
    full_name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
    app_role: "consultant",
    is_active: false,
  }));
  const { data: inserted, error } = await supabase.from("profiles").upsert(rows, { onConflict: "id" }).select("id, email, full_name, app_role, is_active");
  if (error) {
    console.error("Insert error:", error.message);
    process.exit(1);
  }
  console.log("Inserted/updated profiles:", JSON.stringify(inserted ?? [], null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
