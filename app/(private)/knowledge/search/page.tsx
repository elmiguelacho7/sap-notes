"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { PageShell } from "@/components/layout/PageShell";
import { SapitoAvatar } from "@/components/ai/SapitoAvatar";
import { AssistantMessageContent } from "@/components/ai/AssistantMessageContent";

const AGENT_URL = "/api/project-agent";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  grounded?: boolean;
  groundingLabel?: string;
};

const SUGGESTED_PROMPTS = [
  "Summarize the platform architecture",
  "What do we know about roles and permissions?",
  "Show governance decisions",
  "What has changed in invitations?",
  "Search global knowledge about RBAC",
];

export default function KnowledgeSearchPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      setInput("");
      setError(null);
      setLoading(true);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
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
          setError(data?.error ?? "Could not get a response from Sapito.");
          setLoading(false);
          return;
        }

        const data = (await res.json()) as {
          reply?: string;
          grounded?: boolean;
          groundingLabel?: string;
        };
        const reply =
          typeof data?.reply === "string"
            ? data.reply
            : "I couldn't get a response from Sapito right now.";
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: reply,
            grounded: data?.grounded === true,
            groundingLabel:
              typeof data?.groundingLabel === "string" ? data.groundingLabel : undefined,
          },
        ]);
      } catch (err) {
        console.error("Global Sapito request failed", err);
        setError("Connection error. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [loading]
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const isEmpty = messages.length === 0 && !loading;

  return (
    <PageShell className="bg-slate-950">
      <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[800px]">
        <div className="shrink-0 space-y-4 mb-6">
          <Link
            href="/knowledge"
            className="inline-block text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← Back to Knowledge Explorer
          </Link>

          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-100">Sapito</h1>
            <p className="text-sm text-slate-500 max-w-2xl">
              Ask questions across platform knowledge, architecture, governance, and global
              insights.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="rounded-md border border-slate-600/60 bg-slate-800/60 px-2 py-0.5 text-xs text-slate-400">
                Global Knowledge
              </span>
              <span className="rounded-md border border-slate-600/60 bg-slate-800/60 px-2 py-0.5 text-xs text-slate-400">
                AI Assistant
              </span>
              <span className="rounded-md border border-slate-600/60 bg-slate-800/60 px-2 py-0.5 text-xs text-slate-400">
                Cross-platform insights
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden shadow-sm">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-5 space-y-6 scroll-smooth [scroll-padding-bottom:1rem]"
          >
            {isEmpty && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="mb-4">
                  <SapitoAvatar size="lg" />
                </div>
                <p className="text-sm font-medium text-slate-200">
                  Ask Sapito about platform knowledge, architecture, governance, or SAP
                  documentation.
                </p>
                <p className="mt-1 text-xs text-slate-500 max-w-md">
                  This assistant uses only global knowledge sources and platform context—no
                  project-specific memory.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2" role="group" aria-label="Suggested prompts">
                  {SUGGESTED_PROMPTS.map((text) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => sendMessage(text)}
                      disabled={loading}
                      className="rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-2 text-xs text-slate-300 hover:border-slate-500 hover:bg-slate-700/80 hover:text-slate-200 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isEmpty && (
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
                      className={`max-w-[85%] min-w-0 rounded-2xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-slate-700 text-slate-100"
                          : "bg-slate-800/90 text-slate-200 border border-slate-700/60"
                      }`}
                    >
                      {msg.role === "assistant" && (msg.groundingLabel ?? msg.grounded !== undefined) && (
                        <p className="text-[11px] text-slate-500 mb-2.5 pb-2 border-b border-slate-700 font-medium">
                          {msg.groundingLabel ??
                            (msg.grounded === true
                              ? "Based on synced documentation"
                              : "General response (no indexed documentation)")}
                        </p>
                      )}
                      {msg.role === "assistant" ? (
                        <div className="[&_.sapito-heading]:!text-slate-200 [&_.sapito-paragraph]:!text-slate-300 [&_.sapito-list]:!text-slate-300 [&_strong]:!text-slate-200">
                          <AssistantMessageContent content={msg.content} />
                        </div>
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
                    <div className="rounded-2xl px-4 py-3 bg-slate-800/90 border border-slate-700/60 text-slate-500 text-sm">
                      Sapito is thinking…
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {error && (
            <div className="shrink-0 px-5 py-2.5 text-xs text-red-300 bg-red-950/30 border-t border-red-800/50">
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="shrink-0 p-4 border-t border-slate-700/60 bg-slate-900/50 flex items-end gap-3"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Sapito about platform knowledge, architecture, governance, or SAP documentation..."
              disabled={loading}
              rows={1}
              className="flex-1 min-h-[44px] max-h-[180px] resize-y rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-transparent disabled:opacity-60"
              aria-label="Message to Sapito"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
            >
              {loading ? "Sending…" : "Send"}
            </button>
          </form>
        </div>
      </div>
    </PageShell>
  );
}
