# Deployment report — global notes fixes and auth consistency

**Date:** Generated at pre-deploy verification  
**Branch:** main  
**Linked Supabase project:** tqdukdxtpwmuoqtpfsxt (Sap note)

---

## 1. Files included in deploy

### Modified (M) — will be included when committed
- `app/(private)/admin/users/page.tsx`
- `app/(private)/dashboard/page.tsx` — consultant guard for "Notas recientes"
- `app/(private)/notes/new/page.tsx`
- `app/(private)/notes/page.tsx`
- `app/(private)/projects/[id]/notes/page.tsx`
- `app/api/notes/[id]/route.ts`
- `app/api/project-agent/route.ts`
- `app/api/projects/[id]/activity-stats/route.ts`
- `app/api/projects/[id]/brain/route.ts`
- `app/api/projects/[id]/notes/route.ts`
- `app/api/projects/[id]/stats/route.ts`
- `app/api/tickets/[id]/route.ts`
- `lib/ai/contextResolvers.ts`
- `lib/ai/sapitoTools.ts`
- `lib/auth/serverAuth.ts`
- `lib/supabaseClient.ts` — cookie-based browser client

### New / untracked (??) — must be added and committed for deploy
- `app/api/debug/whoami/` — whoami route (cookie + Bearer, authSource)
- `app/api/notes/route.ts` — **global notes API with consultant guard** (currently untracked)
- `middleware.ts` — session refresh for cookie auth
- `docs/*` — audit and verification docs (optional for deploy)
- `scripts/*.mjs` — identity/audit scripts (optional, not required for app deploy)
- `supabase/migrations/20260404110000_notes_global_superadmin_only.sql` — already applied remotely
- `supabase/scripts/` — optional
- `supabase/sql/*.sql` — **audit/helper scripts, NOT migrations** (run manually in SQL Editor if needed)

**Critical for deploy:** Ensure `app/api/notes/route.ts`, `app/api/debug/whoami/`, `middleware.ts`, and `lib/supabaseClient.ts` are committed so the consultant guard, whoami, and cookie auth are deployed.

---

## 2. Local build status

- **Result:** Success  
- **Command:** `npm run build`  
- **Output:** Compiled successfully (Turbopack), TypeScript passed, static pages generated.  
- **Warning (non-blocking):** `The "middleware" file convention is deprecated. Please use "proxy" instead.` — does not block build or deploy.

---

## 3. Supabase migration status

- **Linked project:** tqdukdxtpwmuoqtpfsxt (Sap note)  
- **Migration list:** All listed migrations are in sync (Local = Remote), including:
  - `20260404100000_notes_tasks_ownership_rls.sql`
  - `20260404110000_notes_global_superadmin_only.sql`
- **Pending migrations to push:** None.  
- **Conclusion:** No migration push required. Notes RLS (global = superadmin only) is already applied on the remote DB.

---

## 4. Whether any migration was pushed

**No.** All migrations, including `20260404110000_notes_global_superadmin_only.sql`, are already applied on the remote project. No `supabase db push` or similar was run during this verification.

---

## 5. SQL helper scripts — manual execution only

These files are **not** migrations and are **not** applied by Supabase CLI:

- `supabase/sql/apply_notes_rls_fix_if_needed.sql` — drops legacy `notes_*_own` policies and recreates the four intended policies. Run in **Supabase Dashboard → SQL Editor** if the audit shows legacy policies or RLS off.
- `supabase/sql/run_notes_rls_audit.sql` — audit queries (Query A + B). Run in SQL Editor to verify policies and RLS.
- `supabase/sql/audit_notes_rls_consultant.sql` — same purpose, alternative audit script.

**If** after deploy you still see legacy `notes_*_own` policies or `rls_enabled = false` on `public.notes`, run `apply_notes_rls_fix_if_needed.sql` once in the SQL Editor. Do **not** rely on these scripts being "deployed"; they must be executed manually.

---

## 6. Vercel deployment result

- **Vercel CLI:** Not run (install/auth may be required; deploy usually via Git push or `vercel` after commit).
- **Recommended flow:**
  1. **Commit** all app and config changes (including `app/api/notes/route.ts`, whoami, middleware, `lib/supabaseClient.ts`).
  2. **Push** to `origin/main` if Vercel is connected to the repo (auto-deploy), or run `npx vercel --prod` (or your usual command) after logging in.
- **Env:** Ensure the target Vercel project has:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Any server-side keys used by admin/whoami (e.g. service role only if used by admin routes).
- **Deployment URL / status:** To be filled after you run the deploy.

---

## 7. Post-deploy validation status

**Cannot be fully automated from Cursor.** After deploy, perform these checks on the **deployed** URL:

### A. Consultant user (e.g. administrador@funonso.com)
- [ ] `GET /api/debug/whoami` — returns `authSource: "cookie"` (or `"bearer"`), `jwt.sub` and `profile` with `app_role: "consultant"`.
- [ ] `GET /api/notes` — returns `[]`.
- [ ] `/notes` — shows no global notes.
- [ ] Dashboard — "Notas recientes" shows no global notes (empty or message).

### B. Superadmin user
- [ ] `GET /api/notes` — returns global notes when applicable.
- [ ] `/notes` — works as expected.

### C. Admin users page
- [ ] `/admin/users` — loads; users table and roles dropdown work.
- [ ] "Email (login)" or equivalent is visible if that change is in the deployed code.

---

## 8. Remaining manual steps

1. **Commit and push** (or deploy via Vercel CLI):
   - Add and commit: `app/api/notes/route.ts`, `app/api/debug/whoami/`, `middleware.ts`, and any other modified/new app files you want in production.
   - Push to `main` (or your deploy branch) or run `vercel` deploy.

2. **Optional DB audit:** In Supabase SQL Editor, run `run_notes_rls_audit.sql` (or Query A + B from `NOTES_RLS_VERIFICATION.md`). If legacy `notes_*_own` policies or RLS off are found, run `apply_notes_rls_fix_if_needed.sql` once.

3. **Post-deploy:** Run the checks in §7 (consultant, superadmin, admin users) on the live URL and confirm behavior.

---

## Summary

| Item                         | Status |
|-----------------------------|--------|
| Local build                 | ✅ Passed |
| Supabase migrations         | ✅ In sync; no push needed |
| Notes RLS migration applied | ✅ Yes (20260404110000) |
| SQL helper as migration     | ❌ No; manual run only if needed |
| App changes committed       | ⚠️ Pending (commit before deploy) |
| Vercel deploy               | ⚠️ Pending (after commit + push or CLI) |
| Post-deploy validation      | ⚠️ Manual on live URL |
