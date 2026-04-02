import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type StructuredMemoryItem = {
  memory_type: string;
  title: string | null;
  summary: string;
};

function normalizeSummary(s: string): string {
  return (s ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Store structured memory items into project_memory.
 * Dedupes by exact normalized summary within the same project.
 *
 * This is intentionally tolerant: memory_type is stored as text and can evolve over time.
 */
export async function storeStructuredProjectMemoryItems(
  projectId: string,
  sourceType: string,
  sourceId: string | null,
  items: StructuredMemoryItem[]
): Promise<{ inserted: number; skipped: number }> {
  if (!projectId?.trim() || items.length === 0) return { inserted: 0, skipped: 0 };

  let inserted = 0;
  let skipped = 0;
  for (const item of items) {
    const summary = normalizeSummary(item.summary);
    if (!summary) continue;

    const { data: existing } = await supabaseAdmin
      .from("project_memory")
      .select("id")
      .eq("project_id", projectId)
      .eq("summary", summary)
      .limit(1)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const { error } = await supabaseAdmin.from("project_memory").insert({
      project_id: projectId,
      memory_type: (item.memory_type ?? "reference").toString().trim() || "reference",
      title: item.title ?? null,
      summary,
      source_type: sourceType,
      source_id: sourceId ?? null,
    });

    if (error) {
      console.error("[projectMemoryStore] insert error", error.message);
      continue;
    }
    inserted++;
  }

  return { inserted, skipped };
}

