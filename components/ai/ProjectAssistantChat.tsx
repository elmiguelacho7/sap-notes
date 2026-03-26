"use client";

import { useState, type FormEvent, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabaseClient";
import { SapitoAvatar } from "./SapitoAvatar";
import { AssistantSuggestionChips } from "./AssistantSuggestionChips";
import { AssistantMessageContent } from "./AssistantMessageContent";

type ChatMessage = { role: "user" | "assistant"; content: string; grounded?: boolean; groundingLabel?: string };

const AGENT_URL = "/api/project-agent";

const PROJECT_SUGGESTIONS_PAYLOAD = [
  "¿Qué tareas están vencidas?",
  "¿Qué tickets siguen abiertos?",
  "¿Qué conocimiento tenemos sobre este tema?",
] as const;

type ProjectAssistantChatProps = {
  projectId: string;
  /** When set, open from another page (e.g. Brain): send this message once and clear */
  initialMessage?: string;
  onClearInitialMessage?: () => void;
};

export function ProjectAssistantChat({
  projectId,
  initialMessage,
  onClearInitialMessage,
}: ProjectAssistantChatProps) {
  const t = useTranslations("sapito.chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialMessageSentRef = useRef(false);

  const projectSuggestions = [
    { label: t("suggestions.overdueTasks"), payload: PROJECT_SUGGESTIONS_PAYLOAD[0] },
    { label: t("suggestions.openTickets"), payload: PROJECT_SUGGESTIONS_PAYLOAD[1] },
    { label: t("suggestions.knowledgeTopic"), payload: PROJECT_SUGGESTIONS_PAYLOAD[2] },
  ] as const;

  const quickActions = [
    { label: t("quickActions.viewOverdueTasks"), href: (id: string) => `/projects/${id}/tasks` },
    { label: t("quickActions.viewOpenTickets"), href: (id: string) => `/projects/${id}/tickets` },
    { label: t("quickActions.goToTasks"), href: (id: string) => `/projects/${id}/tasks` },
  ] as const;

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending || !projectId) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setError(null);
    setIsSending(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ?? null;

      const res = await fetch(AGENT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          message: trimmed,
          userId,
          mode: "project",
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data?.error ?? t("errors.noResponse"));
        setIsSending(false);
        return;
      }

      const data = (await res.json()) as { reply?: string; grounded?: boolean; groundingLabel?: string };
      const reply = typeof data?.reply === "string"
        ? data.reply
        : t("errors.noReplyNow");
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: reply,
        grounded: data?.grounded === true,
        groundingLabel: typeof data?.groundingLabel === "string" ? data.groundingLabel : undefined,
      }]);
    } catch (err) {
      console.error("Project agent request failed", err);
      setError(t("errors.aiRequestFailed"));
    } finally {
      setIsSending(false);
    }
  }, [isSending, projectId, t]);

  // When opened with a prefilled message (e.g. from Brain quick action), send it once
  useEffect(() => {
    const msg = initialMessage?.trim();
    if (!msg || initialMessageSentRef.current || !projectId) return;
    initialMessageSentRef.current = true;
    onClearInitialMessage?.();
    sendMessage(msg);
  }, [initialMessage, projectId, onClearInitialMessage, sendMessage]);

  // Reset when pending message is cleared (e.g. dock closed) so next open-with-message works
  useEffect(() => {
    if (!initialMessage?.trim()) initialMessageSentRef.current = false;
  }, [initialMessage]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 space-y-6 text-sm shadow-sm ring-1 ring-slate-100">
          {isEmpty ? (
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-4 space-y-4">
              <div className="flex items-center gap-3">
                <SapitoAvatar size="lg" styledContainer showOnlineIndicator />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{t("header.title")}</h3>
                  <p className="text-xs text-slate-600">{t("header.subtitle")}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-slate-800 text-sm leading-relaxed font-medium">
                  {t("intro.whatICanDoTitle")}
                </p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {t("intro.whatICanDoBody")}
                </p>
                <ul className="list-disc list-outside pl-4 space-y-1 text-slate-700 text-sm">
                  <li>{t("intro.bullets.projectStatus")}</li>
                  <li>{t("intro.bullets.tickets")}</li>
                  <li>{t("intro.bullets.knowledge")}</li>
                  <li>{t("intro.bullets.nextSteps")}</li>
                </ul>
              </div>
              <div className="pt-1">
                <p className="text-slate-500 text-xs mb-2">{t("intro.tryAsking")}</p>
                <AssistantSuggestionChips
                  suggestions={projectSuggestions.map((s) => s.label)}
                  onSelect={(label) => {
                    const selected = projectSuggestions.find((s) => s.label === label);
                    if (selected) sendMessage(selected.payload);
                  }}
                  disabled={false}
                  className="justify-start"
                  variant="light"
                />
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="mt-1 shrink-0">
                      <SapitoAvatar size="sm" styledContainer />
                    </div>
                  )}
                  {msg.role === "user" ? (
                    <div className="max-w-[88%] min-w-0 rounded-2xl px-4 py-3.5 bg-[rgb(var(--rb-brand-primary))] text-white shadow-sm">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="max-w-[88%] min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900">{t("header.title")}</span>
                        <span className="text-[11px] text-slate-500">{t("header.subtitle")}</span>
                      </div>
                      {(msg.groundingLabel || msg.grounded !== undefined) && (
                        <p className="text-[11px] text-slate-500 pb-2 border-b border-slate-200 font-medium">
                          {msg.groundingLabel ?? (msg.grounded === true ? t("grounding.syncedDocs") : t("grounding.general"))}
                        </p>
                      )}
                      <AssistantMessageContent content={msg.content} variant="light" />
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                        {quickActions.map((action) => (
                          <Link
                            key={action.label}
                            href={action.href(projectId)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            {action.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {isSending && (
                <div className="flex gap-3 justify-start">
                  <div className="mt-1 shrink-0">
                    <SapitoAvatar size="sm" thinking styledContainer />
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-600 text-sm">
                    {t("states.thinking")}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-2 px-1 text-xs text-red-700">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2.5 shrink-0 p-1">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isSending}
          className="flex-1 rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/30 focus:border-[rgb(var(--rb-brand-primary))]/35 disabled:opacity-70"
          placeholder={t("input.placeholder")}
          aria-label={t("input.aria")}
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          className="rounded-xl rb-btn-primary font-medium px-4 py-2.5 text-sm disabled:opacity-60 shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2"
        >
          {isSending ? t("input.sending") : t("input.send")}
        </button>
      </form>
    </div>
  );
}
