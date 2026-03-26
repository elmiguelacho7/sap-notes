"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Activity,
  ClipboardList,
  FileText,
  FolderPlus,
  Link2,
  Ticket,
  UserPlus,
} from "lucide-react";

export type ProjectRecentActivityEvent = {
  id: string;
  type: string;
  title: string;
  date: string;
  link: string;
  projectId?: string | null;
};

function relativeTime(iso: string, tRel: (key: string, values?: Record<string, number | string>) => string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return tRel("unknown");
  const now = new Date();
  const diffM = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffM < 1) return tRel("justNow");
  if (diffM < 60) return tRel("minutesAgo", { n: diffM });
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return tRel("hoursAgo", { n: diffH });
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return tRel("daysAgo", { n: diffD });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const KNOWN_EVENT_TYPES = new Set([
  "project_created",
  "task_created",
  "ticket_closed",
  "note_created",
  "user_invited",
]);

function eventIcon(type: string) {
  switch (type) {
    case "task_created":
      return ClipboardList;
    case "ticket_closed":
      return Ticket;
    case "note_created":
      return FileText;
    case "user_invited":
      return UserPlus;
    case "project_created":
      return FolderPlus;
    default:
      return Activity;
  }
}

export function ProjectRecentWorkPanel({
  projectId,
  events,
  loading,
  openTickets,
  notesCount,
  linksCount,
  lastUpdatedAt,
}: {
  projectId: string;
  events: ProjectRecentActivityEvent[];
  loading?: boolean;
  openTickets: number;
  notesCount: number;
  linksCount: number;
  lastUpdatedAt: string | null | undefined;
}) {
  const t = useTranslations("projects.overview.recent");
  const tRel = useTranslations("projects.overview.recent.time");

  const rowInteractive =
    "group flex items-center gap-3.5 rounded-xl border border-slate-200/85 bg-white px-3.5 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100/90 transition-[border-color,box-shadow,background-color] hover:border-slate-300/90 hover:bg-slate-50/80 hover:shadow-md";

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-8px_rgba(15,23,42,0.08)] ring-1 ring-slate-100">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-slate-600">
          <Activity className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">{t("title")}</h2>
          <p className="text-xs text-slate-500 leading-relaxed">{t("subtitle")}</p>
        </div>
      </div>

      {loading ? (
        <ul className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </ul>
      ) : events.length > 0 ? (
        <ul className="space-y-2.5">
          {events.slice(0, 8).map((ev) => {
            const Icon = eventIcon(ev.type);
            const typeLabel = t(`types.${ev.type as "task_created"}` as never) || ev.type;
            return (
              <li key={ev.id}>
                <Link href={ev.link} className={rowInteractive}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/85 bg-gradient-to-br from-slate-50 to-white text-slate-700 shadow-sm transition-colors group-hover:border-slate-300/90">
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">{ev.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-600">{typeLabel}</span>
                      <span className="text-slate-300" aria-hidden>
                        ·
                      </span>
                      <span className="tabular-nums text-slate-500">{relativeTime(ev.date, tRel)}</span>
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">{t("empty")}</p>
          <p className="text-xs text-slate-500">{t("fallbackHint")}</p>
          <div className="space-y-2 pt-1">
            <Link
              href={`/projects/${projectId}/tickets`}
              className={`${rowInteractive} justify-between`}
            >
              <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                <Ticket className="h-4 w-4 text-slate-400" />
                {t("quick.openTickets")}
              </span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">{openTickets}</span>
            </Link>
            <Link
              href={`/projects/${projectId}/notes`}
              className={`${rowInteractive} justify-between`}
            >
              <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                <FileText className="h-4 w-4 text-slate-400" />
                {t("quick.notes")}
              </span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">{notesCount}</span>
            </Link>
            <Link
              href={`/projects/${projectId}/links`}
              className={`${rowInteractive} justify-between`}
            >
              <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                <Link2 className="h-4 w-4 text-slate-400" />
                {t("quick.links")}
              </span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">{linksCount}</span>
            </Link>
          </div>
        </div>
      )}

      {lastUpdatedAt ? (
        <p className="mt-4 text-xs text-slate-500 border-t border-slate-100 pt-3">
          {tRel("statsHint", { time: relativeTime(lastUpdatedAt, tRel) })}
        </p>
      ) : null}
    </section>
  );
}
