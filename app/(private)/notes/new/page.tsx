"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function NewNotePage() {
  const router = useRouter();

  // Hooks SIEMPRE en el mismo orden
  const [checkingSession, setCheckingSession] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [moduleField, setModuleField] = useState("");
  const [client, setClient] = useState("");
  const [scopeItem, setScopeItem] = useState("");
  const [errorCode, setErrorCode] = useState("");
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

    if (!title.trim()) {
      setErrorMsg("El título de la nota es obligatorio.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from("notes").insert([
        {
          title: title.trim(),
          body: body.trim() || null,
          module: moduleField.trim() || null,
          client: client.trim() || null,
          scope_item: scopeItem.trim() || null,
          error_code: errorCode.trim() || null,
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
                Nueva nota
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/notes")}
              className="text-xs border border-slate-300 px-3 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100"
            >
              Volver a notas
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
      <section className="max-w-4xl mx-auto px-6 py-7">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <h1 className="text-xl font-semibold text-slate-900 mb-1">
            Crear nueva nota
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            Utiliza este espacio para documentar análisis de errores, decisiones
            funcionales, configuraciones o cualquier detalle relevante de tus
            proyectos.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Título */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-800">
                Título de la nota *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ejemplo: Análisis error de facturación SD"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Texto principal */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-800">
                Detalle / descripción
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                placeholder="Describe el contexto, los síntomas, el análisis realizado y la solución aplicada."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Campos de clasificación */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-800">
                  Módulo (opcional)
                </label>
                <input
                  type="text"
                  value={moduleField}
                  onChange={(e) => setModuleField(e.target.value)}
                  placeholder="Ejemplo: SD, MM, FI, EWM..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-800">
                  Cliente / contexto (opcional)
                </label>
                <input
                  type="text"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Ejemplo: Cliente interno, entorno de pruebas..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-800">
                  Scope / proceso (opcional)
                </label>
                <input
                  type="text"
                  value={scopeItem}
                  onChange={(e) => setScopeItem(e.target.value)}
                  placeholder="Ejemplo: Pedido a factura, Intercompany..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-800">
                  Código de error (opcional)
                </label>
                <input
                  type="text"
                  value={errorCode}
                  onChange={(e) => setErrorCode(e.target.value)}
                  placeholder="Ejemplo: V1032, M3820..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
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
                {saving ? "Guardando..." : "Crear nota"}
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
      </section>
    </main>
  );
}