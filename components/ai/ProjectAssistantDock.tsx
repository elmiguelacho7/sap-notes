"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { SapitoAvatar } from "./SapitoAvatar";
import { ProjectAssistantChat } from "./ProjectAssistantChat";
import { useProjectWorkspace } from "@/components/projects/ProjectWorkspaceContext";

export type ProjectAssistantDockProps = {
  projectId: string;
  projectName?: string;
};

export function ProjectAssistantDock({
  projectId,
}: ProjectAssistantDockProps) {
  const t = useTranslations("sapito.dock");
  const {
    copilotOpen,
    setCopilotOpen,
    copilotPendingMessage,
    setCopilotPendingMessage,
  } = useProjectWorkspace();

  const open = copilotOpen;
  const setOpen = setCopilotOpen;

  const handleClose = () => {
    setOpen(false);
    setCopilotPendingMessage("");
  };

  return (
    <>
      {/* Drawer panel from the right */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          aria-modal="true"
          role="dialog"
          aria-label={t("panelAria")}
        >
          <div
            className="absolute inset-0 bg-black/30"
            onClick={handleClose}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col border-l border-slate-200 rounded-l-2xl overflow-hidden animate-in slide-in-from-right duration-200">
            <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-slate-50/90 border-b border-slate-200">
              <div className="flex items-center gap-3 min-w-0">
                <SapitoAvatar size="md" styledContainer showOnlineIndicator />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-900">{t("title")}</h2>
                  <p className="text-xs text-slate-600">{t("subtitle")}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{t("helper")}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition"
                aria-label={t("closePanel")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden p-4 flex flex-col bg-[rgb(var(--rb-workspace-bg))]">
              <ProjectAssistantChat
                projectId={projectId}
                initialMessage={copilotPendingMessage}
                onClearInitialMessage={() => setCopilotPendingMessage("")}
              />
            </div>
          </div>
        </div>
      )}

      {/* Floating pill button - premium style */}
      <div className="fixed bottom-6 right-24 z-40 flex flex-col items-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-4 py-2 shadow-lg hover:bg-slate-50 hover:border-slate-300 transition-colors text-slate-800"
          title={t("openTitle")}
          aria-label={t("openAria")}
        >
          <SapitoAvatar size="sm" styledContainer />
          <div className="flex flex-col items-start min-w-0">
            <span className="text-sm font-medium text-slate-900 truncate">{t("launcherTitle")}</span>
            <span className="text-[11px] text-slate-500 -mt-0.5">{t("launcherSubtitle")}</span>
          </div>
        </button>
      </div>
    </>
  );
}
