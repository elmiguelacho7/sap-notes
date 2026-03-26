"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AppPageShell } from "@/components/ui/layout/AppPageShell";
import { MyWorkPageHeader } from "@/components/my-work/MyWorkPageHeader";
import {
  TasksAssignedCard,
  type MyWorkTaskRow,
} from "@/components/my-work/TasksAssignedCard";
import {
  BlockedTasksCard,
  type MyWorkTaskRow as BlockedTaskRow,
} from "@/components/my-work/BlockedTasksCard";
import {
  OverdueTasksCard,
  type MyWorkTaskRow as OverdueTaskRow,
} from "@/components/my-work/OverdueTasksCard";
import { MyTicketsCard, type MyWorkTicketRow } from "@/components/my-work/MyTicketsCard";
import { MyActivitiesCard, type MyWorkActivityRow } from "@/components/my-work/MyActivitiesCard";
import { Skeleton } from "@/components/ui/Skeleton";

function humanizeStatus(status: string | null | undefined) {
  const s = String(status ?? "").trim();
  if (!s) return "—";
  const withSpaces = s.replace(/_/g, " ");
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function formatDueDate(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function SapitoInsightCard() {
  return (
    <section className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/80 bg-[rgb(var(--rb-surface))]/95 p-4 space-y-2">
      <div className="space-y-0.5">
        <p className="text-xs font-semibold text-[rgb(var(--rb-text-primary))]">Sapito Insight</p>
        <p className="text-xs text-[rgb(var(--rb-text-muted))]">
          Ask Sapito to prioritize your next actions and highlight potential blockers.
        </p>
      </div>
    </section>
  );
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

const MY_WORK_SECTION_IDS = {
  overdue: "my-work-overdue",
  blocked: "my-work-blocked",
  tickets: "my-work-tickets",
} as const;

function scrollToMyWorkSection(id: string) {
  if (typeof document === "undefined") return;
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function assignedStatusGroup(
  kind: "global" | "project",
  globalCode: string | undefined,
  projectStatus: string | undefined
): "in_progress" | "pending" {
  if (kind === "global") {
    return String(globalCode ?? "").toUpperCase() === "IN_PROGRESS" ? "in_progress" : "pending";
  }
  return String(projectStatus ?? "").toLowerCase().trim() === "in_progress" ? "in_progress" : "pending";
}

function ticketStatusSortKey(status: string | null | undefined): number {
  const s = String(status ?? "").toLowerCase().trim();
  if (s === "in_progress") return 0;
  if (s === "open") return 1;
  return 2;
}

export default function MyWorkPage() {
  const [loading, setLoading] = useState(true);
  const [loadingIdentity, setLoadingIdentity] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  const [tasksAssigned, setTasksAssigned] = useState<MyWorkTaskRow[]>([]);
  const [blockedTasks, setBlockedTasks] = useState<BlockedTaskRow[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<OverdueTaskRow[]>([]);
  const [tickets, setTickets] = useState<MyWorkTicketRow[]>([]);
  const [activities, setActivities] = useState<MyWorkActivityRow[]>([]);

  const loadIdentity = useCallback(async () => {
    setLoadingIdentity(true);
    setError(null);
    setWarning(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      setError("Unable to verify your session.");
      setUserId(null);
      setProfileId(null);
      setLoadingIdentity(false);
      return;
    }

    if (!user?.id) {
      setError("No authenticated user found.");
      setLoadingIdentity(false);
      return;
    }

    // In this schema, `profiles.id = auth.uid()`; we still fetch the row to ensure it exists.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    setUserId(user.id);
    setProfileId((profile as { id?: string } | null)?.id ?? user.id);
    setLoadingIdentity(false);
  }, []);

  useEffect(() => {
    void loadIdentity();
  }, [loadIdentity]);

  const loadData = useCallback(async () => {
    if (!profileId || !userId) return;

    setLoading(true);
    setError(null);
    setWarning(null);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const settled = await Promise.allSettled([
        supabase
          .from("task_statuses")
          .select("id, code")
          .eq("is_active", true)
          .order("order_index", { ascending: true }),
        // Global tasks assignment field is `assignee_id`, and global tasks have `project_id IS NULL`.
        supabase
          .from("tasks")
          .select(
            "id, project_id, title, description, status_id, due_date, priority, created_at, updated_at, assignee_id"
          )
          .is("project_id", null)
          .eq("assignee_id", userId)
          .order("due_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false }),
        // Project tasks assignment field is `assignee_profile_id`.
        supabase
          .from("project_tasks")
          .select(
            "id, project_id, title, description, status, due_date, priority, created_at, updated_at, assignee_profile_id, activity_id"
          )
          .eq("assignee_profile_id", profileId)
          .order("due_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("project_activities")
          .select("id, project_id, name, status, due_date, start_date, owner_profile_id")
          .eq("owner_profile_id", profileId)
          .order("due_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("tickets")
          .select("id, project_id, title, status, due_date, assigned_to, priority, created_at, updated_at")
          .eq("assigned_to", userId)
          .order("due_date", { ascending: true, nullsFirst: false })
          .order("updated_at", { ascending: false }),
      ]);

      const asRes = (
        r: PromiseSettledResult<{ data: unknown; error: unknown | null }>
      ): { data: unknown; error: unknown | null } => {
        if (r.status === "fulfilled") return r.value;
        return { data: null, error: r.reason };
      };

      const taskStatusesRes = asRes(settled[0]);
      const globalTasksRes = asRes(settled[1]);
      const projectTasksRes = asRes(settled[2]);
      const activitiesRes = asRes(settled[3]);
      const ticketsRes = asRes(settled[4]);

      const failures: Record<string, unknown> = {};
      if (taskStatusesRes.error) failures.taskStatuses = taskStatusesRes.error;
      if (globalTasksRes.error) failures.globalTasks = globalTasksRes.error;
      if (projectTasksRes.error) failures.projectTasks = projectTasksRes.error;
      if (activitiesRes.error) failures.activities = activitiesRes.error;
      if (ticketsRes.error) failures.tickets = ticketsRes.error;

      // Only show user-facing warning when core work cards cannot be built.
      // Non-critical failures (e.g. `task_statuses` mapping or project enrichment metadata) should not trigger it.
      const criticalFailures = {
        globalTasks: Boolean(globalTasksRes.error),
        projectTasks: Boolean(projectTasksRes.error),
        tickets: Boolean(ticketsRes.error),
        activities: Boolean(activitiesRes.error),
      };
      const hasCriticalError = Object.values(criticalFailures).some(Boolean);

      const taskStatuses = (Array.isArray(taskStatusesRes.data) ? taskStatusesRes.data : []) as Array<{
        id: string;
        code: string;
      }>;
      const taskCodeById = new Map<string, string>();
      for (const s of taskStatuses) taskCodeById.set(s.id, s.code);

      const globalTaskRows = (Array.isArray(globalTasksRes.data) ? globalTasksRes.data : []) as Array<{
        id: string;
        project_id: string | null;
        title: string;
        description: string | null;
        status_id: string;
        due_date: string | null;
        created_at: string;
        updated_at: string | null;
      }>;

      const projectTaskRows = (Array.isArray(projectTasksRes.data) ? projectTasksRes.data : []) as Array<{
        id: string;
        project_id: string | null;
        title: string;
        description: string | null;
        status: string;
        due_date: string | null;
        created_at: string;
        updated_at: string | null;
      }>;

      const activityRows = (Array.isArray(activitiesRes.data) ? activitiesRes.data : []) as Array<{
        id: string;
        project_id: string | null;
        name: string;
        status: string | null;
        due_date: string | null;
        start_date: string | null;
      }>;

      const ticketRows = (Array.isArray(ticketsRes.data) ? ticketsRes.data : []) as Array<{
        id: string;
        project_id: string | null;
        title: string;
        status: string | null;
        due_date: string | null;
        updated_at: string | null;
      }>;

      // Collect project ids for enriching rows with project names
      const projectIds = new Set<string>();
      for (const t of [
        ...globalTaskRows,
        ...projectTaskRows,
        ...ticketRows,
        ...activityRows,
      ]) {
        const pid = (t as { project_id?: string | null }).project_id;
        if (pid) projectIds.add(pid);
      }

      const projectsMap = new Map<string, string>();
      if (projectIds.size > 0) {
        try {
          const { data: projects, error: projectsErr } = await supabase
            .from("projects")
            .select("id, name")
            .in("id", Array.from(projectIds));
          if (projectsErr) {
            // Non-fatal enrichment failure: keep dashboard operational with fallback project labels.
          } else {
            for (const p of projects ?? []) {
              projectsMap.set((p as { id: string }).id, (p as { name: string }).name);
            }
          }
        } catch (err) {
          console.error("[my-work] projects enrichment threw (non-fatal):", err);
        }
      }
      const projectName = (pid: string | null | undefined) =>
        (pid ? projectsMap.get(pid) : null) ?? (pid ? "Project" : null);

      const isDoneGlobal = (code: string | undefined) =>
        String(code ?? "").toUpperCase() === "DONE";
      const isBlockedGlobal = (code: string | undefined) =>
        String(code ?? "").toUpperCase() === "BLOCKED";
      const isOverdueDate = (due: string | null | undefined) => {
        if (!due) return false;
        const d = new Date(due);
        d.setHours(0, 0, 0, 0);
        return d.getTime() < today.getTime();
      };

      const globalAssigned = globalTaskRows.filter((t) => !isDoneGlobal(taskCodeById.get(t.status_id)));
      const globalBlocked = globalTaskRows.filter((t) => isBlockedGlobal(taskCodeById.get(t.status_id)));
      const globalOverdue = globalTaskRows.filter(
        (t) =>
          !isDoneGlobal(taskCodeById.get(t.status_id)) && isOverdueDate(t.due_date)
      );

      const projectAssigned = projectTaskRows.filter(
        (t) => String(t.status ?? "").toLowerCase().trim() !== "done"
      );
      const projectBlocked = projectTaskRows.filter(
        (t) => String(t.status ?? "").toLowerCase().trim() === "blocked"
      );
      const projectOverdue = projectTaskRows.filter(
        (t) =>
          String(t.status ?? "").toLowerCase().trim() !== "done" &&
          isOverdueDate(t.due_date)
      );

      const toTaskRow = (args: {
        id: string;
        title: string;
        projectId: string | null;
        statusLabel: string;
        dueDate: string | null;
        dueDateIso?: string | null;
        blockedNote?: string | null;
        statusGroup?: "in_progress" | "pending";
        tone?: "blocked" | "overdue";
      }) =>
        ({
          id: args.id,
          title: args.title,
          projectName: projectName(args.projectId),
          statusLabel: args.statusLabel,
          dueDate: formatDueDate(args.dueDate),
          dueDateIso: args.dueDateIso ?? args.dueDate,
          blockedNote: args.blockedNote?.trim() ? args.blockedNote.trim() : undefined,
          statusGroup: args.statusGroup,
          activityLabel: undefined,
          tone: args.tone,
        }) as MyWorkTaskRow;

      const statusLabelFromGlobalCode = (code: string | undefined) =>
        humanizeStatus(code ? code.toLowerCase() : null);

      setTasksAssigned([
        ...globalAssigned.map((t) =>
          toTaskRow({
            id: t.id,
            title: t.title,
            projectId: t.project_id,
            statusLabel: statusLabelFromGlobalCode(taskCodeById.get(t.status_id)),
            dueDate: t.due_date,
            dueDateIso: t.due_date,
            statusGroup: assignedStatusGroup("global", taskCodeById.get(t.status_id), undefined),
            tone: isBlockedGlobal(taskCodeById.get(t.status_id)) ? "blocked" : undefined,
          })
        ),
        ...projectAssigned.map((t) =>
          toTaskRow({
            id: t.id,
            title: t.title,
            projectId: t.project_id,
            statusLabel: humanizeStatus(t.status),
            dueDate: t.due_date,
            dueDateIso: t.due_date,
            statusGroup: assignedStatusGroup("project", undefined, t.status),
            tone: String(t.status ?? "").toLowerCase().trim() === "blocked" ? "blocked" : undefined,
          })
        ),
      ]);

      setBlockedTasks([
        ...globalBlocked.map((t) =>
          toTaskRow({
            id: t.id,
            title: t.title,
            projectId: t.project_id,
            statusLabel: "Blocked",
            dueDate: t.due_date,
            tone: "blocked",
          })
        ),
        ...projectBlocked.map((t) =>
          toTaskRow({
            id: t.id,
            title: t.title,
            projectId: t.project_id,
            statusLabel: "Blocked",
            dueDate: t.due_date,
            tone: "blocked",
          })
        ),
      ]);

      setOverdueTasks([
        ...globalOverdue.map((t) =>
          toTaskRow({
            id: t.id,
            title: t.title,
            projectId: t.project_id,
            statusLabel: statusLabelFromGlobalCode(taskCodeById.get(t.status_id)),
            dueDate: t.due_date,
            dueDateIso: t.due_date,
            tone: "overdue",
          })
        ),
        ...projectOverdue.map((t) =>
          toTaskRow({
            id: t.id,
            title: t.title,
            projectId: t.project_id,
            statusLabel: humanizeStatus(t.status),
            dueDate: t.due_date,
            dueDateIso: t.due_date,
            tone: "overdue",
          })
        ),
      ]);

      const assignedTickets = ticketRows
        .filter((t) => t.status !== "closed" && t.status !== "resolved")
        .slice()
        .sort((a, b) => {
          const byStatus = ticketStatusSortKey(a.status) - ticketStatusSortKey(b.status);
          if (byStatus !== 0) return byStatus;
          const ad = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
          const bd = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
          if (ad !== bd) return ad - bd;
          const au = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const bu = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return bu - au;
        });

      setTickets(
        assignedTickets.map((t) => ({
          id: t.id,
          title: t.title,
          projectName: projectName(t.project_id),
          statusLabel: humanizeStatus(t.status),
          dueDate: formatDueDate(t.due_date),
        }))
      );

      setActivities(
        activityRows.map((a) => ({
          id: a.id,
          title: a.name,
          projectName: projectName(a.project_id),
          statusLabel: humanizeStatus(a.status),
          dueDate: formatDueDate(a.due_date ?? a.start_date),
        }))
      );

      if (hasCriticalError) {
        setWarning("Some of your work data could not be loaded.");
      }
    } catch (e) {
      setError("Unable to load your My Work dashboard.");
    } finally {
      setLoading(false);
    }
  }, [profileId, userId]);

  useEffect(() => {
    if (loadingIdentity) return;
    if (!profileId || !userId) return;
    void loadData();
  }, [loadingIdentity, profileId, userId, loadData]);

  const leftLoading = loadingIdentity || loading;
  const rightLoading = leftLoading;

  // NOTE: data transformation already happens inside loadData. Cards are pure renderers.
  const showLoadingSkeleton = leftLoading;

  // If we are still loading identity, show the header + skeleton cards.
  if (loadingIdentity) {
    return (
      <AppPageShell>
        <div className="space-y-6">
          <MyWorkPageHeader />

          <section className="space-y-3">
            <p className="text-sm font-semibold text-slate-100">Focus Today</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/80 bg-[rgb(var(--rb-surface))]/95 p-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-2 h-6 w-24" />
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/80 bg-[rgb(var(--rb-surface))]/95 p-5 space-y-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
              <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/80 bg-[rgb(var(--rb-surface))]/95 p-5 space-y-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
              </div>
              <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/80 bg-[rgb(var(--rb-surface))]/95 p-5 space-y-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
            <div className="space-y-6">
              <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/80 bg-[rgb(var(--rb-surface))]/95 p-5 space-y-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-full" />
              </div>
              <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/80 bg-[rgb(var(--rb-surface))]/95 p-5 space-y-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          </div>
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <div className="space-y-6">
        <MyWorkPageHeader />

        <section className="space-y-3">
          <p className="text-sm font-semibold text-[rgb(var(--rb-text-primary))]">Focus Today</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => scrollToMyWorkSection(MY_WORK_SECTION_IDS.overdue)}
              className="rounded-2xl border border-rose-200/80 bg-rose-50/70 p-3 text-left transition-colors hover:bg-rose-50 hover:border-rose-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-rose-700">
                Overdue
              </p>
              <p className="mt-2 text-base font-semibold text-rose-900">
                {countLabel(overdueTasks.length, "overdue task", "overdue tasks")}
              </p>
            </button>

            <button
              type="button"
              onClick={() => scrollToMyWorkSection(MY_WORK_SECTION_IDS.blocked)}
              className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3 text-left transition-colors hover:bg-amber-50 hover:border-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700">
                Blocked
              </p>
              <p className="mt-2 text-base font-semibold text-amber-900">
                {countLabel(blockedTasks.length, "blocked task", "blocked tasks")}
              </p>
            </button>

            <button
              type="button"
              onClick={() => scrollToMyWorkSection(MY_WORK_SECTION_IDS.tickets)}
              className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/80 bg-[rgb(var(--rb-surface))]/95 p-3 text-left transition-colors hover:bg-[rgb(var(--rb-surface-2))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">
                Open tickets
              </p>
              <p className="mt-2 text-base font-semibold text-[rgb(var(--rb-text-primary))]">
                {countLabel(tickets.length, "open ticket", "open tickets")}
              </p>
            </button>

            <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/80 bg-[rgb(var(--rb-surface))]/95 p-3 opacity-90">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">
                Activities
              </p>
              <p className="mt-2 text-base font-semibold text-[rgb(var(--rb-text-primary))]">
                {countLabel(activities.length, "active activity", "active activities")}
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
            {error}
          </div>
        )}
        {warning && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            {warning}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div id={MY_WORK_SECTION_IDS.overdue} className="scroll-mt-6">
              <OverdueTasksCard loading={showLoadingSkeleton} items={overdueTasks as OverdueTaskRow[]} />
            </div>
            <div id={MY_WORK_SECTION_IDS.blocked} className="scroll-mt-6">
              <BlockedTasksCard loading={showLoadingSkeleton} items={blockedTasks as BlockedTaskRow[]} />
            </div>
            <TasksAssignedCard loading={showLoadingSkeleton} items={tasksAssigned} />
          </div>

          <div className="space-y-6">
            <div id={MY_WORK_SECTION_IDS.tickets} className="scroll-mt-6">
              <MyTicketsCard loading={rightLoading} items={tickets} />
            </div>
            <MyActivitiesCard loading={rightLoading} items={activities} />
            <SapitoInsightCard />
          </div>
        </div>
      </div>
    </AppPageShell>
  );
}

