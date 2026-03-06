"use client";

import { useState, type FormEvent, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AssistantSuggestionChips } from "./AssistantSuggestionChips";

type ChatMessage = { role: "user" | "assistant"; content: string };

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
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data?.error ?? "No se pudo obtener respuesta.");
        setLoading(false);
        return;
      }

      const data = (await res.json()) as { reply?: string };
      const reply = typeof data?.reply === "string"
        ? data.reply
        : "No he podido obtener una respuesta de Sapito ahora mismo.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
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
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 space-y-4 text-sm">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center">
              <p className="text-sm font-medium text-slate-700">Estoy listo para ayudarte con este proyecto</p>
              <p className="mt-1 text-xs text-slate-500">
                Pregunta por riesgos, tareas vencidas, tickets o el siguiente foco. Tengo contexto de este proyecto.
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
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-slate-800 border border-slate-200 shadow-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {error && (
        <p className="mt-2 px-1 text-xs text-red-600">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2 shrink-0 p-1">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Mensaje, error SAP o consulta sobre este proyecto…"
          disabled={loading}
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
          aria-label="Mensaje para Sapito del proyecto"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 shrink-0 transition-colors"
        >
          {loading ? "Enviando…" : "Enviar"}
        </button>
      </form>
    </div>
  );
}
