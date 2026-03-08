"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card/Card";
import { StatCard } from "@/components/ui/stat/StatCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FolderOpen, FileText, LayoutGrid, ArrowRight } from "lucide-react";
type ProjectSummary = {
  id: string;
  name: string;
  status: string | null;
  created_at: string;
};

type NoteSummary = {
  id: string;
  title: string;
  client: string | null;
  module: string | null;
  created_at: string;
};

type DashboardStats = {
  totalProjects: number;
  openProjects: number;
  totalNotes: number;
  todayNotes: number;
};

const RECENT_COUNT = 5;

export default function DashboardPage() {
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    openProjects: 0,
    totalNotes: 0,
    todayNotes: 0,
  });

  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>([]);
  const [recentNotes, setRecentNotes] = useState<NoteSummary[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoadingStats(true);
    setErrorMsg(null);
    try {
      const [projResult, noteResult, sessionResult] = await Promise.all([
        supabase
          .from("projects")
          .select("id, name, status, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("notes")
          .select("id, title, client, module, created_at")
          .order("created_at", { ascending: false }),
        supabase.auth.getSession(),
      ]);

      let projects: ProjectSummary[] = [];
      let notes: NoteSummary[] = [];

      if (projResult.error) {
        handleSupabaseError("dashboard projects", projResult.error);
        setErrorMsg("No se pudieron cargar los datos del dashboard.");
      } else {
        projects = (projResult.data ?? []) as ProjectSummary[];
      }

      if (noteResult.error) {
        handleSupabaseError("dashboard notes", noteResult.error);
        setErrorMsg("No se pudieron cargar los datos del dashboard.");
      } else {
        notes = (noteResult.data ?? []) as NoteSummary[];
      }

      setRecentProjects(projects.slice(0, RECENT_COUNT));
      setRecentNotes(notes.slice(0, RECENT_COUNT));

      const token = sessionResult.data?.session?.access_token;
      if (token) {
        try {
          const res = await fetch("/api/metrics/platform", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = (await res.json()) as {
              projects_total?: number;
              projects_active?: number;
              notes_total?: number;
              notes_today?: number;
              tickets_open?: number;
            };
            setStats({
              totalProjects: data.projects_total ?? 0,
              openProjects: data.projects_active ?? 0,
              totalNotes: data.notes_total ?? 0,
              todayNotes: data.notes_today ?? 0,
            });
          } else {
            computeStatsFromLists(projects, notes);
          }
        } catch {
          computeStatsFromLists(projects, notes);
        }
      } else {
        computeStatsFromLists(projects, notes);
      }
    } catch (e) {
      handleSupabaseError("dashboard loadData", e);
      setErrorMsg("No se pudieron cargar los datos del dashboard.");
    } finally {
      setLoadingStats(false);
    }
  };

  function computeStatsFromLists(projects: ProjectSummary[], notes: NoteSummary[]) {
    const openProjects = projects.filter((p) => {
      if (!p.status) return true;
      const s = p.status.toLowerCase();
      return !s.includes("cerrado") && !s.includes("closed");
    });
    const hoy = new Date().toDateString();
    const todayNotes = notes.filter(
      (n) => new Date(n.created_at).toDateString() === hoy
    );
    setStats({
      totalProjects: projects.length,
      openProjects: openProjects.length,
      totalNotes: notes.length,
      todayNotes: todayNotes.length,
    });
  }

  useEffect(() => {
    void loadData();
  }, []);

  const recentActivityCount = recentProjects.length + recentNotes.length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Visión global de la plataforma: indicadores, actividad reciente y accesos rápidos."
      />

      {errorMsg && (
        <div className="rounded-2xl border border-red-900/50 bg-red-950/30 px-5 py-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-red-300">{errorMsg}</p>
          <Button variant="secondary" onClick={() => { setErrorMsg(null); void loadData(); }}>
            Reintentar
          </Button>
        </div>
      )}

      {/* 1) KPI row — platform indicators */}
      <section>
        <h2 className="text-sm font-semibold text-slate-200 mb-1">Indicadores de plataforma</h2>
        <p className="text-xs text-slate-500 mb-5">Resumen de proyectos y notas en la base de conocimiento.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            label="Proyectos totales"
            value={loadingStats ? "—" : stats.totalProjects}
            trend="Todos los proyectos registrados."
          />
          <StatCard
            label="Proyectos activos"
            value={loadingStats ? "—" : stats.openProjects}
            trend="En curso / no cerrados."
          />
          <StatCard
            label="Notas totales"
            value={loadingStats ? "—" : stats.totalNotes}
            trend="Memoria funcional acumulada."
          />
          <StatCard
            label="Notas de hoy"
            value={loadingStats ? "—" : stats.todayNotes}
            trend="Creadas en la fecha actual."
          />
        </div>
      </section>

      {/* 2) Platform signals — compact at-a-glance */}
      <section>
        <h2 className="text-sm font-semibold text-slate-200 mb-1">Señales de plataforma</h2>
        <p className="text-xs text-slate-500 mb-5">Estado actual y actividad reciente a simple vista.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-800/50 px-5 py-4">
            <div className="flex items-center gap-2 text-slate-400">
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span className="text-[11px] font-medium uppercase tracking-wide">Proyectos activos</span>
            </div>
            <p className="mt-2 text-xl font-semibold text-white tracking-tight">
              {loadingStats ? "—" : stats.openProjects}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">En curso</p>
          </div>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-800/50 px-5 py-4">
            <div className="flex items-center gap-2 text-slate-400">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="text-[11px] font-medium uppercase tracking-wide">Notas hoy</span>
            </div>
            <p className="mt-2 text-xl font-semibold text-white tracking-tight">
              {loadingStats ? "—" : stats.todayNotes}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">Nuevas hoy</p>
          </div>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-800/50 px-5 py-4">
            <div className="flex items-center gap-2 text-slate-400">
              <LayoutGrid className="h-4 w-4 shrink-0" />
              <span className="text-[11px] font-medium uppercase tracking-wide">Últimos ítems</span>
            </div>
            <p className="mt-2 text-xl font-semibold text-white tracking-tight">
              {loadingStats ? "—" : recentActivityCount}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">Proyectos + notas recientes</p>
          </div>
        </div>
      </section>

      {/* 3) Recent activity — two clear groups */}
      <section>
        <h2 className="text-sm font-semibold text-slate-200 mb-1">Actividad reciente</h2>
        <p className="text-xs text-slate-500 mb-5">Últimos proyectos y notas creados. Haz clic para abrir.</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-0 overflow-hidden rounded-2xl border border-slate-700/80 shadow-sm">
            <CardHeader className="px-5 pt-5 pb-3 border-b border-slate-700/50">
              <CardTitle className="text-base font-semibold text-slate-100">Proyectos recientes</CardTitle>
              <CardDescription>Acceso rápido a los últimos proyectos.</CardDescription>
            </CardHeader>
            <CardContent className="px-5 py-4">
              {loadingStats ? (
                <p className="text-sm text-slate-500 py-8 text-center">Cargando…</p>
              ) : recentProjects.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">Aún no hay proyectos registrados.</p>
              ) : (
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                  {recentProjects.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-700/80 bg-slate-800/40 px-4 py-3 text-left hover:bg-slate-800/80 transition-colors"
                        onClick={() => router.push(`/projects/${p.id}`)}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{p.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{new Date(p.created_at).toLocaleDateString("es-ES")}</p>
                        </div>
                        {p.status && <span className="shrink-0"><StatusPill status={p.status} /></span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card className="p-0 overflow-hidden rounded-2xl border border-slate-700/80 shadow-sm">
            <CardHeader className="px-5 pt-5 pb-3 border-b border-slate-700/50">
              <CardTitle className="text-base font-semibold text-slate-100">Notas recientes</CardTitle>
              <CardDescription>Últimas notas en la base de conocimiento.</CardDescription>
            </CardHeader>
            <CardContent className="px-5 py-4">
              {loadingStats ? (
                <p className="text-sm text-slate-500 py-8 text-center">Cargando…</p>
              ) : recentNotes.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">Aún no hay notas registradas.</p>
              ) : (
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                  {recentNotes.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-700/80 bg-slate-800/40 px-4 py-3 text-left hover:bg-slate-800/80 transition-colors"
                        onClick={() => router.push(`/notes/${n.id}`)}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{n.title ?? "Sin título"}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{new Date(n.created_at).toLocaleDateString("es-ES")}</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                          {n.client && <Badge variant="brand">{n.client}</Badge>}
                          {n.module && <Badge>{n.module}</Badge>}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 4) Quick links — executive access */}
      <section>
        <h2 className="text-sm font-semibold text-slate-200 mb-1">Accesos rápidos</h2>
        <p className="text-xs text-slate-500 mb-5">Navegación principal de la plataforma.</p>
        <div className="rounded-2xl border border-slate-700/80 bg-slate-800/30 p-5">
          <div className="flex flex-wrap gap-4">
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-3 text-sm font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800/80 hover:text-white transition-colors"
            >
              <FolderOpen className="h-4 w-4 shrink-0" />
              Proyectos
              <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </Link>
            <Link
              href="/notes"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-3 text-sm font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800/80 hover:text-white transition-colors"
            >
              <FileText className="h-4 w-4 shrink-0" />
              Notas
              <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </Link>
            <Link
              href="/knowledge"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-3 text-sm font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800/80 hover:text-white transition-colors"
            >
              <LayoutGrid className="h-4 w-4 shrink-0" />
              Knowledge
              <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </Link>
            <Link
              href="/my-work"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-3 text-sm font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800/80 hover:text-white transition-colors"
            >
              Mi trabajo
              <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const isActive =
    !s.includes("cerrado") && !s.includes("closed") && !s.includes("finalizado");
  return (
    <span
      className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${
        isActive
          ? "bg-indigo-500/20 text-indigo-300"
          : "bg-slate-700 text-slate-400"
      }`}
    >
      {status}
    </span>
  );
}
