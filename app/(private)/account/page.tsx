"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppPageShell } from "@/components/ui/layout/AppPageShell";

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

  const cardClass = "rounded-xl border border-slate-700/60 bg-slate-800/40 p-5";
  const inputClass =
    "w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 disabled:opacity-60";
  const labelClass = "block text-sm font-medium text-slate-300 mb-1.5";

  if (loading) {
    return (
      <div className="bg-slate-950 min-h-full">
        <AppPageShell>
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-slate-300">Cargando…</p>
            <p className="mt-1 text-sm text-slate-500">Un momento.</p>
          </div>
        </AppPageShell>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 min-h-full">
      <AppPageShell>
        <div className="space-y-6">
          <div className="mb-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Cuenta</h1>
            <p className="mt-1 text-sm text-slate-400">Información de tu cuenta, seguridad y preferencias.</p>
          </div>

        {/* Profile */}
        <section className={cardClass}>
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Profile</h2>
          <dl className="space-y-4">
            <div>
              <dt className={labelClass}>Name</dt>
              <dd className="text-slate-100">{fullName ?? "—"}</dd>
            </div>
            <div>
              <dt className={labelClass}>Email</dt>
              <dd className="text-slate-100">{email ?? "—"}</dd>
            </div>
            <div>
              <dt className={labelClass}>Avatar</dt>
              <dd className="text-sm text-slate-500">Coming soon</dd>
            </div>
          </dl>
        </section>

        {/* Security */}
        <section className={cardClass}>
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Security</h2>

          <div className="space-y-4 mb-6">
            <p className="text-sm text-slate-400">
              Introduce tu contraseña actual y la nueva contraseña. Tras actualizarla, tendrás que iniciar sesión de nuevo.
            </p>
            {errorMsg && (
              <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
                {successMsg}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="account-current-password" className={labelClass}>
                  Contraseña actual *
                </label>
                <input
                  id="account-current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Tu contraseña actual"
                  required
                  autoComplete="current-password"
                  disabled={saving}
                />
                {fieldErrors.currentPassword && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.currentPassword}</p>
                )}
              </div>
              <div>
                <label htmlFor="account-new-password" className={labelClass}>
                  Nueva contraseña *
                </label>
                <input
                  id="account-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  disabled={saving}
                />
                {fieldErrors.newPassword && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.newPassword}</p>
                )}
              </div>
              <div>
                <label htmlFor="account-confirm-password" className={labelClass}>
                  Repetir nueva contraseña *
                </label>
                <input
                  id="account-confirm-password"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Vuelve a escribir la nueva contraseña"
                  required
                  autoComplete="new-password"
                  disabled={saving}
                />
                {fieldErrors.confirmNewPassword && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.confirmNewPassword}</p>
                )}
              </div>
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0"
                >
                  {saving ? "Guardando..." : "Actualizar contraseña"}
                </button>
              </div>
            </form>
            <p className="text-xs text-slate-500 border-t border-slate-700/60 pt-3">
              ¿Olvidaste tu contraseña?{" "}
              <a href="/update-password" className="text-indigo-400 font-medium hover:text-indigo-300">
                Restablecer contraseña
              </a>
            </p>
          </div>

          <div className="border-t border-slate-700/60 pt-4">
            <p className="text-sm font-medium text-slate-400">Two-factor authentication</p>
            <p className="mt-0.5 text-xs text-slate-500">Coming soon</p>
          </div>
        </section>

        {/* Preferences */}
        <section className={cardClass}>
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Preferences</h2>
          <ul className="space-y-4">
            <li>
              <span className={labelClass}>Language</span>
              <p className="text-sm text-slate-500">Coming soon</p>
            </li>
            <li>
              <span className={labelClass}>Timezone</span>
              <p className="text-sm text-slate-500">Coming soon</p>
            </li>
            <li>
              <span className={labelClass}>Notifications</span>
              <p className="text-sm text-slate-500">Coming soon</p>
            </li>
          </ul>
        </section>
        </div>
      </AppPageShell>
    </div>
  );
}
