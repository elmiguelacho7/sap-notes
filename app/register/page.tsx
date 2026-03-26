"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthBrandHero } from "@/components/auth/AuthBrandHero";
import { supabase } from "@/lib/supabaseClient";

const MIN_PASSWORD_LENGTH = 6;

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:bg-white focus:border-[rgb(var(--rb-brand-primary))] focus:ring-4 focus:ring-[rgb(var(--rb-brand-ring))]/12";

const labelClass = "text-xs font-semibold tracking-[0.02em] text-slate-700";

export default function RegisterPage() {
  const t = useTranslations("auth.register");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const name = fullName.trim();
    const mail = email.trim();
    const pwd = password;
    const confirm = confirmPassword;

    if (!mail) {
      setErrorMsg(t("errors.emailRequired"));
      return;
    }
    if (pwd.length < MIN_PASSWORD_LENGTH) {
      setErrorMsg(t("errors.minPassword", { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (pwd !== confirm) {
      setErrorMsg(t("errors.passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: mail,
        password: pwd,
        options: {
          data: { full_name: name || undefined },
        },
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      if (process.env.NODE_ENV === "development") {
        console.debug(
          "[signup] Auth user created; DB trigger will create/update profile with is_active = false. Only admin-created users get is_active = true."
        );
      }

      router.replace("/register/success");
    } catch {
      setErrorMsg(t("errors.connection"));
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-[rgb(var(--rb-brand-surface))]/60 text-slate-900 lg:grid lg:grid-cols-[1.08fr_1fr]">
      <AuthBrandHero />

      <section className="flex flex-1 items-center justify-center p-6 sm:p-8 lg:p-10 xl:p-14">
        <div className="w-full max-w-md">
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

          <div className="rounded-2xl border border-slate-200/70 bg-white p-7 sm:p-9 shadow-[0_24px_65px_-36px_rgba(15,23,42,0.35)]">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 mb-1.5">{t("title")}</h2>
            <p className="text-sm text-slate-500 mb-7 leading-relaxed">{t("subtitle")}</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className={labelClass}>{t("fullName")}</label>
                <input
                  type="text"
                  placeholder={t("fullNamePlaceholder")}
                  className={inputClass}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>
                  {t("emailLabel")} <span className="text-red-500">{tCommon("requiredStar")}</span>
                </label>
                <input
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>
                  {t("passwordLabel")} <span className="text-red-500">{tCommon("requiredStar")}</span>
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className={inputClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                />
                <p className="text-[11px] text-slate-400">{t("minChars", { min: MIN_PASSWORD_LENGTH })}</p>
              </div>
              <div className="space-y-2">
                <label className={labelClass}>
                  {t("confirmPassword")} <span className="text-red-500">{tCommon("requiredStar")}</span>
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className={inputClass}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
              <button
                type="submit"
                disabled={loading}
                className="rb-btn-primary w-full mt-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:translate-y-[1px] focus:outline-none focus:ring-4 focus:ring-[rgb(var(--rb-brand-ring))]/25 disabled:opacity-60"
              >
                {loading ? t("submitLoading") : t("submit")}
              </button>

              <p className="text-center text-xs text-slate-500 pt-2">
                {t("hasAccount")}{" "}
                <Link
                  href="/"
                  className="font-semibold text-[rgb(var(--rb-brand-primary))] hover:text-[rgb(var(--rb-brand-primary-hover))]"
                >
                  {t("signIn")}
                </Link>
              </p>
            </form>
          </div>

          <p className="mt-6 text-[11px] text-slate-400/90 text-center">{tCommon("footerInternalUse")}</p>
        </div>
      </section>
    </main>
  );
}
