# Phase 2 Optimization — Deliverables

**Context:** Phase 1 hardening applied. Phase 2 focuses on query performance and centralizing metrics for dashboard and Sapito.

---

## 1. Migration files created

| File | Purpose |
|------|--------|
| `20260402120000_phase2_indexes.sql` | Additive indexes for projects(created_by), project_members(user_id, user_id+project_id), project_tasks(project_id, status), project_activities(project_id, due_date), notes(project_id, created_at), tickets(project_id, status). Uses IF NOT EXISTS; projects/notes/tickets indexes guarded by information_schema checks. |
| `20260402130000_phase2_metrics_rpcs.sql` | RPCs get_platform_metrics(p_user_id) and get_project_metrics(p_project_id, p_user_id). SECURITY DEFINER, same access scope as app (member + owned projects). Grants to service_role and authenticated. |

---

## 2. Indexes added

| Table | Index | Notes |
|-------|--------|--------|
| project_members | idx_project_members_user_id (user_id) | "My projects" / getUserProjectIds |
| project_members | idx_project_members_user_id_project_id (user_id, project_id) | Membership lookups |
| project_tasks | idx_project_tasks_project_id_status (project_id, status) | Open/overdue by project |
| project_activities | idx_project_activities_project_id_due_date (project_id, due_date) WHERE due_date IS NOT NULL | Overdue/upcoming |
| projects | idx_projects_created_by (created_by) | Only if column exists |
| notes | idx_notes_project_id_created_at (project_id, created_at DESC) | Only if table has project_id |
| tickets | idx_tickets_project_id_status (project_id, status) | Only if table has project_id |

**Skipped:** conversation_logs already has idx_conversation_logs_user_created (user_id, created_at DESC).

---

## 3. RPCs created

### get_platform_metrics(p_user_id uuid)

- **Returns:** One row: projects_total, projects_active, notes_total, notes_today, tickets_open (all bigint).
- **Scope:** Project IDs = (SELECT project_id FROM project_members WHERE user_id = p_user_id) UNION (SELECT id FROM projects WHERE created_by = p_user_id).
- **Logic:** Same as previous app logic: projects_total = count(accessible projects), projects_active = count where status not completed/archived/closed/cerrado, notes_total/today with deleted_at IS NULL, tickets_open where status <> 'closed' (case-insensitive).
- **Null user:** Returns one row of zeros.

### get_project_metrics(p_project_id uuid, p_user_id uuid)

- **Returns:** One row or none: project_id, project_name, project_status, open_tasks, overdue_tasks, blocked_tasks, open_tickets, high_priority_tickets, overdue_activities, upcoming_activities, total_notes (bigint counts).
- **Access:** Returns a row only if user has access (member or owner). Returns no row if no access or project missing.
- **Logic:** Matches previous app: open_tasks (status <> 'done'), overdue_tasks (due_date < today and not done), blocked_tasks (status = 'blocked'), open_tickets (status <> 'closed'), high_priority (priority in ('high','urgent')), overdue/upcoming activities by due_date, total_notes with deleted_at IS NULL.

---

## 4. Files updated to use RPCs

| File | Change |
|------|--------|
| lib/metrics/platformMetrics.ts | getPlatformMetrics(userId) now calls supabaseAdmin.rpc('get_platform_metrics', { p_user_id: userId }), maps first row to PlatformMetrics, returns fallback on error or null user. getProjectMetrics(projectId, userId) now calls supabaseAdmin.rpc('get_project_metrics', { p_project_id, p_user_id }), maps first row to ProjectMetrics, returns null on error or no row. Removed inline queries and isProjectActive/todayIso used only by old implementation. getUserProjectIds unchanged (still used by project resolution and others). |

**Dashboard and Sapito:** No direct changes. They keep using getPlatformMetrics and getProjectMetrics from platformMetrics; those now delegate to the RPCs. Single source of truth is the DB RPCs.

---

## 5. Validation results

- **Build:** `npm run build` completed successfully (Next.js 16.1.6, TypeScript and static generation OK).
- **Lint:** No linter errors on platformMetrics.ts.
- **Behavior:** Access scope and metric definitions match previous app logic (member + owned projects; same filters for active, notes_today, tickets_open, task/activity/ticket counts). Project resolution still uses getUserProjectIds (unchanged). After applying migrations (`npx supabase db push`), dashboard counts and "How many projects do I have?" should match; "How is the cccc project going?" still uses getProjectMetrics (now via RPC) and project name resolution unchanged.

**Note:** Validation of dashboard vs Sapito counts and project metrics in a running environment requires applying the Phase 2 migrations and testing manually or via E2E.

---

## 6. Warnings

- **RPC dependency:** If Phase 2 migrations are not applied, getPlatformMetrics and getProjectMetrics will receive an RPC error (e.g. function does not exist). The app returns fallback (zeros) or null and logs the error. Apply migrations before relying on metrics.
- **projects.created_by:** get_platform_metrics and get_project_metrics assume projects has created_by. If it is missing (e.g. 42703), the RPCs will fail at runtime until the schema is fixed.
- **notes/tickets tables:** Indexes on notes and tickets are created only when the table/column exist (DO blocks). If those tables are in a different schema or missing, those indexes are skipped without failing the migration.

---

*Phase 2 migrations are additive. Run `npx supabase db push` to apply, then verify dashboard and Sapito metrics.*
