# Administrator identity — final manual verification

**Project:** tqdukdxtpwmuoqtpfsxt  
**User:** administrator@funonso.com  
**Normalized UUID:** `1acc2b99-6fe0-49f5-b28d-15f33d85abcb`

---

## Task 1 — Final manual steps

### A. Browser / current session check

1. Log in as **administrator@funonso.com**.
2. Open the **browser console** (F12 → Console).
3. Ensure the app has a Supabase client in scope (e.g. from the same origin). Run:

```javascript
const { data: { session } } = await supabase.auth.getSession();
const r = await fetch('/api/debug/whoami', {
  headers: { Authorization: `Bearer ${session?.access_token}` }
});
console.log(await r.json());
```

4. Copy the **exact JSON** output.

---

### B. SQL Editor check (Supabase project tqdukdxtpwmuoqtpfsxt)

1. Open **Supabase Dashboard** → project **tqdukdxtpwmuoqtpfsxt** → **SQL Editor**.
2. Run **Query A**:

```sql
SELECT
  u.id AS auth_id,
  u.email AS auth_email,
  p.id AS profile_id,
  p.email AS profile_email,
  p.full_name,
  p.app_role,
  p.is_active
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE lower(u.email) = lower('administrator@funonso.com');
```

3. Copy the **exact result** (row(s) or “0 rows”).
4. Run **Query B**:

```sql
SELECT
  u.id AS auth_id,
  u.email AS auth_email,
  p.id AS profile_id,
  p.email AS profile_email,
  p.full_name,
  p.app_role,
  p.is_active
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.id = '1acc2b99-6fe0-49f5-b28d-15f33d85abcb';
```

5. Copy the **exact result** (row(s) or “0 rows”).

---

## Task 2 — Interpretation rules

| Case | Condition | Meaning | Action |
|------|-----------|---------|--------|
| **B** | Auth row exists, **profile row missing** (profile_id is null) | Missing profile for this user | Apply Case B fix: insert missing profile (consultant, inactive). |
| **C** | Profile exists, **app_role = 'superadmin'** | Superadmin has global access | No change. /api/notes returning global notes is **correct**. |
| **D** | Profile exists, **app_role = 'consultant'** | Consultant should not see global notes | Do not change profile automatically. /api/notes returning global notes is **incorrect**; review RLS/auth path. |

- **Case B:** auth row exists, profile row missing → fix: insert missing profile with consultant + inactive by default.
- **Case C:** profile exists, app_role = superadmin → /api/notes returning global notes is correct.
- **Case D:** profile exists, app_role = consultant → /api/notes returning global notes is incorrect and needs further review.

---

## Task 3 — Case B insert SQL (use only if Query A or B shows auth row exists and profile_id is null)

Run **only** when:
- Query A or Query B returns a row with **auth_id** and **auth_email** set, and **profile_id** is null.

```sql
INSERT INTO public.profiles (id, email, full_name, app_role, is_active)
SELECT
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    au.raw_user_meta_data->>'name'
  ),
  'consultant',
  false
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE au.id = '1acc2b99-6fe0-49f5-b28d-15f33d85abcb'
  AND p.id IS NULL
ON CONFLICT (id) DO NOTHING
RETURNING id, email, full_name, app_role, is_active;
```

- **id** = auth.users.id  
- **email** = auth.users.email  
- **full_name** = from auth metadata if available, otherwise null  
- **app_role** = 'consultant'  
- **is_active** = false  

After running this, call **GET /api/debug/whoami** again and confirm `profile` is no longer null.

---

## Task 4 — Final response template (paste back)

Copy the block below, fill it in, and paste it back.

```
1. whoami JSON:
[paste here]

2. Query A result:
[paste here]

3. Query B result:
[paste here]

4. Case:
B / C / D

5. Minimal fix applied:
[paste here]

6. Was /api/notes correct for administrator@funonso.com?
Yes / No

7. Is the identity issue closed?
Yes / No
```
