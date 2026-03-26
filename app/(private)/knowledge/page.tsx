"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, MessageCircle, FolderOpen, ExternalLinkIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { AppPageShell } from "@/components/ui/layout/AppPageShell";
import { SapitoState } from "@/components/ui/SapitoState";
import type { KnowledgeExploreItem, KnowledgeExploreMetrics, KnowledgeItemType, KnowledgeScope } from "@/app/api/knowledge/explore/route";

const TYPE_LABELS: Record<KnowledgeItemType, string> = {
  note: "Note",
  document: "Document",
  governance: "Governance",
  sap_source: "SAP source",
};

/** Context badge: GLOBAL NOTE | PROJECT NOTE | DOCUMENT | SAP SOURCE */
function getContextBadge(item: KnowledgeExploreItem): { label: string; className: string } {
  if (item.type === "sap_source") return { label: "SAP source", className: "bg-amber-100 text-amber-700" };
  if (item.type === "note") {
    if (item.scope === "project") return { label: "Project note", className: "bg-blue-100 text-blue-600" };
    return { label: "Global note", className: "bg-purple-100 text-purple-600" };
  }
  if (item.type === "document" || item.type === "governance") return { label: "Document", className: "bg-slate-100 text-slate-600" };
  return { label: "Document", className: "bg-slate-100 text-slate-600" };
}

const SCOPE_OPTIONS: { value: KnowledgeScope | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "global", label: "Global" },
  { value: "project", label: "Project" },
  { value: "external", label: "External" },
];

const SORT_OPTIONS = [
  { value: "recent", label: "Most recent" },
  { value: "oldest", label: "Oldest first" },
  { value: "title", label: "Title A–Z" },
  { value: "type", label: "Type" },
] as const;
type SortValue = (typeof SORT_OPTIONS)[number]["value"];

const TYPE_OPTIONS: { value: KnowledgeItemType | ""; label: string }[] = [
  { value: "", label: "All types" },
  { value: "note", label: "Note" },
  { value: "document", label: "Document" },
  { value: "governance", label: "Governance" },
  { value: "sap_source", label: "SAP source" },
];

export default function KnowledgeExplorerPage() {
  const router = useRouter();
  const [data, setData] = useState<{ metrics: KnowledgeExploreMetrics; items: KnowledgeExploreItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<KnowledgeScope | "">("");
  const [typeFilter, setTypeFilter] = useState<KnowledgeItemType | "">("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortValue>("recent");

  const fetchExplore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError("Authentication required.");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/knowledge/explore", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setError(err?.error ?? "Failed to load knowledge.");
        setLoading(false);
        return;
      }
      const json = await res.json();
      setData({ metrics: json.metrics, items: json.items ?? [] });
    } catch {
      setError("Failed to load knowledge.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExplore();
  }, [fetchExplore]);

  const uniqueModules = useMemo(() => {
    if (!data?.items) return [];
    const set = new Set<string>();
    data.items.forEach((i) => {
      if (i.module?.trim()) set.add(i.module.trim());
    });
    return Array.from(set).sort();
  }, [data?.items]);

  const filteredAndSortedItems = useMemo(() => {
    if (!data?.items) return [];
    let list = data.items;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          (i.title ?? "").toLowerCase().includes(q) ||
          (i.summary ?? "").toLowerCase().includes(q) ||
          (i.module ?? "").toLowerCase().includes(q) ||
          (i.projectName ?? "").toLowerCase().includes(q)
      );
    }
    if (scopeFilter) {
      list = list.filter((i) => {
        const scope = i.scope ?? (i.type === "sap_source" ? "external" : i.type === "note" && i.projectId ? "project" : "global");
        return scope === scopeFilter;
      });
    }
    if (typeFilter) {
      list = list.filter((i) => i.type === typeFilter);
    }
    if (moduleFilter) {
      list = list.filter((i) => i.module === moduleFilter);
    }
    const sorted = [...list].sort((a, b) => {
      if (sortBy === "recent") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "title") return (a.title ?? "").localeCompare(b.title ?? "");
      return TYPE_LABELS[a.type].localeCompare(TYPE_LABELS[b.type]) || (a.title ?? "").localeCompare(b.title ?? "");
    });
    return sorted;
  }, [data?.items, searchQuery, scopeFilter, typeFilter, moduleFilter, sortBy]);

  const isExternal = (href: string) => href.startsWith("http") || href === "#";

  return (
    <AppPageShell>
      <div className="space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--rb-text-primary))]">
              Knowledge Explorer
            </h1>
            <p className="mt-1 text-sm text-[rgb(var(--rb-text-muted))] max-w-3xl">
              Explore platform knowledge across notes, governance, architecture, and SAP documentation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href="/knowledge/search"
              className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-transparent px-4 py-2.5 text-sm font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface))]/70 transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              Ask Sapito
            </Link>
            <Link
              href="/knowledge/documents"
              className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] px-4 py-2.5 text-sm font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface))]/80 transition-colors"
            >
              <FolderOpen className="h-4 w-4" />
              Spaces
            </Link>
          </div>
        </header>

      {error && (
        <div className="rounded-xl border border-red-200/90 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <section className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] overflow-hidden shadow-sm">
          <SapitoState
            variant="loading"
            title="Cargando conocimiento…"
            description="Un momento."
          />
        </section>
      ) : data ? (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-1">
            <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] p-4 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">Total notes</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[rgb(var(--rb-text-primary))]">{data.metrics.totalNotes}</p>
            </div>
            <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] p-4 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">Total knowledge documents</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[rgb(var(--rb-text-primary))]">{data.metrics.totalDocuments}</p>
            </div>
            <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] p-4 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">Governance decisions</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[rgb(var(--rb-text-primary))]">{data.metrics.governanceDecisions}</p>
            </div>
            <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] p-4 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">SAP sources</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[rgb(var(--rb-text-primary))]">{data.metrics.sapSources}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] p-3 shadow-sm">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[rgb(var(--rb-text-muted))]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en conocimiento…"
                className="w-full h-10 rounded-md border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/20 pl-9 pr-3 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
              />
            </div>
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value as KnowledgeScope | "")}
              className="h-10 rounded-md border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/20 px-3 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
            >
              {SCOPE_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  Scope: {opt.label}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as KnowledgeItemType | "")}
              className="h-10 rounded-md border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/20 px-3 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {uniqueModules.length > 0 && (
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="h-10 rounded-md border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/20 px-3 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
              >
                <option value="">All modules</option>
                {uniqueModules.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortValue)}
              className="h-10 rounded-md border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/20 px-3 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Grid of cards */}
          {data.items.length === 0 ? (
            <section className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] py-8 px-6 shadow-sm">
                <SapitoState
                  variant="empty"
                  title="Aún no hay conocimiento"
                  description="Añade notas globales, notas de proyecto, páginas de conocimiento o conecta fuentes SAP. Usa Sapito para buscar."
                />
                <div className="flex justify-center mt-4">
                  <Link
                    href="/knowledge/documents"
                    className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] px-4 py-2.5 text-sm font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface))]/80 transition-colors"
                  >
                    Crear espacios
                  </Link>
                </div>
            </section>
          ) : filteredAndSortedItems.length === 0 ? (
            <section className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] py-12 px-6 text-center shadow-sm">
              <p className="text-sm font-medium text-[rgb(var(--rb-text-primary))]">No hay resultados para los filtros</p>
              <p className="mt-1 text-xs text-[rgb(var(--rb-text-muted))]">Prueba cambiando búsqueda, ámbito, tipo o módulo.</p>
            </section>
          ) : (
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
              {filteredAndSortedItems.map((item) => (
                <CardLink
                  key={`${item.type}-${item.id}`}
                  item={item}
                  isExternal={isExternal(item.href)}
                  contextBadge={getContextBadge(item)}
                />
              ))}
            </section>
          )}
        </>
      ) : null}
      </div>
    </AppPageShell>
  );
}

function CardLink({
  item,
  isExternal,
  contextBadge,
}: {
  item: KnowledgeExploreItem;
  isExternal: boolean;
  contextBadge: { label: string; className: string };
}) {
  const router = useRouter();
  const sapitoHref = `/knowledge/search?context=${encodeURIComponent(item.type + ":" + item.id)}`;

  const content = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium tracking-wide ${contextBadge.className}`}
        >
          {contextBadge.label}
        </span>
        {item.module && (
          <span className="inline-flex items-center rounded-md bg-[rgb(var(--rb-surface-3))]/50 px-2 py-0.5 text-[10px] text-[rgb(var(--rb-text-muted))]">
            {item.module}
          </span>
        )}
      </div>
      <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-[rgb(var(--rb-text-primary))] line-clamp-2">
        {item.title || "Untitled"}
      </h3>
      {item.summary && (
        <p className="line-clamp-2 text-xs leading-relaxed text-[rgb(var(--rb-text-muted))]">
          {item.summary}
        </p>
      )}
      {item.projectName && (
        <p className="text-[11px] text-[rgb(var(--rb-text-muted))]">Project: <span className="text-[rgb(var(--rb-text-secondary))]">{item.projectName}</span></p>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-[rgb(var(--rb-text-muted))] tabular-nums">
          {new Date(item.createdAt).toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>
      {/* Quick actions */}
      <div className="pt-3 border-t border-[rgb(var(--rb-surface-border))]/60 flex flex-wrap items-center gap-2">
        {/*
          Keep actions light + consistent.
          (No behavior change; just class consolidation via repeated strings below.)
        */}
        {isExternal && item.href !== "#" ? (
          <a
            href={item.href}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/20 px-2.5 py-1.5 text-xs font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-3))]/30 transition-colors"
          >
            <ExternalLinkIcon className="h-3 w-3" /> Open
          </a>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); item.href !== "#" && router.push(item.href); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/20 px-2.5 py-1.5 text-xs font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-3))]/30 transition-colors"
          >
            Open
          </button>
        )}
        <Link
          href={sapitoHref}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/20 px-2.5 py-1.5 text-xs font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-3))]/30 transition-colors"
        >
          <MessageCircle className="h-3 w-3" /> Ask Sapito
        </Link>
      </div>
    </div>
  );

  if (isExternal && item.href !== "#") {
    return (
      <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-white shadow-sm hover:shadow-md hover:-translate-y-[2px] transition-all duration-150 p-4">
        {content}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => item.href !== "#" && router.push(item.href)}
      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && item.href !== "#") router.push(item.href); }}
      className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-white shadow-sm hover:shadow-md hover:-translate-y-[2px] transition-all duration-150 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-primary))]/30 cursor-pointer"
    >
      {content}
    </div>
  );
}
