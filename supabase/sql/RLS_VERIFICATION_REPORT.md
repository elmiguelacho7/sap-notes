# project_tasks RLS verification report

Use this after running the diagnostic SQL and retesting in the app.

## 1. Diagnostic SQL

Run the script **Supabase Dashboard → SQL Editor**:

- **File:** `supabase/sql/diagnose_project_tasks_rls.sql`
- Run **Section 1** to get `my_auth_uid`.
- Run **Section 2** to get your `profile_id` (or confirm profile exists).
- Run **Section 5** to list projects where you are a member; pick a `project_id` for testing.
- Run **Section 3** (with that `project_id`) to confirm membership for that project.
- Run **Section 4** to list all policies on `project_tasks`.

## 2. Paste outputs here (steps 1–5 from SQL Editor)

### Step 1 – auth.uid()
```
(paste result row: my_auth_uid)
```

### Step 2 – profile
```
(paste result: profile_id, full_name, email, app_role)
```

### Step 3 – membership for test project (replace placeholder uuid in SQL first)
```
(paste result: id, project_id, user_id, profile_id, role, my_auth_uid, membership_check_passes)
```

### Step 4 – policies on project_tasks
```
(paste result: policyname, permissive, roles, cmd, qual_preview, with_check_preview)
```

### Step 5 – projects I am a member of
```
(paste result: project_id, name, user_id, profile_id, role, i_am_member)
```

## 3. Report (fill in after running)

### Membership present?

- [ ] **Yes** – Section 3 returned at least one row for my test project, and `membership_check_passes` is true (or `user_id`/`profile_id` matches my auth uid).
- [ ] **No** – Section 3 returned no rows → add yourself via Section 6 (or app/API) then retest.

### Policies present?

List the policy names and commands from Section 4:

| policyname | cmd |
|------------|-----|
| Allow select project tasks for members | SELECT |
| Allow insert project tasks for members | INSERT |
| Allow update project tasks for members | UPDATE |
| Allow delete project tasks for members | DELETE |

(If you see different names or fewer than 4 rows, note the actual output.)

### App test result

- [ ] **Pass** – Created a task in a project where I am a member; no 42501; row appears.
- [ ] **Fail** – Exact error (copy from UI or console):

```
(paste exact error message here)
```

If it’s a constraint (NOT NULL, FK, etc.), check the `[createTask] payload` in the browser console and confirm all required fields are set.

## 4. If still failing

- **42501** → RLS: confirm membership (Section 3) and that policies use `project_tasks_is_project_member` (Section 4).
- **NOT NULL / FK** → Fix payload in app (e.g. `activity_id`, `title`) or schema.
- **Other table** → Repeat policy check for that table (e.g. `project_activities` if the error points there).
