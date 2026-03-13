# Quota Control – Phase 4 Implementation Summary

This document summarizes Phase 4 of the quota system for SAP Notes Hub: **capacity dashboard** and **operational visibility** for superadmin. Phases 1–3 are documented in earlier QUOTA_PHASE*.md files; design is in [PLATFORM_QUOTA_DESIGN_PROPOSAL.md](./PLATFORM_QUOTA_DESIGN_PROPOSAL.md).

## What Was Implemented

### 1. Admin area: "Capacidad" tab

**Location:** Admin panel → tab **"Capacidad"** (superadmin only).

- Single view: **Uso y límites** with summary cards, filters, per-user table, and per-project table.
- Data from new GET `/api/admin/quotas/capacity` (see below).

### 2. Summary view (cards)

- **Usuarios al límite** — count of users with status `at_limit`.
- **Usuarios cerca del límite** — count with status `near_limit`.
- **Con overrides** — users that have at least one row in `user_limits`.
- **Proyectos al límite (miembros)** — projects where `membersCurrent >= membersLimit`.
- **Cerca (miembros)** — projects where members usage ≥ 80% and &lt; 100% of limit.
- **Al límite (invit.)** / **Cerca (invit.)** — same for pending invitations.

Summary counts are **global** (not affected by table filters).

### 3. Per-user usage table

Columns: Usuario (full name), Email, Rol (app role), Proyectos (used / limit or "sin límite"), Clientes (used / limit or "sin límite"), Overrides (Sí/—), Estado (badge).

- **projectsUsed** / **projectsLimit**: from `max_projects_created` usage and effective limit.
- **clientsUsed** / **clientsLimit**: from `max_clients_created` usage and effective limit.
- **hasOverrides**: true if `user_limits` has any row for that user.
- **status**: `unlimited` | `normal` | `near_limit` | `at_limit` (see threshold logic below).

### 4. Per-project usage table

Columns: Proyecto, Cliente, Miembros (current / limit or "sin límite"), Invit. pend. (current / limit or "sin límite"), Estado.

- **membersCurrent** / **membersLimit**: count of `project_members`; effective limit = minimum of `max_members_per_project` over all users who can manage the project (project owners + users with `manage_any_project`).
- **invitationsCurrent** / **invitationsLimit**: count of pending `project_invitations`; effective limit = minimum of `max_pending_invitations_per_project` over the same managers.
- **status**: worst of (members status, invitations status).

### 5. Threshold logic

- **≥ 100%** of effective limit → **at_limit**.
- **≥ 80%** and &lt; 100% → **near_limit**.
- &lt; 80% → **normal**.
- No effective limit (unlimited) → **unlimited**.

User status = worst status across their project and client quotas. Project status = worst status across member and invitation quotas.

### 6. Filters

- **Todos los roles** / **admin** / **consultant** / **viewer** / **superadmin** — filter user table by `app_role`.
- **Todos los estados** / **Al límite** / **Cerca del límite** / **Normal** / **Sin límite** — filter both tables by status.
- **Solo con overrides** — only users that have at least one `user_limits` row.
- **Solo proyectos con límite** — only projects that have a non-null members limit or invitations limit.

Filters are passed as query params to the capacity API; summary is always computed from full data.

### 7. API

**GET /api/admin/quotas/capacity**

- **Auth:** `manage_platform_settings` (superadmin).
- **Query:** `role`, `status`, `overridesOnly`, `projectsWithLimitsOnly` (all optional).
- **Response:**
  - `summary`: counts as above.
  - `userUsage`: array of user capacity rows (after filters).
  - `projectUsage`: array of project capacity rows (after filters).

**Service:** `lib/services/quotaCapacityService.ts` — `getCapacityData(filters)`. Uses batched Supabase queries and in-memory resolution of effective limits and usage; no change to the existing quota engine.

### 8. Optional: structured 409 response

When an action is rejected due to quota (409 Conflict), the response body now includes a **quota** object for UI feedback:

- `quota: { quotaKey: string, current: number, limit: number | null }`

Applied in:

- POST `/api/projects` (max_projects_created)
- POST `/api/admin/clients` (max_clients_created)
- POST `/api/projects/[id]/invitations` (max_members_per_project, max_pending_invitations_per_project)
- POST `/api/admin/projects/[id]/members` (max_members_per_project)
- POST `/api/projects/[id]/members` (max_members_per_project)
- POST `/api/invitations/accept` (max_members_per_project)

Existing `error` message is unchanged; clients can optionally use `quota` to show e.g. "10 / 10 proyectos".

### 9. Enforcement unchanged

- No new quota keys.
- No change to evaluation order or to `getEffectiveLimit` / `getCurrentUsage` / `checkQuota` in `lib/auth/quota.ts`.
- All existing enforcement points and semantics are unchanged.

## Files changed

| File | Change |
|------|--------|
| `lib/services/quotaCapacityService.ts` | **New.** Thresholds, summary, userUsage, projectUsage, filters; batched queries. |
| `app/api/admin/quotas/capacity/route.ts` | **New.** GET capacity with query filters; requires manage_platform_settings. |
| `app/(private)/admin/page.tsx` | New tab "Capacidad"; `CapacityDashboard` with cards, filters, user table, project table. |
| `app/api/projects/route.ts` | 409 body includes `quota: { quotaKey, current, limit }`. |
| `app/api/admin/clients/route.ts` | 409 body includes `quota`. |
| `app/api/projects/[id]/invitations/route.ts` | 409 bodies include `quota` (members and invitations). |
| `app/api/admin/projects/[id]/members/route.ts` | 409 body includes `quota`. |
| `app/api/projects/[id]/members/route.ts` | 409 body includes `quota`. |
| `app/api/invitations/accept/route.ts` | 409 body includes `quota`. |
| `docs/QUOTA_PHASE4_IMPLEMENTATION_SUMMARY.md` | This summary. |

## RBAC

- Capacity API and UI: `manage_platform_settings` only (superadmin). No change to other quota or RBAC behavior.
