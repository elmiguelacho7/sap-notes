"use client";

import { useEffect, useState } from "react";
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
  project_id: string | null;
};

export default function NotesPage() {
  const router = useRouter();

  const [loadingNotes, setLoadingNotes] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("");

  useEffect(() => {
    const loadNotes = async () => {
      setLoadingNotes(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("notes")
        .select(
          "id, title, body, client, module, scope_item, error_code, created_at, project_id"
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        setErrorMsg("No se pudieron cargar las notas.");
        setNotes([]);
      } else {
        setNotes((data || []) as Note[]);
      }

      setLoadingNotes(false);
    };

    void loadNotes();
  }, []);

  const uniqueModules = Array.from(
    new Set(notes.map((n) => n.module).filter((m): m is string => !!m))
  );

  const filteredNotes = notes.filter((note) => {
    const q = search.trim().toLowerCase();

    if (moduleFilter && note.module !== moduleFilter) return false;

    if (!q) return true;

    const fields = [
      note.title,
      note.body ?? "",
      note.client ?? "",
      note.module ?? "",
      note.scope_item ?? "",
      note.error_code ?? "",
    ].join(" ");

    return fields.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-7 space-y-5">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Notas</h1>
          <p className="text-sm text-slate-600 max-w-xl">
            Registro centralizado de incidencias, decisiones y configuración de
            tus proyectos SAP.
          </p>
        </div>

        <button
          onClick={() => router.push("/notes/new")}
          className="self-start bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Nueva nota
        </button>
      </div>

      {/* FILTROS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 md:space-y-0 md:flex md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">
            Buscador de notas
          </p>
          <p className="text-xs text-slate-500">
            Filtra por cliente, módulo, texto, código de error o descripción.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por texto, cliente, error..."
            className="w-full md:w-64 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />

          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="w-full md:w-40 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Todos los módulos</option>
            {uniqueModules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* LISTA DE NOTAS */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        {loadingNotes ? (
          <p className="p-6 text-sm text-slate-500">Cargando notas...</p>
        ) : errorMsg ? (
          <p className="p-6 text-sm text-red-500">{errorMsg}</p>
        ) : filteredNotes.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No se han encontrado notas con los filtros actuales.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredNotes.map((note) => (
              <li
                key={note.id}
                className="p-4 hover:bg-slate-50 cursor-pointer"
                onClick={() => router.push(`/notes/${note.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {note.title || "Nota sin título"}
                    </p>

                    {/* Metadatos */}
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      {note.client && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                          Cliente: {note.client}
                        </span>
                      )}
                      {note.module && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                          Módulo: {note.module}
                        </span>
                      )}
                      {note.scope_item && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                          Scope: {note.scope_item}
                        </span>
                      )}
                      {note.error_code && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                          Error: {note.error_code}
                        </span>
                      )}
                    </div>

                    {/* Extracto del cuerpo */}
                    {note.body && (
                      <p className="mt-2 text-xs text-slate-600 line-clamp-2">
                        {note.body}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-[11px] text-slate-400">
                      {new Date(note.created_at).toLocaleDateString()}
                    </p>
                    {note.project_id && (
                      <p className="mt-1 text-[10px] text-slate-400">
                        Proyecto vinculado
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}