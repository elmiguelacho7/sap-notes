"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ExecutiveSignalLevel } from "@/lib/projectOverviewExecutive";

function toneSurface(level: ExecutiveSignalLevel): string {
  if (level === "risk") return "border-rose-200/95 bg-gradient-to-b from-rose-50/95 to-white ring-rose-200/40";
  if (level === "watch") return "border-amber-200/95 bg-gradient-to-b from-amber-50/90 to-white ring-amber-200/35";
  return "border-slate-200/90 bg-gradient-to-b from-slate-50/80 to-white ring-slate-200/50";
}

function toneLabel(level: ExecutiveSignalLevel): string {
  if (level === "risk") return "text-rose-800";
  if (level === "watch") return "text-amber-900";
  return "text-slate-600";
}

function SignalCell({
  label,
  value,
  helper,
  level,
  loading,
  progress,
}: {
  label: string;
  value: string;
  helper?: string;
  level: ExecutiveSignalLevel;
  loading?: boolean;
  progress?: number;
}) {
  const pct = Math.max(0, Math.min(100, progress ?? 0));
  return (
    <div
      className={`rounded-xl border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] min-w-0 ${toneSurface(level)}`}
    >
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${toneLabel(level)}`}>{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <>
          <p className="mt-2 text-2xl sm:text-[1.65rem] font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
          {helper ? <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">{helper}</p> : null}
          {progress !== undefined && !loading ? (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/90">
              <div
                className="h-full rounded-full bg-[rgb(var(--rb-brand-primary))]/85 transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function ProjectExecutiveSignalsStrip({
  healthLabel,
  healthLevel,
  deliveryLabel,
  deliveryLevel,
  teamLoadLabel,
  teamLoadLevel,
  teamLoadHelper,
  openIssues,
  openIssuesLevel,
  progressPct,
  loading,
}: {
  healthLabel: string;
  healthLevel: ExecutiveSignalLevel;
  deliveryLabel: string;
  deliveryLevel: ExecutiveSignalLevel;
  teamLoadLabel: string;
  teamLoadLevel: ExecutiveSignalLevel;
  teamLoadHelper?: string;
  openIssues: number;
  openIssuesLevel: ExecutiveSignalLevel;
  progressPct: number;
  loading?: boolean;
}) {
  const t = useTranslations("projects.overview");

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-12px_rgba(15,23,42,0.09)] ring-1 ring-slate-100 sm:p-6">
      <div className="mb-5 space-y-1.5 max-w-3xl">
        <h2 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">{t("signals.title")}</h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">{t("signals.subtitle")}</p>
        <p className="text-[11px] text-slate-500 leading-relaxed">{t("signals.caption")}</p>
      </div>
      <div className="grid w-full min-w-0 grid-cols-2 gap-3 sm:gap-3.5 md:grid-cols-3 lg:grid-cols-5 lg:gap-4">
        <SignalCell
          label={t("signals.projectHealth")}
          value={healthLabel}
          helper={t("signals.helpers.health")}
          level={healthLevel}
          loading={loading}
        />
        <SignalCell
          label={t("signals.deliveryRisk")}
          value={deliveryLabel}
          helper={t("signals.helpers.delivery")}
          level={deliveryLevel}
          loading={loading}
        />
        <SignalCell
          label={t("signals.teamLoad")}
          value={teamLoadLabel}
          helper={teamLoadHelper}
          level={teamLoadLevel}
          loading={loading}
        />
        <SignalCell
          label={t("signals.openIssues")}
          value={String(openIssues)}
          helper={t("signals.helpers.openIssues")}
          level={openIssuesLevel}
          loading={loading}
        />
        <SignalCell
          label={t("signals.progress")}
          value={`${progressPct}%`}
          helper={t("signals.helpers.progress")}
          level="good"
          loading={loading}
          progress={progressPct}
        />
      </div>
    </section>
  );
}
