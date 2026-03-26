"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useProjectWorkspace } from "@/components/projects/ProjectWorkspaceContext";

export function ProjectAIQuickPanel() {
  const { setCopilotOpen, setCopilotPendingMessage, openProjectCopilotWithMessage } =
    useProjectWorkspace();
  const t = useTranslations("projects.overview.sapito");

  const promptBtn =
    "w-full rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2.5 text-left text-xs font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300/90 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35";

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-8px_rgba(15,23,42,0.08)] ring-1 ring-slate-100">
      <div className="mb-4 space-y-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[rgb(var(--rb-brand-primary))]/25 bg-[rgb(var(--rb-brand-primary))]/10 text-[rgb(var(--rb-brand-primary-active))]">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">{t("title")}</h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => openProjectCopilotWithMessage(t("promptRisks"))}
          className={promptBtn}
        >
          {t("promptRisks")}
        </button>
        <button
          type="button"
          onClick={() => openProjectCopilotWithMessage(t("promptBlocking"))}
          className={promptBtn}
        >
          {t("promptBlocking")}
        </button>
        <button
          type="button"
          onClick={() => openProjectCopilotWithMessage(t("promptFocus"))}
          className={promptBtn}
        >
          {t("promptFocus")}
        </button>
        <button
          type="button"
          onClick={() => openProjectCopilotWithMessage(t("promptDocs"))}
          className={promptBtn}
        >
          {t("promptDocs")}
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          setCopilotPendingMessage("");
          setCopilotOpen(true);
        }}
        className="mt-4 w-full rounded-xl border border-[rgb(var(--rb-brand-primary))]/35 bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[rgb(var(--rb-brand-primary-hover))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        {t("openAssistant")}
      </button>

      <p className="mt-4 rounded-xl border border-dashed border-slate-200/90 bg-slate-50/80 px-3 py-2.5 text-center text-[11px] text-slate-500 leading-snug">
        {t("footnote")}
      </p>
    </section>
  );
}
