"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { searchKnowledge } from "@/lib/knowledgeService";
import type { KnowledgeSearchResult } from "@/lib/types/knowledge";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { ContentSkeleton } from "@/components/skeletons/ContentSkeleton";

const PAGE_TYPE_LABELS: Record<string, string> = {
  how_to: "How-to",
  troubleshooting: "Troubleshooting",
  template: "Template",
  decision: "Decision",
  meeting_note: "Meeting note",
  config: "Config",
  cutover_runbook: "Cutover runbook",
  reference: "Reference",
};

export default function KnowledgeSearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KnowledgeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      const q = query.trim();
      if (!q) {
        setResults([]);
        setSearched(true);
        return;
      }
      setLoading(true);
      setError(null);
      setSearched(true);
      try {
        const list = await searchKnowledge(supabase, q);
        setResults(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al buscar.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [query]
  );

  return (
    <PageShell>
      <div className="space-y-8">
        <div className="flex flex-col gap-2">
          <Link
            href="/knowledge"
            className="text-xs text-slate-500 hover:text-indigo-600 transition-colors"
          >
            ← Volver a Knowledge
          </Link>
        </div>

      <PageHeader
        title="Buscar en Knowledge"
        description="Busca por título o resumen en las páginas de knowledge."
      />

      <section>
        <h2 className="text-sm font-semibold text-slate-800 mb-1">Búsqueda</h2>
        <p className="text-xs text-slate-500 mb-5">Introduce un término y pulsa Buscar para buscar en títulos y resúmenes.</p>
      <form onSubmit={runSearch} className="mb-6">
        <div className="flex gap-2">
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título o resumen..."
            className="flex-1"
            aria-label="Search knowledge"
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Buscando…" : "Buscar"}
          </Button>
        </div>
      </form>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-slate-800 mb-1">Resultados</h2>
        <p className="text-xs text-slate-500 mb-5">Páginas que coinciden con tu búsqueda.</p>
      <Card className="rounded-2xl border border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-200 bg-slate-50/50 px-5 py-3">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Resultados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {!searched ? (
            <EmptyState
              title="Escribe para buscar"
              description="Introduce un término y pulsa Buscar para buscar en títulos y resúmenes."
              icon={<FileText className="h-5 w-5" />}
            />
          ) : loading ? (
            <ContentSkeleton title={false} lines={5} />
          ) : results.length === 0 ? (
            <EmptyState
              title="Sin resultados"
              description="No se encontraron páginas para tu búsqueda. Prueba otros términos."
              icon={<FileText className="h-5 w-5" />}
            />
          ) : (
            <ul className="space-y-0.5">
              {results.map((r) => (
                <li key={r.page_id}>
                  <Link
                    href={`/knowledge/${r.page_id}`}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <FileText className="h-[18px] w-[18px] shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{r.title}</p>
                      {r.summary && (
                        <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">
                          {r.summary}
                        </p>
                      )}
                      <Badge variant="brand" className="mt-1.5">
                        {PAGE_TYPE_LABELS[r.page_type] ?? r.page_type}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      </section>
      </div>
    </PageShell>
  );
}
