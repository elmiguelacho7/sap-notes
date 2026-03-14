"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { RowActions } from "@/components/RowActions";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { ContentSkeleton } from "@/components/skeletons/ContentSkeleton";

type Note = {
  id: string;
  title: string;
  body: string | null;

  // Contexto
  note_type: string | null;
  system_type: string | null;

  client: string | null;
  client_id: string | null;

  module: string | null;
  module_id: string | null;

  scope_item: string | null;
  scope_item_id: string | null;

  transaction: string | null;
  error_code: string | null;

  web_link_1: string | null;
  web_link_2: string | null;
  extra_info: string | null;

  project_id: string | null;
  created_at: string;
};

export default function NotesPage() {
  const router = useRouter();

  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [manageGlobalNotes, setManageGlobalNotes] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ==========================
  // CARGAR NOTAS GLOBALES (vía API con JWT para que RLS se aplique en servidor)
  // ==========================
  const fetchNotes = useCallback(async () => {
    setLoadingNotes(true);
    setErrorMsg(null);
    setNotes([]); // Clear stale state before loading so consultant never sees previous user's notes

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const sessionUserId = session?.user?.id ?? null;
    if (process.env.NODE_ENV === "development") {
      console.debug("[notes] fetchNotes: before /api/notes", { sessionUserId });
    }
    if (!token) {
      setErrorMsg("Debes iniciar sesión para ver las notas.");
      setLoadingNotes(false);
      return;
    }

    try {
      const res = await fetch("/api/notes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (process.env.NODE_ENV === "development") {
        console.debug("[notes] fetchNotes: after response", { status: res.status });
      }
      if (!res.ok) {
        if (res.status === 401) {
          setErrorMsg("Sesión expirada. Inicia sesión de nuevo.");
        } else {
          setErrorMsg("No se pudieron cargar las notas.");
        }
        setLoadingNotes(false);
        return;
      }
      const data = (await res.json()) as Note[];
      const payloadLength = Array.isArray(data) ? data.length : 0;
      if (process.env.NODE_ENV === "development") {
        console.debug("[notes] fetchNotes: after JSON parse", { payloadLength });
      }
      setNotes(data);
      if (process.env.NODE_ENV === "development") {
        console.debug("[notes] fetchNotes: setNotes called with length", payloadLength);
      }
    } catch {
      handleSupabaseError("notes", new Error("Network error"));
      setErrorMsg("No se pudieron cargar las notas.");
      setNotes([]);
      setLoadingNotes(false);
      return;
    }
    setLoadingNotes(false);
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Permission for global notes edit/delete/create (manage_global_notes)
  useEffect(() => {
    let cancelled = false;
    async function loadMe() {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      if (cancelled) return;
      const data = await res.json().catch(() => ({ permissions: { manageGlobalNotes: false } }));
      const perms = (data as { permissions?: { manageGlobalNotes?: boolean } }).permissions;
      setManageGlobalNotes(perms?.manageGlobalNotes ?? false);
    }
    loadMe();
    return () => { cancelled = true; };
  }, []);

  const hasNotes = useMemo(() => notes.length > 0, [notes]);

  if (process.env.NODE_ENV === "development") {
    console.debug("[notes] render: notes state length =", notes.length);
  }

  // ==========================
  // HELPERS UI
  // ==========================
  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const snippet = (text: string | null, max = 160) => {
    if (!text) return "";
    if (text.length <= max) return text;
    return text.slice(0, max).trimEnd() + "…";
  };

  // ==========================
  // RENDER
  // ==========================
  return (
    <PageShell>
      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-8">
        <div className="flex-1 min-w-0 space-y-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Notas globales</h1>
              <p className="mt-1 text-sm text-slate-600 max-w-2xl">
                Conocimiento transversal curado: patrones SAP reutilizables, incidencias recurrentes, estándares de configuración y decisiones entre proyectos.
              </p>
              <p className="mt-0.5 text-xs text-slate-500 max-w-2xl">
                Solo usuarios con permiso de notas globales pueden ver y crear notas globales.
              </p>
            </div>
            <div className="shrink-0">
              {manageGlobalNotes && (
                <Button onClick={() => router.push("/notes/new")}>Nueva nota global</Button>
              )}
            </div>
          </div>

          <section>
            <h2 className="text-sm font-semibold text-slate-800 mb-1">Listado de notas</h2>
            <p className="text-xs text-slate-500 mb-4">Ordenadas por fecha de creación.</p>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-5">
            {errorMsg && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {errorMsg}
              </div>
            )}

            {loadingNotes ? (
              <ContentSkeleton title lines={2} cards={4} />
            ) : !hasNotes ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm font-medium text-slate-700">Todavía no hay notas globales</p>
                <p className="mt-1 text-sm text-slate-500 max-w-sm">
                  {manageGlobalNotes
                    ? "Crea tu primera nota global para documentar un patrón SAP, una incidencia recurrente, un estándar de configuración o una decisión que quieras reutilizar en otros proyectos."
                    : "Las notas globales solo son visibles para usuarios con permiso. Crea o consulta notas dentro de un proyecto desde la pestaña Notas del proyecto."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {notes.map((note) => (
                  <article
                    key={note.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base font-semibold text-slate-900 truncate">
                          {note.title}
                        </h2>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                          {note.note_type && (
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700 border border-blue-100">
                              {note.note_type}
                            </span>
                          )}
                          {note.system_type && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 border border-slate-200">
                              {note.system_type}
                            </span>
                          )}
                          {note.client && (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 border border-emerald-100">
                              {note.client}
                            </span>
                          )}
                          {note.module && (
                            <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-violet-700 border border-violet-100">
                              {note.module}
                            </span>
                          )}
                          {note.error_code && (
                            <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700 border border-rose-100">
                              {note.error_code}
                            </span>
                          )}
                          {note.transaction && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 border border-slate-200">
                              {note.transaction}
                            </span>
                          )}
                          {note.scope_item && (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 border border-amber-100">
                              {note.scope_item}
                            </span>
                          )}
                          <span className="text-slate-500 whitespace-nowrap">
                            {formatDate(note.created_at)}
                          </span>
                        </div>
                        {(note.body || note.extra_info) && (
                          <p className="mt-3 text-sm text-slate-600 line-clamp-2">
                            {snippet(note.body || note.extra_info)}
                          </p>
                        )}
                        {(note.web_link_1 || note.web_link_2) && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {note.web_link_1 && (
                              <a
                                href={note.web_link_1}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                              >
                                Enlace 1 <span className="opacity-70">↗</span>
                              </a>
                            )}
                            {note.web_link_2 && (
                              <a
                                href={note.web_link_2}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                              >
                                Enlace 2 <span className="opacity-70">↗</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <RowActions
                          entity="note"
                          id={note.id}
                          viewHref={`/notes/${note.id}`}
                          canEdit={manageGlobalNotes}
                          canDelete={manageGlobalNotes}
                          deleteEndpoint={manageGlobalNotes ? `/api/notes/${note.id}` : undefined}
                          onDeleted={fetchNotes}
                        />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
            </div>
          </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}