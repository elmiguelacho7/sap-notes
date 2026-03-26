"use client";

import { useTranslations } from "next-intl";

export type TaskSummaryRiskLevel = "high" | "medium" | "low";

export type TaskSummaryProps = {
  total: number;
  active: number;
  blocked: number;
  overdue: number;
  completedPercent: number;
  riskLevel?: TaskSummaryRiskLevel;
  /** When provided, show in-review card (e.g. global board). */
  review?: number;
  /** When provided, show assigned-to-me card. */
  assignedToMe?: number;
};

const labelClass = "text-[11px] uppercase tracking-wide text-[rgb(var(--rb-text-muted))]";
const valueClass = "text-lg font-semibold text-[rgb(var(--rb-text-primary))] tabular-nums";
const cellClass =
  "rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-3 min-w-0 shadow-sm";

export function TaskSummary({
  total,
  active,
  blocked,
  overdue,
  completedPercent,
  riskLevel = "low",
  review,
  assignedToMe,
}: TaskSummaryProps) {
  const t = useTranslations("tasks.summary");
  const showReview = review !== undefined;
  const showAssignedToMe = assignedToMe !== undefined;
  const extraCards = (showReview ? 1 : 0) + (showAssignedToMe ? 1 : 0);
  const gridCols =
    extraCards >= 2
      ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-7"
      : extraCards === 1
        ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
        : "grid-cols-2 sm:grid-cols-5";

  const riskLabel =
    riskLevel === "high" ? t("riskHigh") : riskLevel === "medium" ? t("riskMedium") : t("riskLow");

  return (
    <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-3 py-3 sm:px-4 sm:py-3.5 shadow-sm">
      <div className={`grid ${gridCols} gap-2.5 sm:gap-3.5`}>
        <div className={cellClass}>
          <p className={labelClass}>{t("total")}</p>
          <p className={`${valueClass} mt-1`}>{total}</p>
        </div>
        <div className={cellClass}>
          <p className={labelClass}>{t("active")}</p>
          <p className={`${valueClass} mt-1`}>{active}</p>
        </div>
        <div className={cellClass}>
          <p className={labelClass}>{t("blocked")}</p>
          <p
            className={`mt-1 text-lg font-semibold tabular-nums ${
              blocked > 0 ? "text-red-600" : "text-[rgb(var(--rb-text-primary))]"
            }`}
          >
            {blocked}
          </p>
        </div>
        {showReview && (
          <div className={cellClass}>
            <p className={labelClass}>{t("inReview")}</p>
            <p className={`${valueClass} mt-1`}>{review}</p>
          </div>
        )}
        <div className={cellClass}>
          <p className={labelClass}>{t("overdue")}</p>
          <p
            className={`mt-1 text-lg font-semibold tabular-nums ${
              overdue > 0 ? "text-amber-700" : "text-[rgb(var(--rb-text-primary))]"
            }`}
          >
            {overdue}
          </p>
        </div>
        <div className={cellClass}>
          <p className={labelClass}>{t("completed")}</p>
          <p className={`text-xl font-semibold text-[rgb(var(--rb-text-primary))] mt-1 tabular-nums`}>{completedPercent}%</p>
          <div className="mt-2 h-1 rounded-full bg-[rgb(var(--rb-surface-border))]/50 overflow-hidden">
            <div
              className="h-1 rounded-full bg-[rgb(var(--rb-brand-primary))] transition-all duration-300"
              style={{ width: `${Math.min(100, completedPercent)}%` }}
            />
          </div>
        </div>
        {showAssignedToMe && (
          <div className={cellClass}>
            <p className={labelClass}>{t("assignedToMe")}</p>
            <p className={`${valueClass} mt-1`}>{assignedToMe}</p>
          </div>
        )}
      </div>
      {riskLevel && (
        <div className="mt-2.5 flex items-center justify-end">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide ${
              riskLevel === "high"
                ? "bg-rose-50 text-rose-900 ring-1 ring-inset ring-rose-200/80"
                : riskLevel === "medium"
                  ? "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200/80"
                  : "bg-[rgb(var(--rb-brand-surface))] text-[rgb(var(--rb-brand-primary-active))] ring-1 ring-inset ring-[rgb(var(--rb-brand-primary))]/18"
            }`}
          >
            {t("risk")} {riskLabel}
          </span>
        </div>
      )}
    </div>
  );
}
