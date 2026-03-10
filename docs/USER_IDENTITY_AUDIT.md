# User identity audit report

## 1. Relationship between auth.users and public.profiles

- **profiles.id** = **auth.users.id** (1:1). Every app user is identified by this UUID.
- **Trigger:** `on_auth_user_created_create_profile` (AFTER INSERT ON auth.users) calls `handle_new_auth_user()` which inserts a row into `public.profiles` with `id = NEW.id`, `email`, `full_name` from auth, `app_role = 'consultant'`, `is_active = false` (for self-signup). Admin-created users are upserted with `is_active = true` via `adminService.createAdminUser()`.
- **profiles** columns used for identity: `id`, `email`, `full_name`, `app_role`, `is_active`.

## 2. How to produce the report

Run the queries in **Supabase Dashboard → SQL Editor** in order:

1. **Audit script:** `supabase/scripts/audit_auth_profiles.sql`
   - Query 1: Auth users without profiles
   - Query 2: Profiles without auth.users (orphans)
   - Query 3: Email mismatches (auth.email ≠ profiles.email)
   - Query 4: The three specific accounts (see below)
   - Query 5: Full list of auth users with profile join
   - Query 6: Full list of profiles with auth join

2. **Fix missing profiles (if any):** `supabase/scripts/fix_missing_profiles.sql`
   - Inserts into `public.profiles` for every `auth.users` row that has no profile. Uses `ON CONFLICT (id) DO NOTHING`.

## 3. Specific accounts to inspect

After running the audit script, check **Query 4** for:

| Email                     | What to check                                                                 |
|-------------------------------------------------------------------------------------------|
| administrator@funonso.com | Has profile? Same email? app_role (superadmin expected for admin).            |
| mguerra.marin7@gmail.com  | Has profile? Same email? app_role (consultant/superadmin as intended).        |
| isasis1207@gmail.com      | Has profile? Same email? app_role (consultant/superadmin as intended).        |

Status column in the result: `ok` | `auth_only_no_profile` | `email_mismatch`.

## 4. Confirmation: profiles.id = auth.users.id

- **Schema:** All FKs (e.g. `project_members.profile_id`, `notes.created_by`, RLS policies) reference `public.profiles(id)`. The trigger and app code assume `profiles.id = auth.uid()` = `auth.users.id`.
- **Admin list:** `getAllUsersWithRoles()` loads from `profiles` and enriches email from `auth.admin.listUsers()` by matching `auth.users.id` to `profiles.id`. So the admin UI is driven by profiles and reflects the same identity as auth.

## 5. SQL to create missing profile rows

Already provided: **`supabase/scripts/fix_missing_profiles.sql`**. Run it only if the audit shows auth users without a profile. It inserts one profile per auth user (id, email, full_name from auth, app_role = 'consultant', is_active = false) with `ON CONFLICT (id) DO NOTHING`.

## 6. Admin Users page: full_name, email, app_role, activation

- The Admin Users page already displays:
  - **Nombre** (full_name)
  - **Email** (from profiles, enriched from Auth when available)
  - **Rol global** (app_role) — now **editable** via a dropdown
  - **Estado** (Activo / Pendiente = is_active)
- Role editing uses **PATCH /api/admin/users/:id/app-role** with body `{ appRoleKey: "superadmin" | "consultant" }`, which updates **profiles.app_role** by **profiles.id** (= user id). The current user cannot change their own role (dropdown disabled).

## 7. Role editing updates profiles.app_role by user ID

- **PATCH /api/admin/users/:id/app-role** (and the legacy PATCH /api/admin/users with body `userId` + `appRole`) both call `updateUserAppRole(userId, appRole)` in `lib/services/adminService.ts`, which runs:
  - `supabaseAdmin.from("profiles").update({ app_role: appRole }).eq("id", userId)`  
So role editing updates **profiles.app_role** by user ID.

## 8. Endpoints and profile resolution

| Endpoint / feature      | How identity is resolved | Same profile? |
|-------------------------|---------------------------|----------------|
| **GET /api/me**         | `getCurrentUserIdFromRequest(request)` → then `profiles.select("app_role").eq("id", userId)` (via supabaseAdmin). | Yes: profile by id. |
| **GET /api/notes**      | Bearer token → JWT `sub` = userId; client created with `Authorization: Bearer <token>`; then `profiles.select("app_role").eq("id", userId)` and `notes.select(...)` — both as same user. | Yes: profile by id (and RLS uses auth.uid() = that user). |
| **Admin users page**    | GET /api/admin/users → `getAllUsersWithRoles()` loads from **profiles** (id, full_name, email, app_role, is_active) and enriches email from Auth by id. | Yes: list is profile-driven; id = auth.users.id. |

All three use **profiles** keyed by the same user id (auth.uid() or JWT sub).

## 9. Output (fill after running the scripts)

- **List of auth users:** Run Query 5 of the audit script. Copy the result set here or keep it in the SQL editor.
- **List of profiles:** Run Query 6 of the audit script. Copy the result set here or keep it in the SQL editor.
- **Mismatches:** From Query 1 (auth without profile), Query 2 (profiles without auth), Query 3 (email mismatch). Summarize:
  - Auth users without profile: _e.g. 0 or list ids/emails_
  - Profiles without auth user: _e.g. 0 or list_
  - Email mismatches: _e.g. 0 or list_
- **Minimal fixes applied:**
  - Run `fix_missing_profiles.sql` if Query 1 returned any rows.
  - Optionally fix email mismatches with `UPDATE public.profiles p SET email = au.email FROM auth.users au WHERE au.id = p.id AND trim(lower(au.email)) IS DISTINCT FROM trim(lower(p.email));`
  - Admin Users page: role dropdown added so superadmins can change **profiles.app_role** by user id without leaving the page.
