"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ProjectWorkspaceProvider, useProjectWorkspace } from "@/components/projects/ProjectWorkspaceContext";
import { ProjectWorkspaceHeader } from "@/components/projects/ProjectWorkspaceHeader";
import { ProjectAssistantDock } from "@/components/ai/ProjectAssistantDock";
import { getProjectPhases } from "@/lib/services/projectPhaseService";
import { ProjectLayout as ProjectModeLayout } from "@/components/layout/ProjectLayout";

type ProjectPhaseLite = { id: string; name: string; sort_order: number; start_date: string | null; end_date: string | null };

function getCurrentPhaseName(phases: ProjectPhaseLite[]): string | null {
  const list = phases ?? [];
  if (list.length === 0) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const toDate = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  };
  // Prefer a phase where today is within [start,end]
  for (const p of list) {
    const s = toDate(p.start_date);
    const e = toDate(p.end_date);
    if (s && e && today.getTime() >= s.getTime() && today.getTime() <= e.getTime()) return p.name ?? null;
  }
  // Otherwise, pick the latest phase with start_date <= today
  const started = list
    .map((p) => ({ p, s: toDate(p.start_date) }))
    .filter((x): x is { p: ProjectPhaseLite; s: Date } => Boolean(x.s))
    .filter((x) => x.s.getTime() <= today.getTime())
    .sort((a, b) => b.s.getTime() - a.s.getTime());
  if (started[0]?.p?.name) return started[0].p.name;
  // Fallback to first by sort_order
  const byOrder = [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return byOrder[0]?.name ?? null;
}

type ProjectSummary = {
  id: string;
  name: string;
  status: string | null;
  client_name?: string | null;
  start_date?: string | null;
  planned_end_date?: string | null;
};

function ProjectLayoutInner({
  projectId,
  project,
  loading,
  currentPhase,
  children,
}: {
  projectId: string;
  project: ProjectSummary | null;
  loading: boolean;
  currentPhase: string | null;
  children: React.ReactNode;
}) {
  const { headerActions, setCopilotOpen } = useProjectWorkspace();
  const pathname = usePathname() ?? "";
  const isProjectOverview = pathname === `/projects/${projectId}` || pathname === `/projects/${projectId}/`;

  const askSapitoBtn =
    "inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--rb-brand-primary))]/18 bg-[rgb(var(--rb-brand-primary))]/10 px-3.5 py-2 text-sm font-semibold text-[rgb(var(--rb-brand-primary-active))] shadow-sm hover:bg-[rgb(var(--rb-brand-primary))]/14 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--rb-workspace-bg))]";

  return (
    <ProjectModeLayout
      compactTop={isProjectOverview}
      header={
        <ProjectWorkspaceHeader
          projectId={projectId}
          projectName={project?.name ?? null}
          clientName={project?.client_name ?? null}
          projectStatus={project?.status ?? null}
          currentPhaseName={currentPhase}
          startDate={project?.start_date ?? null}
          plannedEndDate={project?.planned_end_date ?? null}
          loading={loading}
          actions={
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setCopilotOpen(true)} className={askSapitoBtn}>
                Ask Sapito about this project
              </button>
              {headerActions}
            </div>
          }
          compact
        />
      }
    >
      {children}
      {projectId && (
        <ProjectAssistantDock projectId={projectId} projectName={project?.name} />
      )}
    </ProjectModeLayout>
  );
}

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ id: string }>();
  const projectId = params?.id as string;

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    let isMounted = true;

    const loadProject = async () => {
      setLoading(true);
      const [projectRes, phases] = await Promise.all([
        supabase
          .from("projects")
          .select("id, name, status, start_date, planned_end_date, client_id")
          .eq("id", projectId)
          .single(),
        getProjectPhases(projectId).catch(() => []),
      ]);

      if (!isMounted) return;

      const { data, error } = projectRes;
      if (!error && data) {
        const row = data as {
          id: string;
          name: string;
          status: string | null;
          start_date?: string | null;
          planned_end_date?: string | null;
          client_id?: string | null;
        };
        let clientName: string | null = null;
        try {
          if (row.client_id) {
            const { data: clientRow } = await supabase
              .from("clients")
              .select("name")
              .eq("id", row.client_id)
              .single();
            clientName = (clientRow as { name?: string | null } | null)?.name ?? null;
          }
        } catch {
          clientName = null;
        }
        setProject({
          id: row.id,
          name: row.name,
          status: row.status,
          client_name: clientName,
          start_date: row.start_date ?? null,
          planned_end_date: row.planned_end_date ?? null,
        });
      }
      setCurrentPhase(getCurrentPhaseName((phases ?? []) as unknown as ProjectPhaseLite[]));
      setLoading(false);
    };

    loadProject();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  return (
    <ProjectWorkspaceProvider>
      <ProjectLayoutInner
        projectId={projectId}
        project={project}
        loading={loading}
        currentPhase={currentPhase}
      >
        {children}
      </ProjectLayoutInner>
    </ProjectWorkspaceProvider>
  );
}
