/**
 * Print active Supabase project ref and URL host (safe only).
 * Run: node --env-file=.env.local scripts/print-project-ref.mjs
 */
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
let projectRef = "";
let host = "";
try {
  if (url) {
    const u = new URL(url);
    host = u.host;
    const match = u.hostname?.match(/^([a-z]+)\.supabase\.co$/i);
    projectRef = match ? match[1] : u.hostname ?? "";
  }
} catch (_) {}

console.log("NEXT_PUBLIC_SUPABASE_URL (host only):", host || "(not set)");
console.log("projectRef:", projectRef || "(not set)");
