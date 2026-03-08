# Database Architecture Audit — SAP Notes Hub / Project Hub

**Scope:** Public schema and migrations (projects, project_members, project_invitations, profiles, project_phases, project_activities, project_tasks, notes, tickets, conversation_logs, knowledge_*, roles/permissions).  
**Intent:** Analysis and safe improvement plan only. No schema changes, no migration deletions, no business-logic changes in this step.

---

## PART 1 — Schema inventory

### Tables (public schema)

| Table | Primary key | Notes |
|-------|-------------|--------|
| **Core** | | |
| projects | (assumed `id`) | Not created in reviewed migrations; referenced everywhere |
| profiles | (assumed `id`) | Not in migrations; ref’d by project_members, handles, invitations |
| notes | (assumed `id`) | Not in migrations; extended with deleted_at, is_knowledge_base |
| tasks | (assumed `id`) | Legacy/activate; extended with phase_id, activate_phase_key, etc. |
| conversation_logs | id (uuid) | project_id nullable, user_id NOT NULL |
| **Project structure** | | |
| project_members | (project_id, user_id) unique; id not in migrations | user_id + profile_id (both present) |
| project_phases | id (uuid) | project_id NOT NULL, FK projects |
| project_activities | id (uuid) | project_id, phase_id NOT NULL |
| project_tasks | id (uuid) | project_id NOT NULL, activity_id nullable |
| project_invitations | id (uuid) | project_id NOT NULL, UNIQUE(project_id, email) dropped later; token_hash UNIQUE |
| **Activate / templates** | | |
| activate_phases | phase_key (text) | Reference data |
| activity_templates | id (uuid) | FK activate_phases |
| activate_phase_templates | id (uuid) | phase_key UNIQUE |
| activate_activity_templates | id (uuid) | FK activate_phase_templates |
| activate_task_templates | id (uuid) | FK activate_activity_templates |
| **Knowledge (legacy)** | | |
| knowledge_entries | id (uuid) | project_id nullable |
| **Knowledge (module)** | | |
| knowledge_spaces | id (uuid) | owner_profile_id, project_id nullable |
| knowledge_pages | id (uuid) | space_id, owner_profile_id; UNIQUE(space_id, slug) |
| knowledge_blocks | id (uuid) | page_id |
| knowledge_tags | id (uuid) | UNIQUE(owner_profile_id, name) |
| knowledge_page_tags | (page_id, tag_id) PK | |
| knowledge_page_links | id (uuid) | UNIQUE(from_page_id, to_page_id, link_type) |
| knowledge_page_projects | (page_id, project_id) PK | |
| **Knowledge (documents / search)** | | |
| knowledge_documents | id (uuid) | project_id, scope_type, user_id nullable; vector(1536) |
| knowledge_sources | id (uuid) | scope_type + project_id (global/project) |
| project_knowledge_memory | id (uuid) | project_id NOT NULL, embedding vector(1536) |
| **RBAC** | | |
| roles | id (uuid) | UNIQUE(scope, key) |
| permissions | id (uuid) | key UNIQUE |
| role_permissions | (role_id, permission_id) PK | |
| **Other** | | |
| clients | id (uuid) | name UNIQUE |
| project_sources | id (uuid) | project_id NOT NULL |
| project_source_sync_jobs | id (uuid) | project_source_id |
| external_integrations | id (uuid) | owner_profile_id |

*Base tables `projects`, `profiles`, `notes`, `tickets`, `tasks` are not defined in the migrations under review; they are assumed to exist (e.g. from an earlier setup or Supabase starter).*

### Primary keys

- All listed tables use `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` except:  
  `activate_phases` (phase_key), `role_permissions` (role_id, permission_id), `knowledge_page_tags` (page_id, tag_id), `knowledge_page_projects` (page_id, project_id), and composite PKs above.
- `project_members`: unique on (project_id, user_id); no separate `id` in migrations.

### Foreign keys (major)

- conversation_logs → projects(id), user_id (no FK to profiles in migrations)
- project_phases → projects(id) ON DELETE CASCADE
- project_activities → projects(id), project_phases(id); owner_profile_id → profiles(id)
- project_tasks → projects(id), project_activities(id), assignee_profile_id → profiles(id)
- tasks → project_phases(id) via phase_id; activate_phases(phase_key)
- project_members → projects, profiles(id) via profile_id
- project_invitations → projects(id), invited_by → profiles(id), accepted_by → profiles(id)
- knowledge_* → profiles(id) (owner_profile_id), projects(id) where scoped
- knowledge_documents → projects(id) nullable, profiles(id) via user_id nullable
- knowledge_sources → projects(id) nullable, external_integrations(id)
- project_sources → projects(id), created_by → profiles(id)
- clients: projects.client_id → clients(id)

### Major indexes

- conversation_logs: (project_id, user_id, created_at DESC), (user_id, created_at DESC)
- project_phases: (project_id, sort_order)
- project_activities: (project_id, phase_id)
- project_tasks: (project_id), (activity_id), (due_date), (activity_id, status)
- project_invitations: (email), (project_id), (status), (expires_at), UNIQUE(token_hash)
- knowledge_pages: GIN(search_vector), (space_id, updated_at DESC)
- knowledge_documents: ivfflat(embedding), (project_id) partial, (scope_type, project_id, user_id) partial
- project_knowledge_memory: (project_id, user_id) partial, ivfflat(embedding)
- knowledge_sources: (scope_type, project_id), (source_type), (integration_id) partial
- project_sources: (project_id), (source_type)

### Triggers

- set_updated_at: knowledge_entries, project_phases, project_activities, project_tasks, knowledge_spaces/pages/blocks, project_sources, external_integrations, knowledge_sources
- knowledge_entries_updated_at, knowledge_pages_search_update (search_vector)
- recalculate_activity_progress_on_project_tasks_ins/upd/del
- projects_add_owner_member (AFTER INSERT projects → insert project_members)
- accept_project_invitations_on_profile_insert (profiles INSERT → accept invitations, update project_members)
- handle_new_auth_user (auth.users INSERT → create/update profiles)
- knowledge_documents_scope_sync_trigger (sync scope_type with project_id/user_id)

### Functions

- set_updated_at() — TRIGGER, updated_at
- recalculate_activity_progress(uuid) — SECURITY DEFINER
- trg_recalculate_activity_progress() — TRIGGER
- projects_add_owner_member() — TRIGGER
- accept_project_invitations_for_new_profile() — TRIGGER
- handle_new_auth_user() — TRIGGER (auth)
- get_auth_user_email() — SECURITY DEFINER, for RLS
- get_my_profile_id(), is_superadmin(), is_project_member(uuid) — SECURITY DEFINER, RLS helpers
- project_tasks_is_project_member(uuid) — dropped in later cleanup
- knowledge_pages_search_trigger() — search_vector
- knowledge_documents_scope_sync() — TRIGGER
- search_knowledge(text), search_knowledge_documents(...), search_project_knowledge_documents(...), search_knowledge_documents_multitenant(...), search_project_knowledge_memory(...), search_official_sap_knowledge(...)

### RLS-enabled tables

- project_phases, project_activities, project_tasks  
- project_members  
- project_invitations  
- clients  
- roles, permissions, role_permissions  
- activate_phase_templates, activate_activity_templates, activate_task_templates  
- knowledge_spaces, knowledge_pages, knowledge_blocks, knowledge_tags, knowledge_page_tags, knowledge_page_links, knowledge_page_projects  
- project_sources, project_source_sync_jobs  
- external_integrations  
- knowledge_sources  

*conversation_logs, knowledge_entries, knowledge_documents, project_knowledge_memory: not explicitly enabled in reviewed migrations; may rely on service_role or other path.*

---

## PART 2 — Relationship audit

### projects ↔ project_members

- **Clean:** project_members.project_id → projects(id). Unique (project_id, user_id).
- **Issue:** project_members has both `user_id` and `profile_id` (profile_id FK to profiles). Backfill sets profile_id from profiles where profiles.id = user_id. So semantically same; but nullable profile_id and dual columns are legacy. No FK from user_id to auth/users or profiles in migrations.

### projects ↔ project_phases

- **Clean:** project_phases.project_id → projects(id) ON DELETE CASCADE. NOT NULL.

### project_phases ↔ project_activities

- **Clean:** project_activities.phase_id → project_phases(id) ON DELETE CASCADE. NOT NULL.

### project_activities ↔ project_tasks

- **Clean:** project_tasks.activity_id → project_activities(id) ON DELETE SET NULL. Nullable by design (tasks can exist without activity).

### projects ↔ notes / tickets / knowledge

- **notes:** Referenced only via ALTER (deleted_at, is_knowledge_base). No explicit FK to projects in reviewed migrations; likely project_id on notes exists elsewhere.
- **tickets:** Not present in migrations; app/metrics reference tickets_open. Assume table exists with project scoping elsewhere.
- **knowledge_entries:** project_id → projects(id) nullable (global vs project).
- **knowledge_spaces:** project_id → projects(id) nullable.
- **knowledge_documents:** project_id nullable, scope_type/user_id for multitenancy.
- **knowledge_sources:** project_id nullable; CHECK (scope_type = 'global' AND project_id IS NULL OR scope_type = 'project' AND project_id IS NULL).
- **project_knowledge_memory:** project_id NOT NULL → projects(id).

### project_invitations ↔ projects / profiles

- **Clean:** project_invitations.project_id → projects(id) ON DELETE CASCADE; invited_by, accepted_by → profiles(id). invited_by nullable.

### Gaps and inconsistencies

- **Missing FKs:** conversation_logs.user_id has no FK to profiles (or auth.users). project_members.user_id has no FK to profiles in migrations (only profile_id does).
- **Nullable relations:** project_members.profile_id nullable (backfill + comment “optional NOT NULL later”). If app assumes profile_id always set, any NULL breaks is_project_member() which uses profile_id only.
- **Legacy patterns:** Dual identity (user_id vs profile_id) on project_members; tasks table has both phase_id (project_phases) and activate_phase_key (reference); two template systems (activity_templates vs activate_*_templates).

---

## PART 3 — RLS audit

### project_phases

- **Policies:** SELECT/INSERT/UPDATE/DELETE TO authenticated USING (true) / WITH CHECK (true).
- **Risk: Too permissive.** Any authenticated user can read/insert/update/delete any project_phases row. Comment says “app will restrict by project access.” If the app does not enforce project membership on every request, data is exposed across projects.

### project_activities

- **Policies:** SELECT/INSERT/UPDATE/DELETE — service_role OR EXISTS (project_members where project_id = project_activities.project_id AND user_id = auth.uid()).
- **Good:** Consistent with project membership by user_id.

### project_tasks

- **Policies:** After cleanup migrations, four policies (select/insert/update/delete) — service_role OR EXISTS (project_members … user_id = auth.uid()).
- **Good:** No helper; direct subquery; consistent with user_id.

### project_members

- **Current (after 20260305270000):** SELECT: own row (profile_id = get_my_profile_id()) OR is_superadmin(). INSERT/UPDATE/DELETE: is_superadmin() only.
- **Risk: Owners cannot manage members from client.** Previous migration (20250602160000) allowed owner or superadmin for insert/update/delete. The “fix” for RLS recursion removed owner path. If the app uses only the Supabase client (no service_role) for “add member” / “remove member”, owners would be denied. App code uses supabaseAdmin for getUserProjectIds; member management may also go through API with service_role — confirm and document.
- **Inconsistency:** is_project_member(project_uuid) uses profile_id only; other tables use user_id = auth.uid(). If any project_members row has user_id set but profile_id NULL, that user would not be considered a member by is_project_member (used only in that migration’s policies; later policies were replaced).

### project_invitations

- **SELECT:** project owner (pm.role = 'owner') or superadmin.
- **INSERT:** same.
- **UPDATE:** Two policies — (1) owner/superadmin (revoke etc.); (2) invitee accept (pending, not expired, email match, WITH CHECK status = 'accepted', accepted_by = auth.uid()).
- **Good:** Clear split; invitee can only accept their own invite.

### knowledge_* tables

- **knowledge_spaces/pages/blocks/tags/links/page_projects:** Owner-based (owner_profile_id = auth.uid()) for write; project member or superadmin for read when project_id is set. Multiple SELECT policies (owner vs project) can stack; acceptable.
- **knowledge_sources:** Global: superadmin only. Project: service_role or project member (user_id = auth.uid()). Consistent.
- **knowledge_documents / project_knowledge_memory:** No RLS in reviewed migrations; access assumed via service_role or SECURITY INVOKER RPCs that filter by project_id/user_id. RPCs (search_*) use SECURITY INVOKER so RLS would apply if enabled; tables may have RLS off and rely on RPC filters only — verify.

### Summary RLS risks

1. **project_phases:** USING (true) for all operations is too permissive; should be restricted by project membership.
2. **project_members:** Write operations only for superadmin; owners cannot add/remove members from the client unless the app uses service_role for those operations.
3. **auth.uid() vs profiles vs project_members:** Mix of user_id = auth.uid() and profile_id = get_my_profile_id(); get_my_profile_id() = auth.uid() in practice but naming and dual columns cause confusion and risk (e.g. profile_id NULL).
4. **knowledge_documents / project_knowledge_memory:** No RLS on tables; isolation depends on RPCs and app. Consider enabling RLS and aligning with project_members/project_id for consistency and defense in depth.

---

## PART 4 — Technical debt audit

- **Repeated cleanup migrations:** project_tasks RLS cleaned up multiple times (20250328120000 helper, 20250601000000, 20250601120000) with policy renames and DROP FUNCTION. Final state is consistent but history is noisy.
- **Replaced helper:** project_tasks_is_project_member(uuid) introduced then dropped; replaced by inline EXISTS (project_members … user_id = auth.uid()).
- **Redundant policies:** project_members had owner-based policies then replaced by superadmin-only (20260305270000); no owner policy left for client-side use.
- **profile_id vs user_id:** project_members.profile_id added and backfilled; comments say “optional NOT NULL later.” Both columns remain; RLS fix uses profile_id for SELECT and is_project_member(); rest of schema and app use user_id for membership. Redundant and error-prone.
- **Backfill logic:** projects_backfill_owner_members, project_members profile_id backfill, profiles email backfill, project_invitations token/expiry backfill, knowledge_documents scope_type backfill. One-off; conceptually “already applied.” Remaining UPDATEs in migrations are for existing rows at migration time; no ongoing backfill triggers.
- **Duplicate policy names:** project_invitations had one UPDATE policy then two (owner + invitee); naming clarified (project_invitations_update_policy_owner / _invitee_accept). No conflict in final state.
- **Two template systems:** activity_templates (activate_phases) vs activate_phase_templates / activate_activity_templates / activate_task_templates. Both used; different naming and structure; potential confusion.

---

## PART 5 — Optimization opportunities

- **Missing indexes (candidates):**
  - projects: (created_by) if “my projects” / dashboard is common.
  - notes: (project_id, deleted_at) if listing by project and filtering deleted_at IS NULL.
  - tickets: (project_id), (status) or (project_id, status) if used in metrics/dashboard.
  - conversation_logs: already good (project_id, user_id, created_at).
  - project_members: (user_id) if “my projects” is frequent (getUserProjectIds).
- **Composite indexes for common queries:**
  - project_members (user_id, project_id) for “am I member of this project?”
  - project_activities (project_id, status) or (due_date) for dashboard “overdue/upcoming.”
  - project_tasks (project_id, status) for open/overdue counts.
- **RPCs/views for dashboard and Sapito:**
  - Platform metrics: RPC returning projects_total, projects_active, notes_total, notes_today, tickets_open (filtered by auth.uid() / getUserProjectIds) to avoid multiple round-trips.
  - Project metrics: RPC or view for one project’s openTasks, overdueTasks, blockedTasks, openTickets, highPriorityTickets, overdueActivities, upcomingActivities, totalNotes (with RLS or single service_role call).
  - activity_risk_metrics view already exists; consider similar for project-level risk.
- **Simplifications:**
  - Standardize membership check: one helper (e.g. is_project_member(project_id) using user_id = auth.uid()) and use it everywhere to avoid repeated EXISTS (project_members …).
  - Consider materialized view or RPC for “accessible project ids” for the current user to reuse in multiple policies (with care for RLS recursion).
  - Reduce duplicate policy expressions (long USING/WITH CHECK repeated); use a single SECURITY DEFINER function that returns boolean for “can access project X” and call it from policies.

---

## PART 6 — Deliverables summary

### 1. Schema strengths

- Clear project hierarchy: projects → project_phases → project_activities → project_tasks with FKs and CASCADE where appropriate.
- project_invitations: token_hash, expires_at, accepted_by; two UPDATE policies (owner vs invitee) are clear.
- Knowledge layer: separation of knowledge_sources (global/project), knowledge_documents (scope_type, project_id, user_id), project_knowledge_memory; RPCs for semantic search with scope.
- RBAC tables (roles, permissions, role_permissions) in place for future use.
- Activity progress: trigger-driven recalc from project_tasks; indexes on (activity_id, status).
- Single source of truth for “accessible projects” in app code (getUserProjectIds: members + created_by).

### 2. Schema risks

- Base tables (projects, profiles, notes, tickets, tasks) not defined in reviewed migrations; definitions may live elsewhere or in dashboard; possible drift.
- project_members: dual user_id/profile_id; profile_id nullable; no FK on user_id.
- conversation_logs.user_id has no FK to profiles.
- Two template systems (activity_templates vs activate_*_templates); overlapping purpose.

### 3. RLS risks

- **project_phases:** All operations allowed for any authenticated user (USING (true)); must be restricted by project membership.
- **project_members:** Only superadmin can insert/update/delete; owners cannot manage members from client unless app uses service_role.
- **profile_id vs user_id:** project_members SELECT and is_project_member() use profile_id; other policies use user_id = auth.uid(); NULL profile_id breaks membership for that row.
- **knowledge_documents / project_knowledge_memory:** No RLS; isolation only via RPC parameters and app; consider RLS for consistency.

### 4. Relationship inconsistencies

- conversation_logs: project_id FK to projects; user_id NOT NULL but no FK to profiles.
- project_members: user_id used app-wide for membership; profile_id used in RLS fix and is_project_member(); both kept, not normalized.
- tasks: phase_id → project_phases and activate_phase_key → activate_phases; two ways to attach to “phase.”

### 5. Optimization opportunities

- Indexes: projects(created_by), notes(project_id, deleted_at), tickets(project_id[, status]), project_members(user_id).
- Composite: project_members(user_id, project_id), project_activities(project_id, status), project_tasks(project_id, status).
- RPCs/views: platform_metrics and project_metrics RPCs (or views) for dashboard/Sapito to reduce round-trips and centralize logic.
- One canonical “is project member” helper and reuse in policies; consider RPC for “my project ids” with row_security = off for use in policies (avoid N+1).

### 6. Prioritized action plan

**Phase 1 — Hardening (security and correctness)**

1. **project_phases RLS:** Replace USING (true) with project-membership check (service_role OR EXISTS (project_members WHERE project_id = project_phases.project_id AND user_id = auth.uid())). New migration.
2. **project_members write path:** If the app intends owners to manage members from the client, add back INSERT/UPDATE/DELETE for project owner (same pattern as 20250602160000) while keeping SELECT non-recursive (own row or superadmin). If all member management is via service_role, document that and leave as superadmin-only.
3. **project_members identity:** Decide single source of truth (user_id recommended). Ensure profile_id backfill is complete; then either make profile_id NOT NULL and keep both, or deprecate profile_id and switch is_project_member() and project_members SELECT to user_id = auth.uid(). New migration(s).
4. **conversation_logs:** Add FK user_id → profiles(id) if profiles.id = auth.uid(); or document that user_id is auth.uid() and add a comment. Optional: enable RLS and restrict by user_id = auth.uid() and project access.
5. **knowledge_documents / project_knowledge_memory:** Document that access is via RPC only; or enable RLS and add policies (e.g. project_id in getUserProjectIds for project-scoped rows). Prefer RLS for defense in depth.

**Phase 2 — Optimization**

6. Add indexes: projects(created_by), project_members(user_id), notes(project_id, deleted_at) if columns exist; tickets(project_id) and (project_id, status) if table exists.
7. Add composite indexes: project_members(user_id, project_id); project_tasks(project_id, status); project_activities(project_id, status) if used by dashboard.
8. Introduce RPCs: e.g. get_platform_metrics(user_id), get_project_metrics(project_id, user_id) that return the same aggregates as current app code, for use by dashboard and Sapito (with service_role or INVOKER and RLS as appropriate).

**Phase 3 — Optional refactors**

9. Consolidate “is project member” in one place: single SECURITY DEFINER function (user_id-based) and use it in all project-scoped RLS policies to reduce duplication and drift.
10. Normalize project_members to user_id only (or profile_id only) and drop the other column after migration and app update.
11. Unify or document the two template systems (activity_templates vs activate_*_templates); consider deprecating one path.
12. Add CHECK or trigger so tasks.phase_id and activate_phase_key stay consistent with project_phases when both are set (optional; may be by design).

---

*End of audit. All changes to be executed by Cursor only; no automatic application of schema changes.*
