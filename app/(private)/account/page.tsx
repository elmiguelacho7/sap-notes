"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabaseClient";
import { AppPageShell } from "@/components/ui/layout/AppPageShell";
import { FORM_PAGE_BLOCK_CLASS, FORM_PAGE_SHELL_CLASS } from "@/components/layout/formPageClasses";

const MIN_PASSWORD_LENGTH = 8;

export default function AccountPage() {
  const t = useTranslations("account");
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
    if (!current) errors.currentPassword = t("errors.currentRequired");
    if (!newPwd) errors.newPassword = t("errors.newRequired");
    else if (newPwd.length < MIN_PASSWORD_LENGTH)
      errors.newPassword = t("errors.minLength", { min: MIN_PASSWORD_LENGTH });
    if (!confirm) errors.confirmNewPassword = t("errors.confirmRequired");
    else if (newPwd !== confirm)
      errors.confirmNewPassword = t("errors.passwordMismatch");

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);

    const userEmail = email;
    if (!userEmail) {
      setErrorMsg(t("errors.noEmail"));
      setSaving(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: current,
    });

    if (signInError) {
      setErrorMsg(t("errors.currentIncorrect"));
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPwd,
    });

    setSaving(false);

    if (updateError) {
      setErrorMsg(t("errors.updateFailed"));
      return;
    }

    setSuccessMsg(t("success.updated"));
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setFieldErrors({});

    await supabase.auth.signOut();
    router.push("/?message=password-updated");
  };

  const cardClass =
    "rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] p-5 shadow-sm";
  const labelClass = "block text-xs font-medium text-[rgb(var(--rb-text-secondary))] mb-1.5";
  const inputClass =
    "w-full h-10 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-3))]/20 px-3 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30 disabled:opacity-60";

  if (loading) {
    return (
      <AppPageShell>
        <div className={FORM_PAGE_SHELL_CLASS}>
          <div className={`${FORM_PAGE_BLOCK_CLASS} py-12 text-center`}>
            <p className="text-sm font-medium text-[rgb(var(--rb-text-primary))]">{t("loading")}</p>
            <p className="mt-1 text-sm text-[rgb(var(--rb-text-muted))]">{t("loadingSubtext")}</p>
          </div>
        </div>
      </AppPageShell>
    );
  }

  const initials = (() => {
    const base = (fullName ?? email ?? "").trim();
    if (!base) return "U";
    const parts = base.split(/\s+/).filter(Boolean);
    const first = (parts[0] ?? base).charAt(0).toUpperCase();
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0).toUpperCase() : "";
    return `${first}${last}`.slice(0, 2);
  })();

  return (
    <AppPageShell>
      <div className={FORM_PAGE_SHELL_CLASS}>
        <div className={`${FORM_PAGE_BLOCK_CLASS} space-y-6`}>
          <header className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--rb-text-primary))]">
                Settings
              </h1>
              <p className="mt-1 text-sm text-[rgb(var(--rb-text-muted))] max-w-3xl">
                Personal account, security, and preferences.
              </p>
            </div>
          </header>

          {/* Profile */}
          <section className={cardClass}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[rgb(var(--rb-text-primary))]">Profile</h2>
                <p className="mt-1 text-sm text-[rgb(var(--rb-text-muted))]">
                  Your identity and account details.
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center rounded-full border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/25 px-2.5 py-1 text-[11px] font-medium text-[rgb(var(--rb-text-muted))]">
                Avatar editing planned
              </span>
            </div>

            <div className="mt-5 flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl border border-[rgb(var(--rb-brand-primary))]/20 bg-[rgb(var(--rb-brand-primary))]/10 flex items-center justify-center text-sm font-semibold text-[rgb(var(--rb-brand-primary))]">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[rgb(var(--rb-text-primary))] truncate">
                  {fullName ?? "Unnamed user"}
                </p>
                <p className="mt-0.5 text-sm text-[rgb(var(--rb-text-muted))] truncate">
                  {email ?? "—"}
                </p>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className={labelClass}>Name</dt>
                    <dd className="text-sm text-[rgb(var(--rb-text-primary))]">{fullName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className={labelClass}>Email</dt>
                    <dd className="text-sm text-[rgb(var(--rb-text-primary))]">{email ?? "—"}</dd>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Security */}
          <section className={`${cardClass} ring-1 ring-[rgb(var(--rb-surface-border))]/30`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[rgb(var(--rb-text-primary))]">Security</h2>
                <p className="mt-1 text-sm text-[rgb(var(--rb-text-muted))]">
                  {t("securityHelp")}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {errorMsg && (
                <div className="rounded-xl border border-red-200/90 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="rounded-xl border border-emerald-200/90 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {successMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="account-current-password" className={labelClass}>
                    {t("currentPassword")} *
                  </label>
                  <input
                    id="account-current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={inputClass}
                    placeholder={t("currentPasswordPlaceholder")}
                    required
                    autoComplete="current-password"
                    disabled={saving}
                  />
                  {fieldErrors.currentPassword && (
                    <p className="mt-1.5 text-xs text-rose-700">{fieldErrors.currentPassword}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="account-new-password" className={labelClass}>
                      {t("newPassword")} *
                    </label>
                    <input
                      id="account-new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={inputClass}
                      placeholder={t("newPasswordPlaceholder", { min: MIN_PASSWORD_LENGTH })}
                      required
                      minLength={MIN_PASSWORD_LENGTH}
                      autoComplete="new-password"
                      disabled={saving}
                    />
                    {fieldErrors.newPassword && (
                      <p className="mt-1.5 text-xs text-rose-700">{fieldErrors.newPassword}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="account-confirm-password" className={labelClass}>
                      {t("confirmPassword")} *
                    </label>
                    <input
                      id="account-confirm-password"
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className={inputClass}
                      placeholder={t("confirmPasswordPlaceholder")}
                      required
                      autoComplete="new-password"
                      disabled={saving}
                    />
                    {fieldErrors.confirmNewPassword && (
                      <p className="mt-1.5 text-xs text-rose-700">{fieldErrors.confirmNewPassword}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-[rgb(var(--rb-surface-border))]/60">
                  <p className="text-xs text-[rgb(var(--rb-text-muted))]">
                    {t("forgotPassword")}{" "}
                    <a
                      href="/update-password"
                      className="text-[rgb(var(--rb-brand-primary))] font-medium hover:text-[rgb(var(--rb-brand-primary-hover))]"
                    >
                      {t("resetPassword")}
                    </a>
                  </p>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-transparent bg-[rgb(var(--rb-brand-primary))] px-4 text-sm font-medium text-white shadow-sm hover:bg-[rgb(var(--rb-brand-primary-hover))] active:bg-[rgb(var(--rb-brand-primary-active))] disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35"
                  >
                    {saving ? t("saving") : t("updatePassword")}
                  </button>
                </div>
              </form>

              <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/15 px-4 py-3">
                <p className="text-sm font-medium text-[rgb(var(--rb-text-secondary))]">Two-factor authentication</p>
                <p className="mt-0.5 text-xs text-[rgb(var(--rb-text-muted))]">
                  This will be available in a future update.
                </p>
              </div>
            </div>
          </section>

          {/* Preferences */}
          <section className={cardClass}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[rgb(var(--rb-text-primary))]">Preferences</h2>
                <p className="mt-1 text-sm text-[rgb(var(--rb-text-muted))]">
                  Personalize how Ribbit looks and behaves for you.
                </p>
              </div>
            </div>

            <ul className="mt-5 divide-y divide-[rgb(var(--rb-surface-border))]/60">
              {[
                { title: "Language", detail: "Control the UI language and formats." },
                { title: "Timezone", detail: "Used for dates, due times, and reporting." },
                { title: "Notifications", detail: "Choose how you receive updates." },
              ].map((row) => (
                <li key={row.title} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[rgb(var(--rb-text-secondary))]">{row.title}</p>
                      <p className="mt-0.5 text-xs text-[rgb(var(--rb-text-muted))] leading-relaxed">
                        {row.detail}
                      </p>
                    </div>
                    <span className="shrink-0 inline-flex items-center rounded-full border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/25 px-2.5 py-1 text-[11px] font-medium text-[rgb(var(--rb-text-muted))]">
                      Planned
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </AppPageShell>
  );
}
