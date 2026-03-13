# Invitations Flow — Final Root Cause Report

**Purpose:** Record the outcome of the controlled validation (Scenarios 1–3) and the final diagnosis.

**How to use:** Run the scenarios using `docs/INVITATIONS_VALIDATION_RUNBOOK.md`, then fill in the runtime result sections below. The root cause and fix are already confirmed and documented in sections 5–7.

---

## 1. Scenario 1 result

**Existing user email — direct member add.**

| Check | Result |
|-------|--------|
| POST response: `mode` = `direct_member_add`, `added` = true | ☐ PASS / ☐ FAIL |
| UI: success message + user in team members; pending invitations empty | ☐ PASS / ☐ FAIL |

**Summary:** *(e.g. PASS — existing user was added directly; no invitation row; GET count=0 as expected.)*

---

## 2. Scenario 2 result

**New email — pending invitation created and visible.**

| Check | Result |
|-------|--------|
| POST response: `mode` = `pending_invitation`, `invitationId` present | ☐ PASS / ☐ FAIL |
| GET invitations: returns at least one row | ☐ PASS / ☐ FAIL |
| UI: invitation row visible in "Invitaciones pendientes" | ☐ PASS / ☐ FAIL |

**Summary:** *(e.g. PASS — new email created invitation; GET returned it; UI showed it.)*

---

## 3. Scenario 3 result (if Scenario 2 failed)

**Only fill this section if Scenario 2 did not behave as expected.**

| Evidence | Captured |
|----------|----------|
| POST response body (mode, invitationId, success) | ☐ Yes — *(paste or summarize)* |
| GET response (invitations array length) | ☐ Yes — *(paste or summarize)* |
| Server logs (getProjectPendingInvitations error?) | ☐ Yes — *(paste or summarize)* |

**Failing layer (choose one):**

- ☐ **a) Insert path** — POST succeeded but no row in `project_invitations` for this project/email.
- ☐ **b) Query path** — Row exists but GET returns empty (e.g. Supabase error; listing query wrong).
- ☐ **c) Frontend** — GET returns non-empty but UI does not show the row.

**Summary:** *(one paragraph describing where the flow broke.)*

---

## 4. Confirmed runtime evidence

*(Bullet list of concrete facts from the run: response fields, UI state. Fill after manual validation.)*

-
-
-

---

## 5. Final root cause

**Confirmed root cause (listing bug):**

- The table `public.project_invitations` **does not have a `created_at` column**. The schema has `invited_at`, `updated_at`, `accepted_at`, and `expires_at` (see migrations `20250602190000_project_invitations.sql` and `20250602230000_project_invitations_token_expiry.sql`).
- The listing function `getProjectPendingInvitations` in `lib/services/invitationService.ts` was **selecting and ordering by `created_at`**.
- The Supabase query therefore **failed** (invalid column).
- The service **caught the error and returned `[]`**, so the API still returned 200 with `invitations: []`.
- The UI showed "No hay invitaciones pendientes" even when a pending invitation had just been created (POST returned `mode: "pending_invitation"` and a valid `invitationId`).

No business logic or invitation modes were wrong; the failure was purely in the listing query and its error handling (masked by returning an empty array).

---

## 6. Fix applied

**Yes** — The following minimal fix was applied:

- **Listing service (`lib/services/invitationService.ts`):**
  - Replaced `created_at` with **`updated_at`** in the `select(...)` and `order(...)` for `getProjectPendingInvitations`.
  - Updated the TypeScript return type and row cast to use `updated_at` instead of `created_at`.
  - Kept user-facing behavior stable (return `[]` on error) but added **`console.error("getProjectPendingInvitations failed", error)`** so the cause is visible in development.
- **Members page (`app/(private)/projects/[id]/members/page.tsx`):**
  - `PendingInvitation` type and the "Creada" column now use **`updated_at`** to match the API response.

No business flow changes, no RLS changes, no new migrations. Invitation modes (`already_member`, `direct_member_add`, `pending_invitation`) remain unchanged.

---

## 7. Smallest safe next step (completed)

- **Done:** Use `updated_at` instead of `created_at` in the pending-invitations listing query and UI.
- **Optional future improvement:** Consider adding a `created_at` column to `project_invitations` in a later migration for schema consistency and clearer "created at" semantics; not required for correctness. Alternatively, the UI could use `invited_at` for "invitation sent at" if that column is exposed by the API later.

---

## Decision rule applied

- **If Scenario 1 and Scenario 2 both PASS:** The listing fix is validated. The issue is fully resolved.
- **If Scenario 2 FAILS:** Use Scenario 3 evidence to identify any remaining failing layer and address in a follow-up change.

---

*After manual validation, mark the scenario results above and keep this report for future reference.*
