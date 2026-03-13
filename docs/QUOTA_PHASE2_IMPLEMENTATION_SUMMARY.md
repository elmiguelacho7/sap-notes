# Quota Control – Phase 2 Implementation Summary

This document summarizes the Phase 2 extension of the platform quota system for SAP Notes Hub, adding **max_members_per_project** and **max_clients_created**. Phase 1 is documented in [QUOTA_PHASE1_IMPLEMENTATION_SUMMARY.md](./QUOTA_PHASE1_IMPLEMENTATION_SUMMARY.md); design is in [PLATFORM_QUOTA_DESIGN_PROPOSAL.md](./PLATFORM_QUOTA_DESIGN_PROPOSAL.md).

## What Was Implemented

### 1. Quota module extension

**File:** `lib/auth/quota.ts`

- **QUOTA_KEYS** extended with `max_members_per_project` and `max_clients_created`.
- **getCurrentUsage** for:
  - **max_members_per_project:** count of `project_members` for the given `project_id`.
  - **max_clients_created:** count of `clients` where `created_by = userId`.

No schema change: `role_limits` and `user_limits` already store any `limit_key` as text.

### 2. Backend enforcement

**max_clients_created**

- **POST /api/admin/clients**  
  After `requireAuthAndGlobalPermission(request, "manage_clients")`, calls `checkQuota(userId, "max_clients_created")`. If `!allowed`, returns **409 Conflict** with `{ "error": "Has alcanzado el máximo de clientes permitidos." }`.

**max_members_per_project**

- **POST /api/projects/[id]/invitations**  
  When adding an existing user (before `setProjectMember`), calls `checkQuota(auth.userId, "max_members_per_project", projectId)`. If `!allowed`, returns **409** with `{ "error": "Has alcanzado el máximo de miembros permitidos para este proyecto." }`.
- **POST /api/admin/projects/[id]/members**  
  Before `setProjectMember`, same quota check; same 409 message.
- **POST /api/projects/[id]/members**  
  When adding by email and user exists, same quota check before `setProjectMember`.
- **POST /api/invitations/accept**  
  Before inserting into `project_members`, calls `checkQuota(invited_by ?? userId, "max_members_per_project", inv.project_id)`. Uses inviter’s limit when available; same 409 message. **Invitation service:** `findInvitationByToken` now returns `invited_by` for this check.

Separation of concerns: **max_pending_invitations_per_project** still applies only to creating pending invitations; **max_members_per_project** applies only to adding active project members (direct add or accept).

### 3. Admin API and UI

**File:** `app/api/admin/quotas/route.ts`

- **GET /api/admin/quotas**  
  Returns role limits for all four keys: `max_projects_created`, `max_pending_invitations_per_project`, `max_members_per_project`, `max_clients_created`.
- **PUT /api/admin/quotas**  
  Body `limits` may include `max_members_per_project` and `max_clients_created`; same upsert/delete semantics (omit or 0 = unlimited).

**File:** `app/(private)/admin/page.tsx`

- **RoleLimitForm** extended with two inputs: “Máx. miembros por proyecto” and “Máx. clientes creados”. Same pattern: empty = sin límite, save per role.

### 4. Quota hints and UI feedback

**GET /api/projects/[id]/permissions**

- When `canManageMembers` is true, response includes **memberQuota:** `{ atLimit, current, limit }` from `checkQuota(userId, "max_members_per_project", projectId)`.

**GET /api/me**

- When user has `manage_clients`, response includes **clientsQuota:** `{ atLimit, current, limit }` from `checkQuota(userId, "max_clients_created")`. **permissions** now also includes `manageClients`.

**Project team page** (`app/(private)/projects/[id]/members/page.tsx`)

- Reads `memberQuota` from permissions response. When `memberQuota?.atLimit`, shows an amber message and disables the “Añadir al equipo” button. Backend remains source of truth; UI only prevents unnecessary 409s.

**Clients page** (`app/(private)/clients/page.tsx`)

- Fetches `/api/me` when user is superadmin or admin; stores `clientsQuota`. When `clientsQuota?.atLimit` and form is for new client (!editingId), shows amber message and disables “Crear cliente”. After successful create, refetches `/api/me` to update quota state.

## Error contract

- **409 Conflict** when quota exceeded. Spanish messages as specified.
- No change to 401/403 from permission checks.

## Files changed

| File | Change |
|------|--------|
| `lib/auth/quota.ts` | Added max_members_per_project, max_clients_created to QUOTA_KEYS and getCurrentUsage. |
| `lib/services/invitationService.ts` | findInvitationByToken returns invited_by. |
| `app/api/admin/clients/route.ts` | Enforce max_clients_created before insert; 409 on exceed. |
| `app/api/projects/[id]/invitations/route.ts` | Enforce max_members_per_project before setProjectMember (existing-user path). |
| `app/api/admin/projects/[id]/members/route.ts` | Enforce max_members_per_project before setProjectMember. |
| `app/api/projects/[id]/members/route.ts` | Enforce max_members_per_project before setProjectMember (existing-user path). |
| `app/api/invitations/accept/route.ts` | Enforce max_members_per_project before project_members upsert; use inviter’s limit. |
| `app/api/admin/quotas/route.ts` | GET/PUT support all four quota keys. |
| `app/api/projects/[id]/permissions/route.ts` | Return memberQuota when canManageMembers. |
| `app/api/me/route.ts` | Return clientsQuota when manageClients; permissions.manageClients. |
| `app/(private)/admin/page.tsx` | RoleLimitForm: max_members_per_project, max_clients_created inputs and save. |
| `app/(private)/projects/[id]/members/page.tsx` | memberQuota from permissions; atLimit warning and disable add button. |
| `app/(private)/clients/page.tsx` | clientsQuota from /api/me; atLimit warning and disable create; refetch quota after create. |
| `docs/QUOTA_PHASE2_IMPLEMENTATION_SUMMARY.md` | This summary. |

## Migration

No new migration: Phase 1 tables already support any `limit_key`. Phase 2 only adds usage and enforcement for two more keys.

## RBAC

Unchanged. Quota checks run after permission checks; superadmin remains unlimited in code.
