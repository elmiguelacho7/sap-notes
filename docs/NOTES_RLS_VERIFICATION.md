# Global notes RLS verification — final checklist

After the app-level consultant guard is in place, verify database-level defense in depth.

---

## Step 1 — Run the audit SQL

1. Open **Supabase Dashboard** → your project → **SQL Editor**.
2. Open **`supabase/sql/run_notes_rls_audit.sql`** (or paste the two queries below).
3. Run **Query A**, then **Query B**. Copy the **exact** results.

**Query A — active policies:**

```sql
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notes'
ORDER BY policyname;
```

**Query B — RLS enabled:**

```sql
SELECT c.relname, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'notes' AND c.relkind = 'r';
```

---

## Step 2 — Classify database state

Use the results from Step 1:

| Classification | Condition |
|----------------|-----------|
| **A** | Query B: `rls_enabled = false` → RLS is **disabled** on `public.notes`. |
| **B** | Query B: `rls_enabled = true`, but Query A: the **SELECT** policy’s `qual` does **not** restrict global notes to superadmin only (e.g. it allows `created_by = auth.uid()` or all authenticated for `project_id IS NULL`). |
| **OK** | Query B: `rls_enabled = true`, and Query A: the SELECT policy has a branch like `(project_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin'))` with no other permissive branch for global notes. Project notes remain scoped to member/owner/superadmin. |

---

## Step 3 — Apply DB fix only if A or B

- If **OK**: do nothing.
- If **A** or **B**: run the full contents of **`supabase/sql/apply_notes_rls_fix_if_needed.sql`** in the SQL Editor. It enables RLS (if off) and recreates the correct policies (idempotent).

---

## Step 4 — Re-test as consultant

As **administrador@funonso.com** (consultant):

- **GET /api/notes** → must return `[]`.
- **/notes** → must show no global notes.

---

## Step 5 — Final output template

Fill this in and keep for records:

```
1. Exact result of Query A:
[paste table: schemaname, tablename, policyname, cmd, qual, with_check]

2. Exact result of Query B:
[paste one row: relname, rls_enabled, force_rls]

3. Classification: A / B / OK

4. DB fix needed? Yes / No

5. DB fix applied? Yes / No / N/A

6. Final result for administrador@funonso.com:
   GET /api/notes: []
   /notes: no global notes
   [Yes / No]

7. Leakage fully closed in both app and DB? Yes / No
```

---

## Quick reference — correct SELECT policy (qual)

For **OK**, the SELECT policy on `public.notes` should include:

- **Global notes:** `(project_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin'))`
- **Project notes:** `(project_id IS NOT NULL AND (… project member or owner or superadmin …))`

No other branch should allow authenticated users who are not superadmin to see rows with `project_id IS NULL`.
