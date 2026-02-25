"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function NewProjectPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const projectName = name.trim();
    const projectDescription = description.trim();
    const projectStatus = status.trim();

    if (!projectName) {
      setErrorMsg("El nombre del proyecto es obligatorio.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("projects").insert({
      name: projectName,
      description: projectDescription || null,
      status: projectStatus || null,
    });

    setSaving(false);

    if (error) {
      setErrorMsg(error.message || "No se pudo crear el proyecto.");
      return;
    }

    router.push("/projects");
  };

  return (
    <div className="w-full px-6 py-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            Crear nuevo proyecto
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Registra un nuevo proyecto interno. Podrás añadir notas y más
            información más adelante.
          </p>
        </header>

        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
          {errorMsg && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre del proyecto *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ejemplo: Proyecto SAP interno"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Descripción
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="Resumen del objetivo, alcance y contexto del proyecto."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Estado (opcional)
              </label>
              <input
                type="text"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ejemplo: En análisis, En curso, Cerrado..."
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? "Creando..." : "Crear proyecto"}
              </button>

              <button
                type="button"
                onClick={() => router.push("/projects")}
                className="text-sm text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-100"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}