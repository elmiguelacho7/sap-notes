# Invitations Flow — Validation Runbook

Use this runbook to validate the three scenarios and collect evidence for the final root-cause report. Do not remove investigation logs until the final diagnosis is confirmed.

---

## Prerequisites

- Dev server running: `npm run dev`
- Terminal/log viewer for server stdout (Next.js server logs)
- Browser DevTools → Network tab and Console tab
- Access to Supabase Dashboard → SQL Editor (or `psql` / Supabase CLI) for Scenario 3 SQL

**Test data:**

- **Existing user email:** An email that already has an account (e.g. your own or a test user in `profiles`).
- **New email:** An email that does NOT exist in `profiles` (e.g. `newinvite-test-123@example.com`).
- **Project ID:** Pick one project where you have "manage members" (e.g. from the URL `/projects/<PROJECT_ID>/members`). Use the same project for all scenarios.

---

## Scenario 1 — Existing User Email

**Goal:** Confirm that adding an existing user goes through the direct-member path and does not create a pending invitation.

### Steps

1. Open `/projects/<PROJECT_ID>/members`.
2. Open DevTools → Network. Filter by "invitations" or "Fetch/XHR".
3. In the add-member form, enter the **existing user email** and a role. Submit.
4. In Network, find the **POST** to `/api/projects/<PROJECT_ID>/invitations`. Open it → **Response** (or Preview).

### Check — POST response

- [ ] `mode` = `"direct_member_add"`
- [ ] `success` = `true`
- [ ] `added` = `true`
- [ ] `invited` = `false`

### Check — Server logs (terminal where `npm run dev` runs)

- [ ] Line containing `[INVESTIGATION][project invitations POST] findUserIdByEmail result ... targetUserId=<uuid>` (not null)
- [ ] Line containing `[INVESTIGATION][setProjectMember] start ...`
- [ ] Line containing `[INVESTIGATION][setProjectMember] success ...`

### Check — UI

- [ ] Success message explains that the user was added directly (e.g. "El usuario ya existía y fue añadido directamente al equipo" or similar).
- [ ] The user appears in the **Miembros del equipo** table.
- [ ] **Invitaciones pendientes** still shows "No hay invitaciones pendientes" (and the hint text).

### Check — GET invitations (optional)

- [ ] After the flow, in Network find **GET** `/api/projects/<PROJECT_ID>/invitations`. Response body: `{ "invitations": [] }` or empty array is **expected** for this scenario.

### Scenario 1 result (fill in)

- **PASS / FAIL:**  
- **Notes / evidence (paste or summarize):**  

---

## Scenario 2 — New Email

**Goal:** Confirm that adding a new email creates a pending invitation and it appears in the list.

### Steps

1. Open `/projects/<PROJECT_ID>/members` (same project as Scenario 1).
2. DevTools → Network and Console open.
3. In the add-member form, enter the **new email** (not in platform) and a role. Submit.
4. In Network, find the **POST** to `/api/projects/<PROJECT_ID>/invitations`. Open → **Response**.

### Check — POST response

- [ ] `mode` = `"pending_invitation"`
- [ ] `success` = `true`
- [ ] `invited` = `true`
- [ ] `invitationCreated` = `true`
- [ ] `invitationId` = `<uuid>`

### Check — Server logs

- [ ] Line containing `[INVESTIGATION][project invitations POST] pending_invitation created ... invitationId=...`
- [ ] No `[INVESTIGATION][setProjectMember]` lines for this request (direct add not used).

### Check — GET invitations (server)

- [ ] After POST, a GET to `/api/projects/<PROJECT_ID>/invitations` runs (e.g. from `loadInvitations()`).
- [ ] Server log: `[INVESTIGATION][getProjectPendingInvitations] projectId=... count=1` (or count >= 1). If count=0, note it for Scenario 3.

### Check — Frontend (Console)

- [ ] Log: `[INVESTIGATION][members page invitations GET] projectId=... raw=...` with `raw.invitations` an array of length >= 1.
- [ ] Log: `[INVESTIGATION][members page invitations GET] projectId=... invitationsLength=1` (or >= 1).

### Check — UI

- [ ] Success message explains that a pending invitation was created.
- [ ] **Invitaciones pendientes** table shows one row for the new email (role, "Pendiente", date, Revocar).

### Scenario 2 result (fill in)

- **PASS / FAIL:**  
- **Notes / evidence (paste or summarize):**  
- If FAIL: did POST return pending_invitation? Did GET return count=0? Did frontend show invitationsLength=0?  

---

## Scenario 3 — Failure with New Email (only if Scenario 2 failed)

**Goal:** Determine whether the failure is in insert, query/filter, frontend refresh, or a hidden backend error.

### 1. POST response body

- Copy the full JSON response of **POST** `/api/projects/<PROJECT_ID>/invitations` when using the new email. Paste or summarize below.

**POST response (paste/summary):**  

### 2. POST server logs

- Copy all lines containing `[INVESTIGATION][project invitations POST]` for that request.

**POST logs (paste):**  

### 3. GET invitations server logs

- Copy lines containing `[INVESTIGATION][getProjectPendingInvitations]` for the GET that runs after the POST (same project).

**GET server logs (paste):**  

### 4. Frontend invitations GET logs

- Copy the two console lines: `[INVESTIGATION][members page invitations GET] projectId=... raw=...` and `... invitationsLength=...`.

**Frontend GET logs (paste):**  

### 5. Database — run in Supabase SQL Editor

Replace `<PROJECT_ID>` with the actual UUID you used (e.g. from the URL).

**Query 1 — all invitations for the project:**

```sql
select id, project_id, email, role, status, expires_at, accepted_at, created_at
from public.project_invitations
where project_id = '<PROJECT_ID>'
order by created_at desc
limit 20;
```

**Query 2 — pending and non-expired only (what the API uses):**

```sql
select id, project_id, email, role, status, expires_at, accepted_at, created_at
from public.project_invitations
where project_id = '<PROJECT_ID>'
  and status = 'pending'
  and expires_at > now()
order by created_at desc;
```

**Query 1 result (row count and one sample row if any):**  
**Query 2 result (row count and one sample row if any):**  

### Compare

- If Query 1 has a row for the new email but Query 2 has no rows: the row is either not `status = 'pending'` or `expires_at` is not in the future. Compare `status`, `expires_at` and server log `now=...`.
- If Query 1 has no row: the insert path failed or wrote to another project/table.
- If Query 2 has rows but GET returned count=0: backend query/error path (e.g. Supabase error logged in getProjectPendingInvitations).
- If GET returned count>=1 but UI showed empty: frontend state/refresh or wrong response parsing.

**Scenario 3 conclusion (which layer is failing):**  

---

## Final report template

After completing the scenarios, fill the report below (or in `docs/INVITATIONS_FINAL_ROOT_CAUSE_REPORT.md`).

1. **Scenario 1 result:** PASS / FAIL — (one line summary).
2. **Scenario 2 result:** PASS / FAIL — (one line summary).
3. **Scenario 3 result (if applicable):** N/A or (PASS/FAIL and which layer failed).
4. **Confirmed runtime evidence:** (bullet list of what you observed).
5. **Final root cause:** (one short paragraph).
6. **Is a code fix actually needed?** Yes / No.
7. **Smallest safe next step:** (e.g. "Remove investigation logs only" or "Fix X in file Y" or "Run SQL migration to fix status/expires_at" etc.).

**Decision rule applied:**

- If both Scenario 1 and 2 passed → original issue was primarily UX misunderstanding; next step: remove investigation logs.
- If Scenario 2 failed → use Scenario 3 evidence to state exact failing layer (insert / query-filter / frontend / hidden backend error) and recommend smallest fix.

---

*Do not remove investigation logs until this report is completed and the next step is agreed.*
