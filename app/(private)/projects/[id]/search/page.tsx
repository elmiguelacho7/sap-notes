"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, CheckSquare, Ticket, ListTodo, FileText, BookOpen } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";
import { ModuleContentCard } from "@/components/layout/module";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  PROJECT_WORKSPACE_EMPTY,
  PROJECT_WORKSPACE_HERO,
  PROJECT_WORKSPACE_PAGE,
  PROJECT_WORKSPACE_SEARCH_INPUT,
} from "@/lib/projectWorkspaceUi";

type TaskHit = { id: string; title: string; description: string | null; status: string | null };
type TicketHit = { id: string; title: string; description: string | null; status: string | null; priority: string | null };
type ActivityHit = { id: string; name: string; description: string | null; status: string | null };
type NoteHit = { id: string; title: string | null; body?: string | null; module: string | null; created_at: string };
type KnowledgeHit = { id: string; title: string; summary: string | null; space_id: string };

function SectionHeader({
  icon,
  title,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-200/90 bg-slate-50/80">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-slate-400">{icon}</span>
        <h2 className="text-sm font-semibold text-slate-900 truncate">{title}</h2>
      </div>
      <span className="text-[11px] font-semibold tabular-nums text-slate-500 rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200/80">
        {count}
      </span>
    </div>
  );
}

export default function ProjectSearchPage() {
  const t = useTranslations("projectSearch");
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = params?.id ?? "";

  const q = (searchParams?.get("q") ?? "").trim();
  const [input, setInput] = useState(q);

  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<TaskHit[]>([]);
  const [tickets, setTickets] = useState<TicketHit[]>([]);
  const [activities, setActivities] = useState<ActivityHit[]>([]);
  const [notes, setNotes] = useState<NoteHit[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeHit[]>([]);

  const hasAny = useMemo(
    () => tasks.length + tickets.length + activities.length + notes.length + knowledge.length > 0,
    [tasks, tickets, activities, notes, knowledge]
  );
  const totalCount = tasks.length + tickets.length + activities.length + notes.length + knowledge.length;

  const runSearch = useCallback(async () => {
    if (!projectId) return;
    const query = q;
    if (!query) {
      setTasks([]);
      setTickets([]);
      setActivities([]);
      setNotes([]);
      setKnowledge([]);
      return;
    }

    setLoading(true);
    try {
      const like = `%${query}%`;

      const tasksReq = supabase
        .from("project_tasks")
        .select("id, title, description, status")
        .eq("project_id", projectId)
        .or(`title.ilike.${like},description.ilike.${like}`)
        .limit(10);

      const ticketsReq = supabase
        .from("tickets")
        .select("id, title, description, status, priority")
        .eq("project_id", projectId)
        .or(`title.ilike.${like},description.ilike.${like}`)
        .limit(10);

      const activitiesReq = supabase
        .from("project_activities")
        .select("id, name, description, status")
        .eq("project_id", projectId)
        .or(`name.ilike.${like},description.ilike.${like}`)
        .limit(10);

      const notesReq = supabase
        .from("notes")
        .select("id, title, body, module, created_at")
        .eq("project_id", projectId)
        .or(`title.ilike.${like},body.ilike.${like},extra_info.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(10);

      const knowledgeIdsReq = supabase
        .from("knowledge_page_projects")
        .select("page_id")
        .eq("project_id", projectId)
        .limit(500);

      const [tasksRes, ticketsRes, activitiesRes, notesRes, idsRes] = await Promise.all([
        tasksReq,
        ticketsReq,
        activitiesReq,
        notesReq,
        knowledgeIdsReq,
      ]);

      setTasks((tasksRes.data ?? []) as TaskHit[]);
      setTickets((ticketsRes.data ?? []) as TicketHit[]);
      setActivities((activitiesRes.data ?? []) as ActivityHit[]);
      setNotes((notesRes.data ?? []) as NoteHit[]);

      const pageIds = ((idsRes.data ?? []) as { page_id: string }[]).map((r) => r.page_id).filter(Boolean);
      if (pageIds.length > 0) {
        // Prefer full-text search when available; fallback to title/summary ilike.
        const kRes = await supabase
          .from("knowledge_pages")
          .select("id, title, summary, space_id")
          .in("id", pageIds)
          .is("deleted_at", null)
          .textSearch("search_vector", query)
          .limit(10);
        if (kRes.error) {
          const fallback = await supabase
            .from("knowledge_pages")
            .select("id, title, summary, space_id")
            .in("id", pageIds)
            .is("deleted_at", null)
            .or(`title.ilike.${like},summary.ilike.${like}`)
            .limit(10);
          setKnowledge((fallback.data ?? []) as KnowledgeHit[]);
        } else {
          setKnowledge((kRes.data ?? []) as KnowledgeHit[]);
        }
      } else {
        setKnowledge([]);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, q]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  useEffect(() => {
    setInput(q);
  }, [q]);

  if (!projectId) {
    return <p className="text-sm text-slate-500">Invalid project identifier.</p>;
  }

  return (
    <div className={PROJECT_WORKSPACE_PAGE}>
      <div className={PROJECT_WORKSPACE_HERO}>
        <ProjectPageHeader eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
      </div>

      <form
        className="relative max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          const next = input.trim();
          router.push(next ? `/projects/${projectId}/search?q=${encodeURIComponent(next)}` : `/projects/${projectId}/search`);
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden />
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("states.emptyQueryTitle")}
          className={PROJECT_WORKSPACE_SEARCH_INPUT}
          aria-label={t("title")}
        />
      </form>

      {!q ? (
        <div className={`${PROJECT_WORKSPACE_EMPTY} py-14`}>
          <p className="text-base font-semibold text-slate-900">{t("states.emptyQueryTitle")}</p>
          <p className="mt-2 text-sm text-slate-600 max-w-lg leading-relaxed">{t("states.emptyQueryBody")}</p>
        </div>
      ) : loading ? (
        <ModuleContentCard tone="light">
          <div className="space-y-4 px-6 py-6">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-5/6" />
          </div>
        </ModuleContentCard>
      ) : !hasAny ? (
        <div className={`${PROJECT_WORKSPACE_EMPTY} py-14`}>
          <p className="text-base font-semibold text-slate-900">{t("states.noResultsTitle")}</p>
          <p className="mt-2 text-sm text-slate-600 max-w-lg leading-relaxed">{t("states.noResultsBody")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <div className="rounded-2xl border border-slate-200/85 bg-white px-5 py-4 shadow-sm ring-1 ring-slate-100">
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 ring-1 ring-slate-200/80">
                {totalCount} result{totalCount === 1 ? "" : "s"}
              </span>
              <span className="rounded-full bg-slate-50 px-3 py-1.5 text-slate-600 ring-1 ring-slate-200/80">
                {t("results.tasks")}: {tasks.length}
              </span>
              <span className="rounded-full bg-slate-50 px-3 py-1.5 text-slate-600 ring-1 ring-slate-200/80">
                {t("results.tickets")}: {tickets.length}
              </span>
              <span className="rounded-full bg-slate-50 px-3 py-1.5 text-slate-600 ring-1 ring-slate-200/80">
                {t("results.activities")}: {activities.length}
              </span>
              <span className="rounded-full bg-slate-50 px-3 py-1.5 text-slate-600 ring-1 ring-slate-200/80">
                {t("results.notes")}: {notes.length}
              </span>
              <span className="rounded-full bg-slate-50 px-3 py-1.5 text-slate-600 ring-1 ring-slate-200/80">
                {t("results.knowledge")}: {knowledge.length}
              </span>
            </div>
          </div>
          {tasks.length > 0 && (
            <ModuleContentCard tone="light">
              <SectionHeader icon={<CheckSquare className="h-4 w-4" />} title={t("results.tasks")} count={tasks.length} />
              <ul className="divide-y divide-slate-100">
                {tasks.map((x) => (
                  <li key={x.id} className="px-6 py-4 hover:bg-slate-50/90 transition-colors">
                    <Link href={`/projects/${projectId}/tasks`} className="block">
                      <p className="text-sm font-semibold text-slate-900">{x.title}</p>
                      {x.description ? <p className="mt-1 text-xs text-slate-600 line-clamp-2">{x.description}</p> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </ModuleContentCard>
          )}

          {tickets.length > 0 && (
            <ModuleContentCard tone="light">
              <SectionHeader icon={<Ticket className="h-4 w-4" />} title={t("results.tickets")} count={tickets.length} />
              <ul className="divide-y divide-slate-100">
                {tickets.map((x) => (
                  <li key={x.id} className="px-6 py-4 hover:bg-slate-50/90 transition-colors">
                    <Link href={`/projects/${projectId}/tickets`} className="block">
                      <p className="text-sm font-semibold text-slate-900">{x.title}</p>
                      {x.description ? <p className="mt-1 text-xs text-slate-600 line-clamp-2">{x.description}</p> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </ModuleContentCard>
          )}

          {activities.length > 0 && (
            <ModuleContentCard tone="light">
              <SectionHeader icon={<ListTodo className="h-4 w-4" />} title={t("results.activities")} count={activities.length} />
              <ul className="divide-y divide-slate-100">
                {activities.map((x) => (
                  <li key={x.id} className="px-6 py-4 hover:bg-slate-50/90 transition-colors">
                    <Link href={`/projects/${projectId}/planning/activities`} className="block">
                      <p className="text-sm font-semibold text-slate-900">{x.name}</p>
                      {x.description ? <p className="mt-1 text-xs text-slate-600 line-clamp-2">{x.description}</p> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </ModuleContentCard>
          )}

          {notes.length > 0 && (
            <ModuleContentCard tone="light">
              <SectionHeader icon={<FileText className="h-4 w-4" />} title={t("results.notes")} count={notes.length} />
              <ul className="divide-y divide-slate-100">
                {notes.map((x) => (
                  <li key={x.id} className="px-6 py-4 hover:bg-slate-50/90 transition-colors">
                    <Link href={`/projects/${projectId}/notes`} className="block">
                      <p className="text-sm font-semibold text-slate-900">{x.title ?? "Untitled"}</p>
                      {x.module ? <p className="mt-1 text-xs text-slate-500">{x.module}</p> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </ModuleContentCard>
          )}

          {knowledge.length > 0 && (
            <ModuleContentCard tone="light">
              <SectionHeader icon={<BookOpen className="h-4 w-4" />} title={t("results.knowledge")} count={knowledge.length} />
              <ul className="divide-y divide-slate-100">
                {knowledge.map((x) => (
                  <li key={x.id} className="px-6 py-4 hover:bg-slate-50/90 transition-colors">
                    <Link href={`/projects/${projectId}/knowledge`} className="block">
                      <p className="text-sm font-semibold text-slate-900">{x.title}</p>
                      {x.summary ? <p className="mt-1 text-xs text-slate-600 line-clamp-2">{x.summary}</p> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </ModuleContentCard>
          )}
        </div>
      )}
    </div>
  );
}

