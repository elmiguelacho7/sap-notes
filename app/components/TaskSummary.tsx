"use client";

export type TaskSummaryProps = {
  total: number;
  active: number;
  blocked: number;
  overdue: number;
  completedPercent: number;
  riskLevel?: "Alto" | "Medio" | "Bajo";
  /** When provided, show "En revisión" card (e.g. global board). */
  review?: number;
  /** When provided, show "Assigned to me" card. */
  assignedToMe?: number;
};

export function TaskSummary({
  total,
  active,
  blocked,
  overdue,
  completedPercent,
  riskLevel = "Bajo",
  review,
  assignedToMe,
}: TaskSummaryProps) {
  const showReview = review !== undefined;
  const showAssignedToMe = assignedToMe !== undefined;
  const extraCards = (showReview ? 1 : 0) + (showAssignedToMe ? 1 : 0);
  const gridCols =
    extraCards >= 2
      ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-7"
      : extraCards === 1
        ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
        : "grid-cols-2 sm:grid-cols-5";

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-4">
      <div className={`grid ${gridCols} gap-3`}>
        <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total</p>
          <p className="text-lg font-semibold text-slate-100 mt-0.5">{total}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Activas</p>
          <p className="text-lg font-semibold text-slate-100 mt-0.5">{active}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Bloqueadas</p>
          <p className={`text-lg font-semibold mt-0.5 ${blocked > 0 ? "text-red-400" : "text-slate-100"}`}>
            {blocked}
          </p>
        </div>
        {showReview && (
          <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">En revisión</p>
            <p className="text-lg font-semibold text-slate-100 mt-0.5">{review}</p>
          </div>
        )}
        <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Vencidas</p>
          <p className={`text-lg font-semibold mt-0.5 ${overdue > 0 ? "text-amber-400" : "text-slate-100"}`}>
            {overdue}
          </p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Completado</p>
          <p className="text-lg font-semibold text-slate-100 mt-0.5">{completedPercent}%</p>
          <div className="mt-1.5 h-1.5 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-1.5 rounded-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${Math.min(100, completedPercent)}%` }}
            />
          </div>
        </div>
        {showAssignedToMe && (
          <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Asignado a mí</p>
            <p className="text-lg font-semibold text-slate-100 mt-0.5">{assignedToMe}</p>
          </div>
        )}
      </div>
      {riskLevel && (
        <div className="mt-3 flex items-center justify-end">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              riskLevel === "Alto"
                ? "bg-red-500/20 text-red-400"
                : riskLevel === "Medio"
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-emerald-500/20 text-emerald-400"
            }`}
          >
            Riesgo {riskLevel}
          </span>
        </div>
      )}
    </div>
  );
}
