"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AppPageShell } from "@/components/ui/layout/AppPageShell";
import { ProjectCard, type ProjectCardProject } from "@/components/projects/ProjectCard";
import { ContentSkeleton } from "@/components/skeletons/ContentSkeleton";
import {
  FolderOpen,
  Search,
  LayoutGrid,
  CalendarClock,
  Ticket,
  Archive,
} from "lucide-react";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  start_date: string | null;
  planned_end_date: string | null;
  current_phase_key: string | null;
  created_at: string;
  client_id: string | null;
};

type StatusFilter = "" | "planned" | "in_progress" | "completed" | "archived";
type SortOption = "priority" | "newest" | "recently_updated" | "name";

export default function ProjectsPage() {
  const t = useTranslations("projects");
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projects, setProjects] = useState<ProjectCardProject[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [sortBy, setSortBy] = useState<SortOption>("priority");
  const [canCreateProject, setCanCreateProject] = useState(false);
  const [projectsQuota, setProjectsQuota] = useState<{ atLimit?: boolean; current: number; limit: number | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setCanCreateProject(false);
        setProjectsQuota(null);
        return;
      }
      const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      if (cancelled) return;
      const data = await res.json().catch(() => ({}));
      const perms = (data as { permissions?: { createProject?: boolean }; projectsQuota?: { current: number; limit: number | null } }).permissions;
      setCanCreateProject(perms?.createProject ?? false);
      const pq = (data as { projectsQuota?: { current: number; limit: number | null } }).projectsQuota;
      setProjectsQuota(pq ?? null);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoadingProjects(true);
      setErrorMsg(null);

      const { data: projData, error } = await supabase
        .from("projects")
        .select("id, name, description, status, start_date, planned_end_date, current_phase_key, created_at, client_id")
        .order("created_at", { ascending: false });

      if (error) {
        handleSupabaseError("projects", error);
        setErrorMsg(t("errors.loadProjects"));
        setProjects([]);
        setLoadingProjects(false);
        return;
      }

      const rows = (projData ?? []) as ProjectRow[];

      const clientIds = Array.from(new Set(rows.map((p) => p.client_id).filter(Boolean))) as string[];
      const clientNames = new Map<string, string>();
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from("clients")
          .select("id, name, display_name")
          .in("id", clientIds);
        for (const c of (clients ?? []) as { id: string; name: string; display_name?: string | null }[]) {
          clientNames.set(c.id, (c.display_name || c.name) ?? "");
        }
      }

      const { data: doneStatusRows } = await supabase
        .from("task_statuses")
        .select("id")
        .eq("code", "DONE")
        .eq("is_active", true)
        .limit(1);
      const doneStatusId = (doneStatusRows?.[0] as { id: string } | undefined)?.id ?? null;

      const projectsWithCounts = await Promise.all(
        rows.map(async (p) => {
          const [notesRes, ticketsRes, tasksRes] = await Promise.all([
            supabase
              .from("notes")
              .select("id", { count: "exact", head: true })
              .eq("project_id", p.id)
              .is("deleted_at", null),
            supabase
              .from("tickets")
              .select("id", { count: "exact", head: true })
              .eq("project_id", p.id)
              .neq("status", "closed"),
            doneStatusId
              ? supabase
                  .from("tasks")
                  .select("id", { count: "exact", head: true })
                  .eq("project_id", p.id)
                  .neq("status_id", doneStatusId)
              : supabase
                  .from("tasks")
                  .select("id", { count: "exact", head: true })
                  .eq("project_id", p.id),
          ]);

          const notes_count = notesRes.count ?? 0;
          const open_tickets_count = ticketsRes.count ?? 0;
          const open_tasks_count = tasksRes.count ?? 0;

          return {
            id: p.id,
            name: p.name,
            description: p.description,
            status: p.status,
            start_date: p.start_date,
            planned_end_date: p.planned_end_date,
            current_phase_key: p.current_phase_key,
            notes_count,
            open_tickets_count,
            open_tasks_count,
            client_name: p.client_id ? clientNames.get(p.client_id) ?? null : null,
            created_at: p.created_at,
          } satisfies ProjectCardProject;
        })
      );

      setProjects(projectsWithCounts);
      setLoadingProjects(false);
    };

    void load();
  }, [t]);

  const normalizedStatus = (s: string | null) => (s ?? "").toLowerCase().trim();

  const summary = useMemo(() => {
    const active = projects.filter(
      (p) =>
        normalizedStatus(p.status) !== "completed" &&
        normalizedStatus(p.status) !== "archived" &&
        !normalizedStatus(p.status).includes("cerrado") &&
        !normalizedStatus(p.status).includes("closed")
    ).length;
    const planned = projects.filter((p) => normalizedStatus(p.status) === "planned").length;
    const inProgress = projects.filter((p) => normalizedStatus(p.status) === "in_progress").length;
    const closed = projects.filter(
      (p) =>
        normalizedStatus(p.status) === "completed" ||
        normalizedStatus(p.status) === "archived" ||
        normalizedStatus(p.status).includes("cerrado") ||
        normalizedStatus(p.status).includes("closed")
    ).length;
    const totalOpenTickets = projects.reduce((acc, p) => acc + p.open_tickets_count, 0);
    return { active, planned, inProgress, closed, totalOpenTickets };
  }, [projects]);

  const filteredAndSortedProjects = useMemo(() => {
    let list = projects;

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((project) => {
        const fields = [
          project.name,
          project.description ?? "",
          project.status ?? "",
          project.current_phase_key ?? "",
          project.client_name ?? "",
        ].join(" ");
        return fields.toLowerCase().includes(q);
      });
    }

    if (statusFilter) {
      list = list.filter((p) => normalizedStatus(p.status) === statusFilter);
    }

    list = [...list].sort((a, b) => {
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "priority") {
        const order = (s: string | null) => {
          const n = normalizedStatus(s);
          if (n === "in_progress") return 0;
          if (n === "planned") return 1;
          if (n === "completed" || n === "archived" || n.includes("closed") || n.includes("cerrado")) return 2;
          return 1;
        };
        const ao = order(a.status);
        const bo = order(b.status);
        if (ao !== bo) return ao - bo;
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      }
      if (sortBy === "recently_updated") {
        const aTime = new Date((a as ProjectCardProject & { updated_at?: string }).updated_at ?? a.created_at ?? 0).getTime();
        const bTime = new Date((b as ProjectCardProject & { updated_at?: string }).updated_at ?? b.created_at ?? 0).getTime();
        return bTime - aTime;
      }
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });

    return list;
  }, [projects, search, statusFilter, sortBy]);

  return (
    <AppPageShell>
      <div className="space-y-7">
      {/* Header + portfolio snapshot: authoritative title, embedded summary rail */}
      <header className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/40 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-[1.625rem] font-semibold leading-tight tracking-tight text-[rgb(var(--rb-text-primary))] sm:text-3xl sm:tracking-tight">
            {t("page.title")}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-[rgb(var(--rb-text-secondary))]">
            {projectsQuota?.limit != null
              ? t("page.quotaSummary", { current: projectsQuota.current, limit: projectsQuota.limit })
              : t("page.subtitle")}
          </p>
          <div className="pt-4">
            <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <div className="flex flex-wrap items-stretch gap-2">
            <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-500 ring-1 ring-slate-200/60">
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="tabular-nums font-semibold text-slate-900">{loadingProjects ? "—" : summary.active}</span>
              <span className="text-slate-500">{t("summary.active")}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-sky-200/80 bg-sky-50/90 px-3 py-1.5 text-xs text-sky-800 shadow-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-100/90 text-sky-700 ring-1 ring-sky-200/60">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="tabular-nums font-semibold text-sky-900">{loadingProjects ? "—" : summary.planned}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-indigo-200/80 bg-indigo-50/90 px-3 py-1.5 text-xs text-indigo-900 shadow-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-100/90 text-indigo-700 ring-1 ring-indigo-200/60">
                <FolderOpen className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="tabular-nums font-semibold text-indigo-950">{loadingProjects ? "—" : summary.inProgress}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-500 ring-1 ring-slate-200/60">
                <Archive className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="tabular-nums font-medium text-slate-800">{loadingProjects ? "—" : summary.closed}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-500 ring-1 ring-slate-200/60">
                <Ticket className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="tabular-nums font-semibold text-slate-900">{loadingProjects ? "—" : summary.totalOpenTickets}</span>
              <span className="text-slate-500">{t("summary.tickets")}</span>
            </span>
              </div>
            </div>
          </div>
        </div>
        {canCreateProject && (
          <Link
            href="/projects/new"
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl border border-[rgb(var(--rb-brand-primary))]/35 bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[rgb(var(--rb-brand-primary))]/18 transition-all hover:border-[rgb(var(--rb-brand-primary))]/50 hover:bg-[rgb(var(--rb-brand-primary-hover))] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/40 focus:ring-offset-2 focus:ring-offset-white"
          >
            {t("page.createCta")}
          </Link>
        )}
        </div>
      </header>

      {/* Quota alerts */}
      {projectsQuota?.limit != null && projectsQuota.atLimit && (
        <div className="rounded-xl border border-red-200/90 bg-red-50/95 px-4 py-3 text-sm text-red-900 shadow-sm">
          {t("quota.atLimit", { current: projectsQuota.current, limit: projectsQuota.limit })}
        </div>
      )}
      {projectsQuota?.limit != null && !projectsQuota.atLimit && projectsQuota.current >= (projectsQuota.limit ?? 0) * 0.8 && (
        <div className="rounded-xl border border-amber-200/90 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-sm">
          {t("quota.nearLimit", { current: projectsQuota.current, limit: projectsQuota.limit })}
        </div>
      )}

      {/* Find & order */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 sm:flex sm:flex-wrap sm:items-center sm:gap-3 sm:p-3.5">
        <div className="relative flex-1 sm:max-w-[min(100%,320px)]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("filters.searchPlaceholder")}
            className="w-full rounded-xl border border-slate-200/90 bg-slate-50/50 py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition-shadow focus:border-[rgb(var(--rb-brand-primary))]/45 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/22"
          />
        </div>
        <div className="mt-2 flex min-w-0 flex-1 items-center gap-2 sm:mt-0 sm:flex-initial">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="min-h-[2.5rem] w-full min-w-0 flex-1 rounded-xl border border-slate-200/90 bg-slate-50/50 px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-[rgb(var(--rb-brand-primary))]/45 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/22 sm:w-auto sm:flex-initial [&>option]:bg-white"
          >
            <option value="">{t("filters.status.all")}</option>
            <option value="planned">{t("status.planned")}</option>
            <option value="in_progress">{t("status.in_progress")}</option>
            <option value="completed">{t("status.completed")}</option>
            <option value="archived">{t("status.archived")}</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="min-h-[2.5rem] w-full min-w-0 flex-1 rounded-xl border border-slate-200/90 bg-slate-50/50 px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-[rgb(var(--rb-brand-primary))]/45 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/22 sm:w-auto sm:flex-initial [&>option]:bg-white"
          >
            <option value="priority">{t("sort.priority")}</option>
            <option value="newest">{t("sort.newest")}</option>
            <option value="name">{t("sort.name")}</option>
            <option value="recently_updated">{t("sort.recentlyUpdated")}</option>
          </select>
        </div>
      </div>

      {/* Project grid */}
      <section>
        {loadingProjects ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-8 shadow-sm">
            <ContentSkeleton title={false} lines={0} cards={6} />
          </div>
        ) : errorMsg ? (
          <div className="rounded-2xl border border-red-200/90 bg-red-50/90 px-5 py-4 text-sm text-red-900 shadow-sm">
            {errorMsg}
          </div>
        ) : filteredAndSortedProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white py-16 text-center shadow-sm">
            <p className="text-base font-medium text-slate-900">{t("empty.title")}</p>
            <p className="mt-2 max-w-sm text-sm text-slate-600">
              {t("empty.description")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredAndSortedProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>
      </div>
    </AppPageShell>
  );
}
