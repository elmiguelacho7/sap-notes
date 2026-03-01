"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";

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
  role: "user" | "assistant";
  content: string;
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
  const [chatError, setChatError] = useState<string | null>(null);

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

      let projects: ProjectSummary[] = [];
      let notes: NoteSummary[] = [];

      if (projResult.error) {
        handleSupabaseError("dashboard projects", projResult.error);
        setErrorMsg("No se pudieron cargar los datos del dashboard.");
      } else {
        projects = (projResult.data ?? []) as ProjectSummary[];
      }

      if (noteResult.error) {
        handleSupabaseError("dashboard notes", noteResult.error);
        setErrorMsg("No se pudieron cargar los datos del dashboard.");
      } else {
        notes = (noteResult.data ?? []) as NoteSummary[];
      }

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
      handleSupabaseError("dashboard loadData", e);
      setErrorMsg("No se pudieron cargar los datos del dashboard.");
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Enviar mensaje al agente IA (/api/project-agent, modo global sin projectId)
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const userMessageContent = chatInput.trim();
    if (!userMessageContent || chatLoading) return;

    setChatMessages((prev) => [...prev, { role: "user", content: userMessageContent }]);
    setChatInput("");
    setChatError(null);
    setChatLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId: string | null = user?.id ?? null;

      const res = await fetch("/api/project-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessageContent,
          userId,
        }),
      });

      if (!res.ok) {
        let errMessage =
          "No se pudo obtener respuesta de la IA. Inténtalo de nuevo.";
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) errMessage = data.error;
        } catch {
          // use default errMessage
        }
        setChatError(errMessage);
        setChatLoading(false);
        return;
      }

      const data = (await res.json()) as { reply?: string };
      const replyText =
        typeof data?.reply === "string"
          ? data.reply
          : "No he podido obtener una respuesta del asistente ahora mismo.";
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: replyText },
      ]);
    } catch (err) {
      console.error("Dashboard project-agent request failed", err);
      setChatError(
        "No se pudo obtener respuesta de la IA. Inténtalo de nuevo."
      );
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-8">
        {/* Header */}
        <div>
          <p className="text-xs text-slate-500 mb-1">
            Resumen de tu trabajo en curso
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            Dashboard general
          </h1>
          <p className="text-sm text-slate-600/90 max-w-xl mt-1">
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
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Resumen general - KPIs */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Resumen general
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              accent
            />
          </div>
        </section>

        {/* Grid principal: Última actividad + Asistente */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna izquierda (2/3) - Última actividad */}
          <div className="lg:col-span-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold text-slate-900">
                Última actividad
              </h2>
              <p className="text-xs text-slate-500/90">
                Proyectos y notas creadas más recientemente.
              </p>

              <div className="space-y-4">
                {/* Proyectos recientes */}
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">
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
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {recentProjects.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer"
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
                            <StatusPill status={p.status} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notas recientes */}
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">
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
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {recentNotes.map((n) => (
                        <div
                          key={n.id}
                          className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer"
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
                              <span className="text-[10px] rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">
                                {n.client}
                              </span>
                            )}
                            {n.module && (
                              <span className="text-[10px] rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                                {n.module}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Columna derecha (1/3) - Asistente de implementación */}
          <div>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 flex flex-col border-t-4 border-t-indigo-500">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Asistente de implementación
                  </h2>
                  <p className="text-xs text-slate-500/90 mt-0.5">
                    Chat del asistente para ayudarte con errores, configuraciones
                    y procesos SAP.
                  </p>
                </div>
                <span
                  className={`inline-flex h-2 w-2 rounded-full shrink-0 ${
                    chatLoading ? "bg-amber-400" : "bg-emerald-400"
                  }`}
                />
              </div>

              <div className="flex flex-col min-h-[200px]">
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 text-xs">
                  {chatMessages.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-slate-500 text-[11px]">
                      Indica el proyecto, el error (por ejemplo CK701, NR751,
                      VK715…) o el proceso que quieres revisar y el asistente te
                      propondrá posibles causas y pasos.
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`max-w-[90%] rounded-xl px-3 py-2 ${
                          msg.role === "user"
                            ? "ml-auto bg-indigo-600 text-white"
                            : "mr-auto bg-slate-100 text-slate-800"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ))
                  )}
                </div>

                {chatError && (
                  <p className="text-[11px] text-red-600 mt-2">{chatError}</p>
                )}

                <form
                  onSubmit={handleSendMessage}
                  className="flex items-center gap-2 mt-3"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Escribe tu mensaje para la IA…"
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="text-sm font-medium px-4 py-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                  >
                    {chatLoading ? "Enviando…" : "Enviar"}
                  </button>
                </form>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const isActive =
    !s.includes("cerrado") && !s.includes("closed") && !s.includes("finalizado");
  return (
    <span
      className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${
        isActive
          ? "bg-indigo-50 text-indigo-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  accent,
}: {
  title: string;
  value: string;
  subtitle: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm flex flex-col justify-between transition-shadow hover:shadow">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
        {title}
      </p>
      <p
        className={`text-2xl font-bold ${
          accent ? "text-emerald-600" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      <p className="text-[11px] text-slate-400 mt-1">{subtitle}</p>
    </div>
  );
}