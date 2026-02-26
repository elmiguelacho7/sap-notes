"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  created_at: string;
};

type ProjectNote = {
  id: string;
  title: string;
  body: string | null;
  client: string | null;
  module: string | null;
  scope_item: string | null;
  error_code: string | null;
  created_at: string;
  project_id: string | null;
  web_link_1: string | null;
  web_link_2: string | null;
  extra_info: string | null;
};

type ModuleOption = {
  id: string;
  code: string;
  name: string;
};

type ScopeItemOption = {
  id: string;
  code: string;
  name: string;
  module_id: string | null;
};

type ProjectLink = {
  id: string;
  project_id: string;
  name: string;
  url: string;
  link_type: string | null;
  created_at: string;
};

type ChatMessage = {
  id: number;
  from: "user" | "bot";
  text: string;
  createdAt: string;
};

const N8N_WEBHOOK_URL = "/api/n8n";

export default function ProjectDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = (params?.id ?? "") as string;

  // ===== Proyecto / notas / enlaces =====
  const [project, setProject] = useState<Project | null>(null);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [projectLinks, setProjectLinks] = useState<ProjectLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ===== Formulario nota rápida =====
  const [quickTitle, setQuickTitle] = useState("");
  const [quickErrorCode, setQuickErrorCode] = useState("");
  const [quickBody, setQuickBody] = useState("");
  const [extraInfo, setExtraInfo] = useState("");
  const [webLink1, setWebLink1] = useState("");
  const [webLink2, setWebLink2] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Módulos + scope items
  const [modulesOptions, setModulesOptions] = useState<ModuleOption[]>([]);
  const [scopeItemsOptions, setScopeItemsOptions] = useState<ScopeItemOption[]>(
    []
  );
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [selectedScopeItemIds, setSelectedScopeItemIds] = useState<string[]>(
    []
  );

  // ===== Enlaces de proyecto =====
  const [newLinkName, setNewLinkName] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkType, setNewLinkType] = useState("Drive");
  const [savingLink, setSavingLink] = useState(false);

  // ===== Chat IA =====
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const chatStorageKey = useMemo(
    () => (projectId ? `project_chat_${projectId}` : "project_chat"),
    [projectId]
  );

  // ==========================
  // Carga proyecto / notas / enlaces
  // ==========================
  useEffect(() => {
    if (!projectId) return;

    const loadData = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        // Proyecto
        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select("id, name, description, status, created_at")
          .eq("id", projectId)
          .single();

        if (projectError) {
          console.error(projectError);
          setErrorMsg("No se ha podido cargar la información del proyecto.");
          setLoading(false);
          return;
        }

        setProject(projectData as Project);

        // Notas
        const { data: notesData, error: notesError } = await supabase
          .from("notes")
          .select(
            "id, title, body, client, module, scope_item, error_code, created_at, project_id, web_link_1, web_link_2, extra_info"
          )
          .eq("project_id", projectId)
          .order("created_at", { ascending: false });

        if (notesError) {
          console.error(notesError);
          setErrorMsg("No se ha podido cargar las notas del proyecto.");
          setLoading(false);
          return;
        }

        setNotes((notesData as ProjectNote[]) || []);

        // Enlaces del proyecto
        const { data: linksData, error: linksError } = await supabase
          .from("project_links")
          .select("id, project_id, name, url, link_type, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false });

        if (linksError) {
          console.error(linksError);
        } else {
          setProjectLinks((linksData as ProjectLink[]) || []);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("Ha ocurrido un error al cargar el dashboard.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId]);

  // ==========================
  // Carga metadatos: módulos / scope items
  // ==========================
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const { data: modulesData, error: modulesError } = await supabase
          .from("modules")
          .select("id, code, name")
          .order("code", { ascending: true });

        if (modulesError) {
          console.error("Error módulos:", modulesError);
        } else {
          setModulesOptions(((modulesData as ModuleOption[]) || []) ?? []);
        }

        const { data: scopeData, error: scopeError } = await supabase
          .from("scope_items")
          .select("id, code, name, module_id")
          .order("code", { ascending: true });

        if (scopeError) {
          console.error("Error scope items:", scopeError);
        } else {
          setScopeItemsOptions(((scopeData as ScopeItemOption[]) || []) ?? []);
        }
      } catch (err) {
        console.error("Error metadata:", err);
      }
    };

    loadMetadata();
  }, []);

  // ==========================
  // KPIs
  // ==========================
  const { totalNotes, totalErrorNotes, modulesCount, lastNoteDateLabel } =
    useMemo(() => {
      if (!notes || notes.length === 0) {
        return {
          totalNotes: 0,
          totalErrorNotes: 0,
          modulesCount: 0,
          lastNoteDateLabel: "Sin notas todavía",
        };
      }

      const total = notes.length;
      const errorCount = notes.filter(
        (n) => n.error_code && n.error_code.trim() !== ""
      ).length;

      const modules = Array.from(
        new Set(
          notes
            .map((n) => (n.module ?? "").trim())
            .filter((m) => m && m.length > 0)
        )
      );
      const last = notes[0];
      const lastLabel = new Date(last.created_at).toLocaleString();

      return {
        totalNotes: total,
        totalErrorNotes: errorCount,
        modulesCount: modules.length,
        lastNoteDateLabel: lastLabel,
      };
    }, [notes]);

  // ==========================
  // Chat: sessionId + mensajes
  // ==========================
  useEffect(() => {
    if (typeof window === "undefined") return;

    let storedSession = window.localStorage.getItem(
      `${chatStorageKey}_sessionId`
    );
    if (!storedSession) {
      storedSession = `${projectId}-${Date.now()}`;
      window.localStorage.setItem(
        `${chatStorageKey}_sessionId`,
        storedSession
      );
    }
    setSessionId(storedSession);

    const storedChat = window.localStorage.getItem(chatStorageKey);
    if (storedChat) {
      try {
        const parsed: ChatMessage[] = JSON.parse(storedChat);
        setChatMessages(parsed);
      } catch {
        // ignoramos si está corrupto
      }
    }
  }, [chatStorageKey, projectId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(chatStorageKey, JSON.stringify(chatMessages));
  }, [chatMessages, chatStorageKey]);

  // ==========================
  // Scope items visibles
  // ==========================
  const visibleScopeItems = useMemo(() => {
    if (!selectedModuleId) return scopeItemsOptions;
    return scopeItemsOptions.filter((si) => si.module_id === selectedModuleId);
  }, [scopeItemsOptions, selectedModuleId]);

  // ==========================
  // Crear nota rápida
  // ==========================
  const handleCreateQuickNote = async () => {
    if (!projectId) return;
    if (!quickTitle.trim()) {
      alert("El título de la nota es obligatorio.");
      return;
    }

    const selectedModule = modulesOptions.find(
      (m) => m.id === selectedModuleId
    );
    const moduleText = selectedModule ? selectedModule.code : null;

    const selectedScopeItems = scopeItemsOptions.filter((s) =>
      selectedScopeItemIds.includes(s.id)
    );
    const scopeItemsText =
      selectedScopeItems.length > 0
        ? selectedScopeItems.map((s) => s.code).join(", ")
        : null;

    setSavingNote(true);
    try {
      const { data, error } = await supabase
        .from("notes")
        .insert({
          title: quickTitle.trim(),
          body: quickBody.trim() || null,
          client: null, // el cliente viene dado por el proyecto
          module: moduleText,
          scope_item: scopeItemsText,
          error_code: quickErrorCode.trim() || null,
          project_id: projectId,
          web_link_1: webLink1.trim() || null,
          web_link_2: webLink2.trim() || null,
          extra_info: extraInfo.trim() || null,
        })
        .select(
          "id, title, body, client, module, scope_item, error_code, created_at, project_id, web_link_1, web_link_2, extra_info"
        )
        .single();

      if (error) {
        console.error(error);
        alert("No se ha podido crear la nota. Revisa la consola.");
        return;
      }

      setNotes((prev) => [data as ProjectNote, ...(prev || [])]);

      // Reset formulario
      setQuickTitle("");
      setQuickBody("");
      setQuickErrorCode("");
      setSelectedModuleId("");
      setSelectedScopeItemIds([]);
      setWebLink1("");
      setWebLink2("");
      setExtraInfo("");
    } catch (err) {
      console.error(err);
      alert("Ha ocurrido un error al crear la nota.");
    } finally {
      setSavingNote(false);
    }
  };

  // ==========================
  // Crear enlace de proyecto
  // ==========================
  const handleAddProjectLink = async () => {
    if (!projectId) return;
    if (!newLinkName.trim() || !newLinkUrl.trim()) {
      alert("Nombre y URL del enlace son obligatorios.");
      return;
    }

    const urlValue = newLinkUrl.trim();
    if (!/^https?:\/\//i.test(urlValue)) {
      alert("La URL debería empezar por http:// o https://");
      return;
    }

    setSavingLink(true);
    try {
      const { data, error } = await supabase
        .from("project_links")
        .insert({
          project_id: projectId,
          name: newLinkName.trim(),
          url: urlValue,
          link_type: newLinkType || null,
        })
        .select("id, project_id, name, url, link_type, created_at")
        .single();

      if (error) {
        console.error(error);
        alert("No se ha podido crear el enlace. Revisa la consola.");
        return;
      }

      setProjectLinks((prev) => [data as ProjectLink, ...(prev || [])]);
      setNewLinkName("");
      setNewLinkUrl("");
      setNewLinkType("Drive");
    } catch (err) {
      console.error(err);
      alert("Ha ocurrido un error al crear el enlace.");
    } finally {
      setSavingLink(false);
    }
  };

  // ==========================
  // Enviar mensaje al asistente IA
  // ==========================
  const handleSendMessage = async () => {
    if (!chatInput.trim() || !sessionId || !projectId) return;

    const userMessage: ChatMessage = {
      id: Date.now(),
      from: "user",
      text: chatInput.trim(),
      createdAt: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setChatLoading(true);
    setChatError(null);

    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.text,
          projectId,
          sessionId,
        }),
      });

      if (!res.ok) {
        throw new Error(`Error HTTP ${res.status}`);
      }

      const data = await res.json();
      const botText: string =
        data.reply ||
        data.answer ||
        "No he recibido una respuesta clara desde el agente de IA.";

      const botMessage: ChatMessage = {
        id: Date.now() + 1,
        from: "bot",
        text: botText,
        createdAt: new Date().toISOString(),
      };

      setChatMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error(err);
      setChatError("No se ha podido obtener respuesta del asistente.");
    } finally {
      setChatLoading(false);
    }
  };

  const toggleScopeItemSelection = (id: string) => {
    setSelectedScopeItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // ==========================
  // Render
  // ==========================
  if (!projectId) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-sm text-slate-600">
          No se ha encontrado el identificador del proyecto.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <button
            onClick={() => router.push("/projects")}
            className="inline-flex items-center text-[11px] text-slate-500 hover:text-slate-700 mb-1"
          >
            ← Volver a proyectos
          </button>

          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
            {project?.name || "Proyecto sin nombre"}
          </h1>

          <p className="text-xs md:text-sm text-slate-500 max-w-2xl">
            Dashboard centralizado con notas, documentación e IA del
            proyecto.
          </p>
        </div>

        {project && (
          <div className="flex flex-col items-end gap-1">
            {project.status && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700">
                Estado: {project.status}
              </span>
            )}
            <p className="text-[11px] text-slate-400">
              Creado el{" "}
              {new Date(project.created_at).toLocaleDateString("es-ES")}
            </p>
          </div>
        )}
      </div>

      {/* Mensajes de estado */}
      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          Cargando información del proyecto…
        </div>
      )}

      {errorMsg && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* KPIs */}
      {!loading && !errorMsg && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <KpiCard
            title="Notas del proyecto"
            value={String(totalNotes)}
            subtitle="Incluye configuraciones, errores y decisiones."
          />
          <KpiCard
            title="Notas con error / incidencia"
            value={String(totalErrorNotes)}
            subtitle="Basado en notas con código de error informado."
          />
          <KpiCard
            title="Módulos impactados"
            value={String(modulesCount)}
            subtitle="Número de módulos SAP diferentes en las notas."
          />
          <KpiCard
            title="Última actualización"
            value={totalNotes > 0 ? "Reciente" : "—"}
            subtitle={lastNoteDateLabel}
          />
        </div>
      )}

      {/* Contenido principal */}
      {!loading && !errorMsg && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Columna izquierda: nota rápida + últimas notas */}
          <div className="lg:col-span-2 space-y-4">
            {/* Nota rápida */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Crear nota rápida del proyecto
                  </h2>
                  <p className="text-xs text-slate-500">
                    Registra decisiones, errores o configuraciones sin salir
                    de este dashboard.
                  </p>
                </div>
                <button
                  onClick={() => router.push("/notes/new")}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                >
                  Ir a notas avanzadas
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                {/* Columna izquierda del formulario */}
                <div className="space-y-2">
                  <label className="text-[11px] text-slate-600">
                    Título de la nota *
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-0"
                    value={quickTitle}
                    onChange={(e) => setQuickTitle(e.target.value)}
                    placeholder="Ej: Error KI100 en imputación de centros"
                  />

                  <label className="text-[11px] text-slate-600">
                    Módulo SAP
                  </label>
                  <select
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-0 bg-white"
                    value={selectedModuleId}
                    onChange={(e) => {
                      setSelectedModuleId(e.target.value);
                      setSelectedScopeItemIds([]);
                    }}
                  >
                    <option value="">
                      {modulesOptions.length === 0
                        ? "No hay módulos definidos en la BD"
                        : "Selecciona un módulo…"}
                    </option>
                    {modulesOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} — {m.name}
                      </option>
                    ))}
                  </select>

                  <label className="text-[11px] text-slate-600">
                    Enlace 1 (opcional)
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-0"
                    value={webLink1}
                    onChange={(e) => setWebLink1(e.target.value)}
                    placeholder="https://... (Drive, SharePoint, SAP Note, etc.)"
                  />

                  <label className="text-[11px] text-slate-600">
                    Enlace 2 (opcional)
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-0"
                    value={webLink2}
                    onChange={(e) => setWebLink2(e.target.value)}
                    placeholder="https://... (otro documento o referencia)"
                  />
                </div>

                {/* Columna derecha del formulario */}
                <div className="space-y-2">
                  <label className="text-[11px] text-slate-600">
                    Código de error (opcional)
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-0"
                    value={quickErrorCode}
                    onChange={(e) => setQuickErrorCode(e.target.value)}
                    placeholder="Ej: KI100, M7064..."
                  />

                  <label className="text-[11px] text-slate-600">
                    Scope items (multi-selección)
                  </label>
                  <div className="rounded-xl border border-slate-200 px-3 py-2 text-xs max-h-32 overflow-y-auto bg-slate-50/40">
                    {visibleScopeItems.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">
                        No hay scope items para el módulo seleccionado (o aún
                        no se han definido).
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {visibleScopeItems.map((si) => (
                          <label
                            key={si.id}
                            className="inline-flex items-center gap-2 text-[11px] text-slate-700"
                          >
                            <input
                              type="checkbox"
                              className="h-3 w-3 rounded border-slate-300 text-slate-900"
                              checked={selectedScopeItemIds.includes(si.id)}
                              onChange={() => toggleScopeItemSelection(si.id)}
                            />
                            <span>
                              <span className="font-medium">{si.code}</span>{" "}
                              — {si.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <label className="text-[11px] text-slate-600">
                    Descripción / solución (opcional)
                  </label>
                  <textarea
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-0 min-h-[72px]"
                    value={quickBody}
                    onChange={(e) => setQuickBody(e.target.value)}
                    placeholder="Escribe el análisis, causa raíz y solución aplicada…"
                  />

                  <label className="text-[11px] text-slate-600">
                    Información adicional (opcional)
                  </label>
                  <textarea
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-0 min-h-[60px]"
                    value={extraInfo}
                    onChange={(e) => setExtraInfo(e.target.value)}
                    placeholder="Ej: qué contiene cada enlace, referencia interna, responsables, etc."
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleCreateQuickNote}
                  disabled={savingNote}
                  className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {savingNote ? "Guardando..." : "Guardar nota"}
                </button>
              </div>
            </div>

            {/* Últimas notas */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Últimas notas del proyecto
                  </h2>
                  <p className="text-xs text-slate-500">
                    Vista rápida de las notas más recientes vinculadas a este
                    proyecto.
                  </p>
                </div>
                <button
                  onClick={() => router.push("/notes")}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                >
                  Ver todas las notas
                </button>
              </div>

              {notes.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Aún no hay notas asociadas a este proyecto. Crea la primera
                  nota usando el formulario de arriba.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {notes.slice(0, 6).map((note) => (
                    <li
                      key={note.id}
                      className="py-3 cursor-pointer hover:bg-slate-50/80 px-2 -mx-2 rounded-xl transition"
                      onClick={() => router.push(`/notes/${note.id}`)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-[13px] font-semibold text-slate-900">
                            {note.title || "Nota sin título"}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {note.module && (
                              <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">
                                Módulo: {note.module}
                              </span>
                            )}
                            {note.scope_item && (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                                Scope: {note.scope_item}
                              </span>
                            )}
                            {note.error_code && (
                              <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] text-red-700">
                                Error: {note.error_code}
                              </span>
                            )}
                            {note.web_link_1 && (
                              <a
                                href={note.web_link_1}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700 underline decoration-dotted"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Link 1
                              </a>
                            )}
                            {note.web_link_2 && (
                              <a
                                href={note.web_link_2}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700 underline decoration-dotted"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Link 2
                              </a>
                            )}
                          </div>
                          {note.body && (
                            <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                              {note.body}
                            </p>
                          )}
                          {note.extra_info && (
                            <p className="mt-1 text-[11px] text-slate-400 line-clamp-1 italic">
                              {note.extra_info}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400">
                            {new Date(note.created_at).toLocaleDateString(
                              "es-ES"
                            )}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Columna derecha: IA + enlaces + doc */}
          <div className="space-y-4">
            {/* Asistente IA */}
            <div className="rounded-2xl border border-slate-200 bg-slate-900 text-slate-50 p-4 md:p-5 shadow-sm flex flex-col h-[420px]">
              <p className="text-[11px] font-semibold text-slate-200 mb-1">
                Asistente IA del proyecto
              </p>
              <p className="text-xs text-slate-200/80 mb-3">
                Haz preguntas sobre este proyecto. La conversación se
                mantiene ligada mediante <code>projectId</code> y{" "}
                <code>sessionId</code>.
              </p>

              <div className="flex-1 overflow-y-auto rounded-xl bg-slate-950/30 border border-slate-700/60 p-3 space-y-2 text-[11px]">
                {chatMessages.length === 0 && (
                  <p className="text-slate-400 italic">
                    Aún no hay mensajes. Pregunta algo como: “Resume los
                    errores más frecuentes de este proyecto”.
                  </p>
                )}

                {chatMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[90%] rounded-xl px-3 py-2 ${
                      m.from === "user"
                        ? "ml-auto bg-emerald-500/80 text-slate-950"
                        : "mr-auto bg-slate-800 text-slate-50"
                    }`}
                  >
                    <p className="whitespace-pre-line">{m.text}</p>
                    <p className="mt-1 text-[9px] opacity-70 text-right">
                      {new Date(m.createdAt).toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                ))}
              </div>

              {chatError && (
                <p className="mt-2 text-[10px] text-red-300">{chatError}</p>
              )}

              <div className="mt-3 flex items-center gap-2">
                <input
                  className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-[11px] text-slate-50 outline-none focus:border-slate-300"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Escribe tu pregunta sobre este proyecto…"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={chatLoading || !chatInput.trim()}
                  className="inline-flex items-center rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-900 hover:bg-slate-200 disabled:opacity-60"
                >
                  {chatLoading ? "Enviando..." : "Enviar"}
                </button>
              </div>
            </div>

            {/* Enlaces del proyecto */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">
                Enlaces del proyecto
              </h2>
              <p className="text-xs text-slate-500 mb-3">
                Guarda aquí enlaces fijos como la carpeta de Drive, tablero
                de Jira, documentación en Confluence, etc.
              </p>

              {projectLinks.length === 0 ? (
                <p className="text-[11px] text-slate-400 mb-2">
                  Todavía no hay enlaces guardados para este proyecto.
                </p>
              ) : (
                <ul className="space-y-1.5 mb-3">
                  {projectLinks.map((link) => (
                    <li
                      key={link.id}
                      className="flex items-start justify-between gap-2 text-[11px]"
                    >
                      <div className="flex flex-col">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-slate-800 hover:text-slate-900 underline decoration-dotted"
                        >
                          {link.name}
                        </a>
                        <span className="text-[10px] text-slate-400">
                          {new Date(link.created_at).toLocaleDateString(
                            "es-ES"
                          )}
                        </span>
                      </div>
                      {link.link_type && (
                        <span className="ml-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                          {link.link_type}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-slate-100 pt-3 mt-2">
                <p className="text-[11px] text-slate-500 mb-2">
                  Añadir nuevo enlace
                </p>
                <div className="space-y-2">
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[11px] outline-none focus:border-slate-400 focus:ring-0"
                    value={newLinkName}
                    onChange={(e) => setNewLinkName(e.target.value)}
                    placeholder="Nombre del enlace (ej: Carpeta principal Drive)"
                  />
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[11px] outline-none focus:border-slate-400 focus:ring-0"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    placeholder="https://..."
                  />
                  <select
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[11px] outline-none focus:border-slate-400 focus:ring-0 bg-white"
                    value={newLinkType}
                    onChange={(e) => setNewLinkType(e.target.value)}
                  >
                    <option value="Drive">Drive</option>
                    <option value="SharePoint">SharePoint</option>
                    <option value="Jira">Jira</option>
                    <option value="Confluence">Confluence</option>
                    <option value="SAP">SAP</option>
                    <option value="Otro">Otro</option>
                  </select>

                  <div className="flex justify-end">
                    <button
                      onClick={handleAddProjectLink}
                      disabled={savingLink}
                      className="inline-flex items-center rounded-xl bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {savingLink ? "Guardando..." : "Guardar enlace"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Documentación (placeholder) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">
                Documentación del proyecto
              </h2>
              <p className="text-xs text-slate-500 mb-3">
                Aquí podrás centralizar enlaces a manuales, decisiones de
                diseño, actas y archivos relevantes del proyecto.
              </p>

              <ul className="space-y-1.5 text-[11px] text-slate-600">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Manuales funcionales (Drive, Confluence, etc.).
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  Decisiones de diseño y soluciones clave.
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Actas de reuniones y acuerdos con el cliente.
                </li>
              </ul>

              <p className="mt-3 text-[11px] text-slate-400 italic">
                (Más adelante podemos conectar esto con tablas específicas
                de actas, decisiones, etc.).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === KPI Card ===
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