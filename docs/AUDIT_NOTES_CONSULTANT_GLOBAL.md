# Audit: Consultant receiving global notes (GET /api/notes)

## Objective

A consultant user (administrador@funonso.com, id `1acc2b99-6fe0-49f5-b28d-15f33d85abc2`, app_role: consultant) must **not** receive notes where `project_id IS NULL` (global notes). This audit identifies why they could and applies the minimal fix.

---

## Task 1 — Active RLS policies on public.notes

Run in **Supabase Dashboard → SQL Editor** (project same as app):

```sql
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notes'
ORDER BY policyname;
```

Or run the full script: **`supabase/sql/audit_notes_rls_consultant.sql`**.

**Correct behaviour:**

- **Global notes (project_id IS NULL):** only users with `profiles.app_role = 'superadmin'` (i.e. the policy must require `EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin')` for `project_id IS NULL`).
- **Project notes:** visible to project owner, project members, or superadmin.

If the SELECT policy for global notes allows anything else (e.g. all authenticated, or `created_by = auth.uid()` without superadmin-only), consultants can see global notes → **Root cause B**.

---

## Task 2 — RLS enabled on public.notes

```sql
SELECT c.relname, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'notes' AND c.relkind = 'r';
```

- **rls_enabled = false** → consultants can see all rows → **Root cause A** (RLS disabled).
- **rls_enabled = true** → RLS is on; then inspect policies (Task 1).

---

## Task 3 — /api/notes implementation (relevant path)

- **Client:** `createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: Bearer <token> } } })` — anon key only, user JWT in header.
- **No service_role** in this route; token comes from `getTokenAndSource` (Bearer or cookie).
- **Profile and notes** both use the same user-scoped client (same token).
- **Notes query:** `.from("notes").select("*").is("project_id", null).is("deleted_at", null).order("created_at", { ascending: false })`.
- **Consultant guard:** If `profile.app_role === 'consultant'`, the route returns `[]` without querying notes (defense in depth).

So the query runs as the authenticated user; if a consultant still received global notes before the guard, the cause is RLS (A or B), not wrong client (C).

---

## Task 4 — Debug output

When calling GET /api/notes, the server logs (e.g. in the terminal running `next dev`):

- **authSource:** `"bearer"` | `"cookie"` | `"none"`
- **jwtSub:** JWT `sub` (user id)
- **jwtEmail:** JWT `email`
- **app_role:** from `profiles`
- **notesCount:** number of notes returned (0 for consultant after fix)
- **noteIds:** array of note ids (empty for consultant after fix)
- **guard:** `"consultant_return_empty"` when the consultant short-circuit runs

For **administrador@funonso.com** (consultant) you should see `guard: "consultant_return_empty"`, `notesCount: 0`, `noteIds: []`, and response body `[]`.

---

## Root cause classification (Task 5)

| Code | Meaning |
|------|--------|
| **A** | RLS on public.notes is disabled |
| **B** | Active notes policies are wrong/permissive (e.g. global notes not restricted to superadmin) |
| **C** | /api/notes was not querying as the authenticated user (wrong client/token) |
| **D** | Another path bypasses restrictions |

From the codebase: (C) is ruled out — the route uses the user token and a single user-scoped client. So the cause is **A** or **B** (or D if another code path serves global notes). Run the SQL in Task 1 and 2 to confirm.

---

## Minimal fix applied (Task 6)

1. **Application guard (done):** In `app/api/notes/route.ts`, if `app_role === 'consultant'`, the handler returns `[]` without querying notes. So consultants never receive global notes from this route, regardless of RLS state.
2. **RLS (if A or B):**  
   - **If A:** Enable RLS: `ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;` then ensure the correct policies exist (see migration below).  
   - **If B:** Apply or re-apply the policy that restricts global notes to superadmin. The intended definition is in **`supabase/migrations/20260404110000_notes_global_superadmin_only.sql`**. Run that migration in the project (or run its contents in the SQL Editor) so the active SELECT policy for global notes is superadmin-only.

---

## Re-test (Task 7)

As **administrador@funonso.com** (consultant):

- **GET /api/notes** → must return `[]`.
- **/notes** page → must show no global notes.

Server log should show `guard: "consultant_return_empty"`, `notesCount: 0`, `noteIds: []`.

---

## Final output template (Task 8)

1. **Active RLS policies on public.notes**  
   [Paste result of Task 1 SQL]

2. **RLS enabled on public.notes?**  
   [rls_enabled true/false from Task 2]

3. **Relevant /api/notes code path**  
   User-scoped client with Bearer/cookie token; profile fetch then consultant guard (return []); then notes query with `project_id IS NULL`, `deleted_at IS NULL`. No service_role.

4. **Root cause:** A / B / C / D  
   [One of the four]

5. **Minimal fix applied**  
   Consultant guard in GET /api/notes; [if applicable] RLS enabled or migration 20260404110000 applied.

6. **Re-test with administrador@funonso.com**  
   GET /api/notes returns []; /notes shows no global notes. [Yes/No]

7. **Leakage closed?**  
   Yes / No
