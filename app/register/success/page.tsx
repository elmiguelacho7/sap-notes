"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function RegisterSuccessPage() {
  const t = useTranslations("auth.registerSuccess");

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          <div className="rounded-full bg-emerald-100 w-12 h-12 flex items-center justify-center mx-auto mb-4 text-emerald-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">{t("title")}</h1>
          <p className="text-sm text-slate-600 mb-6">{t("body")}</p>
          <Link
            href="/"
            className="inline-block rounded-xl rb-btn-primary px-4 py-2.5 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/40 focus-visible:ring-offset-2"
          >
            {t("backToLogin")}
          </Link>
        </div>
      </div>
    </main>
  );
}
