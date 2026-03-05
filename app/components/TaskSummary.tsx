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
};

export function TaskSummary({
  total,
  active,
  blocked,
  overdue,
  completedPercent,
  riskLevel = "Bajo",
  review,
}: TaskSummaryProps) {
  const showReview = review !== undefined;
  const gridCols = showReview ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6" : "grid-cols-2 sm:grid-cols-5";

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
      <div className={`grid ${gridCols} gap-3`}>
        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total</p>
          <p className="text-lg font-semibold text-slate-900 mt-0.5">{total}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Activas</p>
          <p className="text-lg font-semibold text-slate-900 mt-0.5">{active}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Bloqueadas</p>
          <p className={`text-lg font-semibold mt-0.5 ${blocked > 0 ? "text-rose-600" : "text-slate-900"}`}>
            {blocked}
          </p>
        </div>
        {showReview && (
          <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">En revisión</p>
            <p className="text-lg font-semibold text-slate-900 mt-0.5">{review}</p>
          </div>
        )}
        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Vencidas</p>
          <p className={`text-lg font-semibold mt-0.5 ${overdue > 0 ? "text-amber-600" : "text-slate-900"}`}>
            {overdue}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Completado</p>
          <p className="text-lg font-semibold text-slate-900 mt-0.5">{completedPercent}%</p>
          <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-1.5 rounded-full bg-violet-500 transition-all duration-300"
              style={{ width: `${Math.min(100, completedPercent)}%` }}
            />
          </div>
        </div>
      </div>
      {riskLevel && (
        <div className="mt-3 flex items-center justify-end">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              riskLevel === "Alto"
                ? "bg-rose-100 text-rose-600"
                : riskLevel === "Medio"
                  ? "bg-amber-100 text-amber-600"
                  : "bg-emerald-100 text-emerald-600"
            }`}
          >
            Riesgo {riskLevel}
          </span>
        </div>
      )}
    </div>
  );
}
