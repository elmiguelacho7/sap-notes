# RBAC validation checklist

Use this checklist to verify expected behavior per role after RBAC implementation. It does not define new behavior; it documents what to expect for each role. Schema and RLS are unchanged.

Reference: [RBAC_PERMISSION_MATRIX.md](./RBAC_PERMISSION_MATRIX.md).

---

## App roles (global)

### superadmin

| Area | Expected behavior |
|------|--------------------|
| **Dashboard** | Full access; view all projects (view_all_projects). |
| **Admin panel** | Full access (view_admin_panel, manage_users, manage_global_roles, etc.). |
| **Project (any)** | Can archive any project (manage_any_project). Can delete any project (delete_any_project). Can list/add/remove members on any project (manage_any_project). Can edit/archive/delete when on a project where they are owner (edit_project). |
| **Project permissions API** | canEdit, canArchive, canDelete, canManageMembers true when they are project owner or by global override (manage_any_project, delete_any_project). |
| **Global Copilot** | Can use global project-agent mode (use_global_ai). |
| **Notes insights (Sapito)** | Sees all notes for insights (view_global_notes). |

### admin

| Area | Expected behavior |
|------|--------------------|
| **Dashboard** | Access; view all projects (view_all_projects). No manage_users, manage_global_roles, manage_user_activation, manage_platform_settings. |
| **Admin panel** | view_admin_panel, manage_clients, manage_knowledge_sources, view_global_notes, manage_global_notes, view_global_metrics. |
| **Project (any)** | Can archive any project (manage_any_project). Can list/add/remove members on any project (manage_any_project). **Cannot** delete any project (no delete_any_project). On projects where they are member, behavior follows project role (owner/editor/viewer). |
| **Project permissions API** | canDelete true only if they have edit_project on that project (e.g. owner). canManageMembers true for any project (manage_any_project). |
| **Global Copilot** | Can use global project-agent mode (use_global_ai). |
| **Notes insights** | Depends on view_global_notes (if granted, sees all notes; otherwise project-scoped). |

### consultant

| Area | Expected behavior |
|------|--------------------|
| **Dashboard** | view_dashboard; can create projects (create_project). |
| **Projects** | Only projects they are a member of. Edit/archive/delete/members according to **project role** (owner, editor, viewer) on each project. |
| **Project permissions API** | canEdit, canArchive, canDelete, canManageMembers from project role only (no global override). |
| **Global Copilot** | Can use global project-agent mode (use_global_ai). |
| **Notes insights** | Only notes from projects they are a member of (no view_global_notes). |

### viewer (app)

| Area | Expected behavior |
|------|--------------------|
| **Dashboard** | view_dashboard only. Can list projects they are a member of (no create_project). |
| **Projects** | Only projects they are a member of; behavior per **project role** (owner, editor, viewer). |
| **Project permissions API** | From project role only. |
| **Global Copilot** | Can use global project-agent mode (use_global_ai). |
| **Notes insights** | Only notes from projects they are a member of. |

---

## Project roles

### owner

| Area | Expected behavior |
|------|--------------------|
| **Project** | Full project permissions: view, edit, archive, delete (edit_project), manage members (manage_project_members), all notes/tasks/activities/tickets/knowledge/AI. |
| **Permissions API** | canEdit, canArchive, canDelete (edit_project), canManageMembers true. |
| **Members page** | Can see list, add members, see invitations, revoke (manage_project_members). |
| **Archive / delete** | Can archive and delete this project (edit_project). |

### editor

| Area | Expected behavior |
|------|--------------------|
| **Project** | All project permissions **except** manage_project_members. Can view and manage notes, tasks, activities, tickets, knowledge, use project AI. Can edit project (edit_project) so can archive. |
| **Permissions API** | canEdit, canArchive true. canDelete true if they have edit_project (owner can delete; editor has edit_project so can delete own project). canManageMembers **false** (editor does not have manage_project_members). |
| **Members page** | Can see member list (view_project). **Cannot** add members or manage invitations (no canManageMembers). |
| **Archive** | Can archive (edit_project). **Delete** depends: if delete is restricted to delete_any_project only, editor would not see canDelete; current implementation allows edit_project for canDelete so owner and editor can delete. |

### viewer (project)

| Area | Expected behavior |
|------|--------------------|
| **Project** | View-only: view_project, view_project_notes, view_project_tasks, view_project_activities, view_project_tickets, view_project_knowledge. No edit_project, no manage_project_members, no create/edit/delete notes, no manage tasks/activities/tickets, no manage knowledge, no use_project_ai. |
| **Permissions API** | canEdit, canArchive, canDelete, canManageMembers **false**. |
| **Members page** | Can see member list (view_project). Cannot add or manage invitations. |
| **Archive / delete** | Cannot archive or delete. |

---

## Quick validation steps

1. **superadmin** — Log in as superadmin; open any project (e.g. from admin project list); confirm archive and delete buttons visible; confirm members management in project and in admin; confirm global Copilot works.
2. **admin** — Log in as admin; confirm can archive and manage members on any project; confirm delete only on projects where admin is owner (or no delete if product restricts to delete_any_project only).
3. **consultant** — Log in as consultant; open a project where they are **owner**; confirm edit, archive, delete, members. Open a project where they are **editor**; confirm edit, archive, no members add. Open a project where they are **viewer**; confirm read-only, no edit/archive/delete/members add.
4. **viewer (app)** — Log in as app viewer; confirm only projects they belong to; confirm behavior per project role.
5. **Members page** — As **editor** on a project, confirm “add member” / invitations are hidden (canManageMembers false). As **owner**, confirm they are visible and work.
6. **Project dashboard** — Confirm permissions come from API only (no superadmin override); canDelete/canEdit/canArchive reflect edit_project and delete_any_project.
7. **Sapito / notes insights** — Users with view_global_notes see all notes in insights; others see only project-scoped notes.
8. **Global Copilot** — Users without use_global_ai get 403 in global mode; users with use_global_ai can use it.

---

## UI consistency (RBAC pass)

UI visibility for notes and tickets is aligned with permission-based APIs; API enforcement remains the source of truth.

| Area | Source | Notes |
|------|--------|--------|
| **Project notes** (`/projects/[id]/notes`) | `GET /api/projects/[id]/permissions` → `canEditProjectNotes`, `canDeleteProjectNotes` | Edit/delete/deleteEndpoint from these flags; no `app_role` for note actions. |
| **Project tickets** (`/projects/[id]/tickets`) | Same API → `canManageProjectTickets` | Edit/delete/deleteEndpoint from this flag. |
| **Project links** (`/projects/[id]/links`) | Same API → `canEdit` | Can-edit for links/sources uses only `canEdit` from API (no superadmin override). |
| **Global notes** (`/notes`, `/notes/[id]`, `/notes/new`) | `GET /api/me` → `permissions.manageGlobalNotes` | Create/edit/delete visibility and redirect in `/notes/new` use `manageGlobalNotes` (from `manage_global_notes`). Note detail: global note uses `manageGlobalNotes`; project note uses project `canEditProjectNotes` / `canDeleteProjectNotes`. |
| **Global tickets** (`/tickets`, `/tickets/[id]`) | Still `app_role === "superadmin"` | Tickets are project-scoped; list spans projects. Per-ticket permission would require per-ticket project resolution. Documented here; API enforces `manage_project_tickets` per ticket. |

Remaining **app_role** use (intentional for this pass):

- **Global tickets list and detail**: edit/delete visibility still gated by `appRole === "superadmin"`; backend enforces `manage_project_tickets` per ticket. A future pass could add a “can manage any ticket” style flag if desired.

---

## Notes

- **Admin panel** visibility and actions are gated by global permissions (view_admin_panel, manage_users, etc.); not re-listed in full here.
- **Notes/tickets** edit/delete in project-scoped and global-notes UI now use permission-based flags (see “UI consistency” above). Global tickets list/detail still use app_role for visibility; API enforces permissions.
- RLS and schema are unchanged; this checklist only describes expected behavior under the current permission model.
