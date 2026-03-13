# Quota Control – Phase 5 Implementation Summary

This document summarizes Phase 5 of the quota system for SAP Notes Hub: **preventive alerts**, **operational actions**, **problem-focused views**, and **improved quota messages**. Phases 1–4 are documented in earlier QUOTA_PHASE*.md files.

## What Was Implemented

### 1. Preventive alert behavior in the UI

**Thresholds (unchanged):** ≥80% and &lt;100% → near limit; ≥100% → at limit.

**Projects list** (`app/(private)/projects/page.tsx`)

- When `projectsQuota.atLimit`: red banner — "Has alcanzado el máximo de proyectos permitidos (X / Y). No puedes crear más hasta que un administrador aumente el límite."
- When not at limit but `projectsQuota.current >= projectsQuota.limit * 0.8`: amber banner — "Te acercas al límite de proyectos (X / Y). Cuando lo alcances no podrás crear más…"

**Clients page** (`app/(private)/clients/page.tsx`)

- When `clientsQuota.atLimit`: red banner (same pattern as projects).
- When near limit (≥80%, &lt;100%): amber banner.

**Project team page** (`app/(private)/projects/[id]/members/page.tsx`)

- **Members:** At limit → red message and disabled add button (existing). **New:** near limit (≥80%) → amber message "Te acercas al límite de miembros (X / Y)…"
- **Pending invitations:** Existing usage line. **New:** when at limit, append "· Has alcanzado el máximo…"; when near limit, append "· Te acercas al límite."

**Admin capacity dashboard**

- Summary cards and status badges already highlight at limit / near limit; no additional alert banner added (cards are the alert surface).

### 2. Admin capacity dashboard actions

**User table**

- New column **Acciones** with **"Configurar límites"** button. Click opens an inline modal that loads GET `/api/admin/quotas/user/[userId]`, shows role defaults and override inputs (same pattern as "Límites por usuario" tab), and saves via PUT. Modal component: `CapacityQuotaModal`.

**Project table**

- New column **Acciones** with:
  - **"Ver proyecto"** — `Link` to `/projects/[projectId]`
  - **"Ver equipo"** — `Link` to `/projects/[projectId]/members`

### 3. Problem-focused views

**Preset filter buttons** (capacity dashboard)

- **"Solo al límite"** — sets status filter to `at_limit` (only rows at limit).
- **"Solo cerca del límite"** — sets status filter to `near_limit`.
- **"Todos"** — clears status filter.

Existing dropdown "Todos los estados" / "Al límite" / "Cerca del límite" / etc. remains; presets make one-click access to at limit and near limit. "Blocked" is equivalent to "at limit" (no separate filter).

### 4. Improved quota-related messages (409 + structured data)

When the API returns **409** with `quota: { quotaKey, current, limit }`, the UI now shows a **contextual message** that includes usage and limit.

**Project creation** (`app/(private)/projects/new/page.tsx`)

- If `createRes.status === 409` and `createData.quota?.limit != null`:  
  `"Has alcanzado el máximo de proyectos permitidos (current / limit)."`

**Client creation** (`app/(private)/clients/page.tsx`)

- If `res.status === 409` and `data.quota?.limit != null`:  
  `"Has alcanzado el máximo de clientes permitidos (current / limit)."`

**Project team – add member** (`app/(private)/projects/[id]/members/page.tsx`)

- If `res.status === 409` and `data.quota`:  
  `"Has alcanzado el máximo permitido para este proyecto (current / limit)."`

**Project team – change role** (same page, `handleChangeRole`)

- If `res.status === 409` and `data.quota`:  
  `"Este proyecto ha alcanzado el máximo de miembros permitidos (current / limit)."`

Backend 409 responses already include `quota: { quotaKey, current, limit }` (Phase 4); no API changes in Phase 5.

### 5. Design note: quota/audit history (not implemented)

A future **quota/audit history** feature could record:

- **Who** changed a role limit or user override (actor user id).
- **What** changed: table (`role_limits` or `user_limits`), row (e.g. role_id + limit_key, or user_id + limit_key).
- **Old value** and **new value** (numeric or "removed").
- **When** (timestamp).

**Possible implementation**

- New table e.g. `quota_audit_log` (id, created_at, actor_id, entity_type, entity_id, limit_key, old_value, new_value).
- In PUT `/api/admin/quotas` and PUT `/api/admin/quotas/user/[userId]`, after upsert/delete, insert an audit row (old value from previous read or from payload; new value from request).
- RLS: only superadmin (or a dedicated permission) can read.
- Admin UI: optional "Historial de cambios" section or tab that lists recent audit rows with actor name, entity, key, old/new, date.

Not implemented in Phase 5; this is a design note for a later phase.

## Files changed

| File | Change |
|------|--------|
| `app/(private)/projects/page.tsx` | Preventive alerts (red at limit, amber near limit); `projectsQuota` type includes `atLimit`. |
| `app/(private)/projects/new/page.tsx` | On 409, show message with `(current / limit)` from `createData.quota`. |
| `app/(private)/clients/page.tsx` | Preventive alerts (red/amber); on create 409, message with `data.quota`. |
| `app/(private)/projects/[id]/members/page.tsx` | Near-limit warning for members and invitations; 409 handling with quota message for add and change-role. |
| `app/(private)/admin/page.tsx` | Capacity dashboard: preset buttons (Solo al límite, Solo cerca, Todos); user table "Configurar límites" + `CapacityQuotaModal`; project table "Ver proyecto" / "Ver equipo"; `Link` import. |
| `docs/QUOTA_PHASE5_IMPLEMENTATION_SUMMARY.md` | This summary and audit design note. |

## Constraints

- Quota semantics and engine unchanged.
- No new quota keys.
- RBAC unchanged; capacity and modal remain superadmin-only where applicable.
