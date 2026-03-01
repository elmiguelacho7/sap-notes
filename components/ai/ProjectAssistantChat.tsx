"use client";

import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabaseClient";

type ChatMessage = { role: "user" | "assistant"; content: string };

const AGENT_URL = "/api/project-agent";

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading || !projectId) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
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
          message: text,
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
        : "No he podido obtener una respuesta del asistente ahora mismo.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error("Project agent request failed", err);
      setError("No se pudo obtener respuesta de la IA. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2 text-[11px]">
        {messages.length === 0 ? (
          <p className="text-slate-500">
            Empieza la conversación contando al asistente qué estás haciendo en este proyecto o pega un error de SAP.
          </p>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-slate-800 border border-slate-200"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {error && (
        <p className="mt-2 text-[11px] text-red-600">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu mensaje para la IA…"
          disabled={loading}
          className="flex-1 rounded-full border border-slate-200 px-3 py-2 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
          aria-label="Mensaje para el asistente del proyecto"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-indigo-600 px-4 py-2 text-[11px] font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? "Enviando..." : "Enviar"}
        </button>
      </form>
    </div>
  );
}
