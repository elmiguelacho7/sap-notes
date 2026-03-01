// lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || String(supabaseUrl).trim() === "") {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL for Supabase admin client");
}
if (!supabaseServiceKey || String(supabaseServiceKey).trim() === "") {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for Supabase admin client");
}

/**
 * Server-side only. Use for API routes and backend logic that need to bypass RLS.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
  },
});
