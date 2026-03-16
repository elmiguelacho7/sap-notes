# Assignee / Responsable system — audit report

## Modules reviewed

- **Global Tasks** (`/tasks`)
- **Global Tickets** (`/tickets`)
- **My Work** (`/my-work`)
- **Dashboard / Project Overview widgets** (`/dashboard`, `/projects/[id]`)
- **Project Ticket creation** (`/projects/[id]/tickets/new`) (high-impact entry point for `assigned_to`)
- **Shared components used by the above**: `TasksBoard`, `TaskList`, `AssigneeDropdown`, ticket tables

## Modules updated

### Global Tasks (`app/(private)/tasks/page.tsx`, `app/components/TasksBoard.tsx`)

- **Assignable users source**: now uses `useAssignableUsers({ contextType: "global" })` (active profiles).
- **Assignee filter**: added “Responsable” filter via `TaskFilterBar` using options:
  - **Todos los responsables**
  - active users (no duplicates)
- **Kanban cards**: show/edit **Responsable** using the shared dropdown UI and consistent **“Sin asignar”** fallback.
- **List view**: passes `assigneeOptions` + `onAssigneeChange` so the assignee selector is consistent there too.
- **“Asignado a mí” logic**: standardized to compare **only** against `assignee_id` / `assignee_profile_id` (no longer includes `created_by`).

### Global Tickets (`app/(private)/tickets/page.tsx`)

- Added `assigned_to` to the query and a **Responsable** column rendered with `AssigneeCell`.
- Added filters:
  - **Todos**
  - **Sin asignar**
  - **Asignado a mí** (compares against current user id consistently)
- Uses global assignable users map via `useAssignableUsers({ contextType: "global" })` to resolve names.

### Project Ticket creation (`app/(private)/projects/[id]/tickets/new/page.tsx`)

- Label standardized from **“Asignado a” → “Responsable”**.
- Replaced per-page member loading + custom dropdown with **`AssigneeSelect`**:
  - `contextType="project"`
  - `projectId={projectId}`
  - consistent **“Sin asignar”** behavior

### My Work (`app/(private)/my-work/page.tsx`)

- Standardized Spanish UI copy for the My Work workspace to match platform language and “Asignado a mí” concept.
- **Intentional UI behavior**: does not render a Responsable pill per row, because the page is **already scoped to items assigned to the current user** (the assignee rule is enforced in the query layer).

### Dashboard

- Team workload empty-state text aligned to Spanish and the **Responsable** wording.

## Rules confirmed (platform-wide)

- **Single internal concept**: **assignee** (UI label: **Responsable**).
- **Field mapping**
  - tasks → `assignee_profile_id` (project tasks) / `assignee_id` (global tasks table)
  - tickets → `assigned_to`
  - activities → `owner_profile_id`
- **Assignable users source**
  - project context → **project members only** (`project_members → profiles`)
  - global context → **active global users only** (`profiles.is_active = true`)
- **Unassigned state**: always **“Sin asignar”**.
- **“Asignado a mí”**: always uses strict comparison to the current user’s profile id against the module’s assignee field.

## Remaining intentional exceptions

- **`components/tickets/TicketsTable.tsx`**: the data model provides `assignee_name` (string) but not the canonical `assignee_id`, so the table uses `AssigneePill` with `displayLabel` for consistent rendering. If/when that list query is updated to return the id, it can use `AssigneeCell`/`profilesMap` directly.
- **My Work row display**: assignee is not shown because the page is, by definition, the “assigned to me” workspace; showing a Responsable pill would be redundant.

## Final status

✅ Shared assignee primitives are now used consistently across **global + project** tasks and tickets for:
- rendering (cell/pill)
- selection (dropdown/select)
- filters (“Asignado a mí”, “Sin asignar”)
- user option sources (project members vs active global users)

✅ TypeScript check and Next.js build pass after the changes.

