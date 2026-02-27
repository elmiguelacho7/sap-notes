"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ProjectSummary = {
  id: string;
  name: string;
  status: string | null;
  created_at: string;
};

type NoteSummary = {
  id: string;
  title: string;
  client: string | null;
  module: string | null;
  created_at: string;
};

type DashboardStats = {
  totalProjects: number;
  openProjects: number;
  totalNotes: number;
  todayNotes: number;
};

type ChatMessage = {
  id: number;
  from: "user" | "bot";
  text: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    openProjects: 0,
    totalNotes: 0,
    todayNotes: 0,
  });

  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>([]);
  const [recentNotes, setRecentNotes] = useState<NoteSummary[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Carga de datos del dashboard
  const loadData = async () => {
    setLoadingStats(true);
    setErrorMsg(null);
    try {
      const [projResult, noteResult] = await Promise.all([
        supabase
          .from("projects")
          .select("id, name, status, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("notes")
          .select("id, title, client, module, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (projResult.error) throw projResult.error;
      if (noteResult.error) throw noteResult.error;

      const projects = (projResult.data || []) as ProjectSummary[];
      const notes = (noteResult.data || []) as NoteSummary[];

      const openProjects = projects.filter((p) => {
        if (!p.status) return true;
        const s = p.status.toLowerCase();
        return !s.includes("cerrado") && !s.includes("closed");
      });

      const hoy = new Date().toDateString();
      const todayNotes = notes.filter(
        (n) => new Date(n.created_at).toDateString() === hoy
      );

      setRecentProjects(projects.slice(0, 3));
      setRecentNotes(notes.slice(0, 3));
      setStats({
        totalProjects: projects.length,
        openProjects: openProjects.length,
        totalNotes: notes.length,
        todayNotes: todayNotes.length,
      });
    } catch (e) {
      console.error("Error cargando dashboard:", e);
      setErrorMsg("No se pudieron cargar los datos del dashboard.");
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Enviar mensaje al agente IA (n8n)
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: Date.now(),
      from: "user",
      text,
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/n8n", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();
      const botText: string =
        data?.reply ??
        "No he podido obtener una respuesta del agente en este momento.";

      const botMsg: ChatMessage = {
        id: Date.now() + 1,
        from: "bot",
        text: botText,
      };
      setChatMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error("Error llamando a n8n:", error);
      const botMsg: ChatMessage = {
        id: Date.now() + 1,
        from: "bot",
        text:
          "Ha ocurrido un error al contactar con el agente de IA. Inténtalo de nuevo en unos segundos.",
      };
      setChatMessages((prev) => [...prev, botMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-7 space-y-5">
      {/* HEADER */}
      <div>
        <p className="text-xs text-slate-500 mb-1">
          Resumen de tu trabajo en curso
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          Dashboard general
        </h1>
        <p className="text-sm text-slate-600 max-w-xl">
          Visión rápida de proyectos, notas y acceso directo al asistente de IA.
        </p>
      </div>

      {/* Error del dashboard */}
      {errorMsg && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <p className="text-red-600">{errorMsg}</p>
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              void loadData();
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Proyectos totales"
          value={
            loadingStats ? "…" : stats.totalProjects.toString() || "0"
          }
          subtitle="Todos los proyectos registrados."
        />
        <KpiCard
          title="Proyectos activos"
          value={
            loadingStats ? "…" : stats.openProjects.toString() || "0"
          }
          subtitle="En curso / no cerrados."
        />
        <KpiCard
          title="Notas totales"
          value={loadingStats ? "…" : stats.totalNotes.toString() || "0"}
          subtitle="Memoria funcional acumulada."
        />
        <KpiCard
          title="Notas de hoy"
          value={loadingStats ? "…" : stats.todayNotes.toString() || "0"}
          subtitle="Nuevas notas en la fecha actual."
        />
      </section>

      {/* GRID PRINCIPAL */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.4fr,1.6fr] gap-4">
        {/* Actividad reciente */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-800 mb-1">
              Última actividad
            </p>
            <p className="text-xs text-slate-500 mb-3">
              Proyectos y notas creadas más recientemente.
            </p>

            <div className="space-y-3 text-sm">
              {/* Proyectos */}
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-1">
                  Proyectos recientes
                </p>
                {loadingStats ? (
                  <p className="text-xs text-slate-400">
                    Cargando proyectos…
                  </p>
                ) : recentProjects.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Aún no hay proyectos registrados.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {recentProjects.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 hover:border-blue-500/60 hover:bg-blue-50/60 transition cursor-pointer"
                        onClick={() => router.push(`/projects/${p.id}`)}
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {p.name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {new Date(
                              p.created_at
                            ).toLocaleDateString("es-ES")}
                          </p>
                        </div>
                        {p.status && (
                          <span className="text-[10px] rounded-full bg-slate-900/5 px-2 py-0.5 text-slate-600">
                            {p.status}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Notas */}
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-1">
                  Notas recientes
                </p>
                {loadingStats ? (
                  <p className="text-xs text-slate-400">
                    Cargando notas…
                  </p>
                ) : recentNotes.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Aún no hay notas registradas.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {recentNotes.map((n) => (
                      <li
                        key={n.id}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 hover:border-blue-500/60 hover:bg-blue-50/60 transition cursor-pointer"
                        onClick={() => router.push(`/notes/${n.id}`)}
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {n.title}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {new Date(
                              n.created_at
                            ).toLocaleDateString("es-ES")}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          {n.client && (
                            <span className="text-[10px] rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                              {n.client}
                            </span>
                          )}
                          {n.module && (
                            <span className="text-[10px] rounded-full bg-slate-900/5 px-2 py-0.5 text-slate-600">
                              {n.module}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Asistente IA */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-slate-800">
                Asistente de implementación
              </p>
              <p className="text-xs text-slate-500">
                Chat conectado a n8n para ayudarte con errores, configuraciones
                y procesos SAP.
              </p>
            </div>
            <span
              className={`inline-flex h-2 w-2 rounded-full ${
                chatLoading ? "bg-amber-400" : "bg-emerald-400"
              }`}
            />
          </div>

          <div className="flex-1 flex flex-col min-h-[260px]">
            <div className="flex-1 overflow-y-auto pr-1 mb-3 space-y-2 text-xs">
              {chatMessages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-slate-500 text-[11px]">
                  Indica el proyecto, el error (por ejemplo CK701, NR751,
                  VK715…) o el proceso que quieres revisar y el asistente te
                  propondrá posibles causas y pasos.
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`max-w-[90%] rounded-xl px-3 py-2 ${
                      msg.from === "user"
                        ? "ml-auto bg-blue-600 text-white"
                        : "mr-auto bg-slate-100 text-slate-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={handleSendMessage}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Escribe tu mensaje para la IA…"
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="text-xs px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {chatLoading ? "Enviando…" : "Enviar"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm flex flex-col justify-between">
      <p className="text-[11px] text-slate-500 mb-1">{title}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-400 mt-1">{subtitle}</p>
    </div>
  );
}