# Knowledge module – troubleshooting Supabase errors

Use this when `listSpaces()` or the Knowledge page fails and you need to see the real error and fix the root cause.

## 1. See the real error

- **Service:** `lib/knowledgeService.ts` – `listSpaces()` logs `message`, `details`, `hint`, `code` to the console and throws `error.message` (visible in Next overlay).
- **Page:** `app/(private)/knowledge/page.tsx` – temporary sanity ping runs on load: `SELECT id FROM knowledge_spaces LIMIT 1`. If it fails, the same fields are logged under `knowledge/page.tsx sanity ping knowledge_spaces`.

Check the browser console (and terminal if SSR) for these logs.

## 2. Environment / project mismatch (most common)

The app uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `.env.local`. The Supabase CLI uses the **linked** project (`supabase link`).

- Confirm which project the app talks to: the host in `NEXT_PUBLIC_SUPABASE_URL` (e.g. `https://xxxx.supabase.co`).
- Confirm the **same** project has the Knowledge migrations applied: run `supabase db push` from the repo (linked project) or apply migrations in the Dashboard for that project.
- If the app URL points to project A but you pushed migrations to project B, either:
  - Update `.env.local` to use project B’s URL and anon key, or
  - Run `supabase link` and `supabase db push` for project A.

## 3. "relation does not exist" (e.g. knowledge_spaces)

- The DB your app is hitting does not have the Knowledge tables.
- Fix: Apply the Knowledge migrations to that project (`supabase db push` when linked, or run the migration SQL in Supabase SQL Editor).

## 4. "permission denied" / RLS

- RLS is enabled on Knowledge tables. SELECT is allowed only for:
  - **knowledge_spaces:** `owner_profile_id = auth.uid()` OR (project_id set and user is project member or superadmin).
  - **knowledge_pages:** same idea (owner or project member/superadmin via space).
- Ensure:
  - The user is **logged in** (so `auth.uid()` is set). The app uses the browser Supabase client; session comes from auth (e.g. localStorage).
  - The app uses the **authenticated** client (e.g. `@/lib/supabaseClient`) so requests send the JWT.
  - On **insert**, `owner_profile_id` is set to the current user (e.g. `user.user.id` from `supabase.auth.getUser()`). The migration and service already do this.

If the user is not logged in, RLS will allow no rows; log in and retry.

## 5. After fix

- Remove the **temporary sanity ping** in `app/(private)/knowledge/page.tsx` (the `useEffect` that runs `supabase.from("knowledge_spaces").select("id").limit(1)` and logs `pingError`).
- Confirm `/knowledge` loads and spaces list correctly.

## Quick env check (manual)

In the repo root, ensure `.env.local` has:

- `NEXT_PUBLIC_SUPABASE_URL` = your project URL (e.g. `https://<ref>.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = that project’s anon key

Compare with Supabase Dashboard → Project Settings → API for the same project.
