# Quota Control – Phase 1 Implementation Summary

This document summarizes the Phase 1 implementation of the platform quota/capacity layer for SAP Notes Hub, as designed in [PLATFORM_QUOTA_DESIGN_PROPOSAL.md](./PLATFORM_QUOTA_DESIGN_PROPOSAL.md).

## What Was Implemented

### 1. Schema (migration)

**File:** `supabase/migrations/20260515120000_quota_role_limits_user_limits.sql`

- **`role_limits`:** `(role_id, limit_key, value)` with unique `(role_id, limit_key)`. `role_id` references `roles.id` (app-scope roles). `value` is a positive integer.
- **`user_limits`:** `(user_id, limit_key, value)` with unique `(user_id, limit_key)`. `user_id` references `profiles.id`. Per-user overrides.
- **RLS:** SELECT for authenticated; INSERT/UPDATE/DELETE only for users with `profiles.app_role = 'superadmin'`.

No changes to existing RBAC tables.

### 2. Quota module

**File:** `lib/auth/quota.ts`

- **`getEffectiveLimit(userId, limitKey, projectId?)`:** Returns the effective cap (user override → role default → `null` = unlimited). **Superadmin is always unlimited** (returns `null`).
- **`getCurrentUsage(userId, limitKey, projectId?)`:** Returns current usage (e.g. count of projects by `created_by`, or count of pending invitations for the project).
- **`checkQuota(userId, limitKey, projectId?)`:** Returns `{ allowed, current, limit }`. `allowed` is `false` when `current >= limit` and `limit !== null`.

**Phase 1 keys:** `max_projects_created`, `max_pending_invitations_per_project`.

### 3. Backend enforcement

- **`POST /api/projects`**  
  After `requireAuthAndGlobalPermission(request, "create_project")`, calls `checkQuota(userId, "max_projects_created")`. If `!allowed`, returns **409 Conflict** with body `{ "error": "Has alcanzado el máximo de proyectos permitidos." }`.

- **`POST /api/projects/[id]/invitations`**  
  After `requireAuthAndProjectPermission(request, projectId, "manage_project_members")`, calls `checkQuota(userId, "max_pending_invitations_per_project", projectId)`. If `!allowed`, returns **409 Conflict** with body `{ "error": "Has alcanzado el máximo de invitaciones pendientes para este proyecto." }`.

Permission checks are unchanged; quota is evaluated only after the user is allowed to perform the action.

### 4. Admin API

**File:** `app/api/admin/quotas/route.ts`

- **GET /api/admin/quotas**  
  Requires `manage_platform_settings` (superadmin). Returns `{ roleLimits: [{ roleId, roleKey, roleName, limits: { max_projects_created?, max_pending_invitations_per_project? } }] }` for all app roles.

- **PUT /api/admin/quotas**  
  Requires `manage_platform_settings`. Body: `{ roleKey: string, limits: { max_projects_created?: number, max_pending_invitations_per_project?: number } }`. Upserts or deletes `role_limits` for the given app role. Omitted or non-positive value means “unlimited” (row removed).

### 5. Superadmin UI

**Location:** Admin panel → tab **“Límites por rol”** (only visible when `appRole === "superadmin"`).

- Lists app roles (admin, consultant, viewer; superadmin omitted).
- For each role: two inputs — “Máx. proyectos creados” and “Máx. invitaciones pendientes por proyecto”. Empty = sin límite.
- “Guardar” per role calls PUT /api/admin/quotas with that role’s key and current values.

Implemented in `app/(private)/admin/page.tsx`: new tab, `RoleLimitsPanel`, and `RoleLimitForm` components.

## Evaluation Order

1. **User override** — `user_limits` for `(user_id, limit_key)`.
2. **Role default** — `profiles.app_role` → app-scope `roles.id` → `role_limits.value` for `(role_id, limit_key)`.
3. **Unlimited** — no row → no cap (action allowed).
4. **Superadmin** — always unlimited in code (no DB lookup).

## Error contract

- **409 Conflict** when quota is exceeded. Body: `{ "error": "<message>" }` in Spanish as specified.
- No change to 401/403 from permission checks.

## What Was Not Implemented (Phase 1)

- Quota keys: `max_clients_created`, `max_members_per_project`.
- Per-user limits UI (only role defaults are configurable).
- Usage display (e.g. “3 / 10 proyectos”) in admin.
- Reporting or analytics.
- Seed data for default role limits (admin/consultant can be configured via UI).

## Applying the migration

```bash
supabase db push
```

Or run the migration SQL in the Supabase Dashboard if not using the CLI.

## Files changed

| File | Change |
|------|--------|
| `supabase/migrations/20260515120000_quota_role_limits_user_limits.sql` | New: `role_limits`, `user_limits`, RLS. |
| `lib/auth/quota.ts` | New: getEffectiveLimit, getCurrentUsage, checkQuota. |
| `app/api/projects/route.ts` | Enforce `max_projects_created` before insert; 409 on exceed. |
| `app/api/projects/[id]/invitations/route.ts` | Enforce `max_pending_invitations_per_project` before create; 409 on exceed. |
| `app/api/admin/quotas/route.ts` | New: GET/PUT role limits. |
| `app/(private)/admin/page.tsx` | New tab “Límites por rol”, RoleLimitsPanel, RoleLimitForm. |
| `docs/QUOTA_PHASE1_IMPLEMENTATION_SUMMARY.md` | This summary. |

RBAC and existing permissions are unchanged.
