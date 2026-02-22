"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const MIN_PASSWORD_LENGTH = 6;

export default function UpdatePasswordPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [checkingSession, setCheckingSession] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.replace("/");
        return;
      }

      setCheckingSession(false);
    };

    checkSession();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (checkingSession) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const pwd = newPassword.trim();
    const confirm = confirmPassword.trim();

    if (pwd.length < MIN_PASSWORD_LENGTH) {
      setErrorMsg(
        `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
      );
      return;
    }

    if (pwd !== confirm) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });

      if (error) {
        console.error(error);
        setErrorMsg("No se pudo actualizar la contraseña. Inténtalo de nuevo.");
        setSaving(false);
        return;
      }

      setSuccessMsg("Contraseña actualizada correctamente.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      setErrorMsg("Se ha producido un error inesperado.");
    } finally {
      setSaving(false);
    }
  };

  const isActive = (path: string) => pathname === path;

  return (
    <main className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
            PH
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Project Hub
            </p>
            <p className="text-[11px] text-slate-500">Entorno interno</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
          <button
            onClick={() => router.push("/dashboard")}
            className={`w-full text-left px-3 py-2 rounded-lg transition ${
              isActive("/dashboard")
                ? "bg-blue-50 text-blue-700 font-semibold"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Dashboard
          </button>

          <button
            onClick={() => router.push("/notes")}
            className={`w-full text-left px-3 py-2 rounded-lg transition ${
              isActive("/notes")
                ? "bg-blue-50 text-blue-700 font-semibold"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Notas
          </button>

          <button
            onClick={() => router.push("/projects")}
            className={`w-full text-left px-3 py-2 rounded-lg transition ${
              isActive("/projects")
                ? "bg-blue-50 text-blue-700 font-semibold"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Proyectos
          </button>

          <button
            onClick={() => router.push("/update-password")}
            className={`w-full text-left px-3 py-2 rounded-lg transition ${
              isActive("/update-password")
                ? "bg-blue-50 text-blue-700 font-semibold"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Cambiar contraseña
          </button>
        </nav>

        <div className="px-3 py-4 border-t border-slate-200">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-600 hover:bg-slate-100"
          >
            Cerrar sesión
          </button>
          <p className="mt-2 text-[10px] text-slate-400">
            Acceso restringido · Información interna
          </p>
        </div>
      </aside>

      {/* Contenido */}
      <section className="flex-1">
        <div className="max-w-lg mx-auto px-6 py-7">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <h1 className="text-xl font-semibold text-slate-900 mb-1">
              Cambiar contraseña
            </h1>
            <p className="text-sm text-slate-600 mb-6">
              Define una nueva contraseña para tu cuenta. Utiliza una
              combinación de mayúsculas, minúsculas, números y símbolos para
              mejorar la seguridad.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-800">
                  Nueva contraseña *
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Introduce la nueva contraseña"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-800">
                  Repetir nueva contraseña *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Vuelve a escribir la nueva contraseña"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoComplete="new-password"
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-red-500">{errorMsg}</p>
              )}
              {successMsg && (
                <p className="text-xs text-emerald-600">{successMsg}</p>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Actualizando..." : "Actualizar contraseña"}
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="text-sm text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-100"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}