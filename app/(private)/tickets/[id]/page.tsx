"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError, hasLoggableSupabaseError } from "@/lib/supabaseError";
import type { Ticket, TicketPriority, TicketStatus } from "@/lib/types/ticketTypes";

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Abierto",
  in_progress: "En progreso",
  resolved: "Resuelto",
  closed: "Cerrado",
  cancelled: "Cancelado",
};

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const colors: Record<TicketPriority, string> = {
    low: "bg-slate-100 text-slate-700",
    medium: "bg-blue-50 text-blue-700",
    high: "bg-amber-50 text-amber-700",
    urgent: "bg-red-50 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${colors[priority]}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const colors: Record<TicketStatus, string> = {
    open: "bg-slate-100 text-slate-700",
    in_progress: "bg-blue-50 text-blue-700",
    resolved: "bg-emerald-50 text-emerald-700",
    closed: "bg-slate-200 text-slate-600",
    cancelled: "bg-red-50 text-red-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${colors[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function TicketDetailPage() {
  const params = useParams();
  const id = (params?.id ?? "") as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadTicket = useCallback(async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("tickets")
      .select("id, title, description, priority, status, project_id, due_date, created_at, updated_at")
      .eq("id", id)
      .single();

    if (error) {
      handleSupabaseError("tickets", error);
      if (hasLoggableSupabaseError(error)) {
        setErrorMsg("No se pudo cargar el ticket. Inténtalo de nuevo más tarde.");
      }
      setTicket(null);
    } else {
      setTicket(data as Ticket);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void loadTicket();
  }, [loadTicket]);

  const backHref = ticket?.project_id
    ? `/tickets?projectId=${ticket.project_id}`
    : "/tickets";

  if (!id) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <p className="text-sm text-slate-600">
          No se ha encontrado el identificador del ticket.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          Cargando ticket…
        </div>
      </div>
    );
  }

  if (errorMsg && !ticket) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        <Link
          href="/tickets"
          className="inline-flex items-center text-[11px] text-slate-500 hover:text-slate-700"
        >
          ← Volver a tickets
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        <Link
          href="/tickets"
          className="inline-flex items-center text-[11px] text-slate-500 hover:text-slate-700"
        >
          ← Volver a tickets
        </Link>
        <p className="text-sm text-slate-600">No se encontró el ticket.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center text-[11px] text-slate-500 hover:text-slate-700"
        >
          ← Volver a tickets
        </Link>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-4">
          <h1 className="text-xl font-semibold text-slate-900">{ticket.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
            <span className="text-[11px] text-slate-500">
              Creado el {new Date(ticket.created_at).toLocaleDateString("es-ES")}
            </span>
          </div>
        </div>

        <div className="px-4 py-4 space-y-4">
          {ticket.description && (
            <div>
              <h2 className="text-xs font-semibold text-slate-700 mb-1">Descripción</h2>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">
                {ticket.description}
              </p>
            </div>
          )}

          {ticket.due_date && (
            <div>
              <h2 className="text-xs font-semibold text-slate-700 mb-1">Fecha límite</h2>
              <p className="text-sm text-slate-600">
                {new Date(ticket.due_date).toLocaleDateString("es-ES")}
              </p>
            </div>
          )}

          {ticket.project_id && (
            <div>
              <h2 className="text-xs font-semibold text-slate-700 mb-1">Proyecto</h2>
              <p className="text-sm text-slate-600">{ticket.project_id}</p>
            </div>
          )}

          <div>
            <h2 className="text-xs font-semibold text-slate-700 mb-1">Última actualización</h2>
            <p className="text-sm text-slate-600">
              {new Date(ticket.updated_at).toLocaleString("es-ES")}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
