"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page/PageHeader";
import {
  FolderOpen,
  CheckSquare,
  Ticket,
  FileText,
  BookOpen,
  Building2,
  Search,
} from "lucide-react";

type SearchResults = {
  projects: { id: string; name: string; status: string | null; href: string }[];
  tasks: { id: string; title: string; project_id: string; project_name?: string; href: string }[];
  tickets: { id: string; title: string; status: string | null; project_id: string | null; href: string }[];
  notes: { id: string; title: string; project_id: string | null; href: string }[];
  knowledge: { id: string; title: string; space_name?: string; href: string }[];
  clients: { id: string; name: string; href: string }[];
};

export default function GlobalSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qParam = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(qParam);
  const [results, setResults] = useState<SearchResults>({
    projects: [],
    tasks: [],
    tickets: [],
    notes: [],
    knowledge: [],
    clients: [],
  });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    setQuery(qParam);
  }, [qParam]);

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2) {
      setResults({ projects: [], tasks: [], tickets: [], notes: [], knowledge: [], clients: [] });
      setSearched(true);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setResults({ projects: [], tasks: [], tickets: [], notes: [], knowledge: [], clients: [] });
        return;
      }
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as SearchResults;
      setResults({
        projects: data.projects ?? [],
        tasks: data.tasks ?? [],
        tickets: data.tickets ?? [],
        notes: data.notes ?? [],
        knowledge: data.knowledge ?? [],
        clients: data.clients ?? [],
      });
    } catch {
      setResults({ projects: [], tasks: [], tickets: [], notes: [], knowledge: [], clients: [] });
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (qParam.trim().length >= 2) runSearch();
    else setSearched(false);
  }, [qParam, runSearch]);

  const totalCount = useMemo(
    () =>
      results.projects.length +
      results.tasks.length +
      results.tickets.length +
      results.notes.length +
      results.knowledge.length +
      results.clients.length,
    [results]
  );

  return (
    <PageShell>
      <div className="space-y-6">
        <PageHeader
          title="Búsqueda global"
          description="Proyectos, tareas, tickets, notas, knowledge y clientes."
        />

        <form
          className="flex gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement)?.value?.trim() ?? "";
            if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
          }}
        >
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              name="q"
              placeholder="Buscar en proyectos, tareas, tickets, notas, knowledge, clientes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Buscar
          </button>
        </form>

        {searched && (
          <>
            {loading ? (
              <p className="text-sm text-slate-500 py-8">Buscando…</p>
            ) : query.trim().length < 2 ? (
              <p className="text-sm text-slate-500 py-4">Escribe al menos 2 caracteres.</p>
            ) : totalCount === 0 ? (
              <p className="text-sm text-slate-500 py-8">No se encontraron resultados.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {results.projects.length > 0 && (
                  <Section title="Proyectos" icon={<FolderOpen className="h-4 w-4" />}>
                    {results.projects.map((p) => (
                      <Link key={p.id} href={p.href} className="block rounded-lg border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition-colors">
                        <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                        {p.status && <p className="text-xs text-slate-500 mt-0.5">{p.status}</p>}
                      </Link>
                    ))}
                  </Section>
                )}
                {results.tasks.length > 0 && (
                  <Section title="Tareas" icon={<CheckSquare className="h-4 w-4" />}>
                    {results.tasks.map((t) => (
                      <Link key={t.id} href={t.href} className="block rounded-lg border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition-colors">
                        <p className="text-sm font-medium text-slate-900 truncate">{t.title}</p>
                        {t.project_name && <p className="text-xs text-slate-500 mt-0.5">{t.project_name}</p>}
                      </Link>
                    ))}
                  </Section>
                )}
                {results.tickets.length > 0 && (
                  <Section title="Tickets" icon={<Ticket className="h-4 w-4" />}>
                    {results.tickets.map((t) => (
                      <Link key={t.id} href={t.href} className="block rounded-lg border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition-colors">
                        <p className="text-sm font-medium text-slate-900 truncate">{t.title}</p>
                        {t.status && <p className="text-xs text-slate-500 mt-0.5">{t.status}</p>}
                      </Link>
                    ))}
                  </Section>
                )}
                {results.notes.length > 0 && (
                  <Section title="Notas" icon={<FileText className="h-4 w-4" />}>
                    {results.notes.map((n) => (
                      <Link key={n.id} href={n.href} className="block rounded-lg border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition-colors">
                        <p className="text-sm font-medium text-slate-900 truncate">{n.title}</p>
                      </Link>
                    ))}
                  </Section>
                )}
                {results.knowledge.length > 0 && (
                  <Section title="Knowledge" icon={<BookOpen className="h-4 w-4" />}>
                    {results.knowledge.map((k) => (
                      <Link key={k.id} href={k.href} className="block rounded-lg border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition-colors">
                        <p className="text-sm font-medium text-slate-900 truncate">{k.title}</p>
                        {k.space_name && <p className="text-xs text-slate-500 mt-0.5">{k.space_name}</p>}
                      </Link>
                    ))}
                  </Section>
                )}
                {results.clients.length > 0 && (
                  <Section title="Clientes" icon={<Building2 className="h-4 w-4" />}>
                    {results.clients.map((c) => (
                      <Link key={c.id} href={c.href} className="block rounded-lg border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition-colors">
                        <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                      </Link>
                    ))}
                  </Section>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
        {icon}
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
