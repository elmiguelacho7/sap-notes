# Supabase project verification

## Task 1 — Active project used by the app

- **Source:** Next.js loads `.env.local` (and `.env`) at build/run time. The running app uses `process.env.NEXT_PUBLIC_SUPABASE_URL` and `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **To see the active project ref on your machine:** run  
  `node --env-file=.env.local scripts/print-project-ref.mjs`  
  It prints only the URL host and project ref (no secrets).
- **JWT issuer:** The Bearer token from Supabase Auth has an `iss` claim, e.g. `https://<projectRef>.supabase.co/auth/v1`. So `iss` contains the same project ref as `NEXT_PUBLIC_SUPABASE_URL` when the app and the token are for the same project.
- **CLI linked project:** After `supabase link`, the linked project ref is stored locally; `supabase migration list` and other CLI commands use that project. The scripts that use `--env-file=.env.local` use the **env** URL, which should match the linked project if you use the same .env for both.

## Task 2 — Debug route GET /api/debug/whoami

- **File:** `app/api/debug/whoami/route.ts`
- **Auth:** Same as `/api/notes`: `getAccessTokenFromRequest(req)` then user-scoped Supabase client with `Authorization: Bearer <token>`.
- **Response (safe only):**
  - `projectRef` — from `NEXT_PUBLIC_SUPABASE_URL`
  - `supabaseUrlHost` — host part of the URL
  - `jwt`: `{ sub, email, iss }` from the token payload
  - `profile`: `{ id, email, app_role, is_active }` or `null` (from `profiles` by `jwt.sub`)

**How to call:** From the browser while logged in, same way as `/api/notes` (e.g. from the notes page the session is already used). You can run in DevTools:

```js
const { data: { session } } = await supabase.auth.getSession();
const r = await fetch('/api/debug/whoami', { headers: { Authorization: `Bearer ${session?.access_token}` } });
console.log(await r.json());
```

Or open a page that does this and show the result.

## Task 3 — SQL in the same project

Run these in **Supabase Dashboard → SQL Editor** (project ref `tqdukdxtpwmuoqtpfsxt` or whatever `print-project-ref.mjs` shows):

**By user id (JWT sub):**
```sql
SELECT u.id AS auth_id, u.email AS auth_email, p.id AS profile_id, p.email AS profile_email,
  p.full_name, p.app_role, p.is_active
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.id = '1acc2b99-6fe0-49f5-b28d-15f33d85abcb2';
```

**By email:**
```sql
SELECT u.id AS auth_id, u.email AS auth_email, p.id AS profile_id, p.email AS profile_email,
  p.full_name, p.app_role, p.is_active
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE lower(u.email) = lower('administrator@funonso.com');
```

Full script: `supabase/scripts/verify_admin_direct.sql`.

## Task 4 — Root cause

| Case | Meaning |
|------|--------|
| **A** | App uses a **different** Supabase project than the one audited (different project ref / JWT iss). |
| **B** | Same project; JWT user exists in `auth.users` but **no** row in `public.profiles`. |
| **C** | Same project; user has profile with **app_role = superadmin** → global notes for that user are correct. |
| **D** | Same project; user has profile with **app_role = consultant** → global notes for that user are wrong; RLS/auth must be checked. |

## Task 5 — Minimal safe fix

- **A:** Report mismatch; do not apply DB fixes to the wrong project; identify which project the app uses (whoami + print-project-ref).
- **B:** Create the missing profile for that auth user id (default `app_role = 'consultant'`, `is_active = false`). SQL in `verify_admin_direct.sql` (Task 5 block).
- **C:** No RLS change; report that `/api/notes` behavior was correct for the logged-in user.
- **D:** Report the inconsistency; do not change RLS without understanding why it failed.

## Task 6 — Checklist

1. Active Supabase URL/project ref → run `print-project-ref.mjs`.
2. JWT `iss` / project ref in browser → from whoami or decoded JWT.
3. Match? → same project ref in both.
4. Output of `/api/debug/whoami` → call it with current session; paste JSON.
5. User id in auth/profiles? → run the two SQL queries above in Dashboard.
6. Root cause → A/B/C/D from the table above.
7. Minimal fix → apply per case as above.
