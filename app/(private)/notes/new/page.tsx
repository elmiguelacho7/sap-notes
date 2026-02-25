"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function NewNotePage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [moduleField, setModuleField] = useState("");
  const [client, setClient] = useState("");
  const [scopeItem, setScopeItem] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    const trimmedModule = moduleField.trim();
    const trimmedClient = client.trim();
    const trimmedScope = scopeItem.trim();
    const trimmedError = errorCode.trim();

    if (!trimmedTitle) {
      setErrorMsg("El título de la nota es obligatorio.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from("notes").insert([
        {
          title: trimmedTitle,
          body: trimmedBody || null,
          client: trimmedClient || null,
          module: trimmedModule || null,
          scope_item: trimmedScope || null,
          error_code: trimmedError || null,
          // project_id: null, // cuando conectemos proyecto, lo rellenamos aquí
        },
      ]);

      if (error) {
        console.error(error);
        setErrorMsg("No se pudo crear la nota. Inténtalo de nuevo.");
        setSaving(false);
        return;
      }

      router.push("/notes");
    } catch (err) {
      console.error(err);
      setErrorMsg("Se ha producido un error inesperado.");
      setSaving(false);
    }
  };

  return (
    <div className="w-full px-6 py-7">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            Nueva nota
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-xl">
            Registra una nueva nota de implementación, incidencia o decisión
            relacionada con tus proyectos SAP.
          </p>
        </header>

        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
          {errorMsg && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800">
                Título *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ejemplo: Error V1032 al crear entrega"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800">
                Descripción / detalle
              </label>
              <textarea
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Describe el problema, la decisión tomada o la configuración aplicada..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-800">
                  Cliente (opcional)
                </label>
                <input
                  type="text"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Nombre o código del cliente"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-800">
                  Módulo (opcional)
                </label>
                <input
                  type="text"
                  value={moduleField}
                  onChange={(e) => setModuleField(e.target.value)}
                  placeholder="SD, MM, FI, CO..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-800">
                  Scope item / proceso (opcional)
                </label>
                <input
                  type="text"
                  value={scopeItem}
                  onChange={(e) => setScopeItem(e.target.value)}
                  placeholder="Por ejemplo: 1MX, 7S7, Z-FREE-OF-CHARGE..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-800">
                  Código de error (opcional)
                </label>
                <input
                  type="text"
                  value={errorCode}
                  onChange={(e) => setErrorCode(e.target.value)}
                  placeholder="Ejemplo: V1032, M3820..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? "Guardando..." : "Guardar nota"}
              </button>

              <button
                type="button"
                onClick={() => router.push("/notes")}
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