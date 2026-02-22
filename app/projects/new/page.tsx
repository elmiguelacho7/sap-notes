"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type StatusOption = "planned" | "in_progress" | "on_hold" | "closed";

const STATUS_LABELS: Record<StatusOption, string> = {
  planned: "Planificado",
  in_progress: "En progreso",
  on_hold: "En espera",
  closed: "Cerrado",
};

const ENV_OPTIONS = [
  "Sandbox",
  "Development",
  "Quality",
  "Production",
  "On premise",
  "Public Cloud",
];

const SAP_VERSIONS = [
  "ECC",
  "S/4HANA On Premise",
  "S/4HANA Public Cloud",
  "S/4HANA Private Cloud",
];

export default function NewProjectPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState("");
  const [environmentType, setEnvironmentType] = useState("");
  const [sapVersion, setSapVersion] = useState("");
  const [status, setStatus] = useState<StatusOption>("planned");
  const [startDate, setStartDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setMessage(null);

    if (!name.trim()) {
      setErrorMsg("El nombre del proyecto es obligatorio.");
      return;
    }

    setLoading(true);

    try {
      // Ajusta "projects" si tu tabla base tiene otro nombre
      const { error } = await supabase.from("projects").insert([
        {
          name: name.trim(),
          description: description.trim() || null,
          client_name: clientName.trim() || null,
          client_id: clientId.trim() || null,
          environment_type: environmentType || null,
          sap_version: sapVersion || null,
          status,
          start_date: startDate || null,
        },
      ]);

      if (error) {
        console.error("insert project error", error);
        throw error;
      }

      setMessage("Proyecto creado correctamente ✅");

      setTimeout(() => {
        router.push("/projects");
      }, 900);
    } catch (err: unknown) {
      const base = "No se pudo crear el proyecto. Intenta de nuevo.";
      const msg =
        err instanceof Error && err.message ? err.message : base;
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-sky-400">
              SAP Notes Hub
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-50">
              Nuevo proyecto SAP
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Define los datos básicos del proyecto para empezar a vincular
              notas, errores y decisiones.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/projects")}
            className="text-[11px] text-slate-400 underline underline-offset-4 hover:text-slate-200"
          >
            ← Volver a proyectos
          </button>
        </header>

        <div className="grid gap-5 md:grid-cols-[2fr,1.2fr]">
          {/* Formulario principal */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Nombre */}
              <div className="space-y-1.5">
                <label
                  htmlFor="name"
                  className="block text-xs font-medium text-slate-200"
                >
                  Nombre del proyecto *
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Implementación S/4HANA Lecta – SD/MM"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  required
                />
              </div>

              {/* Cliente */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="clientName"
                    className="block text-xs font-medium text-slate-200"
                  >
                    Cliente
                  </label>
                  <input
                    id="clientName"
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Lecta, Sauleda, etc."
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="clientId"
                    className="block text-xs font-medium text-slate-200"
                  >
                    ID cliente (opcional)
                  </label>
                  <input
                    id="clientId"
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Código interno / BP, etc."
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Entorno y versión SAP */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="environment"
                    className="block text-xs font-medium text-slate-200"
                  >
                    Entorno
                  </label>
                  <select
                    id="environment"
                    value={environmentType}
                    onChange={(e) => setEnvironmentType(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    <option value="">Selecciona entorno…</option>
                    {ENV_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="sapVersion"
                    className="block text-xs font-medium text-slate-200"
                  >
                    Versión SAP
                  </label>
                  <select
                    id="sapVersion"
                    value={sapVersion}
                    onChange={(e) => setSapVersion(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    <option value="">Selecciona versión…</option>
                    {SAP_VERSIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Estado y fecha */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="status"
                    className="block text-xs font-medium text-slate-200"
                  >
                    Estado
                  </label>
                  <select
                    id="status"
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as StatusOption)
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    {(Object.keys(STATUS_LABELS) as StatusOption[]).map(
                      (key) => (
                        <option key={key} value={key}>
                          {STATUS_LABELS[key]}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="startDate"
                    className="block text-xs font-medium text-slate-200"
                  >
                    Fecha de inicio (opcional)
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Descripción */}
              <div className="space-y-1.5">
                <label
                  htmlFor="description"
                  className="block text-xs font-medium text-slate-200"
                >
                  Descripción del proyecto
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Ejemplo: Rollout SD/MM + Settlement Management (CCM) para grupo Lecta. Incluye intercompany 5D2, 3ZB, 7TZ, etc."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              {/* Mensajes */}
              <div className="min-h-[1.5rem] text-[11px]" aria-live="polite">
                {errorMsg && (
                  <p className="text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-md px-2 py-1">
                    {errorMsg}
                  </p>
                )}
                {!errorMsg && message && (
                  <p className="text-emerald-300 bg-emerald-950/40 border border-emerald-900/60 rounded-md px-2 py-1">
                    {message}
                  </p>
                )}
              </div>

              {/* Botones */}
              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/projects")}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-white"
                >
                  {loading ? "Guardando…" : "Crear proyecto"}
                </button>
              </div>
            </form>
          </section>

          {/* Panel lateral de ayuda */}
          <aside className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-[11px] text-slate-300">
            <h2 className="text-sm font-semibold text-slate-50 mb-1">
              Buenas prácticas para tus proyectos
            </h2>
            <ul className="space-y-2 list-disc pl-4">
              <li>
                Usa un <span className="font-semibold">nombre claro</span>:
                cliente + módulo + tipo de proyecto (ej. “Lecta – SD – CCM
                rebates”).
              </li>
              <li>
                En <span className="font-semibold">descripción</span>, anota las
                decisiones clave (intercompany, pricing, CCM, EWM, etc.).
              </li>
              <li>
                El campo <span className="font-semibold">entorno</span> te
                ayudará a separar pruebas de productivo.
              </li>
              <li>
                La <span className="font-semibold">versión SAP</span> es
                importante para recordar si el cliente está en ECC o S/4HANA
                (y en qué modalidad).
              </li>
              <li>
                Podrás ver todas las métricas (notas, scope items, ficheros) en
                el dashboard del proyecto.
              </li>
            </ul>

            <p className="mt-2 text-[10px] text-slate-500">
              Esta ficha de proyecto no impacta directamente en SAP: es tu
              “capa de documentación” para recordar qué hiciste en cada rollout.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}