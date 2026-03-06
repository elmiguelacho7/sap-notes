"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { SapitoAvatar } from "./SapitoAvatar";
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
          aria-label="Sapito del proyecto"
        >
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col border-l border-slate-200 rounded-l-2xl overflow-hidden animate-in slide-in-from-right duration-200">
            <div className="shrink-0 flex items-center justify-between gap-2 px-5 py-4 border-b border-slate-200 bg-slate-50/80">
              <div className="flex items-start gap-3 min-w-0">
                <SapitoAvatar size="md" className="mt-0.5" />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-900">Sapito del proyecto</h2>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {projectName ? `${projectName} — ` : ""}Asistente técnico con contexto del proyecto.
                  </p>
                </div>
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

      {/* Floating pill button - positioned so it does not overlap global bubble */}
      <div className="fixed bottom-6 right-24 z-40 flex flex-col items-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors"
          title="Sapito del proyecto"
          aria-label="Abrir Sapito del proyecto"
        >
          <SapitoAvatar size="sm" />
          <span>Sapito del proyecto</span>
        </button>
      </div>
    </>
  );
}
