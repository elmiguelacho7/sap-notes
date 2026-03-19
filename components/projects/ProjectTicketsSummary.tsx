"use client";

import Link from "next/link";
import { Ticket, ArrowRight } from "lucide-react";

export type ProjectTicketsSummaryProps = {
  projectId: string;
  open: number;
  urgent: number;
  loading?: boolean;
};

export function ProjectTicketsSummary({
  projectId,
  open,
  urgent,
  loading = false,
}: ProjectTicketsSummaryProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
      <div className="flex items-center gap-2 text-slate-400 mb-3">
        <Ticket className="h-4 w-4 shrink-0" />
        <h3 className="text-sm font-semibold uppercase tracking-wider">Tickets</h3>
      </div>
      <div className="space-y-1 text-sm">
        <p className="text-slate-300">
          <span className="font-semibold tabular-nums text-slate-100">{loading ? "—" : open}</span> abiertos
        </p>
        <p className="text-slate-300">
          <span className="font-semibold tabular-nums text-slate-100">{loading ? "—" : urgent}</span> urgentes
        </p>
      </div>
      <Link
        href={`/projects/${projectId}/tickets`}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-400 hover:text-indigo-300"
      >
        Ver tickets
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
