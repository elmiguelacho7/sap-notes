# Platform Capacity and Quota Control – Technical Proposal

This document proposes a **quota/limits layer** for SAP Notes Hub, separate from RBAC. Permissions answer *what* a user may do; quotas answer *how much* they may do.

---

## 1. Distinction: Permissions vs Quotas

| Aspect | Permissions (RBAC) | Quotas (this design) |
|--------|--------------------|----------------------|
| Purpose | Whether an action is allowed | Maximum capacity for that action |
| Source | `role_permissions` + `profiles.app_role` / `project_members.role` | `role_limits`, `user_limits`, system default |
| Enforcement | Before any action | After permission check, before performing the action |
| Configurable by | Superadmin (role–permission matrix) | Superadmin (limits by role and per user) |

A user must have the **permission** to create projects; they may additionally be **limited** to e.g. 10 projects. If they have no permission, the request fails with 403 before any quota check.

---

## 2. Quota Model (Scalable)

### 2.1 Proposed quota keys

| Key | Description | Scope | Usage counted as |
|-----|-------------|--------|-------------------|
| `max_projects_created` | Max projects the user may create (as creator) | Global (per user) | `projects.created_by = user_id` |
| `max_members_per_project` | Max members in a project when user adds/invites | Project | `project_members` where `project_id = X` (at time of add) |
| `max_clients_created` | Max clients the user may create | Global (per user) | `clients.created_by = user_id` |
| `max_pending_invitations_per_project` | Max pending invitations per project | Project | `project_invitations` where `project_id = X` and `status = 'pending'` |

All values are positive integers. `NULL` or missing limit means **no cap** (unlimited) for that level.

### 2.2 Two levels of configuration

1. **Default by role**  
   Applied to every user with that global (app) role when no per-user override exists.  
   Stored in **`role_limits`**, keyed by **app-scope role** (e.g. admin, consultant).

2. **Per-user override**  
   Optional override for a specific user.  
   Stored in **`user_limits`**.

Superadmin can set role defaults and, for specific users, overrides (e.g. power users get higher limits, or a particular admin gets a lower cap).

---

## 3. Schema Options

### 3.1 Option A: `role_limits` + `user_limits` (recommended)

**role_limits** (default by app role)

- `role_id` → `roles.id` (only app-scope roles: superadmin, admin, consultant, viewer).
- `limit_key` (text): e.g. `max_projects_created`, `max_members_per_project`.
- `value` (integer, NOT NULL): the cap.
- Unique on `(role_id, limit_key)`.

**user_limits** (per-user override)

- `user_id` (uuid) → `profiles.id`.
- `limit_key` (text): same keys as above.
- `value` (integer, NOT NULL): the cap for this user.
- Unique on `(user_id, limit_key)`.

Optional: `quota_definitions` table (id, key, name, description) for discoverability and UI labels; not required for Phase 1.

### 3.2 Option B: Single `limits` table with type

One table with `(entity_type, entity_id, limit_key, value)` where `entity_type` is `'role'` or `'user'` and `entity_id` is role id or user id. Flexible but less clear and slightly more complex to index. Can be considered later if many entity types appear.

### 3.3 Recommendation

Use **Option A**: `role_limits` and `user_limits`. Clear, additive, and easy to query for “limits for this user” (user overrides + role defaults).

---

## 4. Evaluation Order

For a given **user** and **limit_key** (and, for project-scoped quotas, **project_id**):

1. **User override**  
   If `user_limits` has a row for `(user_id, limit_key)` → use that `value`.

2. **Role default**  
   Else get the user’s app role from `profiles.app_role`, resolve to app-scope `roles.id`, then read `role_limits.value` for `(role_id, limit_key)`.

3. **System default**  
   Else no row exists → **unlimited** (no enforcement for this quota). Optionally, a small `system_limits` or in-code `DEFAULT_QUOTAS` could define platform-wide defaults (e.g. 100 projects per user); Phase 1 can treat “missing” as unlimited.

Result: **user override → role default → system default (unlimited)**.

---

## 5. Backend Enforcement Points

Enforcement must happen **after** the permission check and **before** the mutation. If the user lacks permission, return 403 without checking quota. If the user has permission but is over quota, return **409 Conflict** (or 429) with a clear message.

| Endpoint | Permission (existing) | Quota to check | Usage query |
|----------|------------------------|----------------|-------------|
| `POST /api/projects` | `create_project` | `max_projects_created` | Count `projects` where `created_by = userId` |
| `POST /api/admin/clients` | `manage_clients` | `max_clients_created` | Count `clients` where `created_by = userId` |
| `POST /api/projects/[id]/invitations` | `manage_project_members` | `max_pending_invitations_per_project` | Count `project_invitations` where `project_id = id` and `status = 'pending'` |
| `POST /api/admin/projects/[id]/members` (add by userId) | `manage_project_members` or `manage_any_project` | `max_members_per_project` | Count `project_members` where `project_id = id` |

For **project-scoped** quotas (`max_members_per_project`, `max_pending_invitations_per_project`), the limit applies to the **project** (same cap for everyone who can add/invite in that project). So the limit is “how many members/invitations this project may have,” not “how many this user may add across projects.” If you need per-user “how many members this user can add in total,” that would be an additional quota key (e.g. `max_members_added_global`); the proposal above keeps project quotas as per-project caps.

**Suggested response when over quota:**  
`409 Conflict` with body e.g. `{ "error": "Has alcanzado el límite de proyectos (10). Contacta al administrador para aumentar la cuota." }`.

---

## 6. Superadmin UI Concept

### 6.1 Where to configure

- **Admin area** (e.g. under `/admin` or a “Configuración” / “Platform settings” section).
- New subsection: **“Límites y cuotas”** or **“Capacity / Quotas”**.
- Access: only for users with a superadmin-only permission (e.g. `manage_platform_settings` or existing superadmin-only entry point). No change to RBAC permission set; only superadmin sees this.

### 6.2 What to show

1. **Role defaults**  
   - List app roles (superadmin, admin, consultant, viewer).  
   - For each role, list quota keys with a short name and an input for **value** (number; empty = unlimited).  
   - Save updates `role_limits` (upsert by role_id + limit_key).

2. **Per-user overrides** (optional in Phase 1)  
   - User picker (e.g. search by email/name).  
   - For selected user, show same quota keys; value override for that user.  
   - Save updates `user_limits`.

3. **Usage vs limit (read-only)**  
   - For “current user” or “selected user”: show for each quota key the **current usage** and the **effective limit** (after override/role/default).  
   - Example: “Proyectos creados: 3 / 10”, “Clientes creados: 1 / 5”.  
   - Helps superadmin decide role defaults and overrides without opening DB.

### 6.3 UX sketch

- Table or cards: one row per (role or user) and per quota key.  
- Columns: Role/User, Quota (name), Limit (input or “Unlimited”), Current usage (if applicable).  
- For project-scoped quotas, “usage” might be “per project” (e.g. “Max pending invitations: 2 in project X, 0 in project Y”) or “max across projects” depending on product choice; Phase 1 can show a single project’s usage when enforcing in that project’s context.

---

## 7. Minimal Safe Phase 1 Implementation Plan

### 7.1 Scope

- Implement **schema** and **evaluation logic**; enforce **one or two** quotas first (e.g. `max_projects_created` and `max_pending_invitations_per_project`) to validate the pattern.
- **No** superadmin UI in Phase 1 if time is tight; limits can be set via SQL or a minimal API. Alternatively, a very small UI: one page “Role limits” with inputs for admin/consultant and two quota keys.

### 7.2 Steps (order)

1. **Migration**
   - Create `role_limits` (role_id, limit_key, value, unique(role_id, limit_key)).
   - Create `user_limits` (user_id, limit_key, value, unique(user_id, limit_key)).
   - RLS: SELECT for authenticated; INSERT/UPDATE/DELETE only for superadmin (same pattern as roles/permissions).
   - Seed optional: e.g. default for role `admin`: `max_projects_created = 50`, `max_pending_invitations_per_project = 25`.

2. **Quota service**
   - `lib/quota/` or `lib/auth/quota.ts`:
     - `getEffectiveLimit(userId, limitKey, projectId?)` → number | null (null = unlimited).
     - Implementation: lookup user_limits first; else resolve app role from profiles, then role_limits; else null.
     - `checkQuota(userId, limitKey, projectId?)` → { allowed: boolean, current: number, limit: number | null }.
     - Usage queries: small helpers or inline in service (e.g. count projects by created_by, count pending invitations by project_id).

3. **Enforcement in routes**
   - In `POST /api/projects`: after `requireAuthAndGlobalPermission(request, 'create_project')`, call `checkQuota(userId, 'max_projects_created')`; if !allowed, return 409 with message.
   - In `POST /api/projects/[id]/invitations`: after permission check, call `checkQuota(userId, 'max_pending_invitations_per_project', projectId)`; if !allowed, return 409.
   - Same pattern later for `POST /api/admin/clients` and `POST /api/admin/projects/[id]/members`.

4. **API for limits (optional Phase 1)**
   - `GET /api/admin/quotas` → list role_limits and optionally user_limits (for superadmin).
   - `PUT /api/admin/quotas/role` → set role_limits (body: roleKey, limits: { limitKey: value }).
   - `PUT /api/admin/quotas/user/[userId]` → set user_limits (body: limits).

5. **Superadmin UI (Phase 1 minimal)**
   - One page or section: “Límites por rol” with dropdown for role and inputs for `max_projects_created`, `max_pending_invitations_per_project`. Save calls PUT role quotas API.
   - Optional: show “Uso actual” for the current user (e.g. from GET /api/me or a small GET /api/admin/quotas/usage?userId=).

### 7.3 What not to do in Phase 1

- Do not change RBAC permission checks or role–permission matrix.
- Do not enforce quotas for superadmin unless explicitly desired (can skip quota check when app_role === 'superadmin').
- Do not add project-scoped quotas that require “per-user per project” counting in Phase 1 if it complicates the UI; keep “per project” caps only.

### 7.4 Files to add/change (Phase 1)

| Area | File(s) |
|------|--------|
| Schema | `supabase/migrations/YYYYMMDD_quota_role_limits_user_limits.sql` |
| Quota logic | `lib/auth/quota.ts` or `lib/quota/limits.ts` |
| Enforcement | `app/api/projects/route.ts` (POST), `app/api/projects/[id]/invitations/route.ts` (POST) |
| Admin API | `app/api/admin/quotas/route.ts` (GET, PUT for role limits) |
| Admin UI | Optional: `app/(private)/admin/quotas/page.tsx` or section in existing admin |

---

## 8. Summary

- **Permissions** (RBAC) stay as-is; they define *what* is allowed.
- **Quotas** add a second layer: *how much* is allowed, via `role_limits` (default by app role) and `user_limits` (per-user override), with evaluation order user → role → unlimited.
- Enforcement is in the same API routes that already check permissions, after the permission check, returning 409 when over quota.
- Superadmin configures limits in a dedicated “Límites y cuotas” area and can see usage vs limit to tune defaults and overrides.
- Phase 1: schema + quota service + enforce 1–2 quotas + optional minimal admin API/UI keeps the change minimal and safe while validating the design.

---

## 9. Phase 1 Implementation Checklist

- [ ] **Migration:** Create `role_limits` and `user_limits` tables; RLS for superadmin write; optional seed for admin/consultant defaults.
- [ ] **Quota module:** `getEffectiveLimit(userId, limitKey, projectId?)`, `checkQuota(...)`, usage helpers (projects count, pending invitations count).
- [ ] **Enforce in POST /api/projects:** After create_project check, enforce `max_projects_created`; return 409 with clear message if over.
- [ ] **Enforce in POST /api/projects/[id]/invitations:** After manage_project_members check, enforce `max_pending_invitations_per_project` for that project; return 409 if over.
- [ ] **Optional:** GET/PUT `/api/admin/quotas` for role limits so superadmin can configure without SQL.
- [ ] **Optional:** Admin UI section “Límites por rol” with form and usage display.
- [ ] **Skip quota for superadmin:** In quota check, if user’s app_role is superadmin, treat as unlimited (no DB lookup).
