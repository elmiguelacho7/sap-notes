"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";
import { RowActions } from "@/components/RowActions";

type ProjectNoteSummary = {
  id: string;
  title: string | null;
  module: string | null;
  scope_item: string | null;
  error_code: string | null;
  web_link_1: string | null;
  web_link_2: string | null;
  extra_info: string | null;
  created_at: string;
  is_knowledge_base?: boolean;
};

export default function ProjectNotesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params?.id ?? "";

  const [notes, setNotes] = useState<ProjectNoteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appRole, setAppRole] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadRole() {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      if (cancelled) return;
      const data = await res.json().catch(() => ({ appRole: null }));
      const role = (data as { appRole?: string | null }).appRole ?? null;
      setAppRole(role);
    }
    loadRole();
    return () => { cancelled = true; };
  }, []);

  const loadNotes = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/notes?limit=50`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg((data as { error?: string }).error ?? "Error al cargar las notas.");
        setNotes([]);
        return;
      }
      const list = (data as { notes?: ProjectNoteSummary[] }).notes ?? [];
      setNotes(list);
    } catch {
      setErrorMsg("Error de conexión.");
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const toggleKnowledge = async (note: ProjectNoteSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    if (togglingId) return;
    const next = !note.is_knowledge_base;
    setTogglingId(note.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ is_knowledge_base: next }),
      });
      if (!res.ok) return;
      setNotes((prev) =>
        prev.map((n) => (n.id === note.id ? { ...n, is_knowledge_base: next } : n))
      );
    } finally {
      setTogglingId(null);
    }
  };

  if (!projectId) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-slate-600">Identificador de proyecto no válido.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProjectPageHeader
        title="Notas del proyecto"
        subtitle="Notas y memoria funcional vinculadas a este proyecto."
        primaryActionLabel="Nueva nota"
        primaryActionHref={`/notes/new?projectId=${projectId}`}
      />

      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            Cargando notas…
          </div>
        ) : notes.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            No hay notas en este proyecto. Crea una desde el botón «Nueva nota».
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notes.map((note) => (
              <li
                key={note.id}
                className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-50/50 transition"
              >
                <div
                  className="min-w-0 flex-1 cursor-pointer"
                  onClick={() => router.push(`/notes/${note.id}`)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">
                      {note.title ?? "Sin título"}
                    </p>
                    <span className="text-xs text-slate-400">
                      {new Date(note.created_at).toLocaleString("es-ES")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {note.module && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                        {note.module}
                      </span>
                    )}
                    {note.scope_item && (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">
                        {note.scope_item}
                      </span>
                    )}
                    {note.error_code && (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] text-red-700">
                        Error {note.error_code}
                      </span>
                    )}
                  </div>
                  {note.extra_info != null && note.extra_info.trim() !== "" && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                      {note.extra_info}
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => toggleKnowledge(note, e)}
                    disabled={!!togglingId}
                    className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                    title={note.is_knowledge_base ? "Quitar de base de conocimiento" : "Añadir a base de conocimiento"}
                  >
                    {togglingId === note.id ? "…" : note.is_knowledge_base ? "Quitar de KB" : "Añadir a KB"}
                  </button>
                  <RowActions
                    entity="note"
                    id={note.id}
                    viewHref={`/notes/${note.id}`}
                    canEdit={appRole === "superadmin"}
                    canDelete={appRole === "superadmin"}
                    deleteEndpoint={appRole === "superadmin" ? `/api/notes/${note.id}` : undefined}
                    onDeleted={loadNotes}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
