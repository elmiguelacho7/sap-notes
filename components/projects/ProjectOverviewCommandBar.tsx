"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  FileText,
  ListTodo,
  MoreHorizontal,
  Plus,
  Ticket,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { ObjectActions } from "@/components/ObjectActions";

export function ProjectOverviewCommandBar({
  projectId,
  permissions,
  loadProject,
  onAskSapito,
}: {
  projectId: string;
  permissions: {
    canEdit: boolean;
    canArchive: boolean;
    canDelete: boolean;
    canManageMembers?: boolean;
  } | null;
  loadProject: () => Promise<boolean>;
  onAskSapito: () => void;
}) {
  const t = useTranslations("projects.overview.command");
  const [workOpen, setWorkOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const workRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (workRef.current && !workRef.current.contains(t)) setWorkOpen(false);
      if (moreRef.current && !moreRef.current.contains(t)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const btnPrimary =
    "inline-flex h-10 items-center gap-2 rounded-xl border border-[rgb(var(--rb-brand-primary))]/35 bg-[rgb(var(--rb-brand-primary))] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[rgb(var(--rb-brand-primary-hover))] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white";
  const btnSecondary =
    "inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white";
  const menuClass =
    "absolute right-0 top-full z-50 mt-1.5 min-w-[220px] rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg shadow-slate-900/10 ring-1 ring-slate-100";
  const menuItem =
    "flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors";

  const hasMore =
    permissions &&
    (permissions.canEdit || permissions.canArchive || permissions.canDelete);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative" ref={workRef}>
        <button
          type="button"
          onClick={() => setWorkOpen((o) => !o)}
          className={btnPrimary}
          aria-expanded={workOpen}
          aria-haspopup="true"
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          {t("addWork")}
          <ChevronDown
            className={`h-4 w-4 shrink-0 opacity-90 transition-transform ${workOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        {workOpen ? (
          <div className={menuClass} role="menu">
            <Link
              href={`/projects/${projectId}/tasks?new=1`}
              role="menuitem"
              className={menuItem}
              onClick={() => setWorkOpen(false)}
            >
              <CheckSquare className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              {t("newTask")}
            </Link>
            <Link
              href={`/projects/${projectId}/tickets?new=1`}
              role="menuitem"
              className={menuItem}
              onClick={() => setWorkOpen(false)}
            >
              <Ticket className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              {t("newTicket")}
            </Link>
            <Link
              href={`/projects/${projectId}/notes?new=1`}
              role="menuitem"
              className={menuItem}
              onClick={() => setWorkOpen(false)}
            >
              <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              {t("newNote")}
            </Link>
            <Link
              href={`/projects/${projectId}/planning/activities?new=1`}
              role="menuitem"
              className={menuItem}
              onClick={() => setWorkOpen(false)}
            >
              <ListTodo className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              {t("newActivity")}
            </Link>
          </div>
        ) : null}
      </div>

      <Link href={`/projects/${projectId}/planning`} className={btnSecondary}>
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        {t("openPlanning")}
      </Link>

      <button type="button" onClick={onAskSapito} className={btnSecondary}>
        <Bot className="h-4 w-4 shrink-0 text-[rgb(var(--rb-brand-primary))]" aria-hidden />
        {t("askSapito")}
      </button>

      {hasMore ? (
        <div className="relative" ref={moreRef}>
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className={btnSecondary}
            aria-expanded={moreOpen}
            aria-haspopup="true"
          >
            <MoreHorizontal className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            {t("more")}
          </button>
          {moreOpen && permissions ? (
            <div className={`${menuClass} p-2`}>
              <ObjectActions
                entity="project"
                id={projectId}
                canEdit={permissions.canEdit}
                canDelete={permissions.canDelete}
                canArchive={permissions.canArchive}
                archiveEndpoint={`/api/projects/${projectId}/archive`}
                deleteEndpoint={`/api/projects/${projectId}`}
                onArchived={() => void loadProject()}
                variant="light"
                stacked
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
