# RBAC Permission Matrix

This document describes the first real RBAC permission matrix implemented on top of the existing roles/permissions structure.

**Next phase:** For a design-ready proposal for the next permission evolution (manage_any_project, delete_any_project, use_global_ai, view_project_members, and sapitoTools note-scoping), see **[RBAC_NEXT_PHASE_PROPOSAL.md](./RBAC_NEXT_PHASE_PROPOSAL.md)**. For **implementation preparation** (migration SQL, role-permission table, and list of routes/helpers to change), see **[RBAC_IMPLEMENTATION_PHASE.md](./RBAC_IMPLEMENTATION_PHASE.md)**. For **validation** (expected behavior per role), see **[RBAC_VALIDATION_CHECKLIST.md](./RBAC_VALIDATION_CHECKLIST.md)**.

---

## Structure (unchanged)

- **profiles.app_role** — global platform role key (superadmin, admin, consultant, viewer).
- **project_members.role** — project role key (owner, editor, viewer).
- **public.roles** — rows with `scope IN ('app', 'project')` and `key` matching the above.
- **public.permissions** — rows with `scope IN ('app', 'project')` and unique `key`.
- **public.role_permissions** — many-to-many (role_id, permission_id).

Global permissions are resolved via: `profiles.app_role` → `roles` (scope='app') → `role_permissions` → `permissions`.  
Project permissions are resolved via: `project_members.role` → `roles` (scope='project') → `role_permissions` → `permissions`.

## Helper functions

- **hasGlobalPermission(userId, permissionKey)** — returns whether the user has the given app-scope permission (from their profile’s app_role).
- **hasProjectPermission(userId, projectId, permissionKey)** — returns whether the user has the given project-scope permission in that project (from their project_members.role).
- **requireGlobalPermission(userId, permissionKey)** — throws `PermissionDeniedError` if the user lacks the permission (use in routes; return 403 when caught).
- **requireProjectPermission(userId, projectId, permissionKey)** — same for project permission.
- **requireAuthAndGlobalPermission(request, permissionKey)** — authenticates the request and requires the global permission; returns `{ userId }` or a `NextResponse` (401/403) to return from the route.
- **requireAuthAndProjectPermission(request, projectId, permissionKey)** — same for project permission.
- **requireAuthAndProjectOrGlobalPermission(request, projectId, projectPermKey, globalPermKey)** — allows either the project permission or the global permission (e.g. manage_any_project for write override, or manage_project_members on the project).

Defined in `lib/auth/permissions.ts`. Use in API routes and server code.

## Routes migrated to permission checks

The following routes now use the helpers above instead of hardcoded `app_role === 'superadmin'` or `requireSuperAdminFromRequest`. Unauthenticated requests receive 401; authenticated users without the required permission receive 403.

### Phase 1 — Admin / platform (global permissions)

| Route | Method | Permission |
|-------|--------|------------|
| `/api/admin/users` | GET, PATCH, POST | manage_users |
| `/api/admin/users/[id]` | DELETE | manage_users |
| `/api/admin/users/[id]/app-role` | PATCH | manage_global_roles |
| `/api/admin/users/[id]/activation` | PATCH | manage_user_activation |
| `/api/admin/roles` | GET | manage_global_roles |
| `/api/admin/roles/[id]` | PATCH | manage_global_roles |
| `/api/admin/roles/[id]/permissions` | PUT | manage_global_roles |
| `/api/admin/app-roles` | GET | view_admin_panel |
| `/api/admin/clients` | GET, POST | manage_clients |
| `/api/admin/knowledge-sources` | GET, POST | manage_knowledge_sources |
| `/api/admin/knowledge-sources/[id]` | DELETE | manage_knowledge_sources |
| `/api/admin/knowledge-sources/[id]/sync` | POST | manage_knowledge_sources |

### Phase 2 — Project core

| Route | Method | Permission |
|-------|--------|------------|
| `/api/projects` | POST | create_project |
| `/api/admin/projects/[id]/members` | GET, POST, DELETE | manage_any_project (global) **or** manage_project_members (on project) |
| `/api/projects/[id]` | DELETE | edit_project |

Project creation is now done via **POST /api/projects** (requires `create_project`). The new-project page calls this API; the DB trigger adds the creator as owner in `project_members`.

**Future change:** Project deletion is currently gated by `edit_project`. A separate permission `delete_project` may be introduced in a later pass so that edit and delete can be controlled independently.

### Phase 3 — Project modules

| Route | Method | Permission |
|-------|--------|------------|
| `/api/projects/[id]/notes` | GET | view_project_notes |
| `/api/projects/[id]/notes` | POST | create_project_notes |
| `/api/notes/[id]` | PATCH | edit_project_notes (project note) or manage_global_notes (global note) |
| `/api/notes/[id]` | DELETE | delete_project_notes (project note) or manage_global_notes (global note) |
| `/api/projects/[id]/brain` | GET | use_project_ai |
| `/api/projects/[id]/knowledge` | GET | view_project_knowledge |
| `/api/projects/[id]/knowledge` | POST | manage_project_knowledge |

### Phase 4 — Project tasks, activities, tickets (next pass)

| Route | Method | Permission |
|-------|--------|------------|
| `/api/projects/[id]/activity-stats` | GET | view_project_activities |
| `/api/projects/[id]/activate-plan` | GET | view_project_tasks |
| `/api/projects/[id]/generate-activate-plan` | POST | manage_project_tasks |
| `/api/projects/[id]/generate-plan` | POST | manage_project_tasks |
| `/api/tickets/[id]` | PATCH | manage_project_tickets (on ticket’s project) |
| `/api/tickets/[id]` | DELETE | manage_project_tickets (on ticket’s project) |

### Phase 5 — Project stats, members, sources, agent, integrations (this pass)

| Route | Method | Permission |
|-------|--------|------------|
| `/api/projects/[id]/stats` | GET | view_project |
| `/api/projects/[id]/members` | GET | view_project |
| `/api/projects/[id]/members` | POST | manage_project_members |
| `/api/projects/[id]/sources/[sourceId]/sync` | POST | manage_project_knowledge |
| `/api/project-agent` | POST | use_project_ai (project mode) **or** use_global_ai (global mode) |
| `/api/integrations/google/sync` | POST | manage_project_knowledge (body: `{ projectId }`) |

### Phase 6 — Archive, invitations, permissions (cleanup pass)

| Route | Method | Permission |
|-------|--------|------------|
| `/api/projects/[id]/archive` | PATCH | edit_project (on project) **or** manage_any_project (global) |
| `/api/projects/[id]/invitations` | GET | manage_project_members |
| `/api/projects/[id]/invitations` | POST | manage_project_members |
| `/api/invitations/revoke` | POST | manage_project_members (on invitation's project) |
| `/api/projects/[id]/permissions` | GET | canEdit/canArchive from edit_project; canDelete from edit_project or delete_any_project; canManageMembers from manage_project_members or manage_any_project |

**GET /api/projects/[id]/permissions** returns `{ canEdit, canArchive, canDelete, canManageMembers }`. `canEdit` and `canArchive` from `hasProjectPermission(userId, projectId, "edit_project")`. `canDelete` from **edit_project** on this project (owner can delete own) **or** **delete_any_project** (global). `canManageMembers` from **manage_project_members** on this project **or** **manage_any_project** (global); use for member list add/invite visibility.

**GET /api/projects/[id]/members** remains gated by **view_project** (any project member can view the list). A future permission **view_project_members** may be introduced to restrict member list visibility separately from general project view.

---

## Project-agent authorization

| Mode | Authorization |
|------|----------------|
| **Project** (`mode === "project"`, `projectId` set) | **use_project_ai** on the project (enforced before loading project data). |
| **Global** (`mode === "global"` or no projectId) | **use_global_ai** (global). Authentication required; global mode is gated by this permission. |

---

## view_all_projects and manage_any_project

**view_all_projects** is a **read-only** global permission (“Ver todos los proyectos” — view all projects). It must **not** be used as a write-level override.

**manage_any_project** is the **write-level global override** for project operations. It is used where an admin (or superadmin) may act on any project without being a member:

| Route | Permission |
|-------|------------|
| **PATCH /api/projects/[id]/archive** | edit_project (on project) **or** manage_any_project (global). |
| **GET/POST/DELETE /api/admin/projects/[id]/members** | manage_project_members (on project) **or** manage_any_project (global). |

**delete_any_project** is a **separate** global permission used for project-deletion capability (canDelete in GET /api/projects/[id]/permissions and, if desired, for DELETE /api/projects/[id]). It is not used as a general write override.

---

## Legacy authorization cleanup summary

Remaining non-debug authorization checks that still rely on `app_role` or role names:

| Location | What | Why it remains | Future replacement |
|----------|------|----------------|--------------------|
| **DELETE /api/admin/users/[id]** | Read target’s `app_role`; block delete if target is superadmin and is the last superadmin | Business rule (protect last superadmin), not route auth (route uses manage_users). | Optional: explicit permission or keep as data guard. |
| **app/(private)/admin/users/page.tsx** | `profile?.app_role === "superadmin"` to show delete user control | UI only; actual delete is gated by API (manage_users). | Optional: derive from same permission as API or keep for simplicity. |
| **lib/auth/serverAuth.ts** | `requireSuperAdminFromRequest` | Used only by **debug** routes (`/api/debug/whoami`, `/api/debug/rls`). | Keep for debug; or gate debug routes with a dedicated debug permission. |

**Implemented:** GET /api/projects/[id]/permissions **canDelete** uses **delete_any_project** (and edit_project on project); **canManageMembers** uses manage_project_members or manage_any_project. Project-agent **global mode** is gated by **use_global_ai**. Archive and admin project members use **manage_any_project**. **lib/ai/sapitoTools.ts** getNotesInsights uses **hasGlobalPermission(userId, "view_global_notes")** for “all notes” scoping (no longer app_role).

All API routes that were previously using `requireProjectAccess`, `isProjectOwner`, or `isProjectMember` have been migrated to permission-based checks; none remain in `app/api`.

---

## RLS-only access (no API enforcement)

The following project-module data is **read/written only from the client** via Supabase (no dedicated list/create/update/delete API routes). Visibility and mutability are enforced **only by RLS** (and by existing API routes where they exist).

| Resource | Access pattern | RLS |
|----------|-----------------|-----|
| **project_tasks** | Client Supabase from project tasks page, activities page, project dashboard, my-work, TasksBoard, and server services (projectService, sapitoTools, projectIntelligence, generateActivatePlan, projectPlanningService). | Yes — project membership (`project_tasks_*_for_members`). |
| **project_activities** | Client Supabase from project activities page, project dashboard, planning/calendar, my-work, and server services. | Yes — project membership (`Allow * project activities for members`). |
| **tickets** (list/read) | Client Supabase from project tickets page, project dashboard, tickets page, my-work. PATCH/DELETE go through `/api/tickets/[id]` (Phase 4). | Depends on existing RLS on `tickets` table; no GET list API in this pass. |

**Intentional for this pass:** No new API routes were added for project_tasks or project_activities. A future pass may add list/read APIs protected by `view_project_tasks` / `view_project_activities` and create/update/delete by `manage_project_tasks` / `manage_project_activities`, and/or a GET project tickets endpoint protected by `view_project_tickets`, if API-level enforcement is required.

---

## Routes still pending migration

- **Admin / debug / profile:** `/api/admin/users/[id]` (delete last-superadmin guard), `/api/notes` (GET app_role), `/api/debug/whoami`, `/api/debug/rls`, `/api/me` — left as-is (admin/debug or profile scope). See [Legacy authorization cleanup summary](#legacy-authorization-cleanup-summary).
- **sapitoTools, admin UI:** Documented in the legacy summary with future replacement options.
- **Future task/activity/ticket APIs:** If list or CRUD APIs are added for project_tasks, project_activities, or ticket list, they should enforce the corresponding view_* / manage_* permissions.
- **Invitations accept/lookup:** `/api/invitations/accept` requires authenticated user + email match (invitee is not a project member yet). `/api/invitations/lookup` is unauthenticated by design. No project permission applied.

## Consultant → create_project

**Decision (initial matrix):** Consultant **has** the `create_project` permission.

- **Rationale:** Default is that consultants can open projects unless the business model says otherwise.
- **To disable:** Remove `create_project` from the consultant block in `supabase/migrations/20260406120000_rbac_permission_matrix.sql` and re-run that migration (or run an idempotent UPDATE that deletes the corresponding role_permission row).

## Migrations / seeds

- **20250602210000_rbac_roles_permissions.sql** — creates roles, permissions, role_permissions and initial seeds.
- **20260406120000_rbac_permission_matrix.sql** — adds missing permissions and fills the role-permission matrix (idempotent; does not change profiles or project_members).
- **20260407120000_rbac_add_manage_delete_use_global_ai.sql** — adds manage_any_project, delete_any_project, use_global_ai and assigns them to app roles (superadmin, admin, consultant, viewer). See docs/RBAC_IMPLEMENTATION_PHASE.md.

## Roles y permisos page

The page at **Admin → Roles y permisos** now loads the matrix from the API (`GET /api/admin/roles`) and shows each role with its permission list (names from the DB). It reflects the real configured permissions.
