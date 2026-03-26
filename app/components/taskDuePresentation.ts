/**
 * Due-date presentation for task cards (UI only).
 * Local date comparison from YYYY-MM-DD or ISO.
 */

/** When omitted, Spanish defaults match previous behavior (e.g. tickets). */
export type TaskDuePresentationLabels = {
  overdue: string;
  dueToday: string;
  dueTomorrow: string;
  /** Called with day count 2–3 for “In N days” style lines */
  inDays: (n: number) => string;
  limit: string;
};

const DEFAULT_LABELS_ES: TaskDuePresentationLabels = {
  overdue: "Vencida",
  dueToday: "Vence hoy",
  dueTomorrow: "Vence mañana",
  inDays: (n: number) => `En ${n} días`,
  limit: "Límite",
};

export function getTaskDuePresentation(
  due: string | null | undefined,
  labels: TaskDuePresentationLabels = DEFAULT_LABELS_ES,
  theme: "dark" | "light" = "dark"
): {
  line: string;
  sub?: string;
  className: string;
} | null {
  if (!due) return null;
  const part = String(due).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) return null;
  const [ys, ms, ds] = part.split("-");
  const y = Number(ys);
  const m = Number(ms) - 1;
  const d = Number(ds);
  const dueDay = new Date(y, m, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDay.setHours(0, 0, 0, 0);
  const diffMs = dueDay.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / 86400000);
  const formatted = dueDay.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

  const light = theme === "light";
  if (diffDays < 0) {
    return {
      line: labels.overdue,
      sub: formatted,
      className: light ? "text-amber-700" : "text-amber-400/95",
    };
  }
  if (diffDays === 0) {
    return {
      line: labels.dueToday,
      sub: undefined,
      className: light ? "text-slate-900 font-medium" : "text-slate-200",
    };
  }
  if (diffDays === 1) {
    return {
      line: labels.dueTomorrow,
      sub: undefined,
      className: light ? "text-slate-800" : "text-slate-300",
    };
  }
  if (diffDays <= 3) {
    return {
      line: labels.inDays(diffDays),
      sub: formatted,
      className: light ? "text-slate-600" : "text-slate-400",
    };
  }
  return {
    line: labels.limit,
    sub: formatted,
    className: light ? "text-slate-600" : "text-slate-500",
  };
}

/**
 * Due date in ticket context: closed/resolved without alert; otherwise same as tasks.
 */
export function getTicketDuePresentation(
  due: string | null | undefined,
  status: string,
  labels?: TaskDuePresentationLabels,
  /** Locale for closed/resolved neutral date line (default preserves previous Spanish formatting). */
  closedDateLocale: string = "es-ES",
  theme: "dark" | "light" = "dark"
): {
  line: string;
  sub?: string;
  className: string;
} | null {
  if (!due) return null;
  const closed = status === "closed" || status === "resolved";
  const part = String(due).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) return null;
  const [ys, ms, ds] = part.split("-");
  const dueDay = new Date(Number(ys), Number(ms) - 1, Number(ds));
  const formattedNeutral = dueDay.toLocaleDateString(closedDateLocale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  if (closed) {
    return {
      line: formattedNeutral,
      sub: undefined,
      className:
        theme === "light"
          ? "text-slate-600 tabular-nums"
          : "text-slate-500 tabular-nums",
    };
  }
  return getTaskDuePresentation(due, labels, theme);
}
