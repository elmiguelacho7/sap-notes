"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";
import { AssigneeSelect } from "@/components/AssigneeSelect";
import type { TicketPriority, TicketStatus } from "@/lib/types/ticketTypes";

const inputClass =
  "w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2.5 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] focus:border-[rgb(var(--rb-brand-primary))]/35 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35";
const labelClass = "mb-1.5 block text-xs font-medium text-[rgb(var(--rb-text-secondary))]";

export default function ProjectNewTicketPage() {
  const t = useTranslations("tickets.new");
  const tPriority = useTranslations("tickets.priority");
  const tStatus = useTranslations("tickets.status");
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const projectId = (params?.id ?? "") as string;
  const fromQuick = searchParams?.get("from") === "quick";

  const priorityOptions = useMemo(
    () =>
      (["low", "medium", "high", "urgent"] as const).map((value) => ({
        value,
        label: tPriority(value),
      })),
    [tPriority]
  );

  const statusOptions = useMemo(
    () =>
      (["open", "in_progress", "resolved", "closed"] as const).map((value) => ({
        value,
        label: tStatus(value),
      })),
    [tStatus]
  );

  const [showCreandoBanner, setShowCreandoBanner] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [status, setStatus] = useState<TicketStatus>("open");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const titlePrefilled = useRef(false);
  const descriptionPrefilled = useRef(false);

  useEffect(() => {
    if (titlePrefilled.current) return;
    const pre = searchParams?.get("title")?.trim();
    if (pre) {
      setTitle(pre);
      titlePrefilled.current = true;
    }
  }, [searchParams]);

  useEffect(() => {
    if (descriptionPrefilled.current) return;
    const pre = searchParams?.get("description")?.trim();
    if (pre) {
      setDescription(pre);
      descriptionPrefilled.current = true;
    }
  }, [searchParams]);

  useEffect(() => {
    if (fromQuick) {
      setShowCreandoBanner(true);
      const t = setTimeout(() => setShowCreandoBanner(false), 2000);
      return () => clearTimeout(t);
    }
  }, [fromQuick]);

  useEffect(() => {
    if (fromQuick && titleInputRef.current) {
      const t = setTimeout(() => titleInputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [fromQuick]);

  useEffect(() => {
    if (fromQuick && projectId) {
      router.replace(`/projects/${projectId}/tickets/new`);
    }
  }, [fromQuick, projectId, router]);

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
        // Default responsible to current user.
        setAssigneeUserId(uid);
      } catch (error) {
        console.error("Tickets error:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const titleTrim = title.trim();
    if (!titleTrim) {
      setErrorMsg(t("errors.titleRequired"));
      return;
    }

    if (!projectId) {
      setErrorMsg(t("errors.missingProject"));
      return;
    }

    setSubmitting(true);

    try {
      if (!currentUserId) {
        setErrorMsg(t("errors.userUnknown"));
        setSubmitting(false);
        return;
      }

      const { data, error } = await supabase
        .from("tickets")
        .insert({
          title: titleTrim,
          description: description.trim() || null,
          priority,
          status,
          project_id: projectId,
          due_date: dueDate.trim() || null,
          assigned_to: assigneeUserId ?? null,
          created_by: currentUserId,
        })
        .select("id")
        .single();

      if (error) {
        handleSupabaseError("tickets insert", error);
        const code = (error as { code?: string }).code;
        const msg = String((error as { message?: string }).message ?? "");
        if (code === "23514" || msg.includes("tickets_client_or_project_chk")) {
          setErrorMsg(t("errors.clientProjectConflict"));
        } else {
          setErrorMsg(error.message ?? t("errors.createFailed"));
        }
        setSubmitting(false);
        return;
      }

      const createdId = data?.id as string | undefined;
      if (createdId) {
        const linkExec = searchParams?.get("linkTestingExecution")?.trim();
        const linkScript = searchParams?.get("linkTestingScriptId")?.trim();
        if (linkExec && linkScript) {
          try {
            await fetch(`/api/projects/${projectId}/testing/executions/${linkExec}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ defect_ticket_id: createdId }),
            });
          } catch {
            /* non-blocking: ticket was created */
          }
        }
        router.push(`/projects/${projectId}/tickets`);
      } else {
        setErrorMsg(t("errors.redirectFailed"));
      }
    } catch (error) {
      console.error("Tickets error:", error);
      setErrorMsg(t("errors.createFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!projectId) {
    return (
      <div className="w-full min-w-0 space-y-4">
        <p className="text-sm text-[rgb(var(--rb-text-secondary))]">{t("invalidProjectId")}</p>
        <Link
          href="/projects"
          className="inline-block text-sm font-medium text-[rgb(var(--rb-brand-primary))] hover:underline"
        >
          {t("backToProjects")}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-10">
      {showCreandoBanner && (
        <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-3 py-2 text-xs text-[rgb(var(--rb-text-muted))] shadow-sm">
          {t("creatingBanner")}
        </div>
      )}
      <header>
        <div className="space-y-3">
          <ProjectPageHeader
            variant="page"
            eyebrow={t("eyebrow")}
            title={t("title")}
            subtitle={t("subtitle")}
          />
          <div className="h-px bg-[rgb(var(--rb-surface-border))]/60" />
        </div>
      </header>

      {errorMsg && (
        <div className="rounded-xl border border-red-200/90 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-[rgb(var(--rb-surface-border))]/75 bg-[rgb(var(--rb-surface))] shadow-md ring-1 ring-[rgb(var(--rb-brand-primary))]/5">
        <form onSubmit={handleSubmit} className="space-y-9 p-7 md:p-9">
          <div className="space-y-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">
              {t("sectionMain")}
            </h2>
            <div>
              <label className={labelClass}>{t("fieldTitle")}</label>
              <input
                ref={titleInputRef}
                type="text"
                className={inputClass}
                placeholder={t("titlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>{t("fieldDescription")}</label>
              <textarea
                className={`${inputClass} min-h-[100px] resize-y`}
                rows={3}
                placeholder={t("descriptionPlaceholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-6 border-t border-[rgb(var(--rb-surface-border))]/60 pt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">
              {t("sectionManagement")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>{t("fieldAssignee")}</label>
                <div className="flex items-center gap-2 min-h-[42px]">
                  <AssigneeSelect
                    contextType="project"
                    projectId={projectId}
                    value={assigneeUserId}
                    onChange={setAssigneeUserId}
                    placeholder={t("assigneePlaceholder")}
                    className="w-full max-w-xs"
                    appearance="light"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>{t("fieldPriority")}</label>
                <select
                  className={inputClass}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                >
                  {priorityOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("fieldStatus")}</label>
                <select
                  className={inputClass}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TicketStatus)}
                >
                  {statusOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("fieldDueDate")}</label>
                <input
                  type="date"
                  className={inputClass}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-[rgb(var(--rb-surface-border))]/60 pt-6">
            <Link
              href={`/projects/${projectId}/tickets`}
              className="inline-flex items-center rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-4 py-2.5 text-sm font-medium text-[rgb(var(--rb-text-primary))] transition-colors hover:bg-[rgb(var(--rb-surface))]/80"
            >
              {t("cancel")}
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center rounded-xl border border-transparent bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[rgb(var(--rb-brand-primary-hover))] active:bg-[rgb(var(--rb-brand-primary-active))] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? t("submitting") : t("submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
