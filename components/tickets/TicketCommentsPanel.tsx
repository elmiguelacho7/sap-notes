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
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div className="max-h-[320px] overflow-y-auto space-y-3 pr-1 [scrollbar-width:thin] [scrollbar-color:rgb(var(--rb-surface-border))_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgb(var(--rb-surface-border))] [&::-webkit-scrollbar-track]:bg-transparent">
          {comments.length === 0 ? (
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 px-3 py-3 text-sm text-slate-600 ring-1 ring-slate-100">
              <p className="font-medium text-slate-700">{t("empty")}</p>
              <p className="mt-1 text-xs text-slate-500">{t("placeholder")}</p>
            </div>
          ) : (
            comments.map((c) => (
              <article
                key={c.id}
                className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-100"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800">
                    {c.author_name ?? t("userFallback")}
                  </span>
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    {formatCommentDate(c.created_at, localeTag)}
                  </span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{c.content}</p>
              </article>
            ))
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200/90 bg-white p-4 space-y-3 shadow-sm ring-1 ring-slate-100"
      >
        {submitError && (
          <p className="text-xs text-red-800 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            {submitError}
          </p>
        )}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("placeholder")}
          className="w-full min-h-[120px] max-h-[240px] resize-y rounded-xl border border-slate-200/90 bg-slate-50/70 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/25 focus:border-[rgb(var(--rb-brand-primary))]/30"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="h-10 inline-flex items-center rounded-xl rb-btn-primary px-4 text-sm font-medium transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2"
          >
            {submitting ? t("sending") : t("add")}
          </button>
        </div>
      </form>
    </section>
  );
}
