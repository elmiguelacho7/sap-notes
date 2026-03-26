"use client";

import { useState, type FormEvent, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { SapitoAvatar } from "./SapitoAvatar";
import { AssistantSuggestionChips } from "./AssistantSuggestionChips";
import { AssistantMessageContent } from "./AssistantMessageContent";

type ChatMessage = { role: "user" | "assistant"; content: string; grounded?: boolean; groundingLabel?: string };

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
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const res = await fetch(AGENT_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: trimmed,
          userId,
          projectId: null,
          mode: "global",
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
              <SapitoAvatar size="md" className="mt-0.5 shrink-0" thinking={loading} />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-900">Sapito</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Global SAP Copilot — asistente técnico SAP. Consultas sobre errores, transacciones y procesos.
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
                <p className="text-sm font-medium text-slate-700">Soy Sapito, tu Global SAP Copilot</p>
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
                <SapitoAvatar size="lg" className="mx-auto mb-2 inline-block" thinking />
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
                          ? "bg-[rgb(var(--rb-brand-primary))] text-white shadow-sm shadow-[rgb(var(--rb-brand-primary))]/15"
                          : "bg-slate-50/90 text-slate-800 border border-slate-200/80 shadow-sm"
                      }`}
                    >
                      {msg.role === "assistant" && (msg.groundingLabel || msg.grounded !== undefined) && (
                        <p className="text-[11px] text-slate-500 mb-2.5 pb-2 border-b border-slate-200 font-medium">
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
                      <SapitoAvatar size="sm" thinking />
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
              className="flex-1 rounded-xl border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface))]/90 px-3.5 py-2.5 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/30 focus:border-[rgb(var(--rb-brand-primary))]/35 disabled:opacity-60 shadow-sm"
              aria-label="Mensaje para Sapito"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rb-btn-primary rounded-xl border border-transparent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 shrink-0 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {loading ? "Enviando…" : "Enviar"}
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(var(--rb-brand-primary))] text-white shadow-lg shadow-[rgb(var(--rb-brand-primary))]/25 hover:bg-[rgb(var(--rb-brand-primary-hover))] active:bg-[rgb(var(--rb-brand-primary-active))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--rb-workspace-bg))]"
        title="Sapito · Global SAP Copilot"
        aria-label={open ? "Cerrar Sapito" : "Abrir Sapito"}
      >
        <SapitoAvatar size="lg" />
      </button>
    </div>
  );
}
