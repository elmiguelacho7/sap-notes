"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  ArrowLeft,
  LayoutDashboard,
  Ticket,
  FileText,
  ListChecks,
  Link as LinkIcon,
  BookOpen,
  CalendarDays,
  ClipboardList,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { ProjectAssistantDock } from "@/components/ai/ProjectAssistantDock";

type ProjectSummary = {
  id: string;
  name: string;
  code?: string | null;
  client_name?: string | null;
  status: string | null;
};

const NAV_ITEMS: { path: string; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { path: "", label: "Dashboard", Icon: LayoutDashboard },
  { path: "planning", label: "Planificación", Icon: CalendarDays },
  { path: "tickets", label: "Tickets", Icon: Ticket },
  { path: "notes", label: "Notas", Icon: FileText },
  { path: "activities", label: "Actividades", Icon: ListChecks },
  { path: "tasks", label: "Tareas", Icon: ClipboardList },
  { path: "links", label: "Enlaces del proyecto", Icon: LinkIcon },
  { path: "knowledge", label: "Base de conocimiento", Icon: BookOpen },
];

function getProjectNavItems(projectId: string) {
  const base = `/projects/${projectId}`;
  return NAV_ITEMS.map(({ path, label, Icon }) => ({
    href: path ? `${base}/${path}` : base,
    label,
    Icon,
  }));
}

const SIDEBAR_STATUS_LABELS: Record<string, string> = {
  in_progress: "En progreso",
  completed: "Completado",
  paused: "En pausa",
};

function SidebarStatusBadge({ status }: { status: string }) {
  const friendlyStatus = SIDEBAR_STATUS_LABELS[status] ?? status;
  const styles =
    status === "completed"
      ? "bg-blue-50 text-blue-700 ring-blue-200"
      : status === "paused"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-emerald-50 text-emerald-700 ring-emerald-200";
  const dotClass =
    status === "completed"
      ? "bg-blue-500"
      : status === "paused"
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${styles}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {friendlyStatus}
    </span>
  );
}

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const projectId = params?.id as string;

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;

    let isMounted = true;

    const loadProject = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status")
        .eq("id", projectId)
        .single();

      if (!isMounted) return;

      if (!error && data) {
        const row = data as { id: string; name: string; status: string | null };
        setProject({
          id: row.id,
          name: row.name,
          code: null,
          client_name: null,
          status: row.status,
        });
      }
      setLoading(false);
    };

    loadProject();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const navItems = projectId ? getProjectNavItems(projectId) : [];

  const base = projectId ? `/projects/${projectId}` : "";
  const isDashboardActive = pathname === base;
  const isPlanningActive = base ? pathname.startsWith(`${base}/planning`) : false;
  const isTicketsActive = base ? pathname.startsWith(`${base}/tickets`) : false;
  const isNotesActive = base ? pathname.startsWith(`${base}/notes`) : false;
  const isActivitiesActive = base ? pathname.startsWith(`${base}/activities`) : false;
  const isTasksActive = base ? pathname.startsWith(`${base}/tasks`) : false;
  const isLinksActive = base ? pathname.startsWith(`${base}/links`) : false;
  const isKnowledgeActive = base ? pathname.startsWith(`${base}/knowledge`) : false;

  const isActiveMap: Record<string, boolean> = {};
  if (navItems.length) {
    const [dash, planning, tickets, notes, activities, tasks, links, knowledge] = navItems;
    isActiveMap[dash.href] = isDashboardActive;
    isActiveMap[planning.href] = isPlanningActive;
    isActiveMap[tickets.href] = isTicketsActive;
    isActiveMap[notes.href] = isNotesActive;
    isActiveMap[activities.href] = isActivitiesActive;
    isActiveMap[tasks.href] = isTasksActive;
    isActiveMap[links.href] = isLinksActive;
    isActiveMap[knowledge.href] = isKnowledgeActive;
  }

  return (
    <div className="flex h-full">
      {/* Sidebar contextual del proyecto */}
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-slate-50">
        <div className="flex flex-col h-full">
          {/* Volver a proyectos */}
          <div className="px-4 py-3 border-b border-slate-200">
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver a proyectos
            </Link>
          </div>

          {/* Info básica del proyecto */}
          <div className="px-4 py-3 space-y-1 border-b border-slate-200">
            {loading ? (
              <div className="h-8 w-36 rounded bg-slate-200 animate-pulse" />
            ) : project ? (
              <>
                <p className="text-sm font-semibold text-slate-900">
                  {project.name}
                </p>
                {(project.client_name ?? project.code) && (
                  <p className="text-xs text-slate-500">
                    {[project.client_name, project.code].filter(Boolean).join(" · ")}
                  </p>
                )}
                {project.status && (
                  <SidebarStatusBadge status={project.status} />
                )}
              </>
            ) : (
              <p className="text-xs text-red-500">
                Proyecto no encontrado o sin acceso.
              </p>
            )}
          </div>

          {/* Navegación interna del proyecto */}
          <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
            {navItems.map((item) => {
              const isActive = isActiveMap[item.href] ?? false;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition",
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  ].join(" ")}
                >
                  <item.Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Contenido principal del proyecto */}
      <section className="flex-1 px-8 py-6">
        {children}
      </section>
      {projectId && (
        <ProjectAssistantDock projectId={projectId} projectName={project?.name} />
      )}
    </div>
  );
}
