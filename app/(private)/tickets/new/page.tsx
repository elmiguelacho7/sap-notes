"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import type { TicketPriority, TicketStatus } from "@/lib/types/ticketTypes";

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: "open", label: "Abierto" },
  { value: "in_progress", label: "En progreso" },
  { value: "resolved", label: "Resuelto" },
  { value: "closed", label: "Cerrado" },
  { value: "cancelled", label: "Cancelado" },
];

export default function NewTicketPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromQuery = searchParams.get("projectId") ?? "";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [status, setStatus] = useState<TicketStatus>("open");
  const [projectId, setProjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (projectIdFromQuery) {
      setProjectId(projectIdFromQuery);
    }
  }, [projectIdFromQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const titleTrim = title.trim();
    if (!titleTrim) {
      setErrorMsg("El título es obligatorio.");
      return;
    }

    setSubmitting(true);

    const payload = {
      title: titleTrim,
      description: description.trim() || null,
      priority,
      status,
      project_id: projectId.trim() || null,
      due_date: dueDate.trim() || null,
    };

    const { data, error } = await supabase
      .from("tickets")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      handleSupabaseError("tickets insert", error);
      console.error("Error creating ticket:", error);
      setErrorMsg("No se pudo crear el ticket. Inténtalo de nuevo más tarde.");
      setSubmitting(false);
      return;
    }

    const createdId = data?.id as string | undefined;
    if (createdId) {
      router.push(`/tickets/${createdId}`);
    } else {
      setErrorMsg("El ticket se creó pero no se pudo redirigir. Ve a la lista de tickets.");
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
          Nuevo ticket
        </h1>
        <p className="text-xs md:text-sm text-slate-500 max-w-2xl">
          Completa los datos para crear un nuevo ticket.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Título *
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-0"
              placeholder="Resumen del ticket"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Descripción (opcional)
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-0"
              rows={3}
              placeholder="Detalles del ticket"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Prioridad
              </label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-0 bg-white"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Estado
              </label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-0 bg-white"
                value={status}
                onChange={(e) => setStatus(e.target.value as TicketStatus)}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Proyecto (opcional)
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-0"
                placeholder="ID del proyecto"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Fecha límite (opcional)
              </label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-0"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 shadow-sm hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Creando…" : "Crear ticket"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
