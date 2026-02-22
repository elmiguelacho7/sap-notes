import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// En vez de lanzar error y tumbar el build, solo avisamos en logs.
// Así el build de Vercel no revienta aunque falte algo.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "⚠️ Supabase env vars missing. Check Vercel Environment Variables.",
    {
      hasUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
    }
  );
}

// Creamos el cliente igualmente. Si las vars están bien,
// todo OK. Si no, fallará al hacer peticiones, pero no en el build.
export const supabase = createClient(
  (supabaseUrl as string) || "",
  (supabaseAnonKey as string) || ""
);