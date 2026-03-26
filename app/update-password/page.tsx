"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthBrandHero } from "@/components/auth/AuthBrandHero";
import { supabase } from "@/lib/supabaseClient";

const MIN_PASSWORD_LENGTH = 8;

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:bg-white focus:border-[rgb(var(--rb-brand-primary))] focus:ring-4 focus:ring-[rgb(var(--rb-brand-ring))]/12";

const labelClass = "text-xs font-semibold tracking-[0.02em] text-slate-700";

const authShellClass =
  "min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-[rgb(var(--rb-brand-surface))]/60 text-slate-900 lg:grid lg:grid-cols-[1.08fr_1fr]";

const cardClass =
  "rounded-2xl border border-slate-200/70 bg-white p-7 sm:p-8 shadow-lg shadow-slate-300/25";

export default function UpdatePasswordPage() {
  const t = useTranslations("auth.updatePassword");
  const tCommon = useTranslations("common");
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
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const pwd = newPassword.trim();
    const confirm = confirmPassword.trim();

    if (pwd.length < MIN_PASSWORD_LENGTH) {
      setErrorMsg(t("errors.minPassword", { min: MIN_PASSWORD_LENGTH }));
      return;
    }

    if (pwd !== confirm) {
      setErrorMsg(t("errors.passwordMismatch"));
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password: pwd,
    });

    if (error) {
      setSaving(false);
      setErrorMsg(error.message || t("errors.updateFailed"));
      return;
    }

    // Cerrar sesión para que el usuario entre de forma normal desde login
    await supabase.auth.signOut();
    setSuccessMsg(t("success"));
    setSaving(false);

    // Redirigir a login con mensaje de éxito (no dejar dentro de la app)
    setTimeout(() => {
      router.push("/?reset=success");
    }, 2000);
  };

  const mobileWordmark = (
    <div className="mb-8 lg:hidden">
      <div className="mb-3">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center" aria-hidden>
            <img
              src="/branding/ribbit_eyes_light.svg"
              alt=""
              className="h-full w-full object-contain"
            />
          </span>
          <span className="text-lg leading-none tracking-tight">
            <span className="text-slate-900 font-bold">ri</span>
            <span className="text-black font-extrabold">bb</span>
            <span className="text-slate-900 font-bold">it</span>
          </span>
        </div>
      </div>
      <p className="text-sm text-slate-600">{t("mobileTagline")}</p>
    </div>
  );

  const footerNote = (
    <p className="mt-6 text-[11px] text-slate-400/90 text-center">{tCommon("footerInternalUse")}</p>
  );

  // Estado: sin sesión o enlace inválido
  if (sessionValid === false) {
    return (
      <main className={authShellClass}>
        <AuthBrandHero />
        <section className="flex flex-1 items-center justify-center p-6 sm:p-8 lg:p-10 xl:p-14">
          <div className="w-full max-w-md">
            {mobileWordmark}
            <div className={`${cardClass} text-center`}>
              <div className="rounded-full bg-amber-100 w-12 h-12 flex items-center justify-center mx-auto mb-4 text-amber-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">{t("invalidTitle")}</h2>
              <p className="text-sm text-slate-600 mb-6">{t("invalidBody")}</p>
              <Link
                href="/forgot-password"
                className="rb-btn-primary inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/40 focus-visible:ring-offset-2"
              >
                {t("requestNew")}
              </Link>
              <p className="mt-5">
                <Link
                  href="/"
                  className="text-sm font-medium text-[rgb(var(--rb-brand-text-accent))] hover:text-[rgb(var(--rb-brand-primary-hover))] transition-colors"
                >
                  {t("backToLogin")}
                </Link>
              </p>
            </div>
            {footerNote}
          </div>
        </section>
      </main>
    );
  }

  // Estado: cargando sesión
  if (sessionValid === null) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-[rgb(var(--rb-brand-surface))]/60 flex items-center justify-center p-6">
        <p className="text-sm text-slate-500">{t("checking")}</p>
      </main>
    );
  }

  // Formulario de nueva contraseña (página pública, sin shell de la app)
  return (
    <main className={authShellClass}>
      <AuthBrandHero />
      <section className="flex flex-1 items-center justify-center p-6 sm:p-8 lg:p-10 xl:p-14">
        <div className="w-full max-w-md">
          {mobileWordmark}

          <div className={cardClass}>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 mb-1.5">{t("title")}</h2>
            <p className="text-sm text-slate-500 mb-7 leading-relaxed">{t("subtitle")}</p>

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
              <div className="space-y-2">
                <label className={labelClass} htmlFor="update-password-new">
                  {t("newPassword")} <span className="text-red-500">{tCommon("requiredStar")}</span>
                </label>
                <input
                  id="update-password-new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  placeholder={t("newPlaceholder")}
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass} htmlFor="update-password-confirm">
                  {t("confirmPassword")} <span className="text-red-500">{tCommon("requiredStar")}</span>
                </label>
                <input
                  id="update-password-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  placeholder={t("confirmPlaceholder")}
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="rb-btn-primary inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? t("submitLoading") : t("submit")}
                </button>
                <Link
                  href="/"
                  className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors px-1 py-2"
                >
                  {t("cancel")}
                </Link>
              </div>
            </form>

            <p className="mt-6 text-center">
              <Link
                href="/"
                className="text-xs font-medium text-[rgb(var(--rb-brand-text-accent))] hover:text-[rgb(var(--rb-brand-primary-hover))] transition-colors"
              >
                {t("backToLogin")}
              </Link>
            </p>
          </div>

          {footerNote}
        </div>
      </section>
    </main>
  );
}
