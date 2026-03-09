# Deployment: Pending activation fix (Supabase)

This document describes how to fully apply the **pending activation fix** in Supabase. The app code is already updated; you must apply the migration and update the confirmation email template in the Dashboard.

---

## Prerequisites

- **Same Supabase project:** The app must use the project you are updating (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` must point to that project).
- **Supabase CLI** installed and, for remote deployment, **linked** to that project.

---

## Step 1 — Apply the migration

### 1.1 Open a terminal in the project root

```bash
cd "c:\Users\Miguel Guerra\Sap note\sap-notes"
```

(or your actual project root path).

### 1.2 Ensure Supabase CLI is available

```bash
npx supabase --version
```

If it fails, install the CLI: [Supabase CLI docs](https://supabase.com/docs/guides/cli).

### 1.3 Link the project (if not already linked)

If you have not linked this repo to your remote Supabase project:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

Get `YOUR_PROJECT_REF` from **Supabase Dashboard → Project Settings → General** (Reference ID).

### 1.4 Apply pending migrations

From the project root:

```bash
npx supabase db push
```

This pushes all **unapplied** migrations in `supabase/migrations/` to the linked project, including:

- `20260403200000_profiles_signup_always_inactive.sql` (and any other pending ones).

### 1.5 What success looks like

- **All migrations already applied:** You may see a message indicating that no new migrations were applied (nothing to push). That is fine if this migration was applied earlier.
- **New migration applied:** You should see output indicating that the migration(s) were applied successfully, with no SQL errors.
- **Failure:** If you see errors (e.g. "relation does not exist", "column does not exist"), the database may be missing an earlier migration (e.g. `20260403100000_profiles_is_active.sql`). Apply migrations in order or fix the linked project.

To list which migrations Supabase considers applied (for the linked project):

```bash
npx supabase migration list
```

---

## Step 2 — Update the confirmation email template (manual)

The confirmation email content is **not** controlled by app code or migrations. It is configured only in the Supabase Dashboard.

1. Open **Supabase Dashboard** → your project.
2. Go to **Authentication** → **Email Templates**.
3. Select **Confirm signup**.
4. Paste the **Subject** and **Message (HTML)** from **`docs/EMAIL_TEMPLATES_SUPABASE.md`** (sections "Subject" and "Message — HTML").
5. Save.

**Important:** Changing the codebase or re-running migrations will **not** update this email. You must paste the template manually in the Dashboard.

---

## Verification checklist (after deployment)

Use this to confirm the fix is active:

1. **Create a new public user**
   - From the app, register with a new email (not used before).
2. **Confirm email**
   - Use the link from the confirmation email.
3. **Verify user appears as pending**
   - In the admin area, the new user should appear as **pending** (or inactive), not active.
4. **Verify login redirects to pending-activation**
   - Log in as that user; the app should redirect to the pending-activation / “account pending approval” experience, not into the private app.

### Optional: confirm the new function/trigger in the database

See **Exact SQL verification queries** below.

---

## Exact SQL verification queries (Supabase SQL Editor)

Copy-paste these in **Supabase Dashboard → SQL Editor** (same project as the app).

### 1. Trigger function body (must show ON CONFLICT DO UPDATE and is_active = false)

```sql
SELECT pg_get_functiondef(oid) AS function_definition
FROM pg_proc
WHERE proname = 'handle_new_auth_user';
```

Expected: The result should contain `ON CONFLICT (id) DO UPDATE SET` and `is_active = false`. If you see `DO NOTHING`, the hardening migration has not been applied.

### 2. Newly created user profiles and is_active values

```sql
SELECT p.id, p.email, p.is_active, p.app_role, p.full_name, au.created_at AS auth_created_at
FROM public.profiles p
JOIN auth.users au ON au.id = p.id
ORDER BY au.created_at DESC
LIMIT 20;
```

Check that recent **public signups** (users not created via admin) have `is_active = false`.

### 3. Whether a specific user was created as pending

Replace `'USER_EMAIL_OR_ID'` with the user's email or UUID:

```sql
SELECT p.id, p.email, p.is_active, p.app_role,
       au.email_confirmed_at IS NOT NULL AS email_confirmed
FROM public.profiles p
JOIN auth.users au ON au.id = p.id
WHERE p.email = 'USER_EMAIL_OR_ID' OR p.id::text = 'USER_EMAIL_OR_ID';
```

For a public signup, `is_active` should be `false` even after email confirmation.

---

## Rollback

If you need to revert the **function** behavior (not recommended):

- You would need to re-apply the previous version of `handle_new_auth_user()` (e.g. from `20260403100000_profiles_is_active.sql`, which uses `ON CONFLICT (id) DO NOTHING`). Doing so reintroduces the bug where re-signups can leave a profile active. Prefer fixing forward (e.g. data fix + keep new migration) rather than rollback.

---

## Summary

| Action | Where | Command / location |
|--------|--------|----------------------|
| Apply migration | Terminal, project root | `npx supabase db push` |
| Update email template | Supabase Dashboard | Authentication → Email Templates → Confirm signup |
| Verify | App + optional SQL | New signup → confirm → check pending + redirect; optional `pg_get_functiondef` |

---

## Deliverable summary (pending activation fix)

1. **Migration file verified**  
   - `supabase/migrations/20260403200000_profiles_signup_always_inactive.sql` is correct. It replaces `handle_new_auth_user()` so that public self-signup always results in `profiles.is_active = false`, and `ON CONFLICT (id) DO UPDATE` sets `is_active = false` so a previously active profile is never preserved on re-signup. Admin-created users still become active via `adminService.createAdminUser()` upsert.

2. **Corrections made**  
   - No changes to the migration file were required. App code: login and private layout now use `getUser()` for server-validated identity; deployment and email-template docs updated.

3. **Exact command(s) to apply the migration**  
   - From project root: `npx supabase db push` (with Supabase CLI installed and project linked via `npx supabase link --project-ref YOUR_PROJECT_REF` if needed).

4. **How to verify the fix**  
   - Create a new public user → confirm email → verify user appears as pending in admin → log in and confirm redirect to pending-activation. Use the **Exact SQL verification queries** above in SQL Editor.

5. **Exact location for the email template (manual only)**  
   - **Supabase Dashboard → Authentication → Email Templates → Confirm signup.** Paste Subject and HTML body from `docs/EMAIL_TEMPLATES_SUPABASE.md`. Changing app code or re-running migrations does **not** update this email.

6. **Dependencies / risks**  
   - **Dependency:** This migration depends on `profiles.is_active` existing (added in `20260403100000_profiles_is_active.sql`). Migration order is correct (20260403200000 runs after 20260403100000). The trigger `on_auth_user_created_create_profile` is created in `20250602232000_profiles_email_backfill.sql` and is unchanged; it continues to call `handle_new_auth_user()`.  
   - **Risk:** None identified. If an older migration was never applied on the target project, `db push` may fail until all prior migrations are applied.
