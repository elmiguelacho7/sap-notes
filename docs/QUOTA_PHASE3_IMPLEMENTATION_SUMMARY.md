# Quota Control – Phase 3 Implementation Summary

This document summarizes Phase 3 of the platform quota system for SAP Notes Hub: **user-level overrides** and **quota visibility**. Phase 1 and 2 are documented in [QUOTA_PHASE1_IMPLEMENTATION_SUMMARY.md](./QUOTA_PHASE1_IMPLEMENTATION_SUMMARY.md) and [QUOTA_PHASE2_IMPLEMENTATION_SUMMARY.md](./QUOTA_PHASE2_IMPLEMENTATION_SUMMARY.md); design is in [PLATFORM_QUOTA_DESIGN_PROPOSAL.md](./PLATFORM_QUOTA_DESIGN_PROPOSAL.md).

## What Was Implemented

### 1. User-level quota overrides

The existing **user_limits** table is used. Resolution order is unchanged:

- **Explicit value in user_limits** → override for that user.
- **No user row** → fall back to role default (role_limits for the user’s app role).
- **No role row** → unlimited.
- **Superadmin** → always unlimited (unchanged; no DB lookup).

Supported keys: `max_projects_created`, `max_pending_invitations_per_project`, `max_members_per_project`, `max_clients_created`. No schema change.

### 2. Admin API for user overrides

**GET /api/admin/quotas/user/[userId]**

- Requires `manage_platform_settings` (superadmin).
- Returns: `{ userId, appRole, roleLimits, userOverrides, effectiveLimits }`.
  - **roleLimits:** Default limits for the user’s app role (from `role_limits`).
  - **userOverrides:** Rows from `user_limits` for this user.
  - **effectiveLimits:** Resolved limit per key (user override or role default or null), via existing `getEffectiveLimit`.

**PUT /api/admin/quotas/user/[userId]**

- Requires `manage_platform_settings`.
- Body: `{ overrides: { max_projects_created?: number, ... } }`.
- For each key: positive integer → upsert `user_limits`; omit or 0 → delete row (revert to role default).

**File:** `app/api/admin/quotas/user/[userId]/route.ts`

### 3. Superadmin UI: Límites por usuario

**Location:** Admin panel → tab **“Límites por usuario”** (same superadmin-only area as “Límites por rol”).

- **List:** Fetches `/api/admin/users`; table with Nombre, Email, Rol, and “Configurar límites” per user.
- **Modal:** On “Configurar límites”, loads GET `/api/admin/quotas/user/[userId]` and shows:
  - User name/email and app role.
  - **Role defaults** (read-only): the four quota keys and their role default values.
  - **Override inputs:** Four number inputs (empty = use role default). Placeholder shows current role value. “Efectivo” line shows resolved limit when set.
  - Save → PUT with `{ overrides }`; then refetch GET to refresh modal state.
  - Close clears modal.

**Files:** `app/(private)/admin/page.tsx` — new tab, `UserLimitsPanel`, `UserQuotaModal`.

### 4. Quota visibility (usage vs effective limit)

**GET /api/me**

- **projectsQuota:** `{ atLimit, current, limit }` when the user has `create_project`, from `checkQuota(userId, "max_projects_created")`.
- **clientsQuota:** unchanged (already present).
- Enables UI to show “X / Y proyectos usados” and “X / Y clientes usados”.

**GET /api/projects/[id]/permissions**

- **pendingInvitationsQuota:** `{ atLimit, current, limit }` when `canManageMembers`, from `checkQuota(userId, "max_pending_invitations_per_project", projectId)`.
- **memberQuota:** unchanged (already present).
- Enables UI to show “X / Y miembros en este proyecto” and “X / Y invitaciones pendientes”.

**UI hints**

- **Projects list** (`app/(private)/projects/page.tsx`): Fetches `projectsQuota` from `/api/me`; in the page description shows “X / Y proyectos usados” when `projectsQuota?.limit != null`.
- **Project team page** (`app/(private)/projects/[id]/members/page.tsx`): Uses `memberQuota` and new `pendingInvitationsQuota` from permissions; shows “X / Y miembros en este proyecto” and “X / Y invitaciones pendientes” in the section headers when the corresponding limit is set.
- **Clients page** (`app/(private)/clients/page.tsx`): Shows “X / Y clientes usados” when `clientsQuota?.limit != null`; if at limit, adds the existing warning text.

### 5. Enforcement unchanged

No changes to the quota engine or enforcement:

- Same evaluation order (user override → role default → unlimited).
- Same `getEffectiveLimit`, `getCurrentUsage`, `checkQuota` in `lib/auth/quota.ts`.
- All existing enforcement points (projects, clients, members, invitations, accept) behave as before.

## Resolution: user overrides vs role defaults

| Source        | When used |
|---------------|-----------|
| user_limits   | Row exists for `(user_id, limit_key)` → use that `value`. |
| role_limits   | No user row → use role default for user’s `profiles.app_role`. |
| Unlimited     | No role row or no role_limits row for that key. |
| Superadmin    | Always unlimited in code (no DB lookup). |

## Files changed

| File | Change |
|------|--------|
| `app/api/admin/quotas/user/[userId]/route.ts` | **New.** GET and PUT for user quota config and overrides. |
| `app/api/me/route.ts` | Added `projectsQuota`; ensure `projectsQuota`/`clientsQuota` in all response paths. |
| `app/api/projects/[id]/permissions/route.ts` | Added `pendingInvitationsQuota` when `canManageMembers`. |
| `app/(private)/admin/page.tsx` | New tab “Límites por usuario”, `UserLimitsPanel`, `UserQuotaModal`. |
| `app/(private)/projects/page.tsx` | Fetch `projectsQuota` from `/api/me`; show “X / Y proyectos usados” in description. |
| `app/(private)/projects/[id]/members/page.tsx` | `pendingInvitationsQuota` from permissions; hints “X / Y miembros” and “X / Y invitaciones pendientes”. |
| `app/(private)/clients/page.tsx` | Hint “X / Y clientes usados” and keep at-limit warning. |
| `docs/QUOTA_PHASE3_IMPLEMENTATION_SUMMARY.md` | This summary. |

## RBAC

- User override read/write: `manage_platform_settings` only (superadmin).
- Visibility of quota hints: same as existing permission checks (e.g. `canManageMembers` for project quotas, `create_project` / `manage_clients` for global quotas in `/api/me`). No RBAC changes.
