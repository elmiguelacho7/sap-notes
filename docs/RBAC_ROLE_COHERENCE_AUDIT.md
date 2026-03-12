# RBAC role coherence audit — SAP Notes Hub

This document audits how global roles and permissions flow through SAP Notes Hub, and where inconsistencies remain between DB state, APIs, UI, and RLS.

It is descriptive and diagnostic only; it does not change behavior by itself.

---

## 1. Sources of truth

### 1.1 Global role and permissions

- **Database source of truth**
  - `public.profiles.app_role` — global role key (`superadmin` \| `admin` \| `consultant` \| `viewer`).
  - `public.roles` (scope = `app`) + `public.permissions` + `public.role_permissions` — permission matrix for app-scope permissions.
  - `public.roles` (scope = `project`) + `public.role_permissions` — permission matrix for project-scope permissions.
- **Helpers**
  - `lib/auth/permissions.ts`
    - `hasGlobalPermission(userId, permissionKey)`
    - `hasProjectPermission(userId, projectId, permissionKey)`
    - `requireGlobalPermission`, `requireProjectPermission`
    - `requireAuthAndGlobalPermission`, `requireAuthAndProjectPermission`, `requireAuthAndProjectOrGlobalPermission`
- **API surface (global)**
  - `app/api/me/route.ts`
    - Reads `profiles.app_role` via `supabaseAdmin`.
    - Returns `{ appRole, permissions: { manageGlobalNotes } }`, where `manageGlobalNotes` = `hasGlobalPermission(userId, "manage_global_notes")`.
- **API surface (project)**
  - `app/api/projects/[id]/permissions/route.ts`
    - Uses `getCurrentUserWithRoleFromRequest` + `hasProjectPermission`/`hasGlobalPermission`.
    - Returns:
      - `canEdit`, `canArchive`, `canDelete`, `canManageMembers`
      - `canEditProjectNotes`, `canDeleteProjectNotes`, `canManageProjectTickets`

### 1.2 Where global role is read in UI

- **Layout / shell**
  - `app/(private)/layout.tsx`
    - On mount, calls `supabase.auth.getUser()` and then `supabase.from("profiles").select("app_role, is_active")`.
    - If `app_role` is `"superadmin"` or `"consultant"`, sets local state `appRole: "superadmin" | "consultant"`.
    - Passes `appRole` into `Sidebar` for role-gated nav (e.g. `/admin`, `/clients`).
    - **Limitation:** Ignores `admin` and `viewer` values; those users see a null `appRole` in layout.
- **User menu**
  - `components/UserMenu.tsx`
    - Reads `profiles.full_name, app_role` with the client Supabase.
    - Shows a role pill; label logic:
      - If `appRole === "superadmin"` → “Superadministrador”.
      - Any other non-null `appRole` → “Consultor”.
    - `isSuperadmin` is computed as `appRole === "superadmin"` and controls the “Administración” menu entry.
    - **Effect:** Users whose `profiles.app_role` is `"admin"` or `"viewer"` are displayed as “Consultor”.
- **Admin entry points**
  - `components/ui/sidebar/Sidebar.tsx`
    - Nav items use `roles?: string[]`.
    - `/clients` and `/admin` are restricted with `roles: ["superadmin"]`; only users with `appRole === "superadmin"` (as seen by `PrivateLayout`) see those sidebar items.
  - `app/(private)/admin/page.tsx`
    - Reads `profiles.app_role, is_active` using the client Supabase.
    - If `app_role !== "superadmin"` or inactive, shows “Acceso restringido — Solo los administradores...”.
    - **Note:** Text says “administradores” but the check is strictly `superadmin`.
  - `app/(private)/admin/users/page.tsx`
    - Reads `profiles.app_role`; only allows `appRole === "superadmin"` to see the page.
  - `app/(private)/clients/page.tsx`
    - Reads `profiles.app_role`; only allows `appRole === "superadmin"` to see the clients UI.

### 1.3 Where roles/permissions are written

- **Admin user management**
  - `app/api/admin/users/route.ts`
    - `POST` — creates auth user and profile via `createAdminUser`. `app_role` defaults to `"consultant"` when omitted; otherwise must be one of `superadmin | admin | consultant | viewer`.
    - `PATCH` — legacy app-role update path; now superseded by more explicit `/api/admin/users/[id]/app-role`.
  - `app/api/admin/users/[id]/app-role/route.ts`
    - `PATCH` — requires `manage_global_roles` (global permission).
    - Validates `appRoleKey` against `["superadmin", "admin", "consultant", "viewer"]`.
    - Writes `profiles.app_role` via `supabaseAdmin`.
  - `lib/services/adminService.ts`
    - `createAdminUser`, `updateUserAppRole`, `getAllUsersWithRoles`.
- **RLS / migrations**
  - Multiple RLS policies and migrations still reference `profiles.app_role = 'superadmin'` as the high-privilege override (e.g. metadata tables, global notes/tasks, roles/permissions admin tables).

---

## 2. Role update flow and coherence

### 2.1 Role update path

1. **Admin navigates to `/admin/users`** (superadmin-only in current UI).
2. **List of users and current `app_role`**
   - `/api/admin/users` (`GET`) uses `requireAuthAndGlobalPermission(request, "manage_users")`.
   - Reads profiles via `getAllUsersWithRoles()` and returns `app_role` per user.
   - `AdminUsersPage` renders roles using `ROLE_LABELS` and `APP_ROLE_OPTIONS`:
     - `superadmin → "Superadministrador"`, `admin → "Administrador"`, `consultant → "Consultor"`, `viewer → "Lector"`.
3. **Changing a user’s role**
   - In `/admin/users`, `RoleSelect` sends `PATCH /api/admin/users/:id/app-role` with `{ appRoleKey }`.
   - API validates the key and updates `profiles.app_role` directly (service role).
   - On success, UI calls `onUpdated()`, which reloads `/api/admin/users`, so the list reflects fresh DB state immediately.

### 2.2 How the current user sees their updated role

- **Admin page / user list**
  - Reflects `profiles.app_role` directly via `/api/admin/users`.
  - Example: if a superadmin changes another user to `admin`, `/admin/users` will show that user as “Administrador”.
- **User menu**
  - Always re-reads `profiles.app_role` *client-side* when the menu mounts:
    - No caching beyond the component lifecycle.
  - However, the label mapping is binary (“superadmin” vs “Consultor for everything else”).
  - **Result:** A user whose `profiles.app_role` was changed from `consultant` to `admin` will:
    - See “Administrador” in `/admin/users` (for that user row).
    - See “Consultor” in their own user menu, because any non-superadmin is labeled “Consultor”.

### 2.3 /api/me vs session vs profile reads

- `/api/me`
  - Uses `getCurrentUserIdFromRequest` and `supabaseAdmin` to read `profiles.app_role` on each call.
  - Returns **fresh DB state**; not cached in JWT/session.
- **Layout / sidebar**
  - `app/(private)/layout.tsx` reads `profiles.app_role` via the **client** Supabase on mount and stores it in `appRole` state.
  - It only recognises `"superadmin"` and `"consultant"`; for `"admin"` or `"viewer"`, `appRole` remains null.
- **User menu**
  - Reads `profiles.app_role` directly via client Supabase; no `/api/me` usage.

**Conclusion:** The global role source of truth is consistent (profiles and `/api/me`), but UI components have partial or lossy interpretations of `app_role`, which causes the observed “Administrador vs Consultor” mismatch.

Classification:
- **/admin users vs user menu role label mismatch:** **UI inconsistency**, not a security issue.
- **Layout using only `"superadmin" | "consultant"`:** **RBAC matrix / UI mismatch**, potential future UX issue if more roles are used for gating.

---

## 3. Permission source of truth vs UI visibility

### 3.1 Primary permission sources

- **Global permissions**
  - `hasGlobalPermission(userId, permissionKey)` backed by `roles` / `permissions` / `role_permissions`.
  - Used extensively in admin and platform APIs via `requireAuthAndGlobalPermission`.
- **Project permissions**
  - `hasProjectPermission(userId, projectId, permissionKey)` backed by `project_members.role` and `role_permissions`.
  - Encapsulated for UI by `GET /api/projects/[id]/permissions`.
- **Docs**
  - `docs/RBAC_PERMISSION_MATRIX.md` and `docs/RBAC_VALIDATION_CHECKLIST.md` describe which APIs require which permissions and what each global role should be able to do.

### 3.2 Where UI is permission-based (good)

- Already aligned in previous passes (see `RBAC_VALIDATION_CHECKLIST.md` “UI consistency” section):
  - Project notes and tickets:
    - `/projects/[id]/notes` and `/projects/[id]/tickets` use `GET /api/projects/[id]/permissions` flags (`canEditProjectNotes`, `canDeleteProjectNotes`, `canManageProjectTickets`).
  - Project links:
    - `/projects/[id]/links` uses `canEdit` from the same API; no `app_role` override.
  - Global notes:
    - `/notes`, `/notes/[id]`, `/notes/new` use `/api/me` → `permissions.manageGlobalNotes` to gate create/edit/delete/redirect.
    - Note detail chooses between project permissions (project note) and `manageGlobalNotes` (global note).

### 3.3 Places still driven by `appRole` for visibility

**Global, project-aggregated UI**

- `app/(private)/tickets/page.tsx` — **global tickets list**
  - Loads tickets via Supabase with RLS (project-scoped).
  - Uses `/api/me` to set `appRole`; `RowActions` for each ticket use:
    - `canEdit={appRole === "superadmin"}`, `canDelete={appRole === "superadmin"}`.
  - Backend enforcement:
    - Ticket updates/deletes are gated by `manage_project_tickets` on the ticket’s project (project permission).
  - **Classification:** UI uses role string; API is permission-based. This is an **UI inconsistency**; not a security weakening.

- `app/(private)/tickets/[id]/page.tsx` — **ticket detail**
  - Similar pattern: uses `appRole === "superadmin"` for delete visibility.

**Admin / system UI**

- `app/(private)/admin/page.tsx`
  - Uses `profiles.app_role` and only allows `appRole === "superadmin"` to see admin panel, despite RBAC docs describing a separate `admin` role with `view_admin_panel` etc.
- `app/(private)/admin/users/page.tsx`
  - Uses `appRole !== "superadmin"` check for access.
- `app/(private)/clients/page.tsx`
  - Uses `appRole !== "superadmin"` check for access.
- `components/ui/sidebar/Sidebar.tsx`
  - Restricted nav items (`/admin`, `/clients`) use `roles: ["superadmin"]`.

**Other uses**

- `lib/auth/serverAuth.ts` — `getCurrentUserWithRoleFromRequest`
  - Defines `AppRoleFromRequest = "superadmin" | "consultant"`.
  - When reading `profiles.app_role`, normalises:
    - `"superadmin"` → `"superadmin"`.
    - Any other value (including `"admin"`, `"viewer"`) → `"consultant"`.
  - Used by `GET /api/projects/[id]/permissions`, but only to carry an `appRole` field; the returned permissions are derived from `hasGlobalPermission` / `hasProjectPermission`, so this lossy mapping does **not** affect authorization decisions.

Classification:
- Global tickets UI and admin panels:
  - **UI inconsistency / RBAC matrix mismatch.**
  - Backend is already enforced via permission helpers or RLS; no immediate security issue.
- `getCurrentUserWithRoleFromRequest`’s two-role mapping:
  - **Technical inconsistency** with the four-role matrix, but currently used only in contexts where specific permissions are also checked.

---

## 4. Project creation audit

### 4.1 Intended model (from docs)

- `docs/RBAC_PERMISSION_MATRIX.md`
  - `POST /api/projects` requires `create_project` (global permission).
  - Consultants **currently have** `create_project`:
    - `supabase/migrations/20260406120000_rbac_permission_matrix.sql`:
      - For role key `consultant`, inserts `('view_dashboard', 'create_project')` permissions.
  - The validation checklist notes:
    - Consultant: “view_dashboard; can create projects (create_project)”.
    - Viewer (app): “no create_project”.

### 4.2 Implementation

- **API**
  - `app/api/projects/route.ts`
    - `POST`:
      - `requireAuthAndGlobalPermission(request, "create_project")`.
      - Inserts into `public.projects` via `supabaseAdmin` with `created_by = userId`.
      - DB trigger ensures creator is added as `project_members.role = 'owner'`.
    - No direct client-side insert to `public.projects`.
- **UI**
  - `app/(private)/projects/new/page.tsx`
    - Calls `/api/projects` with JWT bearer token.
    - If API returns 403 (lacking `create_project`), shows: “No tienes permiso para crear proyectos.”
    - No explicit UI gating; “Create project” button is visible, but API remains the source of truth.
- **RLS**
  - `projects` writes go through `supabaseAdmin` in the API; RLS on `projects` does not gate this specific path (service role).

### 4.3 Why “all users can create projects” may be observed

- Because the **RBAC matrix grants `create_project` to `consultant`**, any authenticated consultant can:
  - Load `/projects/new`.
  - Successfully call `POST /api/projects` (permission check passes).
  - See the new project in their dashboard (as owner).
- This is **by design**, not a bug.

Classification:
- **Consultant can create projects:** **RBAC matrix choice**, not a security error.
  - To change behavior, `create_project` must be removed from the consultant role (via the matrix migration), and maybe granted to `admin` only.
  - UI will automatically reflect the change because `/api/projects` will start returning 403 for consultants.

---

## 5. End-to-end coherence matrix (summary)

This table assumes the RBAC matrix as implemented in migrations and described in `RBAC_PERMISSION_MATRIX.md` and `RBAC_VALIDATION_CHECKLIST.md`.

### 5.1 Global roles

For each app role:

| Global role | DB source | `/api/me` | UI role label (user menu) | Project create (UI) | Project create (API) | Admin panel | Global AI | Global notes | Project member management |
|------------|-----------|-----------|----------------------------|---------------------|----------------------|-------------|-----------|--------------|----------------------------|
| **superadmin** | `profiles.app_role = 'superadmin'` | `appRole = "superadmin"` | **OK**: “Superadministrador” | Button visible; works | Allowed (`create_project`) | `/admin` visible in sidebar & accessible; admin APIs allowed via perms; RLS for admin tables uses `app_role='superadmin'` | Allowed via `use_global_ai` | Global notes visible (RLS + permissions) | Can manage any project via `manage_any_project` + project permissions |
| **admin** | `profiles.app_role = 'admin'` | `appRole = "admin"` | **Inconsistent**: shown as “Consultor” in user menu | Button visible; works if `create_project` is granted to `admin` (per matrix) | Allowed/denied solely by `create_project` permission | **Inconsistent**: `/admin` sidebar & page gated by `app_role === 'superadmin'` only, despite matrix giving `admin` `view_admin_panel`, `manage_clients`, etc. | Allowed via `use_global_ai` if assigned | Global notes visibility via `view_global_notes` / `manage_global_notes`; no UI-only checks | Can archive/manage members via `manage_any_project` as per matrix; UI uses project permissions, not role strings |
| **consultant** | `profiles.app_role = 'consultant'` | `appRole = "consultant"` | Shown as “Consultor” | Button visible; **works by design** (`create_project` granted) | Allowed if `create_project` remains assigned; otherwise 403 | `/admin` hidden; `/admin` 403/blocked by UI; admin APIs denied by permissions | Allowed via `use_global_ai` if assigned; otherwise 403 | No global notes (`view_global_notes` not granted); RLS also restricts global notes to superadmin | Project member management only if project role grants it (owner/editor) and/or specific project permissions |
| **viewer** | `profiles.app_role = 'viewer'` | `appRole = "viewer"` | **Inconsistent**: shown as “Consultor” in user menu | Button visible; 403 from API (no `create_project`) | Denied (`create_project` absent) | `/admin` hidden and blocked | Global AI allowed/denied per `use_global_ai` permission | No global notes (`view_global_notes` absent; RLS still uses `'superadmin'`) | No project-member management unless overridden by project permissions (not typical for viewer) |

### 5.2 Project roles

Project-role behavior (owner/editor/viewer) is coherent between:

- RLS (project membership).
- Project permissions matrix (`view_project_*`, `edit_project`, `manage_project_members`, `manage_project_tickets`, etc.).
- `GET /api/projects/[id]/permissions` and the project UIs (dashboard, members, notes, tickets), as described in `RBAC_VALIDATION_CHECKLIST.md`.

No inconsistencies were observed between project role expectations and implemented permissions in this audit.

---

## 6. Issues found and classification

### 6.1 User menu role label mismatch

- **Files**
  - `components/UserMenu.tsx`
  - `app/(private)/admin/users/page.tsx` (source of truth list)
- **Behavior**
  - `AdminUsersPage` shows each user’s `app_role` with correct labels:
    - `superadmin → "Superadministrador"`, `admin → "Administrador"`, `consultant → "Consultor"`, `viewer → "Lector"`.
  - `UserMenu` shows:
    - `"superadmin"` → “Superadministrador”.
    - Anything else (`"admin"`, `"consultant"`, `"viewer"`) → “Consultor”.
- **Impact**
  - A user whose global role is `"admin"` or `"viewer"` will always see “Consultor” in the header menu.
  - This is purely **UI / labeling**; no security impact.
- **Classification**
  - **UI inconsistency.**

### 6.2 Layout and helper only model two roles

- **Files**
  - `app/(private)/layout.tsx`
  - `lib/auth/serverAuth.ts` (`AppRoleFromRequest`, `getCurrentUserWithRoleFromRequest`)
- **Behavior**
  - `PrivateLayout`:
    - Only stores `appRole` when `profiles.app_role` is `"superadmin"` or `"consultant"`.
    - For `"admin"` or `"viewer"`, `appRole` remains `null`. Currently only `/clients` and `/admin` nav items use `roles: ["superadmin"]`, so this mainly affects potential future gating.
  - `getCurrentUserWithRoleFromRequest`:
    - Normalises `data.app_role` to `"superadmin"` or `"consultant"`; `"admin"` and `"viewer"` are collapsed to `"consultant"`.
    - Today used in `GET /api/projects/[id]/permissions` mostly for carrying an `appRole` field, not for enforcement.
- **Impact**
  - No direct security hole was observed because concrete permissions are derived via `hasGlobalPermission` / `hasProjectPermission`.
  - However, this model is inconsistent with the four-role matrix and may cause confusion in logs or future code.
- **Classification**
  - **RBAC matrix / technical inconsistency** (low impact under current usage).

### 6.3 Admin panel and clients page only recognise `superadmin`

- **Files**
  - `app/(private)/admin/page.tsx`
  - `app/(private)/admin/users/page.tsx`
  - `app/(private)/clients/page.tsx`
  - `components/ui/sidebar/Sidebar.tsx`
- **Behavior**
  - All admin and clients UIs are gated with `appRole === "superadmin"` checks.
  - Sidebar `roles` for `/admin` and `/clients` are `["superadmin"]`.
  - However, the RBAC matrix defines an `admin` role with:
    - `view_admin_panel`, `manage_clients`, `manage_knowledge_sources`, `view_global_notes`, `manage_global_notes`, `view_global_metrics`.
  - Backend admin APIs do **not** use `requireSuperAdminFromRequest` for core admin actions; instead they use `requireAuthAndGlobalPermission` with specific permissions.
- **Impact**
  - Users with `app_role = 'admin'` and the corresponding global permissions would be authorised by APIs but **locked out by UI** for:
    - `/admin` panel and `/admin/users`.
    - `/clients`.
  - Today, because only superadmins typically have those permissions, this is more a **model gap** than an immediate bug; but if `admin` is used in production, those users will see inconsistent capabilities between docs and UI.
- **Classification**
  - **RBAC matrix & UI mismatch.**
  - Not a security weakening (admin APIs are still permission-gated and often superadmin-only via RLS).

### 6.4 Global tickets UI still role-based

- **Files**
  - `app/(private)/tickets/page.tsx`
  - `app/(private)/tickets/[id]/page.tsx`
- **Behavior**
  - Ticket actions (edit/delete) use `appRole === "superadmin"` for visibility.
  - Backend ticket mutations rely on `manage_project_tickets` project permission; the API and RLS remain the source of truth.
- **Impact**
  - Users who have project-level permission to manage tickets but are not superadmin:
    - May be able to manage some tickets via project views but not via the global tickets list/detail.
  - This is deliberately documented in the checklist as an “intentional” remaining use of `appRole`.
- **Classification**
  - **UI consistency gap** (permissions vs role string).

---

## 7. Recommended fixes (ordered by priority)

### 7.1 Small, safe fixes (implemented or safe to implement)

1. **Fix user-menu role label mapping** (**UI inconsistency**)
   - **Files:** `components/UserMenu.tsx`.
   - **Change:** Map `appRole` to labels via a small lookup:
     - `superadmin → "Superadministrador"`, `admin → "Administrador"`, `consultant → "Consultor"`, `viewer → "Lector"`.
     - Fallback: show the raw key when unknown.
   - **Effect:** A user whose global role is `admin` will display as “Administrador” in the user menu, consistent with `/admin/users`.
   - **Security:** No change to permissions; presentation only.

2. **Use `/api/me` consistently in new UI work**
   - Prefer `/api/me` as the single source of truth for global role & permission flags in new screens, rather than querying `profiles` directly from the client.
   - This keeps the role/permission payload consolidated and easier to evolve (e.g. adding more permission flags).

### 7.2 Medium fixes (require product / RBAC decisions)

3. **Decide whether `admin` should access `/admin` and `/clients`**
   - If **yes**:
     - Update UI checks and sidebar:
       - `Sidebar` roles for `/admin` and `/clients`: `["superadmin", "admin"]`.
       - `app/(private)/admin/page.tsx`, `app/(private)/admin/users/page.tsx`, `app/(private)/clients/page.tsx`: replace `appRole !== "superadmin"` with permission-based checks (e.g. `view_admin_panel`, `manage_clients`) or allow both `superadmin` and `admin`.
     - Ensure backend:
       - Admin APIs already use `requireAuthAndGlobalPermission` (good).
       - RLS on `roles` / `permissions` / `role_permissions` can remain superadmin-only if those are considered platform-level, while admin handles only “tenant admin” tasks.
   - If **no** (admin is a reserved/future role):
     - Document clearly in RBAC docs that **only `superadmin` accesses `/admin` and `/clients`**.
     - Optionally hide the `admin` option from APP_ROLE_OPTIONS until semantics are defined.

4. **Normalise role handling in layout and serverAuth**
   - `app/(private)/layout.tsx`:
     - Broaden `AppRole` union to include all four roles or treat it as string.
     - Continue to use role-specific gating in `Sidebar` via the `roles` array, rather than hardcoding only two roles.
   - `lib/auth/serverAuth.ts`:
     - Either:
       - Change `AppRoleFromRequest` to include all four roles; or
       - Replace `appRole` with explicit permission checks or booleans in any API responses where a binary “superadmin vs other” split is actually desired.
   - This cleans up technical debt and prevents future confusion around “admin” vs “consultant”.

5. **Gradually move remaining `appRole`-based UI checks to permission flags**
   - Example candidates:
     - Global tickets list/detail: use a dedicated permission such as `view_all_tickets` / `manage_any_ticket` or rely on `manage_any_project`/`view_all_projects`, and expose a flag via `/api/me` or a specific endpoint.
   - Keep backend as the source of truth; UI should reflect what the APIs already enforce.

### 7.3 Matrix / product-level decisions

6. **Revisit `create_project` for consultants**
   - If “all consultants can create projects” is undesired:
     - Update `supabase/migrations/20260406120000_rbac_permission_matrix.sql` to remove `create_project` from the consultant block and optionally add it to `admin`.
     - Reapply the migration (idempotent) or run a targeted delete from `role_permissions`.
   - UI and API will respect the change immediately because `POST /api/projects` is permission-based.

7. **Clarify long-term semantics of `admin` vs `superadmin`**

---

## 8. Classification summary

- **Security issues**
  - None identified in this audit directly related to global role coherence.
  - APIs and RLS continue to use explicit permissions and `app_role = 'superadmin'` for true platform-wide operations.

- **UI inconsistencies**
  - User menu shows “Consultor” for `admin` and `viewer`.
  - Global tickets UI still uses `appRole === "superadmin"` for actions, while backend enforces project permissions.
  - Admin and clients UIs treat only `superadmin` as “administrador”, ignoring the `admin` role from the matrix.

- **Session/cache inconsistencies**
  - None significant; most role/permission reads are DB-backed (`profiles` or `/api/me`). Observed mismatches stem from mapping logic, not from stale sessions.

- **RLS issues**
  - No new RLS issues found in this pass.
  - Existing RLS usage of `app_role = 'superadmin'` for global overrides remains consistent with the “superadmin = platform owner” concept.

- **RBAC matrix issues**
  - The four-role matrix (`superadmin`, `admin`, `consultant`, `viewer`) is not yet fully reflected in:
    - Layout role type (`AppRole`).
    - `getCurrentUserWithRoleFromRequest` two-role mapping.
    - Admin/clients UI gating, which treats only `superadmin` as “admin”.

This audit should be re-run after any substantial RBAC or workspace-related changes, especially if the `admin` role is given concrete product semantics beyond those described here.

