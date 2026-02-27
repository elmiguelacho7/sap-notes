"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError, hasLoggableSupabaseError } from "@/lib/supabaseError";

// ==========================
// Tipos
// ==========================

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
  description: string | null;
  module_id: string | null;
  module_code: string | null;
  module_name: string | null;
  scope_items: string[];
  error_code: string | null;
  error_type: string | null;
  priority: string | null;
  status: string | null;
  created_at: string;
};

type ModuleOption = {
  id: string;
  code: string;
  name: string;
};

type ScopeItem = {
  id: string;
  code: string;
  name: string;
  module_id: string | null;
};

type ProjectLink = {
  id: string;
  project_id: string;
  label: string;
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

// ==========================
// Página
// ==========================

export default function ProjectDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = (params?.id ?? "") as string;

  const [project, setProject] = useState<Project | null>(null);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [modulesOptions, setModulesOptions] = useState<ModuleOption[]>([]);
  const [scopeItems, setScopeItems] = useState<ScopeItem[]>([]);
  const [links, setLinks] = useState<ProjectLink[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Formulario: nota rápida
  const [quickTitle, setQuickTitle] = useState("");
  const [quickDescription, setQuickDescription] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [selectedScopeItemIds, setSelectedScopeItemIds] = useState<string[]>(
    []
  );
  const [errorCode, setErrorCode] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [creatingNote, setCreatingNote] = useState(false);

  // Formulario: enlaces del proyecto
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkType, setNewLinkType] = useState("");
  const [creatingLink, setCreatingLink] = useState(false);

  // Asistente IA
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatCounter, setChatCounter] = useState(1);

  // ==========================
  // Carga inicial (robusta)
  // ==========================

  useEffect(() => {
    if (!projectId) return;

    const loadData = async () => {
      setLoading(true);
      setErrorMsg(null);

      // 1️⃣ Proyecto
      const {
        data: projectData,
        error: projectError,
      } = await supabase
        .from("projects")
        .select("id, name, description, status, created_at")
        .eq("id", projectId)
        .single();

      if (projectError) {
        handleSupabaseError("projects", projectError);
        setErrorMsg("Part of the project data could not be loaded. Please try again later.");
        setProject(null);
      } else {
        setProject(projectData as Project);
      }

      // 2️⃣ Notas / módulos / scope items en paralelo (fallbacks seguros)
      const [
        { data: notesData, error: notesError },
        { data: modulesData, error: modulesError },
        { data: scopeData, error: scopeError },
      ] = await Promise.all([
        supabase
          .from("notes_with_modules_and_scopeitems")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("modules")
          .select("id, code, name")
          .order("code", { ascending: true }),
        supabase
          .from("scope_items")
          .select("id, code, name, module_id")
          .order("code", { ascending: true }),
      ]);

      if (notesError && hasLoggableSupabaseError(notesError)) handleSupabaseError("notes_with_modules_and_scopeitems", notesError);
      if (modulesError && hasLoggableSupabaseError(modulesError)) handleSupabaseError("modules", modulesError);
      if (scopeError && hasLoggableSupabaseError(scopeError)) handleSupabaseError("scope_items", scopeError);

      setNotes((notesData ?? []) as ProjectNote[]);
      setModulesOptions((modulesData ?? []) as ModuleOption[]);
      setScopeItems((scopeData ?? []) as ScopeItem[]);

      if (notesError || modulesError || scopeError) {
        setErrorMsg("Part of the project data could not be loaded. Please try again later.");
      }

      // 3️⃣ Enlaces del proyecto
      const {
        data: linksData,
        error: linksError,
      } = await supabase
        .from("project_links")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (linksError && hasLoggableSupabaseError(linksError)) {
        handleSupabaseError("project_links", linksError);
      }
      if (linksError) {
        setLinks([]);
        setErrorMsg("Part of the project data could not be loaded. Please try again later.");
      } else {
        setLinks((linksData ?? []) as ProjectLink[]);
      }

      setLoading(false);
    };

    loadData();
  }, [projectId]);

  // ==========================
  // KPIs
  // ==========================

  const totalNotes = notes.length;

  const notesWithError = useMemo(
    () => notes.filter((n) => n.error_code || n.error_type),
    [notes]
  );

  const totalModulesImpacted = useMemo(() => {
    const setMod = new Set(
      notes
        .map((n) => n.module_code)
        .filter((x): x is string => !!x && x.trim() !== "")
    );
    return setMod.size;
  }, [notes]);

  const lastNoteDateLabel = useMemo(() => {
    if (!notes.length) return "Sin notas todavía.";
    const last = new Date(notes[0].created_at);
    return last.toLocaleString("es-ES");
  }, [notes]);

  // ==========================
  // Handlers: nota rápida
  // ==========================

  const handleToggleScopeItem = (id: string) => {
    setSelectedScopeItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreateQuickNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || !projectId) return;

    setCreatingNote(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("notes")
      .insert({
        project_id: projectId,
        title: quickTitle.trim(),
        description: quickDescription.trim() || null,
        module_id: selectedModuleId || null,
        error_code: errorCode.trim() || null,
        priority,
        status: "open",
      })
      .select("*")
      .single();

    if (error) {
      handleSupabaseError("notes insert", error);
      setErrorMsg("No se pudo crear la nota rápida.");
      setCreatingNote(false);
      return;
    }

    const noteId = data.id as string;

    if (selectedScopeItemIds.length > 0) {
      const rows = selectedScopeItemIds.map((scopeId) => ({
        note_id: noteId,
        scope_item_id: scopeId,
      }));

      const { error: scopeLinkError } = await supabase
        .from("note_scope_items")
        .insert(rows);

      if (scopeLinkError) {
        handleSupabaseError("note_scope_items insert", scopeLinkError);
        setErrorMsg("No se pudo crear la nota rápida.");
        setCreatingNote(false);
        return;
      }
    }

    const { data: newNoteData, error: fetchNoteError } = await supabase
      .from("notes_with_modules_and_scopeitems")
      .select("*")
      .eq("id", noteId)
      .single();

    if (!fetchNoteError && newNoteData) {
      setNotes((prev) => [newNoteData as ProjectNote, ...prev]);
    }

    setQuickTitle("");
    setQuickDescription("");
    setSelectedModuleId("");
    setSelectedScopeItemIds([]);
    setErrorCode("");
    setPriority("medium");
    setCreatingNote(false);
  };

  // ==========================
  // Handlers: enlaces del proyecto
  // ==========================

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkLabel.trim() || !newLinkUrl.trim() || !projectId) return;

    setCreatingLink(true);

    const { data, error } = await supabase
      .from("project_links")
      .insert({
        project_id: projectId,
        label: newLinkLabel.trim(),
        url: newLinkUrl.trim(),
        link_type: newLinkType || null,
      })
      .select("*")
      .single();

    if (error) {
      handleSupabaseError("project_links insert", error);
      setErrorMsg("No se pudo crear el enlace del proyecto.");
    } else if (data) {
      setLinks((prev) => [data as ProjectLink, ...prev]);
      setNewLinkLabel("");
      setNewLinkUrl("");
      setNewLinkType("");
    }

    setCreatingLink(false);
  };

  // ==========================
  // Asistente IA (n8n)
  // ==========================

  const handleSendToAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !projectId) return;

    const msgId = chatCounter;
    setChatCounter((c) => c + 1);

    const userMessage: ChatMessage = {
      id: msgId,
      from: "user",
      text: chatInput.trim(),
      createdAt: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setChatLoading(true);
    setChatError(null);

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          question: userMessage.text,
        }),
      });

      if (!response.ok) {
        throw new Error("Error llamando al asistente de IA.");
      }

      const data = await response.json();
      const botText: string =
        (data?.answer as string) ?? "No he podido obtener una respuesta.";

      const botMessage: ChatMessage = {
        id: msgId + 100000,
        from: "bot",
        text: botText,
        createdAt: new Date().toISOString(),
      };

      setChatMessages((prev) => [...prev, botMessage]);
    } catch (e) {
      handleSupabaseError("project dashboard n8n", e);
      setChatError(
        "No se pudo contactar con el asistente de IA. Revisa la configuración de n8n."
      );
    } finally {
      setChatLoading(false);
    }
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
        {/* Lado izquierdo */}
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
            Dashboard centralizado con notas, documentación e IA del proyecto.
          </p>
        </div>

        {/* Lado derecho */}
        {project && (
          <div className="flex flex-col items-end gap-2">
            {project.status && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700">
                Estado: {project.status}
              </span>
            )}

            <p className="text-[11px] text-slate-400">
              Creado el{" "}
              {new Date(project.created_at).toLocaleDateString("es-ES")}
            </p>

            {/* Botón hacia el tablero Kanban del proyecto */}
            <button
              onClick={() => router.push(`/projects/${projectId}/tasks`)}
              className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-slate-50 shadow-sm hover:bg-slate-800"
            >
              Abrir tablero de actividades
            </button>
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
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <KpiCard
            title="Notas del proyecto"
            value={String(totalNotes)}
            subtitle="Incluye configuraciones, errores y decisiones."
          />
          <KpiCard
            title="Notas con error / incidencia"
            value={String(notesWithError.length)}
            subtitle="Basado en notas con código de error informado."
          />
          <KpiCard
            title="Módulos impactados"
            value={String(totalModulesImpacted)}
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
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Columna izquierda: nota rápida + notas */}
          <div className="lg:col-span-2 space-y-4">
            {/* Nota rápida */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Crear nota rápida del proyecto
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Registra decisiones, errores o configuraciones sin salir de
                    este dashboard.
                  </p>
                </div>

                <button
                  onClick={() =>
                    router.push(`/projects/${projectId}/notes/new`)
                  }
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                >
                  Ir a notas avanzadas
                </button>
              </div>

              <form
                onSubmit={handleCreateQuickNote}
                className="px-4 py-4 space-y-3"
              >
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Título de la nota *
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-0"
                    placeholder="Ej. Error KI100 en imputación de centros"
                    value={quickTitle}
                    onChange={(e) => setQuickTitle(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Descripción (opcional)
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-0"
                    rows={3}
                    placeholder="Resumen del error, decisiones tomadas, etc."
                    value={quickDescription}
                    onChange={(e) => setQuickDescription(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Módulo SAP
                    </label>
                    <select
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-0 bg-white"
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
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Código de error (opcional)
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-0"
                      placeholder="Ej: K100, M7064…"
                      value={errorCode}
                      onChange={(e) => setErrorCode(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Prioridad
                    </label>
                    <select
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-0 bg-white"
                      value={priority}
                      onChange={(e) =>
                        setPriority(e.target.value as "low" | "medium" | "high")
                      }
                    >
                      <option value="high">Alta</option>
                      <option value="medium">Media</option>
                      <option value="low">Baja</option>
                    </select>
                  </div>
                </div>

                {/* Scope items */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">
                    Scope items (multi-selección)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    {scopeItems.length === 0 && (
                      <p className="text-[11px] text-slate-500">
                        No hay scope items definidos en la BD.
                      </p>
                    )}

                    {scopeItems
                      .filter(
                        (s) =>
                          !selectedModuleId || s.module_id === selectedModuleId
                      )
                      .map((s) => {
                        const checked = selectedScopeItemIds.includes(s.id);
                        return (
                          <label
                            key={s.id}
                            className="inline-flex items-center gap-2 text-[11px] text-slate-700"
                          >
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-slate-700 focus:ring-slate-500"
                              checked={checked}
                              onChange={() => handleToggleScopeItem(s.id)}
                            />
                            <span>
                              <span className="font-medium">{s.code}</span> —{" "}
                              {s.name}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={creatingNote}
                    className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 shadow-sm hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {creatingNote ? "Creando nota…" : "Guardar nota rápida"}
                  </button>
                </div>
              </form>
            </section>

            {/* Últimas notas */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Últimas notas del proyecto
                </h2>
                <p className="text-[11px] text-slate-500">
                  Vista rápida de notas recientes asociadas a este proyecto.
                </p>
              </div>

              <div className="divide-y divide-slate-100">
                {notes.length === 0 && (
                  <div className="px-4 py-4 text-sm text-slate-500">
                    Aún no hay notas registradas para este proyecto.
                  </div>
                )}

                {notes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => router.push(`/notes/${note.id}`)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900 line-clamp-1">
                        {note.title}
                      </p>
                      <span className="text-[11px] text-slate-400">
                        {new Date(note.created_at).toLocaleDateString("es-ES")}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2">
                      {note.description ||
                        "Nota sin descripción. Haz clic para ver el detalle."}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {note.module_code && (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                          {note.module_code} · {note.module_name}
                        </span>
                      )}

                      {note.error_code && (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                          Error: {note.error_code}
                        </span>
                      )}

                      {note.scope_items && note.scope_items.length > 0 && (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                          {note.scope_items.length} scope items
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* Columna derecha: enlaces + asistente IA */}
          <div className="space-y-4">
            {/* Enlaces del proyecto */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Enlaces rápidos del proyecto
                </h2>
                <p className="text-[11px] text-slate-500">
                  Documentación, JIRA, carpetas compartidas u otros recursos
                  clave.
                </p>
              </div>

              <div className="px-4 py-3 space-y-3">
                <form className="space-y-2" onSubmit={handleCreateLink}>
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-slate-400 focus:ring-0"
                      placeholder="Etiqueta del enlace (ej. JIRA, SharePoint, SAP Note, etc.)"
                      value={newLinkLabel}
                      onChange={(e) => setNewLinkLabel(e.target.value)}
                    />
                    <input
                      type="url"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-slate-400 focus:ring-0"
                      placeholder="https://… (Drive, SharePoint, SAP Note, etc.)"
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-slate-400 focus:ring-0"
                      placeholder="Tipo (ej. Documentación, Error, Procesos…)"
                      value={newLinkType}
                      onChange={(e) => setNewLinkType(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={creatingLink}
                      className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-slate-50 shadow-sm hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {creatingLink ? "Guardando…" : "Guardar"}
                    </button>
                  </div>
                </form>

                <div className="pt-2 space-y-2 max-h-52 overflow-y-auto">
                  {links.length === 0 && (
                    <p className="text-[11px] text-slate-500">
                      Aún no hay enlaces definidos para este proyecto.
                    </p>
                  )}

                  {links.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50"
                    >
                      <p className="font-medium text-slate-800">
                        {link.label}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {link.url}
                      </p>
                      {link.link_type && (
                        <p className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                          {link.link_type}
                        </p>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            </section>

            {/* Asistente IA */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col h-full max-h-[480px]">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Asistente de implementación
                </h2>
                <p className="text-[11px] text-slate-500">
                  Chat conectado a n8n para ayudarte con errores,
                  configuraciones y procesos SAP.
                </p>
              </div>

              <div className="flex-1 flex flex-col px-4 py-3 gap-3 overflow-hidden">
                <div className="flex-1 overflow-y-auto space-y-2 border border-slate-100 rounded-lg bg-slate-50 px-3 py-2">
                  {chatMessages.length === 0 && (
                    <p className="text-[11px] text-slate-500">
                      Indica el proyecto, el error (por ejemplo CK701, NR751,
                      VK715…), o el proceso que quieres revisar y el asistente
                      propondrá posibles causas y pasos.
                    </p>
                  )}

                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.from === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-[11px] ${
                          msg.from === "user"
                            ? "bg-slate-900 text-slate-50 rounded-br-sm"
                            : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm"
                        }`}
                      >
                        <p className="whitespace-pre-line">{msg.text}</p>
                        <p className="mt-1 text-[9px] opacity-60">
                          {new Date(msg.createdAt).toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {chatError && (
                  <p className="text-[11px] text-red-600">{chatError}</p>
                )}

                <form
                  onSubmit={handleSendToAssistant}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-slate-400 focus:ring-0"
                    placeholder="Escribe tu mensaje para la IA…"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={chatLoading}
                    className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-slate-50 shadow-sm hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {chatLoading ? "Enviando..." : "Enviar"}
                  </button>
                </form>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================
// KPI Card auxiliar
// ==========================

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