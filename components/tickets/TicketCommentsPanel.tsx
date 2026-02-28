"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import type { TicketCommentDetail } from "./ticketTypes";

type TicketCommentsPanelProps = {
  ticketId: string;
  comments: TicketCommentDetail[];
  onCommentAdded: () => void;
};

function formatCommentDate(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TicketCommentsPanel({
  ticketId,
  comments,
  onCommentAdded,
}: TicketCommentsPanelProps) {
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setSubmitError(null);

    const { data: { user } } = await supabase.auth.getUser();
    let createdBy: string | null = null;
    if (user?.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();
      if (profile) createdBy = (profile as { id: string }).id;
    }

    const { error } = await supabase.from("ticket_comments").insert({
      ticket_id: ticketId,
      body: trimmed,
      is_internal: isInternal,
      created_by: createdBy,
    });

    if (error) {
      handleSupabaseError("ticket_comments insert", error);
      setSubmitError("No se pudo añadir el comentario.");
    } else {
      setBody("");
      setIsInternal(false);
      onCommentAdded();
    }

    setSubmitting(false);
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Comentarios</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Añade comentarios y seguimiento al ticket.
        </p>
      </div>

      <div className="flex-1 flex flex-col min-h-[260px] overflow-hidden">
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4 max-h-64">
          {comments.length === 0 ? (
            <p className="text-xs text-slate-500">Aún no hay comentarios.</p>
          ) : (
            comments.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-medium text-slate-800">
                    {c.created_by_name ?? "Usuario"}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {formatCommentDate(c.created_at)}
                  </span>
                </div>
                <p className="text-xs text-slate-700 whitespace-pre-wrap">{c.body}</p>
                {c.is_internal && (
                  <span className="inline-block mt-1.5 text-[10px] rounded-full bg-amber-50 text-amber-800 px-2 py-0.5 border border-amber-100">
                    Interno
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-slate-200 p-4 space-y-3">
          {submitError && (
            <p className="text-xs text-red-600">{submitError}</p>
          )}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escribe un comentario..."
            rows={3}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
          />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Comentario interno
          </label>
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Enviando…" : "Añadir comentario"}
          </button>
        </form>
      </div>
    </section>
  );
}
