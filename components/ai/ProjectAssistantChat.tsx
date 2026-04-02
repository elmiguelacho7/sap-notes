"use client";

import { useState, type FormEvent, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabaseClient";
import { SapitoAvatar } from "./SapitoAvatar";
import { AssistantSuggestionChips } from "./AssistantSuggestionChips";
import { AssistantMessageContent } from "./AssistantMessageContent";
import type { SapitoAction } from "@/lib/ai/actionSuggestions";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  grounded?: boolean;
  groundingLabel?: string;
  meta?: {
    sourceLabelsUsed?: string[];
    confidenceLevel?: "high" | "medium" | "low";
    groundingType?: string;
    responseMode?: string;
    followUps?: string[];
    sourceSummary?: string;
    actions?: SapitoAction[];
  };
};

const AGENT_URL = "/api/project-agent";

const PROJECT_SUGGESTIONS_PAYLOAD = [
  "¿Qué problemas hemos resuelto antes en este proyecto (memoria del proyecto)?",
  "Resume la documentación conectada (Drive) más relevante para este tema",
  "¿Qué decisiones hemos tomado y por qué?",
  "¿Cuál es el siguiente paso recomendado para desbloquear esto?",
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
  const router = useRouter();
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

      const data = (await res.json()) as { reply?: string; grounded?: boolean; groundingLabel?: string; meta?: ChatMessage["meta"] };
      const reply = typeof data?.reply === "string"
        ? data.reply
        : t("errors.noReplyNow");
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: reply,
        grounded: data?.grounded === true,
        groundingLabel: typeof data?.groundingLabel === "string" ? data.groundingLabel : undefined,
        meta: data?.meta,
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

  const handleSapitoAction = useCallback(
    (action: SapitoAction) => {
      const path = action.payload?.path;
      const prompt = action.payload?.message;
      if (typeof path === "string" && path.startsWith("/")) {
        router.push(path);
        return;
      }
      if (typeof prompt === "string" && prompt.trim()) {
        void sendMessage(prompt);
      }
    },
    [router, sendMessage]
  );

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

                      {msg.meta && (
                        <div className="pt-2 border-t border-slate-200 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {msg.meta.confidenceLevel && (
                              <span className="rounded-md border border-slate-200/90 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                Confidence: {msg.meta.confidenceLevel}
                              </span>
                            )}
                            {Array.isArray(msg.meta.sourceLabelsUsed) &&
                              msg.meta.sourceLabelsUsed.slice(0, 6).map((s) => (
                                <span
                                  key={s}
                                  className="rounded-md border border-slate-200/90 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                                >
                                  {s}
                                </span>
                              ))}
                          </div>
                          {Array.isArray(msg.meta.followUps) && msg.meta.followUps.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {msg.meta.followUps.slice(0, 4).map((text) => (
                                <button
                                  key={text}
                                  type="button"
                                  onClick={() => sendMessage(text)}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/25 focus-visible:ring-offset-2"
                                >
                                  {text}
                                </button>
                              ))}
                            </div>
                          )}
                          {Array.isArray(msg.meta.actions) && msg.meta.actions.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {msg.meta.actions.slice(0, 6).map((action) => (
                                <button
                                  key={`${action.type}-${action.label}`}
                                  type="button"
                                  onClick={() => handleSapitoAction(action)}
                                  className="rounded-lg border border-dashed border-slate-300/90 bg-slate-50/80 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/25 focus-visible:ring-offset-2"
                                >
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

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
