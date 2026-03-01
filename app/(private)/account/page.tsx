"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const MIN_PASSWORD_LENGTH = 8;

export default function AccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      setEmail(user.email ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (!cancelled && profile) {
        setFullName((profile as { full_name?: string | null }).full_name ?? null);
      }
      if (!cancelled) setLoading(false);
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setFieldErrors({});

    const current = currentPassword.trim();
    const newPwd = newPassword.trim();
    const confirm = confirmNewPassword.trim();

    const errors: Record<string, string> = {};
    if (!current) errors.currentPassword = "La contraseña actual es obligatoria.";
    if (!newPwd) errors.newPassword = "La nueva contraseña es obligatoria.";
    else if (newPwd.length < MIN_PASSWORD_LENGTH)
      errors.newPassword = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    if (!confirm) errors.confirmNewPassword = "Repite la nueva contraseña.";
    else if (newPwd !== confirm)
      errors.confirmNewPassword = "Las contraseñas no coinciden.";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);

    const userEmail = email;
    if (!userEmail) {
      setErrorMsg("No se pudo obtener tu correo. Cierra sesión y vuelve a entrar.");
      setSaving(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: current,
    });

    if (signInError) {
      setErrorMsg("La contraseña actual no es correcta.");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPwd,
    });

    setSaving(false);

    if (updateError) {
      setErrorMsg("No se pudo actualizar la contraseña. Inténtalo de nuevo.");
      return;
    }

    setSuccessMsg("Contraseña actualizada correctamente.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setFieldErrors({});

    await supabase.auth.signOut();
    router.push("/?message=password-updated");
  };

  if (loading) {
    return (
      <div className="w-full">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <p className="text-sm text-slate-500">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Cuenta</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Información de tu cuenta y opciones de seguridad.
          </p>
        </div>

        {/* Información de la cuenta */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Información de la cuenta
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500 font-medium">Email</dt>
              <dd className="text-slate-900 mt-0.5">
                {email ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 font-medium">Nombre</dt>
              <dd className="text-slate-900 mt-0.5">
                {fullName ?? "—"}
              </dd>
            </div>
          </dl>
        </section>

        {/* Cambiar contraseña */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Cambiar contraseña
          </h2>
          <p className="text-sm text-slate-500">
            Introduce tu contraseña actual y la nueva contraseña. Tras
            actualizarla, tendrás que iniciar sesión de nuevo.
          </p>

          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="account-current-password"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Contraseña actual *
              </label>
              <input
                id="account-current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Tu contraseña actual"
                required
                autoComplete="current-password"
                disabled={saving}
              />
              {fieldErrors.currentPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.currentPassword}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="account-new-password"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Nueva contraseña *
              </label>
              <input
                id="account-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                disabled={saving}
              />
              {fieldErrors.newPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.newPassword}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="account-confirm-password"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Repetir nueva contraseña *
              </label>
              <input
                id="account-confirm-password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Vuelve a escribir la nueva contraseña"
                required
                autoComplete="new-password"
                disabled={saving}
              />
              {fieldErrors.confirmNewPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.confirmNewPassword}
                </p>
              )}
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Guardando..." : "Actualizar contraseña"}
              </button>
            </div>
          </form>

          <p className="text-xs text-slate-500 border-t border-slate-100 pt-3">
            ¿Olvidaste tu contraseña? Puedes restablecerla desde el enlace que
            te enviamos por correo.{" "}
            <a
              href="/update-password"
              className="text-indigo-600 font-medium hover:underline"
            >
              Restablecer contraseña
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
