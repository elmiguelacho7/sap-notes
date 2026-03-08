/**
 * Validation: multi-tenant retrieval isolation.
 *
 * Test scenario:
 * - User A + project X must NOT receive documents for project Y.
 * - User B + project Y must NOT receive documents for project X.
 *
 * Usage (optional env for explicit IDs):
 *   PROJECT_ID_X=<uuid> PROJECT_ID_Y=<uuid> USER_ID_A=<uuid> USER_ID_B=<uuid> npx tsx scripts/validate-multitenant-retrieval.ts
 *
 * If env vars are omitted, the script fetches two projects and two profiles from the DB
 * and runs the same checks (no cross-project docs in results).
 */

import { createClient } from "@supabase/supabase-js";

const EMBEDDING_DIMENSIONS = 1536;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

/** Zero vector for filter-only test (we only assert scope, not relevance). */
function zeroEmbedding(): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
}

type Row = {
  id: string;
  scope_type: string | null;
};

async function runMultitenantSearch(
  projectId: string | null,
  userId: string | null,
  limit: number
): Promise<Row[]> {
  const { data, error } = await supabase.rpc("search_knowledge_documents_multitenant", {
    p_project_id: projectId,
    p_user_id: userId,
    query_embedding: zeroEmbedding(),
    match_limit: limit,
  });
  if (error) throw new Error(`RPC error: ${error.message}`);
  return (data ?? []) as Row[];
}

async function fetchDocScopes(ids: string[]): Promise<{ id: string; scope_type: string | null; project_id: string | null; user_id: string | null }[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("id, scope_type, project_id, user_id")
    .in("id", ids);
  if (error) throw new Error(`fetch error: ${error.message}`);
  return (data ?? []) as { id: string; scope_type: string | null; project_id: string | null; user_id: string | null }[];
}

async function main(): Promise<void> {
  let projectIdX: string | null = process.env.PROJECT_ID_X ?? null;
  let projectIdY: string | null = process.env.PROJECT_ID_Y ?? null;
  let userIdA: string | null = process.env.USER_ID_A ?? null;
  let userIdB: string | null = process.env.USER_ID_B ?? null;

  if (!projectIdX || !projectIdY) {
    const { data: projects } = await supabase.from("projects").select("id").limit(2);
    const ids = (projects ?? []).map((p: { id: string }) => p.id);
    if (ids.length < 2) {
      console.log("Need at least 2 projects in DB (or set PROJECT_ID_X, PROJECT_ID_Y). Skipping project isolation check.");
      projectIdX = projectIdY = null;
    } else {
      projectIdX = ids[0];
      projectIdY = ids[1];
      console.log("Using projects:", projectIdX, projectIdY);
    }
  }

  if (!userIdA || !userIdB) {
    const { data: profiles } = await supabase.from("profiles").select("id").limit(2);
    const ids = (profiles ?? []).map((p: { id: string }) => p.id);
    if (ids.length >= 2) {
      userIdA = ids[0];
      userIdB = ids[1];
      console.log("Using users:", userIdA, userIdB);
    } else {
      userIdA = userIdB = null;
    }
  }

  const errors: string[] = [];

  if (projectIdX && projectIdY) {
    const resultsForAOnX = await runMultitenantSearch(projectIdX, userIdA ?? null, 50);
    const fullA = await fetchDocScopes(resultsForAOnX.map((r) => r.id));
    const projectYDocsForA = fullA.filter(
      (r) => r.scope_type === "project" && r.project_id !== projectIdX
    );
    if (projectYDocsForA.length > 0) {
      errors.push(`User A on project X received ${projectYDocsForA.length} document(s) belonging to another project.`);
    } else {
      console.log("OK: User A on project X → no other project's documents.");
    }

    const resultsForBOnY = await runMultitenantSearch(projectIdY, userIdB ?? null, 50);
    const fullB = await fetchDocScopes(resultsForBOnY.map((r) => r.id));
    const projectXDocsForB = fullB.filter(
      (r) => r.scope_type === "project" && r.project_id !== projectIdY
    );
    if (projectXDocsForB.length > 0) {
      errors.push(`User B on project Y received ${projectXDocsForB.length} document(s) belonging to another project.`);
    } else {
      console.log("OK: User B on project Y → no other project's documents.");
    }
  }

  const globalOnly = await runMultitenantSearch(null, null, 20);
  const nonGlobal = globalOnly.filter((r) => r.scope_type !== "global");
  if (nonGlobal.length > 0) {
    errors.push(`Global search (no projectId) returned ${nonGlobal.length} non-global document(s).`);
  } else {
    console.log("OK: No projectId → only global documents.");
  }

  if (errors.length > 0) {
    console.error("Validation FAILED:");
    errors.forEach((e) => console.error(" -", e));
    process.exit(1);
  }

  console.log("All multi-tenant retrieval checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
