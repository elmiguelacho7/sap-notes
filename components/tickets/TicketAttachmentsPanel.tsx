"use client";

import type { TicketAttachmentDetail } from "./ticketTypes";

type TicketAttachmentsPanelProps = {
  attachments: TicketAttachmentDetail[];
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function TicketAttachmentsPanel({
  attachments,
}: TicketAttachmentsPanelProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Adjuntos</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Archivos vinculados a este ticket.
        </p>
      </div>

      <div className="p-4 space-y-3">
        {attachments.length === 0 ? (
          <p className="text-xs text-slate-500">No hay adjuntos.</p>
        ) : (
          <ul className="space-y-2">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <a
                  href={a.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline truncate flex-1 min-w-0"
                >
                  {a.file_name}
                </a>
                <span className="text-[11px] text-slate-400 shrink-0">
                  {formatDate(a.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          disabled
          className="w-full rounded-lg border border-dashed border-slate-200 px-4 py-2 text-xs font-medium text-slate-500 bg-slate-50/50 cursor-not-allowed"
        >
          Añadir adjunto (próximamente)
        </button>
      </div>
    </section>
  );
}
