"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

type Note = {
  id: string;
  title: string;
  body: string | null;
  client: string | null;
  module: string | null;
  scope_item: string | null;
  error_code: string | null;
  created_at: string;
};

export default function NoteDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const noteId = params.id as string;

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      if (!noteId) return;

      setLoading(true);
      setErrorMsg(null);

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("Error comprobando sesión:", error);
        setErrorMsg("No se pudo comprobar la sesión.");
        setLoading(false);
        return;
      }

      if (!session) {
        router.replace("/");
        return;
      }

      const { data, error: noteError } = await supabase
        .from("notes")
        .select("*")
        .eq("id", noteId)
        .single();

      if (noteError) {
        console.error("Error cargando nota:", noteError);
        setErrorMsg("No se pudo cargar la nota.");
      } else {
        setNote(data as Note);
      }

      setLoading(false);
    };

    void init();
  }, [noteId, router]);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-3xl">
        <button
          type="button"
          onClick={() => router.push("/notes")}
          className="text-[11px] text-slate-500 hover:text-slate-700 mb-3 inline-flex items-center gap-1"
        >
          <span className="text-xs">←</span>
          <span>Volver a notas</span>
        </button>

        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
          {errorMsg && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
              {errorMsg}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" />
            </div>
          ) : !note ? (
            <div className="text-center py-10">
              <p className="text-sm font-medium text-slate-800 mb-1">
                No se encontró la nota.
              </p>
              <p className="text-[12px] text-slate-500 mb-4">
                Verifica el enlace o vuelve al listado de notas.
              </p>
              <button
                type="button"
                onClick={() => router.push("/notes")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white shadow-sm hover:bg-blue-700 transition"
              >
                Volver a notas
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <header>
                <p className="text-[11px] text-slate-500 mb-1">
                  Nota de implementación
                </p>
                <h1 className="text-base font-semibold text-slate-900">
                  {note.title}
                </h1>
                <p className="text-[11px] text-slate-400 mt-1">
                  Creada el{" "}
                  {new Date(note.created_at).toLocaleDateString("es-ES")}
                </p>
              </header>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                {note.client && (
                  <div className="rounded-xl bg-slate-50 px-3 py-2 border border-slate-100">
                    <p className="text-slate-500 mb-0.5">Cliente</p>
                    <p className="font-medium text-slate-800">
                      {note.client}
                    </p>
                  </div>
                )}
                {note.module && (
                  <div className="rounded-xl bg-slate-50 px-3 py-2 border border-slate-100">
                    <p className="text-slate-500 mb-0.5">Módulo</p>
                    <p className="font-medium text-slate-800">
                      {note.module}
                    </p>
                  </div>
                )}
                {note.scope_item && (
                  <div className="rounded-xl bg-slate-50 px-3 py-2 border border-slate-100">
                    <p className="text-slate-500 mb-0.5">Scope item</p>
                    <p className="font-medium text-slate-800">
                      {note.scope_item}
                    </p>
                  </div>
                )}
                {note.error_code && (
                  <div className="rounded-xl bg-amber-50 px-3 py-2 border border-amber-100">
                    <p className="text-amber-700 mb-0.5 text-[11px]">
                      Código de error
                    </p>
                    <p className="font-medium text-amber-800 text-[11px]">
                      {note.error_code}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-[12px] font-semibold text-slate-800 mb-2">
                  Detalle
                </h2>
                <div className="border border-slate-200 rounded-xl bg-slate-50 px-4 py-3 text-[12px] text-slate-800">
                  <p className="whitespace-pre-wrap">
                    {note.body ?? "Sin descripción."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}