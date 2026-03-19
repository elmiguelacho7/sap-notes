"use client";

import { X } from "lucide-react";
import { SapitoAvatar } from "./SapitoAvatar";
import { ProjectAssistantChat } from "./ProjectAssistantChat";
import { useProjectWorkspace } from "@/components/projects/ProjectWorkspaceContext";

export type ProjectAssistantDockProps = {
  projectId: string;
  projectName?: string;
};

export function ProjectAssistantDock({
  projectId,
  projectName,
}: ProjectAssistantDockProps) {
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
          aria-label="Sapito Project Copilot"
        >
          <div
            className="absolute inset-0 bg-black/30"
            onClick={handleClose}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md bg-slate-950 shadow-xl flex flex-col border-l border-slate-700 rounded-l-2xl overflow-hidden animate-in slide-in-from-right duration-200">
            <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-slate-900/90 border-b border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <SapitoAvatar size="md" styledContainer showOnlineIndicator />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-100">Sapito AI</h2>
                  <p className="text-xs text-slate-500">Copiloto del proyecto</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Analizando este proyecto</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition"
                aria-label="Cerrar panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden p-4 flex flex-col bg-gradient-to-b from-slate-950 to-slate-900">
              <ProjectAssistantChat
                projectId={projectId}
                projectName={projectName}
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
          className="inline-flex items-center gap-2 rounded-full bg-slate-800/80 border border-slate-600 backdrop-blur-sm px-4 py-2 shadow-lg hover:border-emerald-500 transition-colors text-slate-200"
          title="Project Copilot — Sapito"
          aria-label="Abrir Project Copilot"
        >
          <SapitoAvatar size="sm" styledContainer />
          <div className="flex flex-col items-start min-w-0">
            <span className="text-sm font-medium text-slate-100 truncate">Sapito</span>
            <span className="text-[11px] text-slate-500 -mt-0.5">Project Copilot</span>
          </div>
        </button>
      </div>
    </>
  );
}
