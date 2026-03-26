"use client";

import { Skeleton } from "@/components/ui/Skeleton";

type KpiTone = "neutral" | "danger" | "warning" | "progress";

function KpiCard({
  label,
  value,
  helper,
  loading,
  tone,
  progressPct,
}: {
  label: string;
  value: string | number;
  helper?: string;
  loading?: boolean;
  tone: KpiTone;
  /** 0–100 when tone === progress */
  progressPct?: number;
}) {
  const surface =
    tone === "danger"
      ? "border-rose-500/22 bg-rose-500/[0.08]"
      : tone === "warning"
        ? "border-amber-500/24 bg-amber-500/[0.08]"
        : tone === "progress"
          ? "border-[rgb(var(--rb-brand-primary))]/28 bg-[rgb(var(--rb-brand-primary))]/10"
          : "border-[rgb(var(--rb-surface-border))]/82 bg-[rgb(var(--rb-surface))]/95";

  const labelTone =
    tone === "danger"
      ? "text-rose-200/90"
      : tone === "warning"
        ? "text-amber-200/90"
        : tone === "progress"
          ? "text-[rgb(var(--rb-brand-primary-active))]"
          : "text-[rgb(var(--rb-text-secondary))]";

  const pct = Math.max(0, Math.min(100, progressPct ?? 0));

  return (
    <div className={`rb-depth-card rounded-xl border p-4 min-w-0 ${surface}`}>
      <p className={`text-[11px] font-medium uppercase tracking-wide ${labelTone}`}>{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-[-0.03em] text-[rgb(var(--rb-text-primary))]">{value}</p>
          {helper ? <p className="mt-1 text-[11px] text-[rgb(var(--rb-text-muted))] leading-snug">{helper}</p> : null}
          {tone === "progress" && !loading ? (
            <div className="mt-3 h-1.5 w-full rounded-full bg-[rgb(var(--rb-surface-3))] overflow-hidden">
              <div
                className="h-full rounded-full bg-[rgb(var(--rb-brand-primary))]/80 transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function ProjectExecutiveSummary({
  openTickets,
  overdueTasks,
  blockedTasks,
  activeMembers,
  progressPct,
  loading,
}: {
  openTickets: number;
  overdueTasks: number;
  blockedTasks: number;
  activeMembers: number;
  progressPct: number;
  loading?: boolean;
}) {
  return (
    <div className="rb-surface rb-depth-featured rounded-2xl p-4 sm:p-5">
      <div className="grid w-full min-w-0 grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <KpiCard
        label="Open tickets"
        value={openTickets}
        helper="Not closed or resolved"
        tone="neutral"
        loading={loading}
      />
      <KpiCard
        label="Overdue tasks"
        value={overdueTasks}
        helper="Past due, not done"
        tone="danger"
        loading={loading}
      />
      <KpiCard
        label="Blocked tasks"
        value={blockedTasks}
        helper="Needs unblock"
        tone="warning"
        loading={loading}
      />
      <KpiCard
        label="Active members"
        value={activeMembers}
        helper="On the project team"
        tone="neutral"
        loading={loading}
      />
      <KpiCard
        label="Progress"
        value={`${progressPct}%`}
        helper="Tasks or activity rollup"
        tone="progress"
        loading={loading}
        progressPct={progressPct}
      />
      </div>
    </div>
  );
}
