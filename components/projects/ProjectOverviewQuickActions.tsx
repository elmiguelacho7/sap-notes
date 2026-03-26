"use client";

import Link from "next/link";
import { FileText, ListTodo, Brain, Sparkles } from "lucide-react";
import { useProjectWorkspace } from "@/components/projects/ProjectWorkspaceContext";

type Props = {
  projectId: string;
};

/**
 * Compact operational row — does not compete with header primary actions.
 */
export function ProjectOverviewQuickActions({ projectId }: Props) {
  const { openProjectCopilotWithMessage } = useProjectWorkspace();

  const pill =
    "inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/30 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800/50 hover:text-slate-100";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/projects/${projectId}/notes?new=1`} className={pill}>
        <FileText className="h-3.5 w-3.5 text-slate-500" aria-hidden />
        Add note
      </Link>
      <Link href={`/projects/${projectId}/tasks?new=1`} className={pill}>
        <ListTodo className="h-3.5 w-3.5 text-slate-500" aria-hidden />
        Create task
      </Link>
      <Link href={`/projects/${projectId}/brain`} className={pill}>
        <Brain className="h-3.5 w-3.5 text-slate-500" aria-hidden />
        Open Brain
      </Link>
      <button
        type="button"
        onClick={() => openProjectCopilotWithMessage("")}
        className={pill}
      >
        <Sparkles className="h-3.5 w-3.5 text-slate-500" aria-hidden />
        Ask Sapito
      </button>
    </div>
  );
}
