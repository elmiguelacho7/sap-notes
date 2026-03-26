"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import type { TicketCommentDetail } from "./ticketTypes";

type TicketCommentsPanelProps = {
  ticketId: string;
  comments: TicketCommentDetail[];
  onCommentAdded: () => void;
};

function formatCommentDate(iso: string, localeTag: string): string {
  return new Date(iso).toLocaleString(localeTag, {
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
  const t = useTranslations("tickets.comments");
  const locale = useLocale();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setSubmitError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      setSubmitError(t("errors.loginRequired"));
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("ticket_comments").insert({
      ticket_id: ticketId,
      author_id: user.id,
      content: trimmed,
    });

    if (error) {
      handleSupabaseError("ticket_comments insert", error);
      setSubmitError(t("errors.addFailed"));
    } else {
      setContent("");
      onCommentAdded();
    }

    setSubmitting(false);
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-3">
        <div className="max-h-[280px] overflow-y-auto space-y-3 pr-1">
          {comments.length === 0 ? (
            <p className="text-xs text-slate-500">{t("empty")}</p>
          ) : (
            comments.map((c) => (
              <article
                key={c.id}
                className="rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2.5"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-200">
                    {c.author_name ?? t("userFallback")}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {formatCommentDate(c.created_at, localeTag)}
                  </span>
                </div>
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{c.content}</p>
              </article>
            ))
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-3 space-y-3"
      >
        {submitError && <p className="text-xs text-red-300">{submitError}</p>}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("placeholder")}
          className="w-full min-h-[110px] max-h-[220px] resize-y rounded-xl border border-slate-600/80 bg-slate-800/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="inline-flex items-center rounded-xl border border-indigo-500/50 bg-indigo-500/20 px-4 py-2 text-sm font-medium text-indigo-200 hover:bg-indigo-500/30 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? t("sending") : t("add")}
          </button>
        </div>
      </form>
    </section>
  );
}
