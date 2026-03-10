# Authorization Model Audit — SAP Notes Hub

**Objective:** Realign the authorization model to match business intent: no cross-user data exposure by role alone; workspace scope; project membership; personal scope.

---

## 1. Current model found

### 1.1 Schema (relevant tables)

| Entity | Key columns | Scope / ownership |
|--------|-------------|--------------------|
| **profiles** | `id` (= auth.uid()), `app_role` ('superadmin' \| 'consultant'), `is_active`, `email`, `full_name` | Per-user; no workspace/tenant. |
| **projects** | `id`, `created_by` (uuid), `status`, `client_id`, … | Owner = `created_by`. No `workspace_id` or `tenant_id`. |
| **project_members** | `project_id`, `user_id`, `role` ('owner', …) | Explicit membership; no workspace. |
| **notes** | `id`, `project_id` (nullable), `created_by` (nullable), `deleted_at`, `is_knowledge_base` | **Project notes:** `project_id` set, visibility via project. **Global notes:** `project_id IS NULL`, RLS = superadmin only. |
| **tickets** | `project_id`, … | Scoped by project. |
| **project_activities** | `project_id`, `owner_profile_id` | Project-scoped. |
| **project_tasks** (tasks) | `project_id`, … | Project-scoped. |
| **tasks** (public.tasks) | `project_id` (nullable), `created_by` | General board when `project_id IS NULL`; RLS = owner or superadmin. |
| **knowledge_documents** | `project_id`, `user_id`, `scope_type` ('global' \| 'project' \| 'user') | Multi-tenant by scope_type + project_id + user_id. |
| **knowledge_sources** | `project_id` (null = global), `scope_type`, `created_by` | Global vs project; RLS by superadmin or project member. |
| **clients** | `created_by` | RLS = superadmin only. |

### 1.2 Concepts present vs absent

- **Workspace / tenant / organization:** **Not present.** There is no `workspace_id`, `tenant_id`, or `organization_id` on profiles or projects. The platform is a single flat namespace.
- **Account owner / team owner:** **Not present.** Projects have `created_by` (creator/owner); there is no higher-level “account” or “workspace” that groups users and projects.
- **Platform role:** **Present.** `profiles.app_role` = `superadmin` \| `consultant`. Used in RLS and API to grant platform-wide access (superadmin) vs restricted (consultant).

### 1.3 Current access rules (summary)

- **Projects:** User sees a project if: `projects.created_by = auth.uid()` OR user is in `project_members` for that project OR `profiles.app_role = 'superadmin'`.
- **Notes:**  
  - **Project notes** (`project_id` set): visible if the project is visible (member/owner/superadmin).  
  - **Global notes** (`project_id IS NULL`): visible **only** if `profiles.app_role = 'superadmin'` (migration `20260404110000_notes_global_superadmin_only.sql`).
- **Project members:** Read if you are a member of that project; write (invite/update/delete) if owner or superadmin.
- **Dashboard / metrics:** `get_platform_metrics(p_user_id)` returns counts for: (a) superadmin → all projects/notes/tickets; (b) consultant → only projects where member or `created_by`, and only notes/tickets in those projects (no global notes).
- **APIs:** Project notes API `GET/POST /api/projects/[id]/notes` checks `isProjectMember(userId, projectId)` or superadmin before calling `getProjectNotes` (which uses `supabaseAdmin` with `project_id` filter). Notes PATCH/DELETE enforce superadmin or project membership for the note’s project (global notes require superadmin).

---

## 2. Main conceptual mismatch

- **Role used as scope:** Access is determined by **platform role** (superadmin vs consultant) and **project membership**, not by a **workspace/tenant**. So:
  - There is no “workspace” boundary: a “manager” and a “consultant” cannot be limited to “their” workspace; the only boundary is “all (superadmin)” vs “my projects (consultant).”
  - Two consultants in different organizations (conceptually) are not isolated from each other by data model—only by the fact that they have no shared projects. Any cross-project visibility is by design not modeled.
- **Global notes = platform-global:** Notes with `project_id IS NULL` are **platform-wide** (superadmin-only), not “workspace-shared.” There is no way to have “shared only within my workspace” without introducing a workspace concept.
- **No workspace-scoped admin:** A “manager” or “admin” who should manage only their own workspace cannot be expressed; the only platform-level admin is superadmin (sees everything).

---

## 3. Recommended target model

### 3.1 Principles

- Access is based on: **user identity**, **workspace/owner scope**, **project membership**, and **explicit permissions** — not only on generic role labels.
- **Platform role** = technical/platform-wide (superadmin only).
- **Workspace scope** = each user belongs to one workspace (or ownership scope); managers/admins manage only that workspace.
- **Project scope** = access only by explicit membership in that project.
- **Personal scope** = data private to the user (e.g. personal notes, general board).

### 3.2 Smallest safe model that fits current schema (no workspace table yet)

- **superadmin:** Platform-only; sees all; use existing `profiles.app_role = 'superadmin'`.
- **Project/workspace manager (future):** Would manage “their” workspace only. **Not implementable without a workspace (or equivalent) table.** For now, treat as “consultant with more projects” or “owner of many projects” via `created_by` + `project_members.role = 'owner'`.
- **consultant:** Sees only:
  - Projects where `project_members.user_id = auth.uid()` OR `projects.created_by = auth.uid()`;
  - Notes/tickets/activities in those projects;
  - Personal data (e.g. notes/tasks with `project_id IS NULL` and `created_by = auth.uid()` if/when that is reintroduced for personal notes).
- **consultant with permission to create projects:** Same as consultant; “can create” = allow INSERT on `projects` when some flag or role allows it (e.g. future `can_create_projects` or project-creation permission). Project creation already creates membership (trigger); no change to visibility.

Enforce consistently:

- **RLS:** Use `auth.uid()` and `project_members` / `projects.created_by` (and for global notes, only `app_role = 'superadmin'`). No “see all because role = X” except for superadmin.
- **APIs:** Always resolve `userId` from request; check project membership (or superadmin) before returning project-scoped data; for “global” notes, require superadmin.
- **Metrics/RPCs:** Keep `get_platform_metrics(p_user_id)` scoped to member+owned projects for non-superadmin; superadmin branch can continue to “see all.”

---

## 4. Should “global notes” become “workspace-shared notes”?

- **Recommendation: yes, in the long term**, once a workspace (or equivalent) exists.
  - Today “global” = platform-global (superadmin-only). Business intent is “curated cross-project knowledge” that should be **workspace-scoped**, not visible to all consultants on the platform.
  - Desired behavior: “Workspace-shared notes” visible to everyone in the same workspace (and only that workspace); not to other workspaces; not to consultants in other workspaces.
- **With current schema:** There is no workspace, so “workspace-shared” cannot be implemented. Options:
  - **Keep current behavior:** Global notes remain platform-global (superadmin-only). No change to schema in this pass.
  - **Later:** Add `workspace_id` (or `owner_id` / “account”) to profiles and projects; add `workspace_id` (nullable) to notes. Then:
    - `project_id IS NULL` and `workspace_id IS NOT NULL` → workspace-shared note (visible to same workspace).
    - `project_id IS NULL` and `workspace_id IS NULL` → either forbid or keep as “platform-global” (superadmin only).

---

## 5. Exact likely cause of current consultant visibility issue

- **If the issue is “consultant sees global notes” (e.g. on /notes or in Sapito):**
  - **RLS:** With migration `20260404110000_notes_global_superadmin_only.sql` applied, consultants must not see rows with `project_id IS NULL`. All client-side note queries use the user’s Supabase client (RLS applies).
  - **Most likely causes:**
    1. **Migration not applied** in the environment where the issue is seen (e.g. staging/production behind).
    2. **Stale cache / session:** Frontend or browser still showing data from a previous superadmin session, or session not refreshed after role change (e.g. consultant and superadmin on same browser).
    3. **Server path that bypasses RLS:** Previously, `getNotesInsights` used `supabaseAdmin` and returned aggregates from **all** notes (including global) to Sapito; that was fixed to be user-scoped (consultant = only project notes). If there is another server path that returns note content or aggregates with admin client without filtering by user/scope, that could still leak.
- **If the issue is “consultant sees other projects’ notes”:** Then the leak is in project visibility (e.g. projects RLS or project_members). Current RLS ties project notes to “project visible to user” (member/owner/superadmin). Unlikely if RLS is applied; would check that no API returns project notes without verifying membership for that project (e.g. project-agent with arbitrary `projectId` from client — see below).

**Project-agent note:** In project mode, the API uses `body.projectId` and calls `getProjectNotes(effectiveProjectId, …)` without verifying that the authenticated user is a member of `effectiveProjectId`. A malicious client could send another project’s id and receive that project’s notes. **Recommendation:** In `POST /api/project-agent`, when `mode === 'project'`, verify `isProjectMember(userId, effectiveProjectId)` (or superadmin) before loading project notes/stats/links.

---

## 6. Minimal safe next step to fix the leak

- **Confirm RLS:** Ensure `20260404110000_notes_global_superadmin_only.sql` is applied in all environments. Run existing RLS verification script if present (e.g. `supabase/sql/verify_rls_and_metrics_migrations.sql`).
- **No new migration in this pass.** If consultants still see global notes:
  - **Frontend:** Ensure notes/dashboard refetch after login/logout or role change; avoid reusing cached note lists from another user/role.
  - **Backend:** Add membership check in project-agent for project mode: before calling `getProjectNotes` / `getProjectStats` / `getProjectLinks`, require `isProjectMember(userId, effectiveProjectId)` or superadmin.
- **Optional (defense in depth):** In `get_platform_metrics`, for non-superadmin, explicitly exclude global notes in comments and ensure the query only counts notes where `project_id = ANY(v_project_ids)` (already the case).

---

## 7. Larger future refactor recommended

1. **Introduce workspace (or equivalent):**
   - Add `workspaces` table (e.g. `id`, `name`, optional `owner_id`).
   - Add `workspace_id` to `profiles` and to `projects`. Backfill: e.g. one default workspace per user or one global workspace.
   - Enforce in RLS: users see only projects (and workspace-scoped data) in their `profiles.workspace_id`.

2. **Reclassify “global” notes:**
   - Add `workspace_id` (nullable) to `notes`.
   - Treat `project_id IS NULL` and `workspace_id IS NOT NULL` as workspace-shared notes (visible to same workspace).
   - Keep `project_id IS NULL` and `workspace_id IS NULL` as platform-global (superadmin only), or phase out.

3. **Workspace-scoped admin role:**
   - Add a role or permission “workspace admin” / “manager” that can manage users, projects, connectors, and shared knowledge **within** their workspace only (no cross-workspace visibility).

4. **Consistent use of identity and scope in APIs:**
   - Resolve `userId` from request in all APIs; use `workspace_id` and `project_members` for scope; avoid “if role = consultant then filter” without also checking workspace/project.

5. **Project-agent and any project-scoped API:**
   - Always verify project membership (or superadmin) before returning project data, including when `projectId` comes from the request body.

---

## Summary table

| Question | Answer |
|----------|--------|
| Current model | Flat platform; `profiles.app_role`; projects by `created_by` + `project_members`; global notes = platform-global (superadmin only). No workspace/tenant. |
| Main mismatch | Role used as scope; no workspace; global notes are platform-wide, not workspace-shared. |
| Target model | Superadmin (platform); workspace-scoped manager (after workspace exists); consultant (member/owned projects + personal); access by user + workspace + project membership. |
| Global notes → workspace-shared? | Yes, once workspace exists; today keep global = superadmin-only. |
| Likely cause of consultant seeing notes | Migration not applied, stale session/cache, or server path bypassing RLS (e.g. getNotesInsights — fixed; or project-agent without membership check). |
| Minimal fix | Ensure 20260404110000 applied; refetch after auth change; add project membership check in project-agent for project mode. |
| Future refactor | Add workspaces; workspace_id on profiles/projects/notes; workspace-shared notes; workspace-scoped admin; enforce membership in all project APIs. |
