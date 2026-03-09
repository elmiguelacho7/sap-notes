# Dashboard metrics verification guide

Use this to verify whether the RLS and RPC migrations are applied to the **active** database and to diagnose why KPIs show 0 while recent lists show data.

---

## 1) Verify active Supabase environment

The app uses:

- **`NEXT_PUBLIC_SUPABASE_URL`** — Supabase project URL (e.g. `https://xxxx.supabase.co`). Used by both client and server.
- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** — Anon key for browser/client. **Do not log or print the full value.**
- **`SUPABASE_SERVICE_ROLE_KEY`** — Service role key for API routes (e.g. `/api/metrics/platform` uses it to call the RPC). **Do not log or print; check presence only.**

**How to check (no secrets printed):**

- In project root, ensure `.env.local` (or your env file) exists and is loaded by Next.js.
- In a terminal (from project root):
  - `node -e "console.log('URL set:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)"`  
    (Run with your env loaded, e.g. `source .env.local` first if you use it, or use a small script that loads dotenv.)
  - Or run the app and open Dashboard; if lists load, URL and anon key are set. If `/api/metrics/platform` is called, service role key is used server-side.
- Confirm which project you intend to use: **Supabase Dashboard → Project Settings → API**. The “Project URL” must match `NEXT_PUBLIC_SUPABASE_URL` in the app. If the app points to a different project (e.g. old or local), migrations applied elsewhere will not affect this DB.

**Conclusion:** Note whether the app’s URL matches the Supabase project you expect. If not, fix env so the app points to the correct project.

---

## 2) Verify migrations exist in codebase

Confirm these files exist under `supabase/migrations/`:

- `20260402140000_align_platform_metrics_rls.sql`
- `20260402150000_projects_rls_writes.sql`

**Conclusion:** If either is missing, the codebase is out of sync with the intended design. Restore the file(s) before applying.

---

## 3) Verify migrations applied to database

**Local Supabase (e.g. `supabase start`):**

- From project root: `npx supabase db diff` or `npx supabase migration list`.
- Or run: `npx supabase migration list` (or your CLI’s equivalent) and check that the two migrations above appear as **applied**.

**Hosted Supabase (Dashboard):**

- Migrations are applied when you run them (e.g. via “Run migration” or CLI `supabase db push`). There is no automatic sync from your repo to the hosted DB.
- Run the verification SQL below against the **same** project as `NEXT_PUBLIC_SUPABASE_URL` to see if the migrations were ever applied.

**Conclusion:** “Migrations exist in repo” does **not** mean they are applied to the DB. Confirm applied state via CLI or the verification SQL (sections 3–6).

---

## 4) Verify live database objects (SQL)

Use the script **`supabase/sql/verify_rls_and_metrics_migrations.sql`** in **Supabase Dashboard → SQL Editor** (same project as the app).

It checks:

- **Migration history** — Whether `20260402140000` and `20260402150000` appear in `supabase_migrations.schema_migrations`.
- **RLS** — `relrowsecurity = true` for `public.projects` and `public.notes`.
- **Policies** — Policies on `projects` (SELECT, INSERT, UPDATE) and `notes` (SELECT, INSERT).
- **RPC** — Whether `get_platform_metrics` definition contains `v_is_superadmin` (or equivalent superadmin logic).

**Conclusion:**

- If RLS is **off** on `projects`/`notes` → alignment migration not applied; lists can return all rows while RPC still scopes by member/created_by (or old logic) → KPIs 0, lists with data.
- If **no** INSERT/UPDATE policies on `projects` → write migration not applied (project create/edit may fail).
- If **get_platform_metrics** has no superadmin branch → RPC is old; non-superadmin users with no `project_members`/`created_by` get 0.

---

## 5) Why lists still show rows but KPIs show 0

Typical causes:

| Cause | Lists | KPIs | Fix |
|-------|--------|-----|-----|
| RLS not applied | Return all rows (no filter) | RPC returns member/created_by only → 0 if user has none | Apply `20260402140000_align_platform_metrics_rls.sql` |
| RPC old (no superadmin) | Same as above if RLS off | 0 for users with no projects | Apply same migration (updates RPC) |
| User not authenticated | N/A | API gets `userId = null` → 0 | Ensure dashboard sends Bearer token; session valid |
| Wrong DB / project | Depends on that DB | Depends on that DB | Set `NEXT_PUBLIC_SUPABASE_URL` (and keys) to correct project |

So: **if RLS is off and RPC is scoped to member/created_by, lists can show data while KPIs are 0.** Applying the alignment migration (and ensuring the app uses that DB) fixes the mismatch.

---

## 6) Check API response directly

- Open Dashboard in browser; open DevTools → Network. Find the request to `/api/metrics/platform`. Check:
  - **Request:** Authorization header present (e.g. `Bearer <token>`)?
  - **Response:** JSON with `projects_total`, `notes_total`, etc. In development you may also see `_debug.hasUserId`.
- In dev, server logs print: `[api/metrics/platform] { hasUserId, projects_total, notes_total }`. Use this to confirm:
  - `hasUserId: false` → KPIs will be 0 (no user passed to RPC).
  - `hasUserId: true` and still 0 → RPC or data: either RPC is old, or user has no projects in `project_members` / `projects.created_by` (and is not superadmin).

**Conclusion:** If `hasUserId` is false, fix auth (cookie/Bearer and session). If true and still 0, the problem is DB state or RPC version; use the SQL script and apply the missing migrations.

---

## 7) Minimal next fix

- **RLS/migrations not applied:** Apply migrations to the **same** project as `NEXT_PUBLIC_SUPABASE_URL` (via Dashboard SQL or `supabase db push` / migration workflow). Then reload dashboard.
- **Wrong project:** Point env to the correct Supabase project and ensure migrations are applied there.
- **User not authenticated:** Ensure the dashboard sends the session’s access token in the `Authorization` header and the session is valid.
- **User has no projects:** If RLS and RPC are up to date and the user is not superadmin, 0 is correct until they are added as member or creator. No code change needed.

Do **not** add frontend fallbacks again; fix the database and auth so the API is the single source of truth.
