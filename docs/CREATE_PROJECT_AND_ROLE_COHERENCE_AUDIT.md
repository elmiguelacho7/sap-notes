# Create-project flow and role coherence audit

Focused audit of the create-project flow for **viewer** users and of role/session coherence between admin panel, user menu, and backend. Viewer must NOT be able to create projects (DB confirmed: `create_project` is assigned only to superadmin, admin, consultant).

---

## 1. UI visibility of “Create project”

### 1.1 Where the “+ Create” / “Nuevo proyecto” entry points are

| Location | File | Control of visibility |
|----------|------|------------------------|
| **Projects list header** | `app/(private)/projects/page.tsx` (line 131) | **None.** `actions={<Button onClick={() => router.push("/projects/new")}>Nuevo proyecto</Button>}` is always rendered. No `appRole`, no `/api/me`, no permission check. |
| **Header “+ Create” dropdown** | `components/ui/actions/QuickActionMenu.tsx` | **Hardcoded.** `DEFAULT_ITEMS` includes `{ label: "Create Project", href: "/projects/new" }`. Shown to every user. No role or permission gating. |

### 1.2 What actually controls visibility today

- **Projects page button:** Nothing. Always visible to any user who can reach `/projects`.
- **Quick action “Create Project”:** Nothing. Always visible.
- **Data used elsewhere:** No create-project permission is exposed by `/api/me` (only `appRole` and `permissions.manageGlobalNotes`). No frontend store or permission payload is used to gate project creation UI.

**Conclusion:** A **viewer** can see both “Nuevo proyecto” on the projects page and “Create Project” in the “+ Create” menu. Visibility is **hardcoded** and **not** driven by permissions.

---

## 2. New project page (`/projects/new`)

**File:** `app/(private)/projects/new/page.tsx`

### 2.1 Who can see / access the page

- **Route:** Under `(private)` layout. Any authenticated, active user who can access the private app can open `/projects/new` (e.g. by URL or by clicking the unguarded buttons above).
- **Page logic:** No permission check on mount. No redirect. The page loads clients/modules and renders the full “Nuevo proyecto” form.
- **Submit:** On submit it calls `POST /api/projects` with the session token. The API enforces `create_project`; a viewer gets **403** and the page shows “No tienes permiso para crear proyectos.” (line 217).

### 2.2 Summary

- **Can a viewer see the page?** **Yes.** They can navigate directly to `/projects/new` and see the form.
- **Can a viewer create a project?** **No.** Backend returns 403; no alternate code path.
- **Gap:** No access guard; viewer has a confusing experience (full form then error on submit). Recommended: redirect viewers away from `/projects/new` when they lack `create_project`.

---

## 3. Backend authorization

**File:** `app/api/projects/route.ts`

- **POST handler:** Calls `requireAuthAndGlobalPermission(request, "create_project")`. If the user lacks the permission, it returns the 403 from `requireAuthAndGlobalPermission` (no other path).
- **Insert:** Uses `supabaseAdmin` to insert into `projects`; only reached after permission check. No client-side or alternate server path for project creation.
- **Viewer:** Has no `create_project` in the DB → `hasGlobalPermission(userId, "create_project")` is false → **viewer gets 403**. Confirmed.

**Conclusion:** Backend is correct and single-path. Viewer cannot create projects via the API.

---

## 4. Legacy / direct client insert audit

- **Search:** `supabase.from("projects").insert(...)` and similar patterns (e.g. `from('projects').insert`).
- **Result:** **No matches** in the codebase. Project creation goes only through `POST /api/projects`, which uses `supabaseAdmin` after the permission check.
- **RLS:** Not re-audited here; assumption is that direct client inserts would be subject to RLS. Regardless, there are no direct client inserts to `projects` in the app.

---

## 5. Role/session coherence

### 5.1 Where role is read

| Consumer | Source | When | Notes |
|----------|--------|------|--------|
| **User menu (header)** | Client Supabase: `profiles.full_name, app_role` | Once on mount | Same DB as backend; can be stale until refresh if an admin changed this user’s role in another tab. |
| **Private layout (sidebar)** | Client Supabase: `profiles.app_role, is_active` | On mount + on auth state change | Only sets `appRole` state when value is `"superadmin"` or `"consultant"`. For `"admin"` or `"viewer"` the role is not stored (stays `null`). |
| **/api/me** | Server: `supabaseAdmin` → `profiles.app_role` | Every request | Always DB-backed; no session cache. Also returns `permissions.manageGlobalNotes`. Does **not** return `create_project`. |
| **Admin panel user list** | `/api/admin/users` → `getAllUsersWithRoles()` → DB | On load / refresh | Shows each user’s current `app_role` from DB (e.g. “Administrador” for admin). |

### 5.2 Why admin panel role and user-menu role can differ

- **Different users:** Admin panel shows **other** users’ roles (from API/DB). User menu shows the **current** user’s role (from client Supabase profile read).
- **Stale client read:** If an admin changes the current user’s role (e.g. consultant → admin), the current user’s browser may still have the old profile in memory. User menu and layout read profile only on mount (and layout on auth change), so they can show the old role until the page is refreshed or re-mounted.
- **Label mapping (fixed):** User menu used to show “Consultor” for any non-superadmin; it now uses a map (superadmin → Superadministrador, admin → Administrador, consultant → Consultor, viewer → Lector), so the **same** `app_role` value is displayed consistently. Remaining mismatch is therefore **stale frontend state** (and layout’s two-role model), not a DB/API inconsistency.
- **Layout two-role model:** Layout only keeps `appRole` when it is `"superadmin"` or `"consultant"`. For `"admin"` and `"viewer"` it leaves `appRole` as `null`. So sidebar and any layout-driven role UI do not “see” admin/viewer; that does not change create-project visibility, which is currently unguarded in UI.

**Classification:**

- **Stale frontend state:** Yes — client profile read is not refreshed when an admin updates the user’s role elsewhere.
- **DB/API mismatch:** No — `/api/me` and admin APIs read from the same DB; admin list and backend use the same source of truth.
- **Inconsistent source of truth:** Partially — user menu and layout use client Supabase (cached); `/api/me` is server/DB. Using `/api/me` for role and permission display would align UI with a single, fresh source.

---

## 6. Exact files involved

| Purpose | File(s) |
|---------|--------|
| Create button (projects list) | `app/(private)/projects/page.tsx` |
| Create entry in “+ Create” menu | `components/ui/actions/QuickActionMenu.tsx` |
| New project page (no guard) | `app/(private)/projects/new/page.tsx` |
| Project creation API | `app/api/projects/route.ts` |
| Current user role/permissions API | `app/api/me/route.ts` |
| User menu role display | `components/UserMenu.tsx` |
| Layout / sidebar role | `app/(private)/layout.tsx` |
| Admin user list (role per user) | `app/(private)/admin/users/page.tsx`, `GET /api/admin/users` |

---

## 7. Minimal safe fixes (ordered by priority)

1. **Expose `create_project` for UI**  
   - In **`app/api/me/route.ts`**: Add `permissions.createProject = await hasGlobalPermission(userId, "create_project")` (and include in response).  
   - Enables all UI below to gate on real permission without changing schema or matrix.

2. **Gate “Nuevo proyecto” button**  
   - In **`app/(private)/projects/page.tsx`**: Fetch `/api/me` (or a small hook using it). Render the “Nuevo proyecto” button only when `permissions.createProject === true`.  
   - Viewer no longer sees the button.

3. **Guard `/projects/new`**  
   - In **`app/(private)/projects/new/page.tsx`**: On mount, fetch `/api/me`. If `!permissions.createProject`, redirect to `/projects` (optionally with a short message).  
   - Prevents viewer from seeing the form when opening the URL directly.

4. **Gate “Create Project” in Quick Action menu**  
   - In **`components/ui/actions/QuickActionMenu.tsx`**: Load `/api/me` (or receive a prop). Filter out the “Create Project” item when `!permissions.createProject`.  
   - Viewer no longer sees “Create Project” in the “+ Create” dropdown.

5. **Role display from `/api/me` (applied)**  
   - User menu now loads `appRole` from `/api/me` instead of from the client Supabase profile; full name still comes from `profiles`. Role label thus matches the admin panel and backend.

---

## 8. Summary table

| Question | Answer |
|----------|--------|
| Can a **viewer** see the Create button (projects page)? | **Yes** today; button is unconditional. After fix: **No** (gate on `createProject`). |
| Can a **viewer** access `/projects/new`? | **Yes** today (no guard). After fix: **No** (redirect when !createProject). |
| Can a **viewer** successfully POST `/api/projects`? | **No.** API requires `create_project`; viewer gets 403. |
| Where does the displayed role in the user menu come from? | **After fix:** `/api/me` (DB-backed). Previously: client Supabase profile (could be stale). |
| Why can admin panel role and user-menu role differ? | Admin panel shows **other** users from API/DB; user menu shows **current** user. After fix, user menu uses `/api/me` so role matches DB; a full page refresh still may be needed if an admin changed the current user's role in another tab. |
| Direct client inserts to `projects`? | **None** in codebase. Only path is POST `/api/projects`. |

No schema, RLS, or permission matrix changes are required; only UI and access guard changes driven by `create_project` from `/api/me`.
