"use client";

import { useTranslations } from "next-intl";

/**
 * Shared Ribbit auth hero (login / register / forgot-password).
 * Presentational only — no auth logic.
 */
export function AuthBrandHero() {
  const t = useTranslations("auth.hero");

  return (
    <section className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between p-10 xl:p-14 text-white">
      <div className="absolute inset-0 rb-brand-gradient" aria-hidden />
      <div className="absolute -left-24 top-16 h-80 w-80 rounded-full bg-[rgb(var(--rb-brand-primary))]/20 blur-3xl" />
      <div className="absolute -right-24 bottom-10 h-96 w-96 rounded-full bg-[rgb(var(--rb-brand-wordmark-accent-dark))]/14 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,rgba(74,222,128,0.18),transparent_45%)]" />

      <header className="relative z-10 pt-0.5">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center" aria-hidden>
            <img
              src="/branding/ribbit_eyes_light.svg"
              alt=""
              className="h-full w-full object-contain"
            />
          </span>
          <span className="text-xl leading-none tracking-tight">
            <span className="text-white font-bold">ri</span>
            <span className="text-black font-extrabold">bb</span>
            <span className="text-white font-bold">it</span>
          </span>
        </div>
      </header>

      <div className="relative z-10 max-w-xl space-y-6">
        <h1 className="text-4xl xl:text-5xl font-semibold leading-[1.1] tracking-tight">{t("headline")}</h1>
        <p className="text-base text-white/90 max-w-lg leading-relaxed">{t("sub")}</p>
        <ul className="grid grid-cols-2 gap-2.5 max-w-md text-sm text-white/90">
          <li className="rounded-lg border border-white/15 bg-white/5 px-3 py-2">{t("pillPlanning")}</li>
          <li className="rounded-lg border border-white/15 bg-white/5 px-3 py-2">{t("pillTasks")}</li>
          <li className="rounded-lg border border-white/15 bg-white/5 px-3 py-2">{t("pillTesting")}</li>
          <li className="rounded-lg border border-white/15 bg-white/5 px-3 py-2">{t("pillKnowledge")}</li>
        </ul>
      </div>

      <p className="relative z-10 text-[11px] text-white/75 tracking-wide uppercase">{t("footer")}</p>
    </section>
  );
}
