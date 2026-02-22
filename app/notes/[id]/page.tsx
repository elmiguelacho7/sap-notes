"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

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

export default function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // ✅ necesario con React 19 / Next 15: params es una Promesa
  const { id } = use(params);

  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchNote = async () => {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error(error);
        setErrorMsg("No se pudo cargar la nota.");
      } else {
        setNote(data as Note);
      }

      setLoading(false);
    };

    fetchNote();
  }, [id]);

  if (loading) {
    return (
      <main className="flex-1 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <p className="text-slate-500">Cargando nota…</p>
        </div>
      </main>
    );
  }

  if (errorMsg || !note) {
    return (
      <main className="flex-1 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <button
            onClick={() => router.push("/notes")}
            className="mb-4 text-sm text-sky-600 hover:text-sky-700"
          >
            ← Volver a todas las notas
          </button>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <p className="text-slate-700">
              {errorMsg ?? "Nota no encontrada."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const formattedDate = new Date(note.created_at).toLocaleString();

  return (
    <main className="flex-1 bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header con back + fecha */}
        <div className="mb-4 flex items-center justify-between gap-4">
          <button
            onClick={() => router.push("/notes")}
            className="text-sm text-sky-600 hover:text-sky-700"
          >
            ← Volver a todas las notas
          </button>
          <span className="text-xs text-slate-400 whitespace-nowrap">
            {formattedDate}
          </span>
        </div>

        {/* Card principal */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          {/* Título */}
          <h1 className="text-xl font-semibold text-slate-900 mb-4">
            {note.title}
          </h1>

          {/* Línea de metadatos igual que en el listado */}
          <div className="flex flex-wrap gap-2 mb-4 text-xs">
            {note.module && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                <span className="font-medium mr-1">Módulo:</span> {note.module}
              </span>
            )}
            {note.client && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                <span className="font-medium mr-1">Cliente:</span> {note.client}
              </span>
            )}
            {note.scope_item && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                <span className="font-medium mr-1">Scope:</span>{" "}
                {note.scope_item}
              </span>
            )}
            {note.error_code && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                <span className="font-medium mr-1">Error:</span>{" "}
                {note.error_code}
              </span>
            )}
          </div>

          {/* Detalle */}
          <h2 className="text-sm font-semibold text-slate-800 mb-2">
            Detalle
          </h2>
          <div className="border border-slate-200 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800">
            <p className="whitespace-pre-wrap">
              {note.body ?? "Sin descripción."}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}