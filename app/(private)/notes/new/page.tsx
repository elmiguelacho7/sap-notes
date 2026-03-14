"use client";

import { useEffect, useMemo, useState, useRef, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { getCountryDisplayName } from "@/lib/countryStateCity";

type Client = {
  id: string;
  name: string;
  display_name?: string | null;
  country: string | null;
};

type Module = {
  id: string;
  code: string;
  name: string;
};

type ScopeItem = {
  id: string;
  code: string;
  name: string;
  module_id: string | null;
  scope_type: string;
};

const NOTE_TYPES = [
  "Incidencia / Error",
  "Configuración",
  "Funcional",
  "Técnico",
  "Proceso",
  "Idea / Pendiente",
  "Otro",
];

const SYSTEM_TYPES = [
  "SAP ECC",
  "S/4HANA On-Premise",
  "S/4HANA Public Cloud",
  "S/4HANA Private Cloud",
  "BW / Analytics",
  "Otro sistema",
];

export default function NewNotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromQuick = searchParams?.get("from") === "quick";
  const projectIdFromQuery = searchParams?.get("projectId") ?? "";
  const isProjectMode = projectIdFromQuery.trim().length > 0;

  const [showCreandoBanner, setShowCreandoBanner] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (fromQuick) {
      setShowCreandoBanner(true);
      const t = setTimeout(() => setShowCreandoBanner(false), 2000);
      return () => clearTimeout(t);
    }
  }, [fromQuick]);

  useEffect(() => {
    if (fromQuick && titleInputRef.current) {
      const t = setTimeout(() => titleInputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [fromQuick]);

  useEffect(() => {
    if (fromQuick && projectIdFromQuery) {
      router.replace(`/notes/new?projectId=${projectIdFromQuery}`);
    }
  }, [fromQuick, projectIdFromQuery, router]);

  // Block global note creation for users without manage_global_notes: redirect when no projectId
  useEffect(() => {
    if (isProjectMode) return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      if (cancelled) return;
      const data = await res.json().catch(() => ({ permissions: { manageGlobalNotes: false } }));
      const perms = (data as { permissions?: { manageGlobalNotes?: boolean } }).permissions;
      if (!perms?.manageGlobalNotes) {
        router.replace("/notes");
      }
    })();
    return () => { cancelled = true; };
  }, [isProjectMode, router]);

  // Encabezado
  const [title, setTitle] = useState("");
  const [noteType, setNoteType] = useState<string>("Incidencia / Error");

  // Contexto SAP
  const [systemType, setSystemType] = useState<string>("");

  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<string>("");

  const [modules, setModules] = useState<Module[]>([]);
  const [scopeItems, setScopeItems] = useState<ScopeItem[]>([]);
  const [moduleId, setModuleId] = useState<string>("");
  const [scopeItemId, setScopeItemId] = useState<string>("");

  const [transactionCode, setTransactionCode] = useState("");
  const [errorCode, setErrorCode] = useState("");

  // Contenido
  const [body, setBody] = useState("");

  // Enlaces / contexto adicional
  const [webLink1, setWebLink1] = useState("");
  const [webLink2, setWebLink2] = useState("");
  const [extraInfo, setExtraInfo] = useState("");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ==========================
  // CARGA DE CLIENTES / MÓDULOS / SCOPE ITEMS
  // ==========================
  useEffect(() => {
    const loadData = async () => {
      setErrorMsg(null);
      const [{ data: clientData, error: clientError }, { data: moduleData, error: moduleError }, { data: scopeData, error: scopeError }] =
        await Promise.all([
          supabase
            .from("clients")
            .select("id, name, display_name, country")
            .order("name", { ascending: true }),
          supabase
            .from("modules")
            .select("id, code, name")
            .order("code", { ascending: true }),
          supabase
            .from("scope_items")
            .select("id, code, name, module_id, scope_type")
            .order("code", { ascending: true }),
        ]);

      if (clientError) {
        handleSupabaseError("clients", clientError);
        setClients([]);
        setErrorMsg("Part of the project data could not be loaded. Please try again later.");
      } else {
        setClients(clientData ?? []);
      }

      if (moduleError) {
        handleSupabaseError("modules", moduleError);
        setModules([]);
        setErrorMsg("Part of the project data could not be loaded. Please try again later.");
      } else {
        setModules(moduleData ?? []);
      }

      if (scopeError) {
        handleSupabaseError("scope_items", scopeError);
        setScopeItems([]);
        setErrorMsg("Part of the project data could not be loaded. Please try again later.");
      } else {
        setScopeItems((scopeData ?? []) as ScopeItem[]);
      }
    };

    loadData();
  }, []);

  const filteredScopeItems = useMemo(
    () =>
      scopeItems.filter((s) =>
        moduleId ? s.module_id === moduleId : true
      ),
    [scopeItems, moduleId]
  );

  // ==========================
  // GUARDAR NOTA
  // ==========================
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg("El título de la nota es obligatorio.");
      return;
    }

    setSaving(true);

    try {
      const selectedModule = modules.find((m) => m.id === moduleId) || null;
      const selectedScopeItem =
        scopeItems.find((s) => s.id === scopeItemId) || null;

      if (projectIdFromQuery.trim()) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`/api/projects/${projectIdFromQuery.trim()}/notes`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            title: title.trim(),
            body: body.trim() || null,
            module: selectedModule ? `${selectedModule.code} - ${selectedModule.name}` : null,
            scope_items: selectedScopeItem
              ? [`${selectedScopeItem.code} - ${selectedScopeItem.name}`]
              : [],
            error_code: errorCode.trim() || null,
            web_link_1: webLink1.trim() || null,
            web_link_2: webLink2.trim() || null,
            extra_info: extraInfo.trim() || null,
            is_knowledge_base: false,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorMsg((data as { error?: string; details?: string }).error ?? (data as { details?: string }).details ?? "No se pudo crear la nota.");
          setSaving(false);
          return;
        }
        router.push(`/projects/${projectIdFromQuery.trim()}/notes`);
        return;
      }

      const selectedClient = clients.find((c) => c.id === clientId) || null;
      const payload = {
        title: title.trim(),
        body: body.trim() || null,

        // Cliente
        client: selectedClient ? selectedClient.name : null,
        client_id: selectedClient ? selectedClient.id : null,

        // Módulo
        module: selectedModule
          ? `${selectedModule.code} - ${selectedModule.name}`
          : null,
        module_id: selectedModule ? selectedModule.id : null,

        // Scope item
        scope_item: selectedScopeItem
          ? `${selectedScopeItem.code} - ${selectedScopeItem.name}`
          : null,
        scope_item_id: selectedScopeItem ? selectedScopeItem.id : null,

        // Contexto SAP
        system_type: systemType || null,
        transaction: transactionCode.trim() || null,
        error_code: errorCode.trim() || null,
        note_type: noteType || null,

        // Enlaces / contexto
        web_link_1: webLink1.trim() || null,
        web_link_2: webLink2.trim() || null,
        extra_info: extraInfo.trim() || null,

        // Nota general: sin proyecto asociado; created_by para ownership (RLS)
        project_id: null,
        created_by: null, // set below from session
      };

      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) (payload as Record<string, unknown>).created_by = user.id;

      const { error } = await supabase.from("notes").insert([payload]);

      if (error) {
        handleSupabaseError("notes insert", error);
        setErrorMsg((error as { message?: string })?.message || "No se pudo crear la nota.");
        setSaving(false);
        return;
      }

      router.push("/notes");
    } catch (err) {
      handleSupabaseError("notes new submit", err);
      setErrorMsg("Se ha producido un error inesperado.");
      setSaving(false);
    }
  };

  // ==========================
  // RENDER (manteniendo estilo)
  // ==========================
  const isProject = isProjectMode && projectIdFromQuery.trim().length > 0;
  return (
    <div className="min-h-screen w-full min-w-0 bg-slate-950 px-6 py-10 xl:px-8 2xl:px-10">
      <div className="w-full max-w-2xl mx-auto">
        {showCreandoBanner && (
          <div className="mb-4 rounded-xl border border-slate-600/60 bg-slate-800/50 px-3 py-2 text-xs text-slate-400 transition-opacity duration-300">
            Creando...
          </div>
        )}
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">
              Nueva nota
            </h1>
            {isProject && (
              <span className="inline-flex items-center rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium text-indigo-300">
                Nota de proyecto
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 max-w-xl">
            {isProject
              ? "Crea una nota asociada al proyecto actual. Se guardará en la pestaña Notas del proyecto."
              : "Nota global: conocimiento transversal reutilizable (patrones SAP, incidencias recurrentes, estándares de configuración, decisiones entre proyectos). No ligada a un proyecto concreto."}
          </p>
        </header>

        <div className="mt-8 rounded-2xl border border-slate-700/80 bg-slate-800/60 shadow-xl shadow-black/10 ring-1 ring-slate-700/30 p-6 md:p-8">
          {errorMsg && (
            <div className="mb-6 rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-0">
            {/* Section 1 — Información principal */}
            <section className="space-y-4 pb-6 border-b border-slate-600/50">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Información principal
              </h2>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Título <span className="text-red-400">*</span>
                </label>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ejemplo: Error KI100 al contabilizar en ES25"
                  className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Descripción / detalle
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  placeholder="Describe el problema, el análisis (causa raíz) y la solución aplicada, incluyendo transacciones, customizing, condiciones, etc."
                  className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-y min-h-[100px]"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Documenta aquí problemas, decisiones, soluciones y contexto útil del proyecto.
                </p>
                {isProject && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    Las notas bien documentadas refuerzan el conocimiento del proyecto.
                  </p>
                )}
              </div>
            </section>

            {/* Section 2 — Clasificación SAP */}
            <section className="space-y-4 py-6 border-b border-slate-600/50">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Clasificación SAP
              </h2>
              {!isProjectMode && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Tipo de nota
                    </label>
                    <select
                      value={noteType}
                      onChange={(e) => setNoteType(e.target.value)}
                      className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                    >
                      {NOTE_TYPES.map((nt) => (
                        <option key={nt} value={nt}>
                          {nt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Sistema / entorno (opcional)
                    </label>
                    <select
                      value={systemType}
                      onChange={(e) => setSystemType(e.target.value)}
                      className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                    >
                      <option value="">No especificar</option>
                      {SYSTEM_TYPES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              {!isProjectMode && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Cliente (opcional)
                  </label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                  >
                    <option value="">Nota genérica (sin cliente)</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.display_name || client.name}
                        {client.country ? ` · ${getCountryDisplayName(client.country)}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Módulo (opcional)
                  </label>
                  <select
                    value={moduleId}
                    onChange={(e) => {
                      setModuleId(e.target.value);
                      setScopeItemId("");
                    }}
                    className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                  >
                    <option value="">No especificar</option>
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} · {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Scope item / proceso (opcional)
                  </label>
                  <select
                    value={scopeItemId}
                    onChange={(e) => setScopeItemId(e.target.value)}
                    className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                  >
                    <option value="">No especificar</option>
                    {filteredScopeItems.map((si) => (
                      <option key={si.id} value={si.id}>
                        {si.code} · {si.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {!isProjectMode && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Transacción / App (opcional)
                    </label>
                    <input
                      type="text"
                      value={transactionCode}
                      onChange={(e) => setTransactionCode(e.target.value)}
                      placeholder="Ejemplo: VA01, VK11, app Fiori..."
                      className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Código de error (opcional)
                  </label>
                  <input
                    type="text"
                    value={errorCode}
                    onChange={(e) => setErrorCode(e.target.value)}
                    placeholder="Ejemplo: KI100, CK701, M7064..."
                    className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                  />
                </div>
              </div>
            </section>

            {/* Section 3 — Referencias y contexto */}
            <section className="space-y-4 py-6">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Referencias y contexto
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Enlace 1
                  </label>
                  <input
                    type="url"
                    value={webLink1}
                    onChange={(e) => setWebLink1(e.target.value)}
                    placeholder="https://... (SAP Note, Jira, Confluence...)"
                    className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Enlace 2
                  </label>
                  <input
                    type="url"
                    value={webLink2}
                    onChange={(e) => setWebLink2(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Información adicional
                </label>
                <textarea
                  value={extraInfo}
                  onChange={(e) => setExtraInfo(e.target.value)}
                  rows={3}
                  placeholder="Notas internas, referencias a comités, dependencias con otros flujos, etc."
                  className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-y min-h-[72px]"
                />
              </div>
            </section>

            {/* Footer actions */}
            <div className="pt-6 flex items-center justify-end gap-3 border-t border-slate-600/50">
              <button
                type="button"
                onClick={() => router.push(projectIdFromQuery.trim() ? `/projects/${projectIdFromQuery.trim()}/notes` : "/notes")}
                className="text-sm font-medium text-slate-400 px-4 py-2.5 rounded-xl hover:bg-slate-700/50 hover:text-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-indigo-500/90 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Guardando..." : "Guardar nota"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}