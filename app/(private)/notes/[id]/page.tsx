"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { addToRecent } from "@/components/command-palette/recentStore";

type Note = {
  id: string;
  title: string;
  body: string | null;
  client: string | null;
  module: string | null;
  scope_item: string | null;
  error_code: string | null;
  web_link_1: string | null;
  web_link_2: string | null;
  extra_info: string | null;
  created_at: string;
  project_id: string | null;
};

export default function NoteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const noteId = params?.id as string;

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [canDeleteNote, setCanDeleteNote] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNote = async () => {
      try {
        const { data, error } = await supabase
          .from("notes")
          .select("*")
          .eq("id", noteId)
          .single();

        if (error) {
          handleSupabaseError("notes", error);
          setErrorMsg("No se pudo cargar la nota.");
          setNote(null);
        } else {
          setNote(data as Note);
          setErrorMsg(null);
        }
      } catch (err) {
        handleSupabaseError("notes fetch", err);
        setErrorMsg("Se ha producido un error inesperado.");
        setNote(null);
      } finally {
        setLoading(false);
      }
    };

    if (noteId) {
      void fetchNote();
    }
  }, [noteId]);

  useEffect(() => {
    if (note?.id && note?.title != null) {
      addToRecent({
        type: "note",
        id: note.id,
        title: note.title || "Sin título",
        href: `/notes/${note.id}`,
      });
    }
  }, [note?.id, note?.title]);

  useEffect(() => {
    let cancelled = false;
    async function loadPermissions() {
      if (!note) return;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (note.project_id) {
        const res = await fetch(`/api/projects/${note.project_id}/permissions`, { headers });
        if (cancelled) return;
        const data = await res.json().catch(() => ({}));
        const perms = data as { canDeleteProjectNotes?: boolean };
        setCanDeleteNote(perms.canDeleteProjectNotes ?? false);
      } else {
        const res = await fetch("/api/me", { headers });
        if (cancelled) return;
        const data = await res.json().catch(() => ({ permissions: { manageGlobalNotes: false } }));
        const perms = (data as { permissions?: { manageGlobalNotes?: boolean } }).permissions;
        setCanDeleteNote(perms?.manageGlobalNotes ?? false);
      }
    }
    loadPermissions();
    return () => { cancelled = true; };
  }, [note?.id, note?.project_id]);

  const handleDeleteConfirm = async () => {
    if (!canDeleteNote) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE", headers });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setDeleteError(data?.error ?? "No se pudo completar la acción.");
        return;
      }
      setDeleteOpen(false);
      router.push(note?.project_id ? `/projects/${note.project_id}/notes` : "/notes");
    } catch {
      setDeleteError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const backHref = note?.project_id ? `/projects/${note.project_id}/notes` : "/notes";
  const hasLinks = (note?.web_link_1 && note.web_link_1.trim() !== "") || (note?.web_link_2 && note?.web_link_2.trim() !== "");
  const hasExtraInfo = note?.extra_info != null && note.extra_info.trim() !== "";

  return (
    <div className="min-h-screen w-full min-w-0 rb-workspace-bg px-6 py-7 xl:px-8 2xl:px-10">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a notas
      </Link>

      {errorMsg && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-[rgb(var(--rb-brand-primary-active))] animate-spin" />
        </div>
      ) : !note ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white px-6 py-12 text-center text-sm text-slate-600 shadow-sm ring-1 ring-slate-100">
          No se encontró la nota.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {note.project_id && (
                  <span className="inline-flex items-center rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium text-indigo-300">
                    Nota de proyecto
                  </span>
                )}
              </div>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">
                {note.title}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Creada el {new Date(note.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
              </p>
            </div>
            {canDeleteNote && (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-300 hover:bg-rose-500/20 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            )}
          </header>

          {/* Metadata grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {note.client && (
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Cliente</p>
                <p className="mt-0.5 text-sm text-slate-200">{note.client}</p>
              </div>
            )}
            {note.module && (
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Módulo</p>
                <p className="mt-0.5 text-sm text-slate-200">{note.module}</p>
              </div>
            )}
            {note.scope_item && (
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Scope item / proceso</p>
                <p className="mt-0.5 text-sm text-slate-200">{note.scope_item}</p>
              </div>
            )}
            {note.error_code && (
              <div className="rounded-xl border border-amber-700/50 bg-amber-950/20 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600/90">Código de error</p>
                <p className="mt-0.5 text-sm font-medium text-amber-200">{note.error_code}</p>
              </div>
            )}
          </div>

          {/* Detalle */}
          <section className="rounded-2xl border border-slate-700/80 bg-slate-900/60 shadow-lg ring-1 ring-slate-700/30 overflow-hidden">
            <div className="border-b border-slate-700/60 px-5 py-3 bg-slate-800/40">
              <h2 className="text-sm font-semibold text-slate-300">Detalle</h2>
            </div>
            <div className="px-5 py-4">
              <p className="whitespace-pre-wrap text-sm text-slate-300 leading-relaxed">
                {note.body?.trim() ?? "Sin descripción."}
              </p>
            </div>
          </section>

          {/* Referencias */}
          {hasLinks && (
            <section className="rounded-2xl border border-slate-700/80 bg-slate-900/60 shadow-lg ring-1 ring-slate-700/30 overflow-hidden">
              <div className="border-b border-slate-700/60 px-5 py-3 bg-slate-800/40">
                <h2 className="text-sm font-semibold text-slate-300">Referencias</h2>
              </div>
              <div className="px-5 py-4 flex flex-wrap gap-3">
                {note.web_link_1?.trim() && (
                  <a
                    href={note.web_link_1}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600/80 bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-indigo-300 hover:bg-slate-700 hover:border-indigo-500/50 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Enlace 1
                  </a>
                )}
                {note.web_link_2?.trim() && (
                  <a
                    href={note.web_link_2}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600/80 bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-indigo-300 hover:bg-slate-700 hover:border-indigo-500/50 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Enlace 2
                  </a>
                )}
              </div>
            </section>
          )}

          {/* Información adicional */}
          {hasExtraInfo && (
            <section className="rounded-2xl border border-slate-700/80 bg-slate-900/60 shadow-lg ring-1 ring-slate-700/30 overflow-hidden">
              <div className="border-b border-slate-700/60 px-5 py-3 bg-slate-800/40">
                <h2 className="text-sm font-semibold text-slate-300">Información adicional</h2>
              </div>
              <div className="px-5 py-4">
                <p className="whitespace-pre-wrap text-sm text-slate-300 leading-relaxed">{note.extra_info}</p>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !deleteLoading && setDeleteOpen(false)}>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-800 p-6 shadow-xl ring-1 ring-slate-700/50 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100">Eliminar nota</h3>
            <p className="mt-2 text-sm text-slate-400">¿Seguro que quieres eliminar esta nota? Esta acción no se puede deshacer.</p>
            {deleteError && <p className="mt-3 text-sm text-rose-400 bg-rose-950/30 rounded-lg px-3 py-2">{deleteError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => !deleteLoading && setDeleteOpen(false)} disabled={deleteLoading} className="rounded-xl border border-slate-600 bg-slate-700 px-3 h-9 text-sm font-medium text-slate-200 hover:bg-slate-600 disabled:opacity-60">Cancelar</button>
              <button type="button" onClick={handleDeleteConfirm} disabled={deleteLoading} className="rounded-xl bg-rose-600 px-3 h-9 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60">{deleteLoading ? "Eliminando…" : "Eliminar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
