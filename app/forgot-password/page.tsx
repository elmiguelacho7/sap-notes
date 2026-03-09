"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMsg("Introduce tu correo electrónico.");
      return;
    }
    setLoading(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const redirectTo = `${origin}/update-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      });
      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }
      setSent(true);
    } catch {
      setErrorMsg("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-7">
          <h1 className="text-lg font-semibold text-slate-900 mb-1">
            Recuperar contraseña
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            Es un flujo de recuperación de cuenta. Introduce tu correo y te enviaremos un enlace para restablecer la contraseña. Al hacer clic en el enlace llegarás a una página pública donde podrás definir una contraseña nueva; después tendrás que iniciar sesión normalmente. No entrarás en la plataforma hasta que inicies sesión.
          </p>

          {sent ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña. Revisa tu bandeja de entrada y, si no lo ves, la carpeta de spam. El enlace te llevará a una página para establecer la nueva contraseña; después inicia sesión con ella.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              {errorMsg && (
                <p className="text-xs text-red-500">{errorMsg}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-medium transition"
              >
                {loading ? "Enviando…" : "Enviar enlace"}
              </button>
            </form>
          )}

          <p className="mt-5 text-center">
            <Link href="/" className="text-xs text-blue-600 hover:text-blue-700">
              Volver a iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
