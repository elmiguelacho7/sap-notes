// lib/supabaseClient.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: SupabaseClient;

// Si las vars existen, creamos el cliente real
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  // No rompemos el build: solo avisamos
  console.warn(
    "⚠ Supabase env vars missing. Check Vercel Environment Variables.",
    { hasUrl: !!supabaseUrl, hasAnonKey: !!supabaseAnonKey }
  );

  // Creamos un cliente "dummy" para que el bundle no reviente.
  // Si se usa sin configurar env vars, devolverá errores controlados.
  const error = new Error("Supabase environment variables not configured");

  supabase = {
    // @ts-expect-error dummy client
    auth: {
      getSession: async () => ({ data: { session: null }, error }),
      signInWithPassword: async () => ({ data: null, error }),
      signUp: async () => ({ data: null, error }),
      signOut: async () => ({ error }),
      resetPasswordForEmail: async () => ({ data: null, error }),
      updateUser: async () => ({ data: null, error }),
    },
    // @ts-expect-error dummy client
    from: () => ({
      select: async () => ({ data: null, error }),
      insert: async () => ({ data: null, error }),
      update: async () => ({ data: null, error }),
      delete: async () => ({ data: null, error }),
    }),
  } as SupabaseClient;
}

export { supabase };