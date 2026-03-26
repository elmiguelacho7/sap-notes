"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthBrandHero } from "@/components/auth/AuthBrandHero";
import { supabase } from "@/lib/supabaseClient";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:bg-white focus:border-[rgb(var(--rb-brand-primary))] focus:ring-4 focus:ring-[rgb(var(--rb-brand-ring))]/12";

const labelClass = "text-xs font-semibold tracking-[0.02em] text-slate-700";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPassword");
  const tCommon = useTranslations("common");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMsg(t("errors.emailRequired"));
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
      setErrorMsg(t("errors.connection"));
    } finally {
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

            {sent ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {t("sent")}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className={labelClass}>{t("emailLabel")}</label>
                  <input
                    type="email"
                    placeholder={t("emailPlaceholder")}
                    className={inputClass}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
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
              </form>
            )}

            <p className="mt-6 text-center text-xs text-slate-500">
              <Link
                href="/"
                className="font-medium text-slate-500 hover:text-[rgb(var(--rb-brand-primary))] transition-colors"
              >
                {t("backToLogin")}
              </Link>
            </p>
          </div>

          <p className="mt-6 text-[11px] text-slate-400/90 text-center">{tCommon("footerInternalUse")}</p>
        </div>
      </section>
    </main>
  );
}
