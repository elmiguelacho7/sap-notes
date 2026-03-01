"use client";

import { useState, type FormEvent } from "react";
import { Bot } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type ChatMessage = { role: "user" | "assistant"; content: string };

const AGENT_URL = "/api/project-agent";

export function GlobalAssistantBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

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
          message: text,
          userId,
          projectId: null,
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
        : "No he podido obtener una respuesta ahora mismo.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error("Global assistant request failed", err);
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {open && (
        <div
          className="rounded-2xl border border-slate-200 bg-white shadow-xl w-[340px] max-h-[480px] flex flex-col overflow-hidden"
          role="dialog"
          aria-label="Asistente general"
        >
          <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-900">Asistente general</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">IA de uso global en la aplicación.</p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 text-[11px]">
            {messages.length === 0 ? (
              <p className="text-slate-500">
                Escribe tu pregunta o indica en qué necesitas ayuda.
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
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-800 border border-slate-200"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          {error && (
            <p className="px-3 py-1 text-[11px] text-red-600 bg-red-50">{error}</p>
          )}
          <form onSubmit={handleSubmit} className="shrink-0 p-3 border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu mensaje…"
              disabled={loading}
              className="flex-1 rounded-full border border-slate-200 px-3 py-2 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:opacity-60"
              aria-label="Mensaje para el asistente"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-slate-900 px-4 py-2 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "…" : "Enviar"}
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-800 transition-colors"
        title="Asistente general"
        aria-label={open ? "Cerrar asistente general" : "Abrir asistente general"}
      >
        <Bot className="h-5 w-5" />
      </button>
    </div>
  );
}
