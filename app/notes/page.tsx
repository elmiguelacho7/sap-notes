"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

// Ajusta los campos a lo que tengas en tu vista/tabla de notas
type Note = {
  id: string;
  title: string;
  body: string | null;
  client: string | null;
  module: string | null;
  scope_item: string | null;
  error_code: string | null;
  project_id: string | null;
  project_name: string | null;
  project_client_name: string | null;
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
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterModule, setFilterModule] = useState<string>("all");

  // Chat n8n
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      from: "bot",
      text: "👋 Soy tu asistente SAP Notes. Pregúntame por un error, scope item o configuración y te ayudo a localizar notas relevantes.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // ======================
  // Cargar notas
  // ======================

  useEffect(() => {
    const loadNotes = async () => {
      setLoading(true);
      setErrorMsg(null);

      // Ajusta el nombre de la tabla / vista si lo necesitas
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("notes select error", error);
        setErrorMsg("No se pudieron cargar las notas.");
      } else if (data) {
        setNotes(data as Note[]);
      }

      setLoading(false);
    };

    void loadNotes();
  }, []);

  // ======================
  // Filtros / búsqueda
  // ======================

  const filteredNotes = useMemo(() => {
    const term = search.trim().toLowerCase();

    return notes.filter((n) => {
      const matchesModule =
        filterModule === "all" ||
        (n.module ?? "").toLowerCase() === filterModule.toLowerCase();

      if (!matchesModule) return false;

      if (!term) return true;

      const haystack = [
        n.title,
        n.body,
        n.client,
        n.module,
        n.scope_item,
        n.error_code,
        n.project_name,
        n.project_client_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [notes, search, filterModule]);

  const uniqueModules = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => {
      if (n.module) set.add(n.module);
    });
    return Array.from(set).sort();
  }, [notes]);

  const formatDate = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString();
  };

  // ======================
  // Chat: enviar mensaje
  // ======================

  const handleSendChat = async (e: FormEvent) => {
    e.preventDefault();
    setChatError(null);

    const text = chatInput.trim();
    if (!text) return;

    const nextId = chatMessages.length
      ? chatMessages[chatMessages.length - 1].id + 1
      : 1;

    // Añadir mensaje de usuario
    setChatMessages((prev) => [
      ...prev,
      { id: nextId, from: "user", text },
    ]);
    setChatInput("");
    setChatSending(true);

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // En n8n usas {{ $json.body.message }}, así que enviamos body.message
        body: JSON.stringify({
          body: {
            message: text,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}`);
      }

      const data = await response.json();

      const botText =
        data.reply ??
        data.response ??
        data.answer ??
        "He recibido tu mensaje, pero no he podido generar una respuesta más detallada.";

      const newId = nextId + 1;

      setChatMessages((prev) => [
        ...prev,
        {
          id: newId,
          from: "bot",
          text: String(botText),
        },
      ]);
    } catch (err) {
      console.error("Error enviando mensaje a n8n", err);
      setChatError(
        "No se ha podido contactar con el asistente. Inténtalo de nuevo en unos segundos."
      );
    } finally {
      setChatSending(false);
    }
  };

  // ======================
  // UI
  // ======================

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row">
        {/* Columna principal: notas */}
        <section className="flex-1 space-y-5">
          {/* Header */}
          <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-sky-400">
                SAP Notes Hub
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-50">
                Panel de notas
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Reúne incidencias, configuraciones y decisiones de tus
                proyectos SAP en un solo lugar.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/projects")}
              className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-500/80 hover:text-sky-100"
            >
              ← Volver a proyectos
            </button>
          </header>

          {/* Filtros / búsqueda */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 space-y-2 sm:space-y-0 sm:space-x-3 sm:flex sm:items-center">
              <div className="flex-1">
                <label
                  htmlFor="search"
                  className="mb-1 block text-[11px] font-medium text-slate-400"
                >
                  Buscar en tus notas
                </label>
                <input
                  id="search"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Error F5730, cliente Lecta, condición ZR01, etc."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <div className="w-full sm:w-48">
                <label
                  htmlFor="moduleFilter"
                  className="mb-1 block text-[11px] font-medium text-slate-400"
                >
                  Módulo
                </label>
                <select
                  id="moduleFilter"
                  value={filterModule}
                  onChange={(e) => setFilterModule(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="all">Todos</option>
                  {uniqueModules.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              {filteredNotes.length} nota
              {filteredNotes.length === 1 ? "" : "s"} encontradas
            </p>
          </div>

          {/* Estado de carga / error */}
          {loading && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-8 text-center text-sm text-slate-400">
              Cargando notas…
            </div>
          )}

          {!loading && errorMsg && (
            <div className="rounded-2xl border border-rose-500/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
              {errorMsg}
            </div>
          )}

          {/* Lista de notas */}
          {!loading && !errorMsg && (
            <>
              {filteredNotes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/60 px-6 py-10 text-center">
                  <p className="text-sm text-slate-200">
                    Aún no tienes notas registradas.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Crea una nota desde un proyecto o añade manualmente tus
                    incidencias clave para tener tu “memoria SAP”.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filteredNotes.map((note) => (
                    <article
                      key={note.id}
                      className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left shadow-sm transition hover:border-sky-500/60 hover:bg-slate-900"
                    >
                      <header className="mb-2">
                        <p className="text-[11px] text-slate-500">
                          {note.project_name || "Proyecto sin nombre"}
                        </p>
                        <h2 className="mt-0.5 text-sm font-semibold text-slate-50">
                          {note.title}
                        </h2>
                      </header>

                      <p className="mb-3 line-clamp-3 text-xs text-slate-400">
                        {note.body || "Sin descripción detallada."}
                      </p>

                      <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
                        {note.client && (
                          <span className="rounded-full bg-slate-800/80 px-2 py-1">
                            Cliente: {note.client}
                          </span>
                        )}
                        {note.module && (
                          <span className="rounded-full bg-slate-800/80 px-2 py-1">
                            Módulo: {note.module}
                          </span>
                        )}
                        {note.scope_item && (
                          <span className="rounded-full bg-slate-800/80 px-2 py-1">
                            Scope: {note.scope_item}
                          </span>
                        )}
                        {note.error_code && (
                          <span className="rounded-full bg-slate-800/80 px-2 py-1">
                            Error: {note.error_code}
                          </span>
                        )}
                      </div>

                      <footer className="mt-auto flex items-center justify-between text-[10px] text-slate-500">
                        <span>Creada: {formatDate(note.created_at)}</span>
                        {note.project_client_name && (
                          <span>{note.project_client_name}</span>
                        )}
                      </footer>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Columna lateral: asistente n8n */}
        <aside className="w-full max-w-md shrink-0 space-y-3 lg:w-80">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.7)]">
            <h2 className="text-sm font-semibold text-slate-50 mb-1">
              Asistente SAP Notes
            </h2>
            <p className="text-[11px] text-slate-400 mb-3">
              Conectado a n8n. Úsalo como copiloto: pregúntale por un mensaje
              de error, un scope item o una configuración y úsalo para navegar
              tus notas más rápido.
            </p>

            <div className="mb-3 max-h-64 space-y-1 overflow-y-auto rounded-xl bg-slate-950/80 p-2">
              {chatMessages.map((m) => (
                <div
                  key={m.id}
                  className={`mb-1 flex ${
                    m.from === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-[11px] ${
                      m.from === "user"
                        ? "bg-sky-600 text-white"
                        : "bg-slate-800 text-slate-100"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            {chatError && (
              <p className="mb-2 text-[11px] text-rose-400">{chatError}</p>
            )}

            <form
              onSubmit={handleSendChat}
              className="mt-2 flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ej: error F5730 intercompany clearing"
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
              <button
                type="submit"
                disabled={chatSending || !chatInput.trim()}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:bg-slate-600 disabled:cursor-not-allowed"
              >
                {chatSending ? "…" : "Enviar"}
              </button>
            </form>
          </div>
        </aside>
      </div>
    </main>
  );
}