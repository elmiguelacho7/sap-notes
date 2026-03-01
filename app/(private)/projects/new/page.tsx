"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { createDefaultPhasesForProject } from "@/lib/services/projectPhaseService";

type Client = {
  id: string;
  name: string;
  country: string | null;
  industry?: string | null;
};

type Module = {
  id: string;
  code: string;
  name: string;
};

const ENVIRONMENT_TYPES = [
  "SAP ECC",
  "S/4HANA On-Premise",
  "S/4HANA Private Cloud",
  "S/4HANA Public Cloud",
  "Otro / Mixto",
];

const STATUS_OPTIONS = [
  "Planeado",
  "En curso",
  "En UAT",
  "Productivo",
  "Cerrado",
];

export default function NewProjectPage() {
  const router = useRouter();

  // Datos básicos
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Contexto SAP
  const [environmentType, setEnvironmentType] = useState("");
  const [sapVersion, setSapVersion] = useState("");
  const [startDate, setStartDate] = useState("");
  const [plannedEndDate, setPlannedEndDate] = useState("");
  const [status, setStatus] = useState("Planeado");

  // Cliente
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<string>("");

  // Módulos
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);

  // Control UI
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [planWarning, setPlanWarning] = useState<string | null>(null);

  // ==========================
  // CARGA DE CLIENTES Y MÓDULOS
  // ==========================
  useEffect(() => {
    const loadData = async () => {
      try {
        const [{ data: clientData, error: clientError }, { data: moduleData, error: moduleError }] =
          await Promise.all([
            supabase
              .from("clients")
              .select("id, name, country, industry")
              .order("name", { ascending: true }),
            supabase
              .from("modules")
              .select("id, code, name")
              .order("code", { ascending: true }),
          ]);

        if (clientError) {
          handleSupabaseError("clients", clientError);
          setClients([]);
        } else {
          setClients(clientData ?? []);
        }

        if (moduleError) {
          handleSupabaseError("modules", moduleError);
          setModules([]);
        } else {
          setModules(moduleData ?? []);
        }
      } catch (err) {
        handleSupabaseError("projects/new loadData", err);
      }
    };

    loadData();
  }, []);

  // ==========================
  // HANDLERS
  // ==========================
  const toggleModuleSelection = (moduleId: string) => {
    setSelectedModuleIds((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validaciones básicas
    if (!name.trim()) {
      setErrorMsg("El nombre del proyecto es obligatorio.");
      return;
    }

    if (!environmentType) {
      setErrorMsg("Debes indicar el tipo de entorno SAP.");
      return;
    }

    if (!status) {
      setErrorMsg("Debes indicar el estado del proyecto.");
      return;
    }

    setSaving(true);
    setPlanWarning(null);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        environment_type: environmentType,
        sap_version: sapVersion.trim() || null,
        start_date: startDate || null,
        planned_end_date: plannedEndDate || null,
        status,
        client_id: clientId || null,
      };

      // 1) Crear proyecto y recuperar su id
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert([payload])
        .select("id")
        .single();

      if (projectError || !project) {
        handleSupabaseError("projects insert", projectError);
        setErrorMsg(
          (projectError as { message?: string })?.message || "No se pudo crear el proyecto."
        );
        setSaving(false);
        return;
      }

      const projectId = project.id as string;

      // 2) Create default project phases (Discover, Prepare, Explore, etc.)
      await createDefaultPhasesForProject(projectId);

      let planFailed = false;
      // 3) Generate SAP Activate plan if we have start and end dates
      if (startDate && plannedEndDate) {
        try {
          const { data: session } = await supabase.auth.getSession();
          const token = session?.session?.access_token;
          const headers: Record<string, string> = token
            ? { Authorization: `Bearer ${token}` }
            : {};
          const planRes = await fetch(`/api/projects/${projectId}/generate-plan`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
          });
          const planJson = await planRes.json().catch(() => ({}));
          if (!planRes.ok) {
            console.warn("Plan generation failed", planJson);
            planFailed = true;
            setPlanWarning(
              (planJson as { error?: string })?.error ?? "No se pudo generar el plan de actividades."
            );
          }
        } catch (planErr) {
          console.warn("Plan generation error", planErr);
          planFailed = true;
          setPlanWarning("No se pudo generar el plan de actividades.");
        }
      }

      // 4) Insertar módulos relacionados (si hay)
      if (selectedModuleIds.length > 0) {
        const projectModulesPayload = selectedModuleIds.map((moduleId) => ({
          project_id: projectId,
          module_id: moduleId,
        }));

        const { error: projectModulesError } = await supabase
          .from("project_modules")
          .insert(projectModulesPayload);

        if (projectModulesError) {
          handleSupabaseError("project_modules insert", projectModulesError);
        }
      }

      // 5) Redirigir: al proyecto si hay fechas (para ver plan), o al listado
      if (startDate && plannedEndDate) {
        router.push(planFailed ? `/projects/${projectId}?planGenerated=false` : `/projects/${projectId}`);
      } else {
        router.push("/projects");
      }
    } catch (err) {
      handleSupabaseError("projects new submit", err);
      setErrorMsg("Se ha producido un error inesperado.");
      setSaving(false);
    }
  };

  // ==========================
  // RENDER
  // ==========================
  return (
    <div className="w-full px-6 py-8">
      <div className="max-w-4xl mx-auto">
        {/* HEADER */}
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            Nuevo proyecto
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            Define los datos clave del proyecto SAP. Esta información se
            utilizará en el dashboard, en las notas y en el contexto del
            asistente de IA.
          </p>
        </header>

        {/* CARD PRINCIPAL */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mb-2">
              {errorMsg}
            </div>
          )}
          {planWarning && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 mb-2">
              {planWarning}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* DATOS BÁSICOS */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Datos básicos
              </h2>
              <p className="text-xs text-slate-500">
                Nombre, cliente y descripción general del proyecto.
              </p>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    Nombre del proyecto <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Implementación S/4HANA Public Cloud · Entidades TP"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    Cliente
                  </label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
                  >
                    <option value="">Sin cliente asignado todavía</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                        {client.country ? ` · ${client.country}` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400">
                    Si es un proyecto interno o aún no está definido, puedes dejarlo vacío.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    Descripción
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Breve resumen del alcance funcional, módulos implicados y objetivo principal del proyecto."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500 resize-none"
                  />
                </div>
              </div>
            </section>

            {/* CONTEXTO SAP */}
            <section className="space-y-3 pt-4 border-t border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">
                Contexto SAP
              </h2>
              <p className="text-xs text-slate-500">
                Información técnica básica del entorno donde se ejecuta el proyecto.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    Tipo de entorno <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={environmentType}
                    onChange={(e) => setEnvironmentType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
                  >
                    <option value="">Selecciona una opción</option>
                    {ENVIRONMENT_TYPES.map((env) => (
                      <option key={env} value={env}>
                        {env}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    Versión / release SAP
                  </label>
                  <input
                    type="text"
                    value={sapVersion}
                    onChange={(e) => setSapVersion(e.target.value)}
                    placeholder="Ej: S/4HANA 2023 FPS01 · Public Cloud 2408"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
                  />
                  <p className="text-[11px] text-slate-400">
                    Útil para diferenciar proyectos ECC vs S/4, releases de Public Cloud, etc.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    Fecha de inicio prevista
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    Fecha de fin planificada
                  </label>
                  <input
                    type="date"
                    value={plannedEndDate}
                    onChange={(e) => setPlannedEndDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
                  />
                  <p className="text-[11px] text-slate-400">
                    Si indicas inicio y fin, se generará un plan inicial de actividades según SAP Activate.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    Estado del proyecto <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* MÓDULOS RELACIONADOS */}
            <section className="space-y-3 pt-4 border-t border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">
                Módulos relacionados
              </h2>
              <p className="text-xs text-slate-500">
                Selecciona los módulos SAP que están dentro del alcance del proyecto.
                Esto se utilizará en el dashboard, en los resúmenes y en el contexto de IA.
              </p>

              {modules.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No hay módulos configurados todavía en la tabla <code>modules</code>.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
                  {modules.map((m) => {
                    const checked = selectedModuleIds.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs cursor-pointer transition
                          ${
                            checked
                              ? "border-blue-500 bg-blue-50 text-blue-900"
                              : "border-slate-200 bg-slate-50/60 text-slate-700 hover:border-slate-300"
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleModuleSelection(m.id)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="truncate">
                          <span className="font-medium">{m.code}</span>
                          {m.name ? ` · ${m.name}` : ""}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              <p className="text-[11px] text-slate-400">
                Puedes añadir o quitar módulos más adelante desde la ficha del proyecto
                si ampliáis el alcance.
              </p>
            </section>

            {/* ACCIONES */}
            <div className="pt-4 flex items-center justify-between gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => router.push("/projects")}
                className="text-sm text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? "Guardando..." : "Crear proyecto"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}