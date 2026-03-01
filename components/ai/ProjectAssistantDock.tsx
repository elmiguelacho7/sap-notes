"use client";

import { useState } from "react";
import { Bot, X } from "lucide-react";
import { ProjectAssistantChat } from "./ProjectAssistantChat";

export type ProjectAssistantDockProps = {
  projectId: string;
  projectName?: string;
};

export function ProjectAssistantDock({
  projectId,
  projectName,
}: ProjectAssistantDockProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Drawer panel from the right */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          aria-modal="true"
          role="dialog"
          aria-label="Asistente del proyecto"
        >
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
            <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-indigo-50/80">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-900">Asistente del proyecto</h2>
                <p className="text-[11px] text-slate-600 truncate">
                  {projectName || "Proyecto"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
                aria-label="Cerrar panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden p-4">
              <ProjectAssistantChat projectId={projectId} projectName={projectName} />
            </div>
          </div>
        </div>
      )}

      {/* Floating pill button - positioned so it does not overlap global bubble (e.g. right-24 when global is right-6) */}
      <div className="fixed bottom-6 right-24 z-40 flex flex-col items-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-indigo-700 transition-colors"
          title="IA del proyecto"
          aria-label="Abrir asistente del proyecto"
        >
          <Bot className="h-4 w-4" />
          <span>IA del proyecto</span>
        </button>
      </div>
    </>
  );
}
