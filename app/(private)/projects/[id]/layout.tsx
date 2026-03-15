"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ProjectWorkspaceProvider, useProjectWorkspace } from "@/components/projects/ProjectWorkspaceContext";
import { ProjectWorkspaceHeader } from "@/components/projects/ProjectWorkspaceHeader";
import { ProjectTabsNav } from "@/components/projects/ProjectTabsNav";
import { ProjectAssistantDock } from "@/components/ai/ProjectAssistantDock";

type ProjectSummary = {
  id: string;
  name: string;
  status: string | null;
};

function ProjectLayoutInner({
  projectId,
  project,
  loading,
  children,
}: {
  projectId: string;
  project: ProjectSummary | null;
  loading: boolean;
  children: React.ReactNode;
}) {
  const { headerActions } = useProjectWorkspace();

  return (
    <div className="flex h-full flex-col">
      {/* Workspace masthead: one composed header system */}
      <div className="shrink-0 bg-slate-950/95">
        <ProjectWorkspaceHeader
          projectId={projectId}
          projectName={project?.name ?? null}
          projectStatus={project?.status ?? null}
          loading={loading}
          actions={headerActions}
        />
        <div className="min-w-0 overflow-x-auto px-4 sm:px-5 lg:px-6 pb-3.5 pt-1">
          <ProjectTabsNav projectId={projectId} variant="dark" />
        </div>
      </div>
      <section className="flex-1 overflow-y-auto w-full min-w-0 px-4 sm:px-5 lg:px-6 xl:px-8 2xl:px-10 pt-6 sm:pt-7 pb-6">
        {children}
      </section>
      {projectId && (
        <ProjectAssistantDock projectId={projectId} projectName={project?.name} />
      )}
    </div>
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

  return (
    <ProjectWorkspaceProvider>
      <ProjectLayoutInner projectId={projectId} project={project} loading={loading}>
        {children}
      </ProjectLayoutInner>
    </ProjectWorkspaceProvider>
  );
}
