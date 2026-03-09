"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const MIN_PASSWORD_LENGTH = 8;

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);

  // Solo permitir uso con sesión válida (enlace de recuperación o sesión activa)
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (!session?.user) {
        setSessionValid(false);
        return;
      }
      setSessionValid(true);
    });
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const pwd = newPassword.trim();
    const confirm = confirmPassword.trim();

    if (pwd.length < MIN_PASSWORD_LENGTH) {
      setErrorMsg(
        `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
      );
      return;
    }

    if (pwd !== confirm) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password: pwd,
    });

    if (error) {
      setSaving(false);
      setErrorMsg(error.message || "No se pudo actualizar la contraseña.");
      return;
    }

    // Cerrar sesión para que el usuario entre de forma normal desde login
    await supabase.auth.signOut();
    setSuccessMsg("Contraseña actualizada correctamente. Inicia sesión con tu nueva contraseña.");
    setSaving(false);

    // Redirigir a login con mensaje de éxito (no dejar dentro de la app)
    setTimeout(() => {
      router.push("/?reset=success");
    }, 2000);
  };

  // Estado: sin sesión o enlace inválido
  if (sessionValid === false) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-7 text-center">
            <div className="rounded-full bg-amber-100 w-12 h-12 flex items-center justify-center mx-auto mb-4 text-amber-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-slate-900 mb-2">
              Enlace inválido o expirado
            </h1>
            <p className="text-sm text-slate-600 mb-6">
              Este enlace de recuperación no es válido o ya ha caducado. Solicita uno nuevo desde la página de recuperar contraseña.
            </p>
            <Link
              href="/forgot-password"
              className="inline-block w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              Solicitar nuevo enlace
            </Link>
            <p className="mt-5">
              <Link href="/" className="text-sm text-blue-600 hover:text-blue-700">
                Volver a iniciar sesión
              </Link>
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Estado: cargando sesión
  if (sessionValid === null) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-sm text-slate-500">Comprobando enlace…</p>
      </main>
    );
  }

  // Formulario de nueva contraseña (página pública, sin shell de la app)
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-7">
          <header className="mb-6">
            <h1 className="text-xl font-semibold text-slate-900">
              Establecer nueva contraseña
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Estás en el flujo de recuperación de cuenta. Define una contraseña nueva. Cuando termines, serás redirigido al inicio de sesión; esta pantalla no te da acceso a la plataforma hasta que inicies sesión con la nueva contraseña.
            </p>
          </header>

          {errorMsg && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nueva contraseña *
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Mínimo 8 caracteres"
                required
                minLength={MIN_PASSWORD_LENGTH}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Repetir nueva contraseña *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Vuelve a escribir la contraseña"
                required
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? "Actualizando…" : "Actualizar contraseña"}
              </button>
              <Link
                href="/"
                className="text-sm text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-100"
              >
                Cancelar
              </Link>
            </div>
          </form>

          <p className="mt-6 text-center">
            <Link href="/" className="text-xs text-blue-600 hover:text-blue-700">
              Volver a iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
