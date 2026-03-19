"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import Link from "next/link";
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
        setErrorMsg("No se pudieron cargar los proyectos.");
        setProjects([]);
        setLoadingProjects(false);
        return;
      }

      const rows = (projData ?? []) as ProjectRow[];

      const clientIds = Array.from(new Set(rows.map((p) => p.client_id).filter(Boolean))) as string[];
      let clientNames = new Map<string, string>();
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
  }, []);

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
      <div className="space-y-6">
      {/* Header: stronger title, cleaner subtitle, metrics below, primary action right */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Proyectos</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {projectsQuota?.limit != null
              ? `${projectsQuota.current} / ${projectsQuota.limit} proyectos`
              : "Gestiona y abre el workspace de cada proyecto."}
          </p>
          {/* Compact metrics row below title */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-400">
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="font-medium text-slate-300">{loadingProjects ? "—" : summary.active}</span>
              <span>activos</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-400/90">
              <CalendarClock className="h-3.5 w-3.5" />
              {loadingProjects ? "—" : summary.planned}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-400/90">
              <FolderOpen className="h-3.5 w-3.5" />
              {loadingProjects ? "—" : summary.inProgress}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-500">
              <Archive className="h-3.5 w-3.5" />
              {loadingProjects ? "—" : summary.closed}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-500">
              <Ticket className="h-3.5 w-3.5" />
              <span className="font-medium text-slate-300">{loadingProjects ? "—" : summary.totalOpenTickets}</span>
              <span>tickets</span>
            </span>
          </div>
        </div>
        {canCreateProject && (
          <Link
            href="/projects/new"
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-700 hover:border-slate-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            Nuevo proyecto
          </Link>
        )}
      </header>

      {/* Quota alerts (dark style) */}
      {projectsQuota?.limit != null && projectsQuota.atLimit && (
        <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          Has alcanzado el máximo de proyectos permitidos ({projectsQuota.current} / {projectsQuota.limit}). No puedes crear más hasta que un administrador aumente el límite.
        </div>
      )}
      {projectsQuota?.limit != null && !projectsQuota.atLimit && projectsQuota.current >= (projectsQuota.limit ?? 0) * 0.8 && (
        <div className="rounded-xl border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          Te acercas al límite de proyectos ({projectsQuota.current} / {projectsQuota.limit}). Cuando lo alcances no podrás crear más hasta que un administrador aumente la cuota.
        </div>
      )}

      {/* Filter bar: search first, status, sort; compact and aligned */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="relative flex-1 sm:max-w-[280px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, cliente o estado..."
            className="w-full rounded-lg border border-slate-800 bg-slate-900/80 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="w-full sm:w-auto min-w-0 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-200 focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600 [&>option]:bg-slate-900"
          >
            <option value="">Todos los estados</option>
            <option value="planned">Planificado</option>
            <option value="in_progress">En progreso</option>
            <option value="completed">Completado</option>
            <option value="archived">Archivado</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="w-full sm:w-auto min-w-0 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-200 focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600 [&>option]:bg-slate-900"
          >
            <option value="priority">Activos primero</option>
            <option value="newest">Más recientes</option>
            <option value="name">Por nombre</option>
            <option value="recently_updated">Recientemente actualizados</option>
          </select>
        </div>
      </div>

      {/* Project grid */}
      <section>
        {loadingProjects ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-6 py-8">
            <ContentSkeleton title={false} lines={0} cards={6} />
          </div>
        ) : errorMsg ? (
          <div className="rounded-2xl border border-red-800/50 bg-red-950/30 px-5 py-4 text-sm text-red-200">
            {errorMsg}
          </div>
        ) : filteredAndSortedProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 py-16 text-center">
            <p className="text-base font-medium text-slate-300">No se han encontrado proyectos</p>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              Ajusta el filtro o crea un nuevo proyecto para empezar.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
