"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { ClientSelector } from "./ClientSelector";
import { AssigneeSelect } from "@/components/AssigneeSelect";
import type { TicketPriority, TicketStatus } from "@/lib/types/ticketTypes";
import {
  FORM_FOOTER_ACTIONS_CLASS,
  FORM_PAGE_BLOCK_CLASS,
  FORM_PAGE_SHELL_CLASS,
  FORM_PAGE_SUBTITLE_CLASS,
  FORM_PAGE_TITLE_BLOCK_CLASS,
  FORM_PAGE_TITLE_CLASS,
  FORM_SECTION_DIVIDER_CLASS,
  FORM_SECTION_HELPER_CLASS,
  FORM_SECTION_TITLE_CLASS,
} from "@/components/layout/formPageClasses";

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const inputClass =
  "w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2.5 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] focus:border-[rgb(var(--rb-brand-primary))]/35 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35";
const labelClass = "mb-1.5 block text-xs font-medium text-[rgb(var(--rb-text-secondary))]";

export default function NewTicketPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromQuery = searchParams.get("projectId") ?? "";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [status, setStatus] = useState<TicketStatus>("open");
  const [projectId, setProjectId] = useState("");
  const [clientId, setClientId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (projectIdFromQuery) {
      setProjectId(projectIdFromQuery);
      setClientId("");
    }
  }, [projectIdFromQuery]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        const uid = user?.id ?? null;
        setCurrentUserId(uid);
        setAssignedTo(uid);
      } catch (error) {
        console.error("Tickets error:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveProjectId = (projectIdFromQuery?.trim() || projectId.trim()) || null;
  const effectiveClientId = clientId.trim() || null;
  const hasProject = effectiveProjectId != null && effectiveProjectId !== "";
  const hasClient = effectiveClientId != null && effectiveClientId !== "";

  const handleProjectChange = (v: string) => {
    setProjectId(v);
    if (v.trim()) setClientId("");
  };

  const handleClientChange = (id: string | null, _name: string | null) => {
    setClientId(id ?? "");
    if (id) setProjectId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const titleTrim = title.trim();
    if (!titleTrim) {
      setErrorMsg("Title is required.");
      return;
    }

    const proj = (projectIdFromQuery?.trim() || projectId.trim()) || null;
    const cli = clientId.trim() || null;

    if (proj && cli) {
      setErrorMsg("A ticket can be linked to either a project or a client, not both.");
      return;
    }

    setSubmitting(true);

    const payload: Record<string, unknown> = {
      title: titleTrim,
      description: description.trim() || null,
      priority,
      status,
      due_date: dueDate.trim() || null,
      project_id: proj ?? null,
      client_id: cli ?? null,
    };

    if (!currentUserId) {
      setErrorMsg("Could not identify the current user.");
      setSubmitting(false);
      return;
    }

    payload.assigned_to = assignedTo ?? null;
    payload.created_by = currentUserId;

    let data: { id?: string } | null = null;
    try {
      const res = await supabase.from("tickets").insert(payload).select("id").single();
      data = res.data as { id?: string } | null;
      if (res.error) {
        handleSupabaseError("tickets insert", res.error);
        const code = (res.error as { code?: string }).code;
        const msg = String((res.error as { message?: string }).message ?? "");
        if (code === "23514" || msg.includes("tickets_client_or_project_chk")) {
          setErrorMsg("A ticket cannot be linked to a project and a client at the same time.");
        } else {
          setErrorMsg("Could not create the ticket. Please try again later.");
        }
        setSubmitting(false);
        return;
      }
    } catch (error) {
      console.error("Tickets error:", error);
      setErrorMsg("Could not create the ticket. Please try again later.");
      setSubmitting(false);
      return;
    }

    const createdId = data?.id as string | undefined;
    if (createdId) {
      if (effectiveProjectId) {
        router.push(`/projects/${effectiveProjectId}/tickets`);
      } else {
        router.push(`/tickets/${createdId}`);
      }
    } else {
      setErrorMsg("The ticket was created but redirect failed. Open the ticket list.");
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full min-w-0 bg-[rgb(var(--rb-shell-bg))]">
      <div className={FORM_PAGE_SHELL_CLASS}>
        <header className={FORM_PAGE_TITLE_BLOCK_CLASS}>
          <h1 className={FORM_PAGE_TITLE_CLASS}>New ticket</h1>
          <p className={FORM_PAGE_SUBTITLE_CLASS}>
            Create a ticket, set assignee, priority, and context. Link it to a project or a client if
            needed.
          </p>
        </header>

        {errorMsg && (
          <div className={`${FORM_PAGE_BLOCK_CLASS} rounded-xl border border-red-200/90 bg-red-50 px-4 py-3 text-sm text-red-800`}>
            {errorMsg}
          </div>
        )}

        <div className={`${FORM_PAGE_BLOCK_CLASS} rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] p-6 shadow-md md:p-8`}>
          <form onSubmit={handleSubmit} className="space-y-0">
            <div className="space-y-4">
              <h2 className={FORM_SECTION_TITLE_CLASS}>Main information</h2>
              <div>
                <label className={labelClass}>Title *</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Ticket summary"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Description (optional)</label>
                <textarea
                  className={`${inputClass} min-h-[120px] resize-y`}
                  rows={4}
                  placeholder="Ticket details"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className={`space-y-4 ${FORM_SECTION_DIVIDER_CLASS}`}>
              <h2 className={FORM_SECTION_TITLE_CLASS}>Assignment and status</h2>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <label className={labelClass}>Assignee</label>
                  <AssigneeSelect
                    contextType="global"
                    value={assignedTo}
                    onChange={setAssignedTo}
                    placeholder="Unassigned"
                    className="w-full"
                    appearance="light"
                  />
                </div>
                <div>
                  <label className={labelClass}>Priority</label>
                  <select
                    className={inputClass}
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  >
                    {PRIORITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select
                    className={inputClass}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TicketStatus)}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="hidden lg:block" aria-hidden />
              </div>
            </div>

            <div className={`space-y-4 ${FORM_SECTION_DIVIDER_CLASS}`}>
              <h2 className={FORM_SECTION_TITLE_CLASS}>Context</h2>
              <p className={FORM_SECTION_HELPER_CLASS}>
                A ticket can be global (no project or client), project-scoped, or client-scoped. You cannot
                link both a project and a client.
              </p>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <label className={labelClass}>Project (optional)</label>
                  <input
                    type="text"
                    className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
                    placeholder="Project ID"
                    value={projectId}
                    onChange={(e) => handleProjectChange(e.target.value)}
                    disabled={hasClient}
                  />
                  {hasClient && (
                    <p className="mt-1 text-[11px] text-amber-700">Clear the client to select a project.</p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Client (optional)</label>
                  <ClientSelector
                    value={clientId}
                    onChange={handleClientChange}
                    disabled={hasProject}
                    placeholder="Search client…"
                  />
                  {hasProject && (
                    <p className="mt-1 text-[11px] text-amber-700">Clear the project to select a client.</p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Due date (optional)</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className={FORM_FOOTER_ACTIONS_CLASS}>
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex items-center rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-4 py-2.5 text-sm font-medium text-[rgb(var(--rb-text-primary))] transition-colors hover:bg-[rgb(var(--rb-surface))]/80"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center rounded-xl border border-transparent bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[rgb(var(--rb-brand-primary-hover))] active:bg-[rgb(var(--rb-brand-primary-active))] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Creating…" : "Create ticket"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
