"use client";

import { useEffect, useMemo, useState, type FormEvent, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { RowActions } from "@/components/RowActions";
import { PageShell } from "@/components/layout/PageShell";
import { SapitoAvatar } from "@/components/ai/SapitoAvatar";
import { AssistantSuggestionChips } from "@/components/ai/AssistantSuggestionChips";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

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

// ======================
// CHAT — Sapito Brain v1 (project-agent with scope notes)
// ======================

const PROJECT_AGENT_URL = "/api/project-agent";

const NOTES_SUGGESTIONS = [
  "¿Qué errores se repiten?",
  "¿Qué módulos aparecen más?",
  "¿Qué transacciones se mencionan?",
  "¿Qué patrones ves en mis notas?",
];

type ChatMessage = {
  id: number;
  from: "user" | "bot";
  text: string;
};

export default function NotesPage() {
  const router = useRouter();

  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [appRole, setAppRole] = useState<string | null>(null);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);

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

  // Rol del usuario para acciones (View siempre; Edit/Delete solo superadmin)
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

  const hasNotes = useMemo(() => notes.length > 0, [notes]);

  if (process.env.NODE_ENV === "development") {
    console.debug("[notes] render: notes state length =", notes.length);
  }

  // ==========================
  // ENVIAR MENSAJE AL CHAT (Sapito project-agent, scope notes)
  // ==========================
  const sendMessage = async (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed || sending) return;

    setChatMessages((prev) => [
      ...prev,
      { id: Date.now(), from: "user", text: trimmed },
    ]);
    setChatInput("");
    setSending(true);

    try {
      const res = await fetch(PROJECT_AGENT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          scope: "notes",
        }),
      });

      const data = await res.json().catch(() => ({}));
      const botText: string = res.ok
        ? (data?.reply ?? "No he recibido una respuesta válida de Sapito.")
        : (data?.error ?? "Ha ocurrido un error al contactar con Sapito.");

      setChatMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, from: "bot", text: botText },
      ]);
    } catch (error) {
      handleSupabaseError("notes chat Sapito", error);
      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          from: "bot",
          text: "Ha ocurrido un error al contactar con Sapito.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    await sendMessage(chatInput);
  };

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
                Solo superadministradores pueden ver y crear notas globales.
              </p>
            </div>
            <div className="shrink-0">
              {appRole === "superadmin" && (
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
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-slate-700">Cargando notas…</p>
                <p className="mt-1 text-sm text-slate-500">Un momento.</p>
              </div>
            ) : !hasNotes ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm font-medium text-slate-700">Todavía no hay notas globales</p>
                <p className="mt-1 text-sm text-slate-500 max-w-sm">
                  {appRole === "superadmin"
                    ? "Crea tu primera nota global para documentar un patrón SAP, una incidencia recurrente, un estándar de configuración o una decisión que quieras reutilizar en otros proyectos."
                    : "Las notas globales solo son visibles para superadministradores. Crea o consulta notas dentro de un proyecto desde la pestaña Notas del proyecto."}
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
                          canEdit={appRole === "superadmin"}
                          canDelete={appRole === "superadmin"}
                          deleteEndpoint={appRole === "superadmin" ? `/api/notes/${note.id}` : undefined}
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

        {/* Intelligence panel — contextual companion */}
        <aside className="w-full xl:w-[320px] xl:min-w-[280px] xl:sticky xl:top-4 shrink-0">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-[400px]">
            <div className="shrink-0 px-5 py-4 border-b border-slate-200 bg-slate-50/80">
              <div className="flex items-start gap-3">
                <SapitoAvatar size="md" className="mt-0.5" />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-900">Sapito de notas</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Patrones, errores recurrentes y sugerencias derivadas de tus notas globales.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
              <div className="space-y-3 text-sm">
                {chatMessages.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-5 text-center">
                    <p className="text-sm font-medium text-slate-700">Pregúntame lo que necesites</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Patrones, módulos, errores recurrentes y transacciones. Elige una sugerencia o escribe.
                    </p>
                    <p className="mt-3 text-[11px] text-slate-500">Sugerencias:</p>
                    <div className="mt-2">
                      <AssistantSuggestionChips
                        suggestions={NOTES_SUGGESTIONS}
                        onSelect={sendMessage}
                        disabled={sending}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.from === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                            msg.from === "user"
                              ? "bg-indigo-600 text-white"
                              : "bg-white text-slate-800 border border-slate-200 shadow-sm"
                          } text-sm`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
            <form onSubmit={handleSendMessage} className="shrink-0 p-4 border-t border-slate-200 flex gap-2 bg-white">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Pregunta sobre patrones, errores o estructura de notas…"
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={sending || !chatInput.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
              >
                {sending ? "Enviando…" : "Enviar"}
              </button>
            </form>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}