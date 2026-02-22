"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function NewProjectPage() {
  const router = useRouter();

  // Hooks SIEMPRE en el mismo orden
  const [checkingSession, setCheckingSession] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.replace("/");
        return;
      }

      setCheckingSession(false);
    };

    checkSession();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (checkingSession) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("El nombre del proyecto es obligatorio.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from("projects").insert([
        {
          name: name.trim(),
          description: description.trim() || null,
          status: status.trim() || null,
        },
      ]);

      if (error) {
        console.error(error);
        setErrorMsg("No se pudo crear el proyecto. Inténtalo de nuevo.");
        setSaving(false);
        return;
      }

      router.push("/projects");
    } catch (err) {
      console.error(err);
      setErrorMsg("Se ha producido un error inesperado.");
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
              PH
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Project Hub
              </p>
              <p className="text-[11px] text-slate-500">
                Nuevo proyecto
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/projects")}
              className="text-xs border border-slate-300 px-3 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100"
            >
              Volver a proyectos
            </button>
            <button
              onClick={handleLogout}
              className="text-xs border border-slate-300 px-3 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <section className="max-w-3xl mx-auto px-6 py-7">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <h1 className="text-xl font-semibold text-slate-900 mb-1">
            Crear nuevo proyecto
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            Registra un nuevo proyecto interno. Podrás añadir notas y más
            información más adelante.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-800">
                Nombre del proyecto *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ejemplo: Proyecto SAP interno"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-800">
                Descripción
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Resumen del objetivo, alcance y contexto del proyecto."
                rows={4}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-800">
                Estado (opcional)
              </label>
              <input
                type="text"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="Ejemplo: En análisis, En curso, Cerrado..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {errorMsg && (
              <p className="text-xs text-red-500">{errorMsg}</p>
            )}

            <div className="pt-2 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Crear proyecto"}
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
      </section>
    </main>
  );
}