"use client";

import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import type { MemberLoadBand } from "@/lib/projectOverviewExecutive";
import { bandToLoadFraction } from "@/lib/projectOverviewExecutive";

export type TeamLoadRow = {
  userId: string;
  displayName: string;
  openTasks: number;
  openTickets: number;
  blocked: number;
  overdue: number;
  score: number;
  band: MemberLoadBand;
};

function bandLabel(band: MemberLoadBand, t: (k: string) => string): string {
  return t(`load.bands.${band}`);
}

function bandBarClass(band: MemberLoadBand): string {
  if (band === "light") return "bg-emerald-500";
  if (band === "balanced") return "bg-[rgb(var(--rb-brand-primary))]";
  if (band === "high") return "bg-amber-500";
  return "bg-rose-500";
}

export function ProjectTeamLoadPanel({
  rows,
  loading,
  summaryLine,
}: {
  rows: TeamLoadRow[];
  loading?: boolean;
  /** Optional executive summary derived from the same row data. */
  summaryLine?: string;
}) {
  const t = useTranslations("projects.overview");

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-12px_rgba(15,23,42,0.09)] ring-1 ring-slate-100">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/85 bg-gradient-to-br from-slate-50 to-white text-slate-700 shadow-sm">
          <Users className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1.5">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">{t("load.title")}</h2>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">{t("load.subtitle")}</p>
          {summaryLine ? (
            <p className="text-[11px] text-slate-500 leading-relaxed border-l-2 border-[rgb(var(--rb-brand-primary))]/50 pl-3 py-0.5">
              {summaryLine}
            </p>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-600">
          {t("load.empty")}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => {
            const frac = bandToLoadFraction(r.band);
            return (
              <li
                key={r.userId}
                className="rounded-xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/50 to-white px-3.5 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100/90 transition-[border-color,box-shadow] hover:border-slate-300/85 hover:shadow-md"
              >
                <div className="flex items-start gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/85 bg-white text-[11px] font-bold uppercase tracking-wide text-slate-700 shadow-sm">
                    {(r.displayName || "?")
                      .split(/\s+/)
                      .map((p) => p[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join("") || "—"}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 gap-y-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{r.displayName}</p>
                      <span className="inline-flex items-center rounded-md border border-slate-200/90 bg-white px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-700">
                        {t("load.scoreLabel", { n: r.score })}
                      </span>
                      <span className="inline-flex items-center rounded-md border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        {bandLabel(r.band, t)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4 text-[11px] text-slate-600 tabular-nums">
                      <span>
                        {t("load.tasks")}{" "}
                        <span className="font-semibold text-slate-900">{r.openTasks}</span>
                      </span>
                      <span>
                        {t("load.tickets")}{" "}
                        <span className="font-semibold text-slate-900">{r.openTickets}</span>
                      </span>
                      <span>
                        {t("load.blocked")}{" "}
                        <span className="font-semibold text-slate-900">{r.blocked}</span>
                      </span>
                      <span>
                        {t("load.overdue")}{" "}
                        <span className="font-semibold text-slate-900">{r.overdue}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 pt-0.5">
                      <div className="h-2 min-w-[5rem] flex-1 max-w-[200px] overflow-hidden rounded-full bg-slate-200/95 ring-1 ring-slate-200/80">
                        <div
                          className={`h-full rounded-full ${bandBarClass(r.band)} transition-all shadow-sm`}
                          style={{ width: `${frac * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
