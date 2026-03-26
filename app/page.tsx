"use client";

import { Suspense, useState, type FormEvent, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthBrandHero } from "@/components/auth/AuthBrandHero";
import { supabase } from "../lib/supabaseClient";

function LoginPageContent() {
  const t = useTranslations("auth.login");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next");
  const resetSuccess = searchParams.get("reset") === "success";
  const inviteEmail = searchParams.get("email");
  const isInviteContext = Boolean(nextUrl?.includes("/invite"));
  const [email, setEmail] = useState(inviteEmail ?? "");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Si ya hay sesión, comprobar activación antes de redirigir: solo permitir acceso privado si is_active = true
  useEffect(() => {
    const checkSessionAndActivation = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.user?.id) return;

      // Use getUser() so identity is validated with the server, not just from storage
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", userId)
        .single();

      const row = profile as { is_active?: boolean } | null;
      // Inactivo o sin perfil => no permitir acceso privado; enviar a pendiente de activación
      if (!row || row.is_active === false) {
        router.replace("/pending-activation");
        return;
      }

      router.replace(nextUrl && nextUrl.startsWith("/") ? nextUrl : "/dashboard");
    };
    checkSessionAndActivation();
  }, [router, nextUrl]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    // After login, enforce activation: do not send to private app if profile is inactive
    const userId = data.user?.id;
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", userId)
        .single();
      const row = profile as { is_active?: boolean } | null;
      if (!row || row.is_active === false) {
        router.replace("/pending-activation");
        setLoading(false);
        return;
      }
    }

    router.push(nextUrl && nextUrl.startsWith("/") ? nextUrl : "/dashboard");
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-[rgb(var(--rb-brand-surface))]/60 text-slate-900 lg:grid lg:grid-cols-[1.08fr_1fr]">
      <AuthBrandHero />

      {/* Panel derecho: formulario */}
      <section className="flex items-center justify-center p-6 sm:p-8 lg:p-10 xl:p-14">
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

            {resetSuccess && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {t("resetSuccess")}
              </div>
            )}

            {isInviteContext && (
              <p className="mb-4 text-sm text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                {t("inviteHint")}
              </p>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold tracking-[0.02em] text-slate-700">{t("emailLabel")}</label>
                <input
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:bg-white focus:border-[rgb(var(--rb-brand-primary))] focus:ring-4 focus:ring-[rgb(var(--rb-brand-ring))]/12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold tracking-[0.02em] text-slate-700">
                  {t("passwordLabel")}
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:bg-white focus:border-[rgb(var(--rb-brand-primary))] focus:ring-4 focus:ring-[rgb(var(--rb-brand-ring))]/12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <p className="text-right">
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-slate-500 hover:text-[rgb(var(--rb-brand-primary))] transition-colors"
                  >
                    {t("forgotPassword")}
                  </Link>
                </p>
              </div>

              {errorMsg && (
                <p className="text-xs text-red-500">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="rb-btn-primary w-full mt-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:translate-y-[1px] focus:outline-none focus:ring-4 focus:ring-[rgb(var(--rb-brand-ring))]/25 disabled:opacity-60"
              >
                {loading ? t("submitLoading") : t("submit")}
              </button>

              <p className="text-center text-xs text-slate-500 pt-2">
                {t("noAccount")}{" "}
                <Link href="/register" className="font-semibold text-[rgb(var(--rb-brand-primary))] hover:text-[rgb(var(--rb-brand-primary-hover))]">
                  {t("createAccount")}
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

function LoginSuspenseFallback() {
  const t = useTranslations("common");
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-[rgb(var(--rb-brand-surface))]/60 flex items-center justify-center">
      <p className="text-sm text-slate-500">{t("loading")}</p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSuspenseFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}