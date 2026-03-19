"use client";

import { useState, type FormEvent, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { SapitoAvatar } from "./SapitoAvatar";
import { AssistantSuggestionChips } from "./AssistantSuggestionChips";
import { AssistantMessageContent } from "./AssistantMessageContent";

type ChatMessage = { role: "user" | "assistant"; content: string; grounded?: boolean; groundingLabel?: string };

const AGENT_URL = "/api/project-agent";

const PROJECT_SUGGESTIONS = [
  "¿Qué tareas están vencidas?",
  "¿Qué tickets siguen abiertos?",
  "¿Qué conocimiento tenemos sobre este tema?",
];

const QUICK_ACTIONS = [
  { label: "Ver tareas vencidas", href: (id: string) => `/projects/${id}/tasks` },
  { label: "Ver tickets abiertos", href: (id: string) => `/projects/${id}/tickets` },
  { label: "Ir a Tasks", href: (id: string) => `/projects/${id}/tasks` },
] as const;

type ProjectAssistantChatProps = {
  projectId: string;
  projectName?: string;
  /** When set, open from another page (e.g. Brain): send this message once and clear */
  initialMessage?: string;
  onClearInitialMessage?: () => void;
};

export function ProjectAssistantChat({
  projectId,
  projectName,
  initialMessage,
  onClearInitialMessage,
}: ProjectAssistantChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialMessageSentRef = useRef(false);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading || !projectId) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setError(null);
    setLoading(true);

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
        setError(data?.error ?? "No se pudo obtener respuesta.");
        setLoading(false);
        return;
      }

      const data = (await res.json()) as { reply?: string; grounded?: boolean; groundingLabel?: string };
      const reply = typeof data?.reply === "string"
        ? data.reply
        : "No he podido obtener una respuesta de Sapito ahora mismo.";
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: reply,
        grounded: data?.grounded === true,
        groundingLabel: typeof data?.groundingLabel === "string" ? data.groundingLabel : undefined,
      }]);
    } catch (err) {
      console.error("Project agent request failed", err);
      setError("No se pudo obtener respuesta de la IA. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [loading, projectId]);

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

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/40 p-4 sm:p-5 space-y-6 text-sm">
          {messages.length === 0 && !loading ? (
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-4">
              <div className="flex items-center gap-3">
                <SapitoAvatar size="lg" styledContainer showOnlineIndicator />
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Sapito AI</h3>
                  <p className="text-xs text-slate-500">Copiloto del proyecto</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-slate-300 text-sm leading-relaxed font-medium">
                  Qué puedo hacer por ti
                </p>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Soy tu asistente de proyecto con contexto de tareas, tickets y conocimiento. Puedo ayudarte a:
                </p>
                <ul className="list-disc list-outside pl-4 space-y-1 text-slate-300 text-sm">
                  <li>Resumir el estado del proyecto y tareas vencidas</li>
                  <li>Revisar tickets abiertos y prioridades</li>
                  <li>Buscar en la base de conocimiento del proyecto</li>
                  <li>Sugerir siguientes pasos y riesgos</li>
                </ul>
              </div>
              <div className="pt-1">
                <p className="text-slate-500 text-xs mb-2">Prueba preguntando:</p>
                <AssistantSuggestionChips
                  suggestions={PROJECT_SUGGESTIONS}
                  onSelect={sendMessage}
                  disabled={loading}
                  className="justify-start"
                  variant="dark"
                />
              </div>
            </div>
          ) : messages.length === 0 && loading ? (
            <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-6 text-center">
              <SapitoAvatar size="lg" className="mx-auto mb-2 inline-block" thinking styledContainer />
              <p className="text-sm font-medium text-slate-300">Sapito está pensando…</p>
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
                    <div className="max-w-[88%] min-w-0 rounded-2xl px-4 py-3.5 bg-indigo-600 text-white shadow-sm">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="max-w-[88%] min-w-0 rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-100">Sapito AI</span>
                        <span className="text-[11px] text-slate-500">Project Copilot</span>
                      </div>
                      {(msg.groundingLabel || msg.grounded !== undefined) && (
                        <p className="text-[11px] text-slate-500 pb-2 border-b border-slate-700 font-medium">
                          {msg.groundingLabel ?? (msg.grounded === true ? "Según la documentación sincronizada" : "Respuesta general (sin documentación indexada)")}
                        </p>
                      )}
                      <AssistantMessageContent content={msg.content} variant="dark" />
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-700">
                        {QUICK_ACTIONS.map((action) => (
                          <Link
                            key={action.label}
                            href={action.href(projectId)}
                            className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
                          >
                            {action.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-3 justify-start">
                  <div className="mt-1 shrink-0">
                    <SapitoAvatar size="sm" thinking styledContainer />
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3.5 text-slate-400 text-sm">
                    Sapito está pensando…
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-2 px-1 text-xs text-red-400">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2.5 shrink-0 p-1">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Mensaje, error SAP o consulta sobre este proyecto…"
          disabled={loading}
          className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-60"
          aria-label="Mensaje para Sapito del proyecto"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-medium px-4 py-2.5 text-sm disabled:opacity-60 shrink-0 transition-colors"
        >
          {loading ? "Enviando…" : "Enviar"}
        </button>
      </form>
    </div>
  );
}
