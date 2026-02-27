"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";

type Client = {
  id: string;
  name: string;
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
            .select("id, name, country")
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
      const selectedClient = clients.find((c) => c.id === clientId) || null;
      const selectedModule = modules.find((m) => m.id === moduleId) || null;
      const selectedScopeItem =
        scopeItems.find((s) => s.id === scopeItemId) || null;

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

        // Nota general: sin proyecto asociado
        project_id: null,
      };

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
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 flex justify-center">
      <div className="w-full max-w-3xl">
        {/* Título y descripción (igual estilo que tenías) */}
        <h1 className="text-2xl font-semibold text-slate-900">
          Nueva nota
        </h1>
        <p className="mt-1 text-sm text-slate-600 max-w-2xl">
          Registra una nueva nota de implementación, incidencia o decisión.
          Esta nota será general (no ligada a un proyecto concreto) para
          que puedas reutilizarla en futuros clientes y proyectos.
        </p>

        <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-7">
          {errorMsg && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* TÍTULO */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Título <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ejemplo: Error KI100 al contabilizar en ES25"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
              />
            </div>

            {/* DESCRIPCIÓN / DETALLE */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Descripción / detalle
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder="Describe el problema, el análisis (causa raíz) y la solución aplicada, incluyendo transacciones, customizing, condiciones, etc."
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500 resize-y"
              />
            </div>

            {/* TIPO DE NOTA Y SISTEMA */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tipo de nota
                </label>
                <select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                >
                  {NOTE_TYPES.map((nt) => (
                    <option key={nt} value={nt}>
                      {nt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Sistema / entorno (opcional)
                </label>
                <select
                  value={systemType}
                  onChange={(e) => setSystemType(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
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

            {/* CLIENTE */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Cliente (opcional)
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
              >
                <option value="">Nota genérica (sin cliente)</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                    {client.country ? ` · ${client.country}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* MÓDULO Y SCOPE ITEM */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Módulo (opcional)
                </label>
                <select
                  value={moduleId}
                  onChange={(e) => {
                    setModuleId(e.target.value);
                    setScopeItemId("");
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
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
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Scope item / proceso (opcional)
                </label>
                <select
                  value={scopeItemId}
                  onChange={(e) => setScopeItemId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
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

            {/* TRANSACCIÓN Y CÓDIGO DE ERROR */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Transacción / App (opcional)
                </label>
                <input
                  type="text"
                  value={transactionCode}
                  onChange={(e) => setTransactionCode(e.target.value)}
                  placeholder="Ejemplo: VA01, VK11, app Fiori..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Código de error (opcional)
                </label>
                <input
                  type="text"
                  value={errorCode}
                  onChange={(e) => setErrorCode(e.target.value)}
                  placeholder="Ejemplo: KI100, CK701, M7064..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                />
              </div>
            </div>

            {/* ENLACES Y CONTEXTO ADICIONAL */}
            <div className="pt-2 border-t border-slate-100 mt-4 space-y-3">
              <p className="text-xs font-medium text-slate-700">
                Enlaces y contexto adicional (opcional)
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Enlace 1
                  </label>
                  <input
                    type="url"
                    value={webLink1}
                    onChange={(e) => setWebLink1(e.target.value)}
                    placeholder="https://... (SAP Note, Jira, Confluence...)"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Enlace 2
                  </label>
                  <input
                    type="url"
                    value={webLink2}
                    onChange={(e) => setWebLink2(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Información adicional
                </label>
                <textarea
                  value={extraInfo}
                  onChange={(e) => setExtraInfo(e.target.value)}
                  rows={3}
                  placeholder="Notas internas, referencias a comités, dependencias con otros flujos, etc."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500 resize-y"
                />
              </div>
            </div>

            {/* BOTONES */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => router.push("/notes")}
                className="text-sm text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
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