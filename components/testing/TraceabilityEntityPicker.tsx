"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Search, X } from "lucide-react";
import type { TraceabilitySearchHit } from "@/lib/types/testing";

export type TraceabilityPickerKind = "task" | "ticket" | "page";

export type TraceabilitySelectionPreview = {
  title: string;
  subtitle?: string | null;
  meta?: string | null;
};

type Props = {
  projectId: string;
  kind: TraceabilityPickerKind;
  valueId: string;
  onChangeId: (id: string) => void;
  disabled?: boolean;
  emptyHint: string;
  /** Labels from GET script (traceability_linked) or last user pick. */
  resolvedPreview?: TraceabilitySelectionPreview | null;
};

const btnBase =
  "inline-flex w-full items-center justify-between gap-2 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2 text-left text-sm text-[rgb(var(--rb-text-primary))] transition-colors hover:border-[rgb(var(--rb-surface-border))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/30 disabled:cursor-not-allowed disabled:opacity-55";

export function TraceabilityEntityPicker({
  projectId,
  kind,
  valueId,
  onChangeId,
  disabled,
  emptyHint,
  resolvedPreview,
}: Props) {
  const t = useTranslations("testing.traceabilityPicker");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<TraceabilitySearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<TraceabilitySelectionPreview | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!valueId) setPicked(null);
  }, [valueId]);

  const display = picked ?? resolvedPreview ?? null;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  const runSearch = useCallback(
    async (query: string) => {
      if (!projectId) return;
      setLoading(true);
      try {
        const sp = new URLSearchParams({ kind, q: query });
        const res = await fetch(`/api/projects/${projectId}/testing/traceability-search?${sp}`, {
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as { hits?: TraceabilitySearchHit[] };
        setHits(Array.isArray(data.hits) ? data.hits : []);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    },
    [projectId, kind]
  );

  useEffect(() => {
    if (!open) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void runSearch(q.trim());
    }, 240);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open, q, runSearch]);

  useEffect(() => {
    if (open) {
      setQ("");
      void runSearch("");
    }
  }, [open, runSearch]);

  const selectHit = (h: TraceabilitySearchHit) => {
    setPicked({
      title: h.title,
      subtitle: h.subtitle,
      meta: h.meta,
    });
    onChangeId(h.id);
    setOpen(false);
    setQ("");
  };

  const clear = () => {
    setPicked(null);
    onChangeId("");
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      {!valueId ? (
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) setOpen((o) => !o);
          }}
          className={btnBase}
        >
          <span className="text-[rgb(var(--rb-text-muted))]">{emptyHint}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[rgb(var(--rb-text-muted))]" />
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-slate-100">
            <span className="max-w-[min(100%,14rem)] truncate font-medium text-slate-800">{display?.title ?? t("untitled")}</span>
            {display?.subtitle ? (
              <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                {display.subtitle}
              </span>
            ) : null}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clear();
                }}
                className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label={t("remove")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((o) => !o);
              }}
              className="text-xs font-medium text-[rgb(var(--rb-brand-primary-active))] hover:underline"
            >
              {t("change")}
            </button>
          )}
        </div>
      )}

      {open && !disabled && (
        <div
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg ring-1 ring-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-2 py-2">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
              autoFocus
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {loading ? (
              <li className="px-3 py-2 text-xs text-slate-500">{t("loading")}</li>
            ) : hits.length === 0 ? (
              <li className="px-3 py-2 text-xs text-slate-500">{t("noResults")}</li>
            ) : (
              hits.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => selectHit(h)}
                    className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900">{h.title}</span>
                    <span className="text-[11px] text-slate-500">
                      {[h.subtitle, h.meta].filter(Boolean).join(" · ") || h.id.slice(0, 8)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
