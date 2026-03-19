"use client";

import Link from "next/link";
import { CheckSquare, Ticket, BookOpen, CheckCircle } from "lucide-react";

export type ProjectRecentActivityItem = {
  id: string;
  type: "task_created" | "task_completed" | "ticket_created" | "page_updated" | "note_created";
  title: string;
  date: string;
  href?: string;
};

export type ProjectRecentActivityProps = {
  items: ProjectRecentActivityItem[];
  loading?: boolean;
  maxItems?: number;
};

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 60) return `hace ${diffMins} min`;
    if (diffHours < 24) return `hace ${diffHours} h`;
    if (diffDays < 7) return `hace ${diffDays} d`;
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

function iconForType(type: ProjectRecentActivityItem["type"]) {
  switch (type) {
    case "task_created":
      return <CheckSquare className="h-3.5 w-3.5 shrink-0 text-slate-500" />;
    case "task_completed":
      return <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500/80" />;
    case "ticket_created":
      return <Ticket className="h-3.5 w-3.5 shrink-0 text-slate-500" />;
    case "page_updated":
      return <BookOpen className="h-3.5 w-3.5 shrink-0 text-slate-500" />;
    default:
      return <CheckSquare className="h-3.5 w-3.5 shrink-0 text-slate-500" />;
  }
}

export function ProjectRecentActivity({
  items,
  loading = false,
  maxItems = 8,
}: ProjectRecentActivityProps) {
  const display = items.slice(0, maxItems);

  return (
    <section aria-labelledby="recent-activity-heading">
      <h2 id="recent-activity-heading" className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-widest">
        Actividad reciente
      </h2>
      {loading ? (
        <p className="text-sm text-slate-500 py-4">Cargando…</p>
      ) : display.length === 0 ? (
        <p className="text-sm text-slate-500 py-4">Aún no hay actividad.</p>
      ) : (
        <ul className="rounded-xl border border-slate-700 bg-slate-900/80 divide-y divide-slate-700/80 overflow-hidden">
          {display.map((item) => (
            <li key={`${item.type}-${item.id}-${item.date}`}>
              {item.href ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 transition-colors"
                >
                  {iconForType(item.type)}
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <span className="shrink-0 text-xs text-slate-500">{formatRelative(item.date)}</span>
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-400">
                  {iconForType(item.type)}
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <span className="shrink-0 text-xs text-slate-500">{formatRelative(item.date)}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
