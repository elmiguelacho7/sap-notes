# RBAC next phase — design proposal

This document is a **design-ready proposal** for the next permission evolution. It does not change behavior, schema, RLS, or route logic. Implementation will follow in a later pass.

Reference: [RBAC_PERMISSION_MATRIX.md](./RBAC_PERMISSION_MATRIX.md) for current state, legacy summary, and view_all_projects semantic note.

---

## 1. Overview

The next phase should:

- Introduce **global (app-scope)** permissions that replace write-level use of `view_all_projects` and legacy `app_role === "superadmin"` for project deletion and global AI.
- Optionally introduce a **project-scope** permission to restrict member list visibility.
- Align **sapitoTools** note-scoping with the permission model instead of `app_role === "superadmin"`.

No new permissions are created in the database in this pass; this proposal defines candidates and their intended use.

---

## 2. Candidate permissions

### 2.1 manage_any_project

| Attribute | Value |
|-----------|--------|
| **Key** | `manage_any_project` |
| **Scope** | **app** (global) |
| **Purpose** | Allow the holder to perform project-level write/administrative actions on **any** project without being a member. Replaces the use of `view_all_projects` as a write override in admin and archive flows. |
| **Current legacy behavior replaced** | Use of **view_all_projects** (read-level) as a stand-in for "admin can act on any project" in: archive, admin project members GET/POST/DELETE. |
| **Routes / modules affected** | **PATCH /api/projects/[id]/archive** — would accept `edit_project` (on project) **or** `manage_any_project` (global) instead of `view_all_projects`. **GET/POST/DELETE /api/admin/projects/[id]/members** — would accept `manage_project_members` (on project) **or** `manage_any_project` (global) instead of `view_all_projects`. |
| **Role assignment (suggestion)** | Grant to **superadmin** and **admin** (same roles that today have `view_all_projects`), so behavior stays unchanged while semantics become correct. |
| **Notes** | If we later add **archive_any_project** or **delete_any_project**, they can be narrower subsets; until then, `manage_any_project` is the single "admin override" for project-level writes. |

---

### 2.2 delete_any_project

| Attribute | Value |
|-----------|--------|
| **Key** | `delete_any_project` |
| **Scope** | **app** (global) |
| **Purpose** | Allow the holder to see the "delete project" capability and to call project deletion for any project (e.g. hard-delete when allowed by business rules). Replaces legacy `app_role === "superadmin"` for **canDelete** in the permissions endpoint and, if desired, for the delete route itself. |
| **Current legacy behavior replaced** | **GET /api/projects/[id]/permissions** — `canDelete = user.appRole === "superadmin"`. Optionally **DELETE /api/projects/[id]** could require `edit_project` (on project) **or** `delete_any_project` (global) so that only project owners can delete their project unless the user has delete_any_project. |
| **Routes / modules affected** | **GET /api/projects/[id]/permissions** — `canDelete` would become `hasGlobalPermission(userId, "delete_any_project")` (and optionally project owner still allowed via `edit_project` if we keep "owner can delete own project"). **DELETE /api/projects/[id]** — today requires `edit_project` only; if we want "only superadmins can delete any project", we could require `edit_project` (on project) **or** `delete_any_project` (global) and grant `delete_any_project` only to superadmin. |
| **Role assignment (suggestion)** | Grant only to **superadmin** if the product rule is "only superadmin can delete any project". If "admin can delete any project" is desired, grant to admin as well. |
| **Notes** | Can coexist with **manage_any_project**: `manage_any_project` = broad admin override; `delete_any_project` = explicit delete-any capability for UI and API. |

---

### 2.3 use_global_ai

| Attribute | Value |
|-----------|--------|
| **Key** | `use_global_ai` |
| **Scope** | **app** (global) |
| **Purpose** | Gate access to the **project-agent global mode** (SAP Copilot / workspace-level AI). Today global mode has no permission check and no required auth. |
| **Current legacy behavior replaced** | "No permission or auth check" for **POST /api/project-agent** when `mode === "global"` (or no projectId). |
| **Routes / modules affected** | **POST /api/project-agent** — when `mode === "global"` (or effectiveProjectId is null), require authenticated user and `hasGlobalPermission(userId, "use_global_ai")`; return 401 if not authenticated, 403 if authenticated but lacking permission. |
| **Role assignment (suggestion)** | Grant to **superadmin**, **admin**, **consultant**, **viewer** (or whichever roles should see the global Copilot). Restricting to a subset (e.g. consultant and above) is a product decision. |
| **Notes** | Optionally require authentication for global mode in the same pass (today userId is optional for resolution). |

---

### 2.4 view_project_members (optional)

| Attribute | Value |
|-----------|--------|
| **Key** | `view_project_members` |
| **Scope** | **project** |
| **Purpose** | Restrict visibility of the **project members list** to users who have this permission on the project. Today **GET /api/projects/[id]/members** is gated by **view_project** (any project member can view). |
| **Current legacy behavior replaced** | None (behavior today is "any member can view"). This is an **optional refinement**: if we want "only owners or editors can see the member list", we would gate GET members with **view_project_members** and grant it only to owner/editor (not viewer). |
| **Routes / modules affected** | **GET /api/projects/[id]/members** — would require **view_project_members** instead of **view_project**. Project settings / members UI would only show the list when the user has **view_project_members**. |
| **Role assignment (suggestion)** | Grant to **owner** and **editor**; do **not** grant to **viewer** if the product rule is "viewers cannot see member list". |
| **Notes** | Defer unless product explicitly wants to hide member list from viewers. Keeping **view_project** for GET members is simpler and remains valid. |

---

## 3. sapitoTools note-scoping under RBAC

### 3.1 Current behavior (`lib/ai/sapitoTools.ts`)

- **getNotesInsights(userId, topN)** builds an insight summary from notes visible to the user.
- **Logic today:**
  - Loads `profiles.app_role` for `userId`.
  - If **superadmin**: query notes with no `project_id` filter (all non-deleted notes: global + all projects).
  - Otherwise: resolve `getUserProjectIds(userId)` and filter notes by `project_id IN (projectIds)` (only notes from projects the user is a member of; no global notes).

So today "see all notes for insights" is tied to **app_role === "superadmin"**.

### 3.2 Intended evolution (design)

- **Replace** the `app_role === "superadmin"` check with a **permission-based** check.
- **Recommended permission:** Use the existing global permission **view_global_notes** if the intended semantics are "user can see global notes (project_id IS NULL) and, for insights, we treat 'see all notes' as an extension of that."  
  Alternatively, introduce a dedicated global permission, e.g. **view_all_notes_for_insights**, if "see all notes" should be separate from "view global notes" (e.g. for audit or compliance).
- **Proposed logic:**
  - If `hasGlobalPermission(userId, "view_global_notes")` (or the new permission) → same as current superadmin branch: no `project_id` filter (all non-deleted notes).
  - Else → keep current non-superadmin branch: `getUserProjectIds(userId)` and filter by `project_id IN (projectIds)`.
- **Effects:**
  - **lib/ai/sapitoTools.ts**: remove direct read of `profiles.app_role`; call `hasGlobalPermission(userId, "view_global_notes")` (or the chosen key) from `lib/auth/permissions.ts`. No schema change in this pass; only the proposal is documented.
  - **Role assignment:** Today only superadmin has broad "see all" behavior; after migration, grant the chosen permission only to roles that should retain that behavior (e.g. superadmin, and optionally admin).

### 3.3 Summary table

| Current | After RBAC evolution |
|--------|----------------------|
| `app_role === "superadmin"` → all notes | `hasGlobalPermission(userId, "view_global_notes")` (or **view_all_notes_for_insights**) → all notes |
| Else → notes from `getUserProjectIds(userId)` | Else → notes from `getUserProjectIds(userId)` (unchanged) |

---

## 4. Implementation order (suggested)

1. **Schema/migration**: Add new permissions to `permissions` and assign to roles via `role_permissions` (e.g. `manage_any_project`, `delete_any_project`, `use_global_ai`; optionally `view_project_members`).
2. **Global write override**: Replace `view_all_projects` with **manage_any_project** in archive and admin project members routes (Phase 2 / Phase 6 in matrix).
3. **Project delete**: Switch **GET /api/projects/[id]/permissions** `canDelete` to **delete_any_project**; optionally tighten **DELETE /api/projects/[id]** to require **delete_any_project** for non-owners.
4. **Project-agent global mode**: Require auth + **use_global_ai** for global mode in **POST /api/project-agent**.
5. **sapitoTools**: Replace superadmin check in **getNotesInsights** with **hasGlobalPermission(userId, "view_global_notes")** (or the chosen permission).
6. **Optional**: Gate **GET /api/projects/[id]/members** with **view_project_members** and assign to owner/editor only if product wants to hide member list from viewers.

---

## 5. No changes in this pass

- No new rows in `permissions` or `role_permissions`.
- No changes to RLS, route behavior, or sapitoTools logic.
- This document is design-only; implementation will follow in a later phase.
