"use client";

import { useState, type FormEvent, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { SapitoAvatar } from "./SapitoAvatar";
import { AssistantSuggestionChips } from "./AssistantSuggestionChips";
import { AssistantMessageContent } from "./AssistantMessageContent";

type ChatMessage = { role: "user" | "assistant"; content: string; grounded?: boolean; groundingLabel?: string };

const AGENT_URL = "/api/project-agent";

const PROJECT_SUGGESTIONS = [
  "¿Hay riesgos en este proyecto?",
  "¿Qué tareas están vencidas?",
  "¿Hay tickets prioritarios?",
  "¿Cuál es el siguiente foco?",
];

type ProjectAssistantChatProps = {
  projectId: string;
  projectName?: string;
};

export function ProjectAssistantChat({
  projectId,
  projectName,
}: ProjectAssistantChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5 space-y-6 text-sm">
          {messages.length === 0 && !loading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center">
              <div className="flex justify-center mb-3">
                <SapitoAvatar size="lg" />
              </div>
              <p className="text-sm font-medium text-slate-700">Soy Sapito, tu Project Copilot</p>
              <p className="mt-1 text-xs text-slate-500">
                Asistente contextual de este proyecto. Pregunta por riesgos, tareas vencidas, tickets o el siguiente foco.
              </p>
              <p className="mt-3 text-[11px] text-slate-500">Sugerencias:</p>
              <div className="mt-3">
                <AssistantSuggestionChips
                  suggestions={PROJECT_SUGGESTIONS}
                  onSelect={sendMessage}
                  disabled={loading}
                />
              </div>
            </div>
          ) : messages.length === 0 && loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center">
              <SapitoAvatar size="lg" className="mx-auto mb-2 inline-block" />
              <p className="text-sm font-medium text-slate-700">Sapito está pensando…</p>
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
                      <SapitoAvatar size="sm" />
                    </div>
                  )}
                  <div
                    className={`max-w-[88%] min-w-0 rounded-2xl px-4 py-3.5 ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-white text-slate-800 border border-slate-200/80 shadow-sm"
                    }`}
                  >
                    {msg.role === "assistant" && (msg.groundingLabel || msg.grounded !== undefined) && (
                      <p className="text-[11px] text-slate-500 mb-2.5 pb-2 border-b border-slate-100 font-medium">
                        {msg.groundingLabel ?? (msg.grounded === true ? "Según la documentación sincronizada" : "Respuesta general (sin documentación indexada)")}
                      </p>
                    )}
                    {msg.role === "assistant" ? (
                      <AssistantMessageContent content={msg.content} />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3 justify-start">
                  <div className="mt-1 shrink-0">
                    <SapitoAvatar size="sm" />
                  </div>
                  <div className="rounded-2xl px-4 py-3.5 bg-slate-100 text-slate-500 text-sm border border-slate-200/80">
                    Sapito está pensando…
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-2 px-1 text-xs text-red-600">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2.5 shrink-0 p-1">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Mensaje, error SAP o consulta sobre este proyecto…"
          disabled={loading}
          className="flex-1 rounded-xl border border-slate-200 bg-white/80 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60 shadow-sm"
          aria-label="Mensaje para Sapito del proyecto"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 shrink-0 transition-colors shadow-sm"
        >
          {loading ? "Enviando…" : "Enviar"}
        </button>
      </form>
    </div>
  );
}
