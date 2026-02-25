"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

const MIN_PASSWORD_LENGTH = 6;

export default function UpdatePasswordPage() {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

    setSaving(false);

    if (error) {
      setErrorMsg(error.message || "No se pudo actualizar la contraseña.");
      return;
    }

    setSuccessMsg("Contraseña actualizada correctamente.");

    // Pequeña pausa y volvemos al dashboard
    setTimeout(() => {
      router.push("/dashboard");
    }, 1500);
  };

  return (
    <div className="w-full px-6 py-8">
      <div className="max-w-md mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            Cambiar contraseña
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Define una nueva contraseña para tu cuenta. Utiliza una
            combinación de mayúsculas, minúsculas, números y símbolos
            para mejorar la seguridad.
          </p>
        </header>

        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
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
                placeholder="Introduce la nueva contraseña"
                required
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
                placeholder="Vuelve a escribir la nueva contraseña"
                required
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
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
    </div>
  );
}