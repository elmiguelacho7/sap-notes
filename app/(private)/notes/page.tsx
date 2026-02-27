"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";

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
// CHAT WIDGET N8N
// ======================

const N8N_WEBHOOK_URL = "/api/n8n";

type ChatMessage = {
  id: number;
  from: "user" | "bot";
  text: string;
};

export default function NotesPage() {
  const router = useRouter();

  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ==========================
  // CARGAR NOTAS GENERALES
  // ==========================
  useEffect(() => {
    const fetchNotes = async () => {
      setLoadingNotes(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .is("project_id", null) // Solo notas NO vinculadas a proyecto
        .order("created_at", { ascending: false });

      if (error) {
        handleSupabaseError("notes", error);
        setErrorMsg("No se pudieron cargar las notas.");
        setNotes([]);
      } else {
        setNotes((data ?? []) as Note[]);
      }

      setLoadingNotes(false);
    };

    fetchNotes();
  }, []);

  const hasNotes = useMemo(() => notes.length > 0, [notes]);

  // ==========================
  // ENVIAR MENSAJE AL CHAT N8N
  // ==========================
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput.trim();
    setChatInput("");

    const newUserMessage: ChatMessage = {
      id: Date.now(),
      from: "user",
      text: userText,
    };

    setChatMessages((prev) => [...prev, newUserMessage]);
    setSending(true);

    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          // Para el chat general no pasamos projectId
          scope: "global-notes",
        }),
      });

      if (!res.ok) {
        throw new Error("Error en la llamada a n8n");
      }

      const data = await res.json();
      const botText: string =
        data?.reply ||
        data?.answer ||
        "No he recibido una respuesta válida del asistente.";

      const newBotMessage: ChatMessage = {
        id: Date.now() + 1,
        from: "bot",
        text: botText,
      };

      setChatMessages((prev) => [...prev, newBotMessage]);
    } catch (error) {
      handleSupabaseError("notes chat n8n", error);
      const errorBotMessage: ChatMessage = {
        id: Date.now() + 2,
        from: "bot",
        text: "Ha ocurrido un error al contactar con el asistente de IA.",
      };
      setChatMessages((prev) => [...prev, errorBotMessage]);
    } finally {
      setSending(false);
    }
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
    <div className="w-full px-6 py-6">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        {/* COLUMNA IZQUIERDA: NOTAS */}
        <div className="flex-1 min-w-0">
          {/* HEADER */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Notas generales
              </h1>
              <p className="mt-1 text-sm text-slate-600 max-w-xl">
                Base de conocimiento global. Aquí se registran notas que
                no pertenecen a un proyecto concreto: errores recurrentes,
                configuraciones estándar, decisiones funcionales, etc.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/notes/new")}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
            >
              <span className="text-base leading-none">＋</span>
              Nueva nota general
            </button>
          </div>

          {/* CARD LISTADO */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-5">
            {errorMsg && (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {errorMsg}
              </div>
            )}

            {loadingNotes ? (
              <div className="space-y-3">
                <div className="h-4 w-40 rounded bg-slate-100 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-20 rounded-xl bg-slate-50 animate-pulse" />
                  <div className="h-20 rounded-xl bg-slate-50 animate-pulse" />
                  <div className="h-20 rounded-xl bg-slate-50 animate-pulse" />
                </div>
              </div>
            ) : !hasNotes ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-slate-500">
                <p className="font-medium text-slate-700 mb-1">
                  Todavía no hay notas generales.
                </p>
                <p className="max-w-sm">
                  Crea tu primera nota para documentar un error típico,
                  una configuración estándar o una decisión funcional
                  que quieras reutilizar en futuros proyectos.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <article
                    key={note.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3.5 hover:border-blue-200 hover:bg-blue-50/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {/* TÍTULO */}
                        <h2 className="text-sm font-semibold text-slate-900 truncate">
                          {note.title}
                        </h2>

                        {/* CHIPS SUPERIORES */}
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                          {note.note_type && (
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-100">
                              {note.note_type}
                            </span>
                          )}
                          {note.system_type && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 border border-slate-200">
                              {note.system_type}
                            </span>
                          )}
                          {note.client && (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 border border-emerald-100">
                              Cliente: {note.client}
                            </span>
                          )}
                          {note.module && (
                            <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700 border border-violet-100">
                              {note.module}
                            </span>
                          )}
                          {note.scope_item && (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 border border-amber-100">
                              {note.scope_item}
                            </span>
                          )}
                          {note.transaction && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 border border-slate-200">
                              Tx/App: {note.transaction}
                            </span>
                          )}
                          {note.error_code && (
                            <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-100">
                              Error: {note.error_code}
                            </span>
                          )}
                        </div>

                        {/* TEXTO / EXTRA INFO */}
                        {(note.body || note.extra_info) && (
                          <p className="mt-2 text-xs text-slate-700">
                            {snippet(note.body || note.extra_info)}
                          </p>
                        )}

                        {/* ENLACES */}
                        {(note.web_link_1 || note.web_link_2) && (
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                            {note.web_link_1 && (
                              <a
                                href={note.web_link_1}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:border-blue-300 hover:text-blue-700"
                              >
                                <span>Enlace 1</span>
                                <span className="text-[13px]">↗</span>
                              </a>
                            )}
                            {note.web_link_2 && (
                              <a
                                href={note.web_link_2}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:border-blue-300 hover:text-blue-700"
                              >
                                <span>Enlace 2</span>
                                <span className="text-[13px]">↗</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      {/* FECHA */}
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[11px] text-slate-500 whitespace-nowrap">
                          {formatDate(note.created_at)}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: CHAT IA GLOBAL */}
        <aside className="w-full xl:w-80 xl:sticky xl:top-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col h-[420px]">
            <h2 className="text-sm font-semibold text-slate-900">
              Asistente de IA · Global
            </h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Usa este asistente para buscar patrones, resumir errores
              recurrentes o pedir sugerencias sobre cómo estructurar tus
              notas y procesos.
            </p>

            <div className="mt-3 flex-1 overflow-y-auto rounded-xl bg-slate-50/60 border border-slate-100 px-3 py-2.5 space-y-2 text-xs">
              {chatMessages.length === 0 ? (
                <p className="text-[11px] text-slate-400">
                  Inicia la conversación preguntando, por ejemplo:
                  <br />
                  <span className="italic">
                    “¿Cómo puedo clasificar mejor mis notas de errores
                    KI100, CK701 y M7064?”
                  </span>
                </p>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.from === "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-1.5 ${
                        msg.from === "user"
                          ? "bg-blue-600 text-white rounded-br-sm"
                          : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm"
                      } text-[11px]`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendMessage} className="mt-3 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Escribe tu pregunta..."
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={sending || !chatInput.trim()}
                className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sending ? "..." : "Enviar"}
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}