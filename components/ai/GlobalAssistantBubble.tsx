"use client";

import { useState, type FormEvent, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { SapitoAvatar } from "./SapitoAvatar";
import { AssistantSuggestionChips } from "./AssistantSuggestionChips";
import { AssistantMessageContent } from "./AssistantMessageContent";

type ChatMessage = { role: "user" | "assistant"; content: string; grounded?: boolean };

const AGENT_URL = "/api/project-agent";

const GLOBAL_SUGGESTIONS = [
  "¿Cuántos proyectos activos hay?",
  "¿Hay tickets abiertos?",
  "Resumen de la plataforma",
  "¿Qué está más activo ahora?",
];

export function GlobalAssistantBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

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
          message: trimmed,
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

      const data = (await res.json()) as { reply?: string; grounded?: boolean };
      const reply = typeof data?.reply === "string"
        ? data.reply
        : "No he podido obtener una respuesta de Sapito ahora mismo.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply, grounded: data?.grounded === true }]);
    } catch (err) {
      console.error("Global assistant request failed", err);
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {open && (
        <div
          className="rounded-2xl border border-slate-200 bg-white shadow-xl w-[360px] max-h-[500px] flex flex-col overflow-hidden"
          role="dialog"
          aria-label="Sapito"
        >
          <div className="shrink-0 px-4 py-4 border-b border-slate-200 bg-slate-50/80">
            <div className="flex items-start gap-3">
              <SapitoAvatar size="md" className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-900">Sapito</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Asistente técnico SAP. Consultas sobre errores, transacciones y procesos.
                </p>
              </div>
              <span
                className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${loading ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`}
                title={loading ? "Pensando…" : "Disponible"}
                aria-hidden="true"
              />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-sm scroll-smooth [scroll-padding-bottom:1rem]">
            {messages.length === 0 && !loading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center">
                <div className="flex justify-center mb-3">
                  <SapitoAvatar size="lg" />
                </div>
                <p className="text-sm font-medium text-slate-700">Soy Sapito, tu asistente técnico SAP</p>
                <p className="mt-1 text-xs text-slate-500">
                  Puedo ayudarte con el estado de la plataforma, proyectos, notas y tickets. Elige una sugerencia o escribe.
                </p>
                <div className="mt-4">
                  <AssistantSuggestionChips
                    suggestions={GLOBAL_SUGGESTIONS}
                    onSelect={sendMessage}
                    disabled={loading}
                  />
                </div>
              </div>
            ) : messages.length === 0 && loading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-6 text-center">
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
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-slate-50/90 text-slate-800 border border-slate-200/80 shadow-sm"
                      }`}
                    >
                      {msg.role === "assistant" && msg.grounded === true && (
                        <p className="text-[11px] text-slate-500 mb-2.5 pb-2 border-b border-slate-200 font-medium">
                          Según la documentación sincronizada
                        </p>
                      )}
                      {msg.role === "assistant" && msg.grounded === false && (
                        <p className="text-[11px] text-slate-400 mb-2.5 pb-2 border-b border-slate-200">
                          Respuesta general (sin documentación indexada)
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
          {error && (
            <p className="shrink-0 px-5 py-2.5 text-xs text-red-600 bg-red-50 border-t border-red-100">{error}</p>
          )}
          <form onSubmit={handleSubmit} className="shrink-0 p-4 pt-3 border-t border-slate-200 flex items-center gap-2.5 bg-white">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Error, transacción o tema…"
              disabled={loading}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60 shadow-sm"
              aria-label="Mensaje para Sapito"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 shrink-0 transition-colors shadow-sm"
            >
              {loading ? "Enviando…" : "Enviar"}
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-800 transition-colors"
        title="Sapito · Asistente técnico SAP"
        aria-label={open ? "Cerrar Sapito" : "Abrir Sapito"}
      >
        <SapitoAvatar size="lg" />
      </button>
    </div>
  );
}
