import { supabase } from "@/lib/supabaseClient";

export type ProjectPhase = {
  id: string;
  project_id: string;
  phase_key: string;
  name: string;
  sort_order: number;
  start_date: string | null;
  end_date: string | null;
};

const DEFAULT_PHASES: Array<Pick<ProjectPhase, "phase_key" | "name" | "sort_order">> = [
  { phase_key: "discover", name: "Discover", sort_order: 1 },
  { phase_key: "prepare", name: "Prepare", sort_order: 2 },
  { phase_key: "explore", name: "Explore", sort_order: 3 },
  { phase_key: "realize", name: "Realize", sort_order: 4 },
  { phase_key: "deploy", name: "Deploy", sort_order: 5 },
  { phase_key: "run", name: "Run", sort_order: 6 },
];

/**
 * Insert default SAP Activate phases for a newly created project.
 * Call this right after creating the project.
 */
export async function createDefaultPhasesForProject(projectId: string) {
  if (!projectId) return;

  const { data, error } = await supabase
    .from("project_phases")
    .insert(
      DEFAULT_PHASES.map((p) => ({
        project_id: projectId,
        phase_key: p.phase_key,
        name: p.name,
        sort_order: p.sort_order,
      }))
    )
    .select("id");

  if (error) {
    console.error("Error creating default phases", error);
  }

  return data;
}

/**
 * Load all phases for a project, ordered by sort_order.
 */
export async function getProjectPhases(projectId: string): Promise<ProjectPhase[]> {
  const { data, error } = await supabase
    .from("project_phases")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error loading project phases", error);
    return [];
  }

  return (data ?? []) as ProjectPhase[];
}

export type UpdateProjectPhasePayload = {
  name?: string;
  sort_order?: number;
  start_date?: string | null;
  end_date?: string | null;
};

/**
 * Update a single project phase (name, order, dates).
 */
export async function updateProjectPhase(
  projectId: string,
  phaseId: string,
  payload: UpdateProjectPhasePayload
): Promise<ProjectPhase | null> {
  const updates: Record<string, unknown> = {};
  if (payload.name !== undefined) updates.name = payload.name;
  if (payload.sort_order !== undefined) updates.sort_order = payload.sort_order;
  if (payload.start_date !== undefined) updates.start_date = payload.start_date;
  if (payload.end_date !== undefined) updates.end_date = payload.end_date;

  if (Object.keys(updates).length === 0) return null;

  const { data, error } = await supabase
    .from("project_phases")
    .update(updates)
    .eq("id", phaseId)
    .eq("project_id", projectId)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating project phase", error);
    return null;
  }

  return data as ProjectPhase;
}
