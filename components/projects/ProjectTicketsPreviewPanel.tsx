"use client";

import Link from "next/link";
import { Ticket } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/Skeleton";
import type { TicketPriority, TicketStatus } from "@/lib/types/ticketTypes";
import { getTicketDetailHref } from "@/lib/routes";

export type ProjectTicketPreviewRow = {
  id: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  pending: "Pending",
  resolved: "Resolved",
  closed: "Closed",
  cancelled: "Cancelled",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

function statusBadgeClass(status: TicketStatus) {
  const s = String(status).toLowerCase();
  if (s === "open") return "rb-badge-neutral";
  if (s === "in_progress") return "rb-badge-success";
  if (s === "pending") return "rb-badge-warning";
  return "rb-badge-neutral";
}

function priorityBadgeClass(p: TicketPriority) {
  if (p === "urgent") return "rb-badge-error";
  if (p === "high") return "rb-badge-error";
  if (p === "medium") return "rb-badge-warning";
  return "rb-badge-neutral";
}

export function ProjectTicketsPreviewPanel({
  projectId,
  tickets,
  loading,
  openCount = 0,
  urgentCount = 0,
}: {
  projectId: string;
  tickets: ProjectTicketPreviewRow[];
  loading?: boolean;
  openCount?: number;
  urgentCount?: number;
}) {
  const tp = useTranslations("projects.overview.panels");
  const listHref = `/projects/${projectId}/tickets`;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-12px_rgba(15,23,42,0.09)] ring-1 ring-slate-100 w-full min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/85 bg-gradient-to-br from-slate-50 to-white text-slate-700 shadow-sm">
            <Ticket className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-700/90">
              {tp("ticketsAttention")}
            </p>
            <h2 className="text-base font-semibold tracking-tight text-slate-900">{tp("ticketsTitle")}</h2>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">{tp("ticketsSubtitle")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {openCount > 0 ? (
            <span className="rounded-lg border border-slate-200/80 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 tabular-nums">
              {tp("open", { n: openCount })}
            </span>
          ) : null}
          {urgentCount > 0 ? (
            <span className="rounded-lg border border-rose-200/80 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-800 tabular-nums">
              {tp("priorityHot", { n: urgentCount })}
            </span>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[4.25rem] w-full rounded-lg" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200/90 bg-slate-50/80 px-4 py-6 text-center space-y-2">
          <p className="text-sm text-slate-600">No open tickets right now.</p>
          <Link
            href={`${listHref}?new=1`}
            className="inline-block text-sm font-semibold text-[rgb(var(--rb-brand-primary-active))] hover:text-[rgb(var(--rb-brand-primary-hover))]"
          >
            Create a ticket
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/40 px-1">
          {tickets.map((t) => (
            <li
              key={t.id}
              className="py-3.5 first:pt-3 last:pb-3 px-2 transition-colors hover:bg-white/90 rb-row-interactive"
            >
              <div className="space-y-2 min-w-0">
                <Link
                  href={getTicketDetailHref(t.id, projectId)}
                  className="text-sm font-semibold text-[rgb(var(--rb-text-primary))] line-clamp-2 hover:text-[rgb(var(--rb-brand-primary-hover))] transition-colors text-left block leading-snug"
                >
                  {t.title}
                </Link>
                <p className="text-[11px] text-slate-500 font-medium">{tp("ticketsRowHint")}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rb-badge ${statusBadgeClass(t.status)}`}
                  >
                    {STATUS_LABELS[t.status] ?? t.status}
                  </span>
                  <span
                    className={`rb-badge ${priorityBadgeClass(t.priority)}`}
                  >
                    {PRIORITY_LABELS[t.priority] ?? t.priority}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-2 border-t border-slate-100">
        <Link
          href={listHref}
          className="text-sm font-semibold text-[rgb(var(--rb-brand-primary-active))] hover:text-[rgb(var(--rb-brand-primary-hover))] transition-colors"
        >
          {tp("viewAll")}
        </Link>
      </div>
    </section>
  );
}
