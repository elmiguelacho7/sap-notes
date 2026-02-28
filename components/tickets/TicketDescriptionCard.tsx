"use client";

import type { TicketDetail } from "./ticketTypes";

type TicketDescriptionCardProps = {
  ticket: TicketDetail;
};

export default function TicketDescriptionCard({ ticket }: TicketDescriptionCardProps) {
  const description =
    ticket.description && String(ticket.description).trim() !== ""
      ? ticket.description
      : null;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900 mb-4">Descripción</h2>
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-800">
        {description ? (
          <p className="whitespace-pre-wrap">{description}</p>
        ) : (
          <p className="text-slate-500 italic">
            No hay descripción para este ticket.
          </p>
        )}
      </div>
    </section>
  );
}
