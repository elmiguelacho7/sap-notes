"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Search, MessageCircle, FolderOpen, ExternalLinkIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { AppPageShell } from "@/components/ui/layout/AppPageShell";
import { SapitoState } from "@/components/ui/SapitoState";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";
import type { KnowledgeExploreItem, KnowledgeExploreMetrics, KnowledgeItemType, KnowledgeScope } from "@/app/api/knowledge/explore/route";

const TYPE_LABELS: Record<KnowledgeItemType, string> = {
  note: "Note",
  document: "Document",
  governance: "Governance",
  sap_source: "SAP source",
};

/** Context badge: GLOBAL NOTE | PROJECT NOTE | DOCUMENT | SAP SOURCE */
function getContextBadge(item: KnowledgeExploreItem): { label: string; className: string } {
  if (item.type === "sap_source") return { label: "SAP SOURCE", className: "bg-amber-500/20 text-amber-400 border border-amber-500/30" };
  if (item.type === "note") {
    if (item.scope === "project") return { label: "PROJECT NOTE", className: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" };
    return { label: "GLOBAL NOTE", className: "bg-slate-600/50 text-slate-400 border border-slate-500/40" };
  }
  if (item.type === "document" || item.type === "governance") return { label: "DOCUMENT", className: "bg-violet-500/20 text-violet-300 border border-violet-500/30" };
  return { label: "DOCUMENT", className: "bg-violet-500/20 text-violet-300 border border-violet-500/30" };
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
      <div className="space-y-8">
      <header className="space-y-1">
        <ProjectPageHeader
          variant="section"
          dark
          title="Knowledge Explorer"
          subtitle="Explore platform knowledge across notes, governance, architecture, and SAP documentation."
          secondaryActionSlot={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/knowledge/search"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-600/80 bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 hover:border-slate-500 transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                Ask Sapito
              </Link>
              <Link
                href="/knowledge/documents"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-600/80 bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 hover:border-slate-500 transition-colors"
              >
                <FolderOpen className="h-4 w-4" />
                Spaces
              </Link>
            </div>
          }
        />
      </header>

      {error && (
        <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden">
          <SapitoState
            variant="loading"
            title="Cargando conocimiento…"
            description="Un momento."
          />
        </section>
      ) : data ? (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 sm:p-5 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
              <p className="text-xs uppercase text-slate-400">Total notes</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">{data.metrics.totalNotes}</p>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 sm:p-5 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
              <p className="text-xs uppercase text-slate-400">Total knowledge documents</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">{data.metrics.totalDocuments}</p>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 sm:p-5 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
              <p className="text-xs uppercase text-slate-400">Governance decisions</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">{data.metrics.governanceDecisions}</p>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 sm:p-5 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
              <p className="text-xs uppercase text-slate-400">SAP sources</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">{data.metrics.sapSources}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
            <div className="relative flex-1 min-w-0 w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en conocimiento…"
                className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
              />
            </div>
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value as KnowledgeScope | "")}
              className="rounded-xl border border-slate-600/80 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
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
              className="rounded-xl border border-slate-600/80 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
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
                className="rounded-xl border border-slate-600/80 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
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
              className="rounded-xl border border-slate-600/80 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Grid of cards */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden">
            {data.items.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 py-8 px-6">
                <SapitoState
                  variant="empty"
                  title="Aún no hay conocimiento"
                  description="Añade notas globales, notas de proyecto, páginas de conocimiento o conecta fuentes SAP. Usa Sapito para buscar."
                />
                <div className="flex justify-center mt-4">
                  <Link
                    href="/knowledge/documents"
                    className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 transition-colors"
                  >
                    Crear espacios
                  </Link>
                </div>
              </div>
            ) : filteredAndSortedItems.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 py-12 px-6 text-center">
                <p className="text-sm font-medium text-slate-300">No hay resultados para los filtros</p>
                <p className="mt-1 text-xs text-slate-500">Prueba cambiando búsqueda, ámbito, tipo o módulo.</p>
              </div>
            ) : (
              <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAndSortedItems.map((item) => (
                  <CardLink
                    key={`${item.type}-${item.id}`}
                    item={item}
                    isExternal={isExternal(item.href)}
                    contextBadge={getContextBadge(item)}
                  />
                ))}
              </div>
            )}
          </section>
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
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide border ${contextBadge.className}`}>
          {contextBadge.label}
        </span>
        {item.module && (
          <span className="inline-flex items-center rounded-lg bg-indigo-500/20 px-2 py-0.5 text-[10px] text-indigo-300">
            {item.module}
          </span>
        )}
      </div>
      <h3 className="mt-2 font-medium text-slate-100 line-clamp-2">
        {item.title || "Untitled"}
      </h3>
      {item.summary && (
        <p className="mt-1.5 line-clamp-2 text-xs text-slate-400">
          {item.summary}
        </p>
      )}
      {item.projectName && (
        <p className="mt-1.5 text-[11px] text-slate-500">Project: {item.projectName}</p>
      )}
      <p className="mt-2 text-[11px] text-slate-500">
        {new Date(item.createdAt).toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      </p>
      {/* Quick actions */}
      <div className="mt-3 pt-3 border-t border-slate-700/60 flex flex-wrap items-center gap-2">
        {isExternal && item.href !== "#" ? (
          <a
            href={item.href}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-600/80 bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <ExternalLinkIcon className="h-3 w-3" /> Open
          </a>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); item.href !== "#" && router.push(item.href); }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-600/80 bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Open
          </button>
        )}
        <Link
          href={sapitoHref}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-600/80 bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
        >
          <MessageCircle className="h-3 w-3" /> Ask Sapito
        </Link>
      </div>
    </>
  );

  if (isExternal && item.href !== "#") {
    return (
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 sm:p-5 hover:border-slate-600 hover:bg-slate-800/60 transition-all duration-150 focus-within:ring-2 focus-within:ring-indigo-500/40">
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
      className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 sm:p-5 hover:border-slate-600 hover:bg-slate-800/60 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 cursor-pointer"
    >
      {content}
    </div>
  );
}
