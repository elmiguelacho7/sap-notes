# RBAC implementation phase — preparation

This document prepares the **implementation** of the approved permission model. It is design-oriented: migration SQL and role-permission assignments are proposed; code changes are listed so they can be applied in a follow-up pass without breaking existing behavior.

Reference: [RBAC_PERMISSION_MATRIX.md](./RBAC_PERMISSION_MATRIX.md), [RBAC_NEXT_PHASE_PROPOSAL.md](./RBAC_NEXT_PHASE_PROPOSAL.md).

---

## 1. Current RBAC schema and migration approach

- **Tables:** `public.roles` (scope + key), `public.permissions` (scope + key UNIQUE), `public.role_permissions` (role_id, permission_id). Defined in `20250602210000_rbac_roles_permissions.sql`.
- **Idempotent matrix:** `20260406120000_rbac_permission_matrix.sql` inserts missing app/project permissions with `ON CONFLICT (key) DO UPDATE`, then inserts role_permissions with `ON CONFLICT (role_id, permission_id) DO NOTHING`. It does **not** grant new permissions to existing roles automatically when new permission rows are added later.
- **Helpers:** `lib/auth/permissions.ts` — `hasGlobalPermission`, `hasProjectPermission`, `requireAuthAndProjectOrGlobalPermission`, etc. They resolve permission by role key (from `profiles.app_role` or `project_members.role`) and look up permission by key in `permissions`.

So: add new permission rows in a new migration, then add the corresponding **role_permissions** rows for each role that should have them.

---

## 2. Minimal migration to add new permissions

Add a **new migration** (e.g. `supabase/migrations/YYYYMMDDHHMMSS_rbac_add_manage_delete_use_global_ai.sql`) with:

**2.1 Insert the three new app-scope permissions** (idempotent):

```sql
-- RBAC: Add manage_any_project, delete_any_project, use_global_ai.
-- Semantic: view_all_projects remains read-only; manage_any_project is the write override; delete_any_project is separate/critical; use_global_ai gates global Copilot.

INSERT INTO public.permissions (scope, key, name) VALUES
  ('app', 'manage_any_project', 'Gestionar cualquier proyecto'),
  ('app', 'delete_any_project', 'Eliminar cualquier proyecto'),
  ('app', 'use_global_ai', 'Usar IA global (Copilot)')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, scope = EXCLUDED.scope;
```

**2.2 Grant new permissions to roles** (idempotent):

- **superadmin:** all three (`manage_any_project`, `delete_any_project`, `use_global_ai`).
- **admin:** `manage_any_project` and `use_global_ai` (not `delete_any_project` unless product decides admins may delete any project).
- **consultant:** `use_global_ai`.
- **viewer (app):** `use_global_ai`.

**Full migration SQL:**

```sql
-- ========== 1. New app permissions ==========
INSERT INTO public.permissions (scope, key, name) VALUES
  ('app', 'manage_any_project', 'Gestionar cualquier proyecto'),
  ('app', 'delete_any_project', 'Eliminar cualquier proyecto'),
  ('app', 'use_global_ai', 'Usar IA global (Copilot)')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, scope = EXCLUDED.scope;

-- ========== 2. Superadmin: manage_any_project, delete_any_project, use_global_ai ==========
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'app' AND r.key = 'superadmin' AND p.scope = 'app'
  AND p.key IN ('manage_any_project', 'delete_any_project', 'use_global_ai')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ========== 3. Admin: manage_any_project, use_global_ai ==========
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'app' AND r.key = 'admin' AND p.scope = 'app'
  AND p.key IN ('manage_any_project', 'use_global_ai')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ========== 4. Consultant: use_global_ai ==========
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'app' AND r.key = 'consultant' AND p.scope = 'app'
  AND p.key = 'use_global_ai'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ========== 5. Viewer (app): use_global_ai ==========
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'app' AND r.key = 'viewer' AND p.scope = 'app'
  AND p.key = 'use_global_ai'
ON CONFLICT (role_id, permission_id) DO NOTHING;
```

Project roles (owner, editor, viewer) are unchanged. **view_project_members** is optional/future and not added here.

**Migration file created:** `supabase/migrations/20260407120000_rbac_add_manage_delete_use_global_ai.sql` contains the SQL above. Run it (e.g. via Supabase CLI or dashboard) before applying the code changes in §4.

---

## 3. Exact role–permission assignments (new permissions only)

After the new migration:

| Role (app) | manage_any_project | delete_any_project | use_global_ai |
|------------|--------------------|--------------------|---------------|
| superadmin | Yes                | Yes                | Yes           |
| admin      | Yes                | No                 | Yes           |
| consultant | No                 | No                 | Yes           |
| viewer     | No                 | No                 | Yes           |

**Project roles (owner, editor, viewer):** No change in this phase. They keep existing assignments from `20260406120000_rbac_permission_matrix.sql` (owner: all project permissions; editor: all except manage_project_members; viewer: view_project, view_project_notes, view_project_tasks, view_project_activities, view_project_tickets, view_project_knowledge). **view_project_members** is optional/future and not assigned.

Existing app and project permissions are unchanged.

---

## 4. Routes and helpers that must change

Apply these only **after** the migration is run. Semantic rules: view_all_projects is not used for write; manage_any_project is the write override; delete_any_project is separate; use_global_ai and use_project_ai remain distinct.

### 4.1 Use manage_any_project instead of view_all_projects (write/override)

| File | Change |
|------|--------|
| **app/api/projects/[id]/archive/route.ts** | In `requireAuthAndProjectOrGlobalPermission(..., "edit_project", "view_all_projects")`, replace the global argument with **"manage_any_project"**. Update JSDoc to require `edit_project` (on project) or `manage_any_project` (global). |
| **app/api/admin/projects/[id]/members/route.ts** | In GET, POST, and DELETE handlers, replace **"view_all_projects"** with **"manage_any_project"** in `requireAuthAndProjectOrGlobalPermission(..., "manage_project_members", "view_all_projects")`. Update JSDoc to "manage_any_project (global) or manage_project_members (on project)". |

### 4.2 Use delete_any_project for canDelete

| File | Change |
|------|--------|
| **app/api/projects/[id]/permissions/route.ts** | Replace `canDelete = user.appRole === "superadmin"` with **canDelete = await hasGlobalPermission(userId, "delete_any_project")**. Optionally allow project owners to delete their own project: **canDelete = (await hasProjectPermission(userId, projectId, "edit_project")) \|\| (await hasGlobalPermission(userId, "delete_any_project"))**. Document the chosen rule in a short comment. Current DELETE /api/projects/[id] uses only edit_project; if that stays, canDelete can be aligned to "edit_project on this project OR delete_any_project global". |

### 4.3 Require use_global_ai for project-agent global mode

| File | Change |
|------|--------|
| **app/api/project-agent/route.ts** | When **mode === "global"** (or effectiveProjectId is null): (1) Ensure authenticated user: if effectiveUserId is null, set it from `getCurrentUserIdFromRequest(req)`; if still null, return 401. (2) Call **requireAuthAndGlobalPermission(req, "use_global_ai")** and return its result if it is a NextResponse. Update the inline comment to state that global mode requires auth + use_global_ai. |

### 4.4 Helpers and constants

| File | Change |
|------|--------|
| **lib/auth/permissions.ts** | Add **"manage_any_project"**, **"delete_any_project"**, **"use_global_ai"** to **GLOBAL_PERMISSION_KEYS**. Update JSDoc for **requireAuthAndProjectOrGlobalPermission** to mention manage_any_project as the write-override example instead of view_all_projects. |

---

## 5. Checklist (no behavior break)

- [ ] New migration file created with §2 SQL (permissions + role_permissions).
- [ ] Archive route: global key `view_all_projects` → `manage_any_project`.
- [ ] Admin project members (GET/POST/DELETE): global key `view_all_projects` → `manage_any_project`.
- [ ] Permissions route: canDelete from `delete_any_project` (and optionally `edit_project`).
- [ ] Project-agent: global mode requires auth + `use_global_ai`.
- [ ] lib/auth/permissions.ts: GLOBAL_PERMISSION_KEYS and JSDoc updated.
- [ ] docs/RBAC_PERMISSION_MATRIX.md updated to reflect view_all_projects read-only and use of manage_any_project, delete_any_project, use_global_ai.

---

## 6. No changes in this pass

- RLS: no changes.
- Schema: only new rows in `permissions` and `role_permissions`.
- Project roles: no new project permissions (view_project_members optional/future).
- sapitoTools note-scoping: remains in RBAC_NEXT_PHASE_PROPOSAL.md; not part of this phase.

This document is preparation only; implementation in code and migration can follow using the checklist above.
