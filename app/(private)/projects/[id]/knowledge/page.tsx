"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";

type KnowledgeNote = {
  id: string;
  title: string | null;
  body: string | null;
  module: string | null;
  scope_item: string | null;
  error_code: string | null;
  web_link_1: string | null;
  web_link_2: string | null;
  extra_info: string | null;
  created_at: string;
  is_knowledge_base?: boolean;
};

export default function ProjectKnowledgePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params?.id ?? "";

  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/knowledge?limit=50`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg((data as { error?: string }).error ?? "Error al cargar la base de conocimiento.");
        setNotes([]);
        return;
      }
      const payload = data as { notes?: KnowledgeNote[] };
      setNotes(payload.notes ?? []);
    } catch {
      setErrorMsg("Error de conexión.");
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const openCreateModal = () => {
    setFormTitle("");
    setFormBody("");
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const title = formTitle.trim();
    if (!title) {
      setFormError("El título es obligatorio.");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/projects/${projectId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          title,
          body: formBody.trim() || null,
          is_knowledge_base: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError((data as { error?: string }).error ?? "Error al crear la nota.");
        return;
      }
      const created = (data as { note?: KnowledgeNote }).note;
      if (created) setNotes((prev) => [created, ...prev]);
      setModalOpen(false);
    } catch {
      setFormError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  if (!projectId) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-slate-600">Identificador de proyecto no válido.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProjectPageHeader
        title="Base de conocimiento"
        subtitle="Notas y artículos seleccionados como conocimiento del proyecto."
        primaryActionLabel="Nueva nota de conocimiento"
        primaryActionOnClick={openCreateModal}
      />

      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            Cargando…
          </div>
        ) : notes.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            No hay notas en la base de conocimiento. Añade una con «Nueva nota de conocimiento» o marca notas existentes desde la lista de notas del proyecto.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notes.map((note) => (
              <li
                key={note.id}
                className="px-4 py-3 hover:bg-slate-50/50 transition cursor-pointer"
                onClick={() => router.push(`/notes/${note.id}`)}
              >
                <p className="font-medium text-slate-900">
                  {note.title ?? "Sin título"}
                </p>
                {(note.module ?? note.scope_item) && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {note.module && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                        {note.module}
                      </span>
                    )}
                    {note.scope_item && (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">
                        {note.scope_item}
                      </span>
                    )}
                  </div>
                )}
                {note.body && (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                    {note.body}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-slate-400">
                  {new Date(note.created_at).toLocaleString("es-ES")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !saving && setModalOpen(false)}
        >
          <div
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900">Nueva nota de conocimiento</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Título *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Ej: Parámetros de variante de valoración"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Contenido (opcional)</label>
                <textarea
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Describe el conocimiento o procedimiento..."
                />
              </div>
              {formError && (
                <p className="text-xs text-red-600">{formError}</p>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? "Guardando…" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
