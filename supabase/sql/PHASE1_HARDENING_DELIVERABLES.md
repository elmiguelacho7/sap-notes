# Phase 1 Hardening — Deliverables

**Source:** DATABASE_ARCHITECTURE_AUDIT.md  
**Executed:** Additive migrations only; no migrations deleted or rewritten.

---

## 1. Root issues addressed

| Issue | Resolution |
|-------|------------|
| **project_phases too permissive** | RLS replaced from `USING (true)` for all authenticated users to project-membership only: `service_role` OR `EXISTS(project_members WHERE project_id = project_phases.project_id AND user_id = auth.uid())` for SELECT, INSERT, UPDATE, DELETE. |
| **project_members write path ambiguous** | Owners can manage members from the client. New policies: INSERT/UPDATE/DELETE allowed when `is_project_owner(project_id)` (current user is owner of that project) OR `is_superadmin()`. SELECT unchanged: own row (`user_id = auth.uid()`) OR superadmin. |
| **project_members identity inconsistency** | **Canonical identity: `user_id = auth.uid()`.** All policies and helpers now use `user_id`. `is_project_member(project_uuid)` updated to use `pm.user_id = auth.uid()` instead of `profile_id = get_my_profile_id()`. New `is_project_owner(project_uuid)` uses `user_id` and `role = 'owner'`. Column comment added on `project_members.user_id`. |
| **conversation_logs.user_id no FK** | FK added: `conversation_logs.user_id` → `profiles(id)` ON DELETE CASCADE, idempotent. Applied with `NOT VALID` because existing rows had `user_id` not in `profiles` (e.g. placeholder UUID); after cleaning data run `ALTER TABLE public.conversation_logs VALIDATE CONSTRAINT conversation_logs_user_id_fkey`. |
| **knowledge_documents / project_knowledge_memory RLS** | No RLS added. Access documented as RPC-only and service_role; isolation by RPC parameters. Reasoning documented in migration and below. |

---

## 2. Migration files created

| File | Purpose |
|------|--------|
| `20260401120000_phase1_project_phases_rls.sql` | Restrict project_phases RLS to project members (and service_role). |
| `20260401130000_phase1_project_members_identity_and_owner_writes.sql` | Standardize on user_id; add `is_project_owner(uuid)`; replace project_members policies (SELECT by user_id/superadmin, write by superadmin or owner). |
| `20260401140000_phase1_conversation_logs_user_id_fkey.sql` | Add FK conversation_logs.user_id → profiles(id) when possible. Uses NOT VALID to allow existing invalid user_ids; validate after data clean. |
| `20260401150000_phase1_knowledge_access_documentation.sql` | COMMENT ON TABLE for knowledge_documents and project_knowledge_memory documenting RPC-only access and why RLS is not enabled. |

---

## 3. Exact policy changes

### project_phases

- **Dropped:** `project_phases_select`, `project_phases_insert`, `project_phases_update`, `project_phases_delete` (all previously `USING (true)` / `WITH CHECK (true)` for authenticated).
- **Created (same names):**
  - **SELECT:** `auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = project_phases.project_id AND pm.user_id = auth.uid())`
  - **INSERT:** same expression in WITH CHECK
  - **UPDATE:** same expression in USING and WITH CHECK
  - **DELETE:** same expression in USING

### project_members

- **Dropped:** All existing policies (by dynamic loop: `project_members_select_own_or_superadmin`, `project_members_insert_superadmin`, `project_members_update_superadmin`, `project_members_delete_superadmin`).
- **Created:**
  - **project_members_select_own_or_superadmin:** `USING (is_superadmin() OR user_id = auth.uid())` — identity changed from `profile_id = get_my_profile_id()` to `user_id = auth.uid()`.
  - **project_members_insert_superadmin_or_owner:** `WITH CHECK (is_superadmin() OR is_project_owner(project_id))`.
  - **project_members_update_superadmin_or_owner:** `USING` and `WITH CHECK` both `(is_superadmin() OR is_project_owner(project_id))`.
  - **project_members_delete_superadmin_or_owner:** `USING (is_superadmin() OR is_project_owner(project_id))`.

### Functions

- **is_project_owner(uuid):** New. Returns true if `project_members` has a row for that project with `user_id = auth.uid()` and `role = 'owner'`. SECURITY DEFINER, `row_security = off` to avoid recursion.
- **is_project_member(uuid):** Replaced body to use `pm.user_id = auth.uid()` instead of `pm.profile_id = get_my_profile_id()`.

---

## 4. Identity standard chosen for project_members

- **Canonical column:** `user_id` = `auth.uid()` (the Supabase auth user id).
- **Policies and helpers:** All membership and owner checks use `project_members.user_id = auth.uid()`. No policy depends on `profile_id` for access decisions.
- **profile_id:** Left in place (additive only). Documented as legacy/denormalized; app and RLS should prefer `user_id`. Future phase can backfill any NULLs and add NOT NULL or deprecate the column.

---

## 5. Tables intentionally left unchanged and why

| Table(s) | Change | Reason |
|----------|--------|--------|
| **knowledge_documents** | No RLS added | Access is via search_* RPCs (SECURITY INVOKER) that filter by project_id, user_id, scope_type. Writes/ingest use service_role. Enabling RLS would require duplicating RPC logic in policies and full regression testing; deferred to a later phase. COMMENT added to document this. |
| **project_knowledge_memory** | No RLS added | Same as above: RPC search_project_knowledge_memory and service_role for writes; isolation by project_id/user_id in RPC. COMMENT added. |
| **profiles, projects, notes, tasks, tickets** | No structural change | Phase 1 scope was project_phases, project_members, conversation_logs FK, and knowledge documentation only. |
| **project_members.profile_id** | Not dropped, not made NOT NULL | Additive hardening only; backfill and NOT NULL or removal can be a later migration. |

---

## 6. Recommended next Phase 2 optimization steps

From the audit, execute in order:

1. **Indexes**
   - `projects(created_by)` if column exists and “my projects” / dashboard is common.
   - `project_members(user_id)` and composite `project_members(user_id, project_id)` for membership lookups.
   - `notes(project_id, deleted_at)` if listing by project with `deleted_at IS NULL`.
   - `tickets(project_id)` and `tickets(project_id, status)` if the table exists and is used for metrics.

2. **RPCs for metrics**
   - `get_platform_metrics(user_id)` returning projects_total, projects_active, notes_total, notes_today, tickets_open scoped to the user’s accessible projects (member + created_by).
   - `get_project_metrics(project_id, user_id)` returning openTasks, overdueTasks, blockedTasks, openTickets, highPriorityTickets, overdueActivities, upcomingActivities, totalNotes for one project (with access check).

3. **Composite indexes for dashboard**
   - `project_tasks(project_id, status)` for open/overdue counts.
   - `project_activities(project_id, status)` or `(due_date)` if used for overdue/upcoming.

All Phase 2 steps should remain additive (new indexes, new RPCs) and not change existing RLS or business logic unless explicitly scoped.
