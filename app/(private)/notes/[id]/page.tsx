"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";

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
  const params = useParams();
  const noteId = params?.id as string;

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchNote = async () => {
      try {
        const { data, error } = await supabase
          .from("notes")
          .select("*")
          .eq("id", noteId)
          .single();

        if (error) {
          handleSupabaseError("notes", error);
          setErrorMsg("No se pudo cargar la nota.");
          setNote(null);
        } else {
          setNote(data as Note);
          setErrorMsg(null);
        }
      } catch (err) {
        handleSupabaseError("notes fetch", err);
        setErrorMsg("Se ha producido un error inesperado.");
        setNote(null);
      } finally {
        setLoading(false);
      }
    };

    if (noteId) {
      void fetchNote();
    }
  }, [noteId]);

  return (
    <div className="w-full px-6 py-7">
      <div className="max-w-4xl mx-auto">
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
            <div className="text-center py-10 text-sm text-slate-500">
              No se encontró la nota.
            </div>
          ) : (
            <div className="space-y-5">
              {/* HEADER */}
              <header>
                <p className="text-[11px] text-slate-500 mb-1">
                  Nota de implementación
                </p>
                <h1 className="text-base sm:text-lg font-semibold text-slate-900">
                  {note.title}
                </h1>
                <p className="text-[11px] text-slate-400 mt-1">
                  Creada el{" "}
                  {new Date(note.created_at).toLocaleDateString("es-ES")}
                </p>
              </header>

              {/* META */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                {note.client && (
                  <div className="rounded-xl bg-slate-50 px-3 py-2 border border-slate-200">
                    <p className="font-medium text-slate-800">Cliente</p>
                    <p className="text-slate-600 mt-0.5">{note.client}</p>
                  </div>
                )}

                {note.module && (
                  <div className="rounded-xl bg-slate-50 px-3 py-2 border border-slate-200">
                    <p className="font-medium text-slate-800">Módulo</p>
                    <p className="text-slate-600 mt-0.5">{note.module}</p>
                  </div>
                )}

                {note.scope_item && (
                  <div className="rounded-xl bg-slate-50 px-3 py-2 border border-slate-200">
                    <p className="font-medium text-slate-800">
                      Scope item / proceso
                    </p>
                    <p className="text-slate-600 mt-0.5">
                      {note.scope_item}
                    </p>
                  </div>
                )}

                {note.error_code && (
                  <div className="rounded-xl bg-amber-50 px-3 py-2 border border-amber-200">
                    <p className="font-medium text-amber-900">
                      Código de error
                    </p>
                    <p className="text-amber-800 mt-0.5">
                      {note.error_code}
                    </p>
                  </div>
                )}
              </div>

              {/* BODY */}
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-900">
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
    </div>
  );
}