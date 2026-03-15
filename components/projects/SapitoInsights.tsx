"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Brain, ListTodo, Ticket, CalendarDays, FileText, BookOpen } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type InsightItem = {
  id: string;
  message: string;
  href?: string;
  icon: React.ReactNode;
};

type Signals = {
  activitiesOverdue: number;
  openTickets: number;
  delayedPhases: Array<{ id: string; name: string }>;
  notesLast7Days: number;
  knowledgeLast7Days: number;
};

const ICON_CLASS = "h-4 w-4 shrink-0 text-slate-400";

function fetchSignals(projectId: string): Promise<Signals> {
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString();

  return Promise.all([
    supabase
      .from("project_activities")
      .select("id, due_date, status", { count: "exact", head: false })
      .eq("project_id", projectId)
      .lt("due_date", today)
      .neq("status", "done")
      .then((r) => ({ count: (r.data ?? []).length })),
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "open")
      .then((r) => ({ count: r.count ?? 0 })),
    supabase
      .from("project_phases")
      .select("id, name, end_date")
      .eq("project_id", projectId)
      .lt("end_date", today)
      .then((r) => ({ phases: (r.data ?? []) as { id: string; name: string; end_date: string | null }[] })),
    supabase
      .from("notes")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .gte("created_at", sevenDaysAgoIso)
      .is("deleted_at", null)
      .then((r) => ({ count: r.count ?? 0 })),
    supabase
      .from("knowledge_page_projects")
      .select("page_id")
      .eq("project_id", projectId)
      .then((res) => {
        if (res.error || !res.data?.length) return { count: 0 };
        const pageIds = (res.data as { page_id: string }[]).map((p) => p.page_id);
        return supabase
          .from("knowledge_pages")
          .select("id", { count: "exact", head: true })
          .in("id", pageIds)
          .gte("updated_at", sevenDaysAgoIso)
          .then((r) => ({ count: r.count ?? 0 }));
      }),
  ]).then(([activities, tickets, phases, notes, knowledge]) => ({
    activitiesOverdue: activities.count,
    openTickets: tickets.count,
    delayedPhases: phases.phases.map((p) => ({ id: p.id, name: p.name })),
    notesLast7Days: notes.count,
    knowledgeLast7Days: knowledge.count,
  }));
}

export function SapitoInsights({ projectId }: { projectId: string }) {
  const [signals, setSignals] = useState<Signals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSignals(projectId);
      setSignals(data);
    } catch (e) {
      console.error("SapitoInsights load error", e);
      setError("Could not load insights.");
      setSignals(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const items: InsightItem[] = [];
  if (signals) {
    if (signals.activitiesOverdue > 0) {
      items.push({
        id: "activities-overdue",
        message: `${signals.activitiesOverdue} ${signals.activitiesOverdue === 1 ? "activity" : "activities"} overdue`,
        href: `/projects/${projectId}/planning/activities`,
        icon: <ListTodo className={ICON_CLASS} />,
      });
    }
    if (signals.openTickets > 0) {
      items.push({
        id: "open-tickets",
        message: `${signals.openTickets} ticket${signals.openTickets === 1 ? "" : "s"} open`,
        href: `/projects/${projectId}/tickets`,
        icon: <Ticket className={ICON_CLASS} />,
      });
    }
    signals.delayedPhases.forEach((phase) => {
      items.push({
        id: `phase-${phase.id}`,
        message: `Phase ${phase.name} behind schedule`,
        href: `/projects/${projectId}/planning`,
        icon: <CalendarDays className={ICON_CLASS} />,
      });
    });
    if (signals.notesLast7Days > 0) {
      items.push({
        id: "notes-recent",
        message: `${signals.notesLast7Days} note${signals.notesLast7Days === 1 ? "" : "s"} created this week`,
        href: `/projects/${projectId}/notes`,
        icon: <FileText className={ICON_CLASS} />,
      });
    }
    if (signals.knowledgeLast7Days > 0) {
      items.push({
        id: "knowledge-recent",
        message: `${signals.knowledgeLast7Days} new lesson${signals.knowledgeLast7Days === 1 ? "" : "s"} learned added`,
        href: `/projects/${projectId}/knowledge`,
        icon: <BookOpen className={ICON_CLASS} />,
      });
    }
  }

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 sm:p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
        <Brain className="h-4 w-4 shrink-0 text-slate-400" />
        <span>Sapito Insights</span>
      </div>
      {loading ? (
        <p className="mt-3 text-sm text-slate-500">Loading insights…</p>
      ) : error ? (
        <p className="mt-3 text-sm text-slate-500">{error}</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">Sapito sees everything under control.</p>
      ) : (
        <ul className="mt-3 space-y-0.5">
          {items.map((item) => (
            <li key={item.id}>
              {item.href ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-300 transition-colors duration-150 hover:bg-slate-800/50"
                >
                  {item.icon}
                  <span>{item.message}</span>
                </Link>
              ) : (
                <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-300 transition-colors duration-150 hover:bg-slate-800/50">
                  {item.icon}
                  <span>{item.message}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
