"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import type { RiskBullet } from "@/lib/projectOverviewExecutive";

function rowAccent(level: RiskBullet["tone"]): string {
  if (level === "risk") return "border-l-rose-500 bg-rose-50/35 ring-rose-100/80";
  if (level === "watch") return "border-l-amber-500 bg-amber-50/30 ring-amber-100/70";
  return "border-l-emerald-500 bg-emerald-50/25 ring-emerald-100/70";
}

function severityLabel(level: RiskBullet["tone"], t: (key: string) => string): string {
  if (level === "risk") return t("risks.severityHigh");
  if (level === "watch") return t("risks.severityWatch");
  return t("risks.severityOk");
}

export function ProjectRisksBottlenecksPanel({ bullets }: { bullets: RiskBullet[] }) {
  const t = useTranslations("projects.overview");

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-12px_rgba(15,23,42,0.09)] ring-1 ring-slate-100">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50 to-white text-amber-900 shadow-sm">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1.5">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">{t("risks.title")}</h2>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">{t("risks.subtitle")}</p>
          <p className="text-[11px] text-slate-500 leading-relaxed">{t("risks.caption")}</p>
        </div>
      </div>
      <ul className="space-y-2">
        {bullets.map((b, i) => (
          <li
            key={i}
            className={`rounded-xl border border-slate-200/85 border-l-[3px] pl-3.5 pr-3 py-3 text-sm text-slate-800 leading-snug shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ${rowAccent(b.tone)}`}
          >
            <div className="flex flex-wrap items-center gap-2 gap-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {severityLabel(b.tone, t as (key: string) => string)}
              </span>
            </div>
            <p className="mt-1.5 font-medium text-slate-800">{b.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
