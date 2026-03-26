import type { SupabaseClient } from "@supabase/supabase-js";

export type GraphNode = { id: string; title: string };
export type GraphEdge = { from_page_id: string; to_page_id: string; link_type: string };

export type PageGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

/**
 * Load graph for a knowledge page: the page, its outgoing and incoming links,
 * and titles for all connected pages. Respects RLS.
 */
export async function getPageGraph(
  supabase: SupabaseClient,
  pageId: string
): Promise<PageGraph> {
  const [pageRes, linksRes] = await Promise.all([
    supabase
      .from("knowledge_pages")
      .select("id, title")
      .eq("id", pageId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("knowledge_page_links")
      .select("from_page_id, to_page_id, link_type")
      .or(`from_page_id.eq.${pageId},to_page_id.eq.${pageId}`),
  ]);

  const page = pageRes.data as { id: string; title: string } | null;
  const links = (linksRes.data ?? []) as GraphEdge[];
  if (linksRes.error) {
    console.error("knowledgeGraphService getPageGraph links", linksRes.error);
    return { nodes: [], edges: [] };
  }

  const nodeIds = new Set<string>();
  if (page) nodeIds.add(page.id);
  links.forEach((e) => {
    nodeIds.add(e.from_page_id);
    nodeIds.add(e.to_page_id);
  });

  if (nodeIds.size === 0) return { nodes: [], edges: links };

  const ids = Array.from(nodeIds);
  const { data: pages, error } = await supabase
    .from("knowledge_pages")
    .select("id, title")
    .in("id", ids)
    .is("deleted_at", null);

  if (error) {
    console.error("knowledgeGraphService getPageGraph pages", error);
    return { nodes: page ? [page] : [], edges: links };
  }

  const nodes: GraphNode[] = (pages ?? []).map((p) => ({
    id: (p as { id: string; title: string }).id,
    title: (p as { id: string; title: string }).title ?? "",
  }));

  return { nodes, edges: links };
}

/**
 * Synchronize internal knowledge references for a page.
 * Creates/removes rows in `knowledge_page_links` so backlinks stay consistent.
 */
export async function syncKnowledgePageLinks(
  supabase: SupabaseClient,
  fromPageId: string,
  toPageIds: string[],
  linkType: string = "references"
): Promise<void> {
  const uniqueToIds = Array.from(new Set(toPageIds.filter(Boolean)));

  const { data: existing, error: existingError } = await supabase
    .from("knowledge_page_links")
    .select("to_page_id")
    .eq("from_page_id", fromPageId)
    .eq("link_type", linkType);

  if (existingError) {
    throw new Error(existingError.message ?? "Error al leer knowledge_page_links.");
  }

  const existingToIds = new Set((existing ?? []).map((r) => r.to_page_id as string));

  const toInsert = uniqueToIds.filter((id) => !existingToIds.has(id));
  const toDelete = Array.from(existingToIds).filter((id) => !uniqueToIds.includes(id));

  if (toInsert.length > 0) {
    const rows = toInsert.map((to_page_id) => ({
      from_page_id: fromPageId,
      to_page_id,
      link_type: linkType,
    }));
    const { error: insertError } = await supabase.from("knowledge_page_links").insert(rows);
    if (insertError) {
      throw new Error(insertError.message ?? "Error al crear knowledge_page_links.");
    }
  }

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("knowledge_page_links")
      .delete()
      .eq("from_page_id", fromPageId)
      .eq("link_type", linkType)
      .in("to_page_id", toDelete);
    if (deleteError) {
      throw new Error(deleteError.message ?? "Error al eliminar knowledge_page_links.");
    }
  }
}
