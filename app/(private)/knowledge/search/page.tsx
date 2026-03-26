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
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;

      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      setInput("");
      setError(null);
      setIsSending(true);

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
          setIsSending(false);
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
        setIsSending(false);
      }
    },
    [isSending]
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

  const isEmpty = messages.length === 0;

  return (
    <PageShell>
      <div className="flex flex-col min-h-0 w-full">
        {/* Back link */}
        <div className="shrink-0 mb-4">
          <Link
            href="/knowledge"
            className="inline-block text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            ← Back to Knowledge Explorer
          </Link>
        </div>

        {/* Hero: Sapito + title + input + prompts */}
        <div className="shrink-0 flex flex-col items-center w-full max-w-3xl mx-auto px-2 py-6 pb-8">
          <div className="mb-5 flex justify-center">
            <SapitoAvatar size="lg" className="shrink-0" />
          </div>
          <div className="text-center space-y-1 mb-6">
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Sapito</h1>
            <p className="text-sm text-slate-500 max-w-xl mx-auto">
              Ask questions across platform knowledge, architecture, governance, and global
              insights.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              <span className="rounded-md border border-slate-200/90 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                Global Knowledge
              </span>
              <span className="rounded-md border border-slate-200/90 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                AI Assistant
              </span>
              <span className="rounded-md border border-slate-200/90 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                Cross-platform insights
              </span>
            </div>
          </div>

          {/* Primary input */}
          <form
            onSubmit={handleSubmit}
            className="w-full flex items-end gap-3 mb-5"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Sapito about platform knowledge, architecture, governance, or SAP documentation..."
              disabled={isSending}
              rows={1}
              className="flex-1 min-h-[48px] max-h-[160px] resize-y rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/30 disabled:opacity-70"
              aria-label="Message to Sapito"
            />
            <button
              type="submit"
              disabled={isSending || !input.trim()}
              className="shrink-0 rounded-xl rb-btn-primary px-4 py-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2"
            >
              {isSending ? "Sending..." : "Send"}
            </button>
          </form>

          {/* Suggested prompts */}
          <div className="flex flex-wrap justify-center gap-3" role="group" aria-label="Suggested prompts">
            {SUGGESTED_PROMPTS.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => sendMessage(text)}
                className="rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/25 focus-visible:ring-offset-2"
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation area */}
        <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100 overflow-hidden">
          {error && (
            <div className="shrink-0 px-5 py-2.5 text-xs text-red-700 bg-red-50 border-b border-red-200">
              {error}
            </div>
          )}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-5 space-y-6 scroll-smooth [scroll-padding-bottom:1rem] min-h-[120px]"
          >
            {isEmpty && (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <p className="text-sm text-slate-500 max-w-md">
                  Your conversation with Sapito will appear here. Use the input above or try a suggested prompt.
                </p>
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
                          ? "bg-[rgb(var(--rb-brand-primary))] text-white"
                          : "bg-slate-50 text-slate-800 border border-slate-200/90"
                      }`}
                    >
                      {msg.role === "assistant" && (msg.groundingLabel ?? msg.grounded !== undefined) && (
                        <p className="text-[11px] text-slate-500 mb-2.5 pb-2 border-b border-slate-200 font-medium">
                          {msg.groundingLabel ??
                            (msg.grounded === true
                              ? "Based on synced documentation"
                              : "General response (no indexed documentation)")}
                        </p>
                      )}
                      {msg.role === "assistant" ? (
                        <div className="[&_.sapito-heading]:!text-slate-900 [&_.sapito-paragraph]:!text-slate-700 [&_.sapito-list]:!text-slate-700 [&_strong]:!text-slate-900">
                          <AssistantMessageContent content={msg.content} />
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="flex gap-3 justify-start">
                    <div className="mt-1 shrink-0">
                      <SapitoAvatar size="sm" thinking />
                    </div>
                    <div className="rounded-2xl px-4 py-3 bg-slate-50 border border-slate-200/90 text-slate-600 text-sm">
                      Sapito is thinking…
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
