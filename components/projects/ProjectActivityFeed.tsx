"use client";

import Link from "next/link";
import { CheckSquare, Ticket, BookOpen, CheckCircle } from "lucide-react";

export type ActivityItem = {
  id: string;
  type: "task_created" | "task_completed" | "ticket_created" | "page_updated";
  title: string;
  date: string;
  href?: string;
};

export type ProjectActivityFeedProps = {
  items: ActivityItem[];
  loading?: boolean;
};

function formatDate(iso: string): string {
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

function iconForType(type: ActivityItem["type"]) {
  switch (type) {
    case "task_created":
      return <CheckSquare className="h-4 w-4 shrink-0 text-slate-500" />;
    case "task_completed":
      return <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500/80" />;
    case "ticket_created":
      return <Ticket className="h-4 w-4 shrink-0 text-slate-500" />;
    case "page_updated":
      return <BookOpen className="h-4 w-4 shrink-0 text-slate-500" />;
    default:
      return <CheckSquare className="h-4 w-4 shrink-0 text-slate-500" />;
  }
}

export function ProjectActivityFeed({ items, loading = false }: ProjectActivityFeedProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
        Actividad reciente
      </h3>
      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">Aún no hay actividad.</p>
      ) : (
        <ul className="space-y-0">
          {items.slice(0, 10).map((item) => (
            <li key={`${item.type}-${item.id}-${item.date}`}>
              {item.href ? (
                <Link
                  href={item.href}
                  className="flex items-start gap-3 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {iconForType(item.type)}
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <span className="shrink-0 text-xs text-slate-500">{formatDate(item.date)}</span>
                </Link>
              ) : (
                <div className="flex items-start gap-3 py-2 text-sm text-slate-400">
                  {iconForType(item.type)}
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <span className="shrink-0 text-xs text-slate-500">{formatDate(item.date)}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
