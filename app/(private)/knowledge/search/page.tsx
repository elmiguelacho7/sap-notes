"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Search, FileText } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { searchKnowledge } from "@/lib/knowledgeService";
import type { KnowledgeSearchResult } from "@/lib/types/knowledge";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";

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
      <Link
        href="/knowledge"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-indigo-600 mb-6"
      >
        ← Volver a Knowledge
      </Link>

      <PageHeader
        title="Buscar en Knowledge"
        description="Busca por título o resumen en las páginas de knowledge."
      />

      <form onSubmit={runSearch} className="mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título o resumen..."
              className="pl-10"
              aria-label="Search knowledge"
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Buscando…" : "Buscar"}
          </Button>
        </div>
      </form>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="border-b border-slate-200 bg-slate-50/50">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Resultados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {!searched ? (
            <p className="text-sm text-slate-500">
              Escribe un término y pulsa Buscar para buscar en títulos y resúmenes.
            </p>
          ) : loading ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-slate-500">
              No se encontraron páginas para tu búsqueda.
            </p>
          ) : (
            <ul className="space-y-3">
              {results.map((r) => (
                <li key={r.page_id}>
                  <Link
                    href={`/knowledge/${r.page_id}`}
                    className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{r.title}</p>
                        {r.summary && (
                          <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                            {r.summary}
                          </p>
                        )}
                        <Badge variant="brand" className="mt-2">
                          {PAGE_TYPE_LABELS[r.page_type] ?? r.page_type}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
