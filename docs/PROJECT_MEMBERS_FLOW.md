# Project Members & Invitations Flow

This document summarizes the final behavior of the project member add / invite flow in the **Equipo** tab, including the three possible response modes and when `project_members` vs `project_invitations` are used.

---

## Purpose

Allow project managers to add people to a project by email while keeping behavior clear and predictable for:

- **Existing platform users** (already have a profile).
- **New emails** (no profile yet → invitation).
- **Users already in the project** (avoid duplicate membership).

Backend entrypoint: `POST /api/projects/[id]/invitations` with `{ email, role }`. Requires `manage_project_members` on the project.
Frontend entrypoint: `/projects/[id]/members` → \"Añadir miembro\" form.

---

## Decision flow and response modes

The API implements a three-step decision tree with **three explicit modes**:

1. **Existing platform user?**
   - Look up user id: `findUserIdByEmail(email)`.

2. **If existing user: already a member of this project?**
   - Check `project_members` via `isUserProjectMember(projectId, userId)` (by `project_id` + `user_id`).

3. **Decide which mode applies:**

### Mode: `already_member`

Conditions:

- Email belongs to an existing user (`findUserIdByEmail` found a `userId`), **and**
- `isUserProjectMember(projectId, userId)` returned **true**.

Behavior:

- **No change** in `project_members` (no upsert, no new row).
- **No row** created in `project_invitations`.
- Response (additive, backwards-safe):

```json
{
  "success": true,
  "mode": "already_member",
  "added": false,
  "invited": false,
  "alreadyMember": true,
  "message": "El usuario ya pertenece a este proyecto."
}
```

Why this mode exists:

- Prevents unnecessary writes for users already assigned to the project.
- Makes it clear in the UI that **\"nothing changed\"** because the user was already in the team.

### Mode: `direct_member_add`

Conditions:

- Email belongs to an existing user, **and**
- `isUserProjectMember(projectId, userId)` returned **false**.

Behavior:

- Uses `project_members` only:
  - Calls `setProjectMember(projectId, userId, role)` (upsert by `project_id,user_id`). 
- **No row** created in `project_invitations`.
- Response:

```json
{
  "success": true,
  "mode": "direct_member_add",
  "added": true,
  "invited": false,
  "message": "El usuario ya existía y fue añadido directamente al equipo."
}
```

Why existing users do **not** appear in pending invitations:

- They already have accounts and can be added directly; there is no need for a separate invitation row. They appear immediately in `project_members` and in the \"Miembros del equipo\" table.

### Mode: `pending_invitation`

Conditions:

- `findUserIdByEmail(email)` returns **no user** for this email.

Behavior:

- Uses `project_invitations`:
  - Calls `createProjectInvitation(projectId, email, role, invitedBy)` which inserts a **pending**, non-expired row into `public.project_invitations` with a token and expiry.
- No direct change in `project_members` at this point; membership will be created later when the invitation is accepted.
- Response (variants share the same mode):

```json
{
  "success": true,
  "mode": "pending_invitation",
  "invited": true,
  "added": false,
  "invitationCreated": true,
  "invitationId": "<uuid>",
  "emailSent": true|false,
  "actionLink": "https://.../invite?token=...",
  "message": "Se creó una invitación pendiente..." 
}
```

Why new emails **do** appear in pending invitations:

- They have no profile yet; the only representation of their relationship to the project is the `project_invitations` row. The \"Invitaciones pendientes\" section reads exactly those pending, non-expired rows.

---

## When each table is used

- **`project_members`**
  - Existing platform user added via `direct_member_add`.
  - Also updated when an invitation is accepted (invitation accept flow, not covered in detail here).

- **`project_invitations`**
  - New email invited via `pending_invitation`.
  - Holds `status = 'pending' | 'accepted' | 'revoked' | 'expired'` and `expires_at`.
  - Only rows with `status = 'pending'` and `expires_at > now()` appear in the "Invitaciones pendientes" list.

---

## Why `already_member` prevents duplicate assignment

- Before calling `setProjectMember`, the API now explicitly checks `isUserProjectMember(projectId, userId)`.
- If the user is already in `project_members` for this project, it **returns `mode: "already_member"` and does nothing else**:
  - No second upsert into `project_members`.
  - No extra `project_invitations` row.
- This keeps the data model clean and explains to the user why they don't see a change: the user was already on the team.

---

## Validation checklist

Use this as a quick validation checklist for the flow.

### Case 1 — Existing user not yet in project → `direct_member_add`

- **Setup:** Email belongs to a platform user; user is **not** currently in `project_members` for this project.
- **API:** `POST /api/projects/[id]/invitations` → `mode = "direct_member_add"`, `success = true`, `added = true`, `invited = false`.
- **UI:** Success message; user appears in "Miembros del equipo"; no new row in "Invitaciones pendientes".
- **DB:** Row in `project_members`; no new row in `project_invitations` for that email/project.

### Case 2 — Existing user already in project → `already_member`

- **Setup:** Email belongs to a platform user; user is **already** in `project_members` for this project.
- **API:** `POST /api/projects/[id]/invitations` → `mode = "already_member"`, `success = true`, `added = false`, `alreadyMember = true`.
- **UI:** Informational message; members list unchanged; no row in "Invitaciones pendientes".
- **DB:** `project_members` unchanged; no new `project_invitations` row.

### Case 3 — New email (no user) → `pending_invitation`

- **Setup:** Email does **not** belong to any platform user.
- **API:** `POST /api/projects/[id]/invitations` → `mode = "pending_invitation"`, `success = true`, `invited = true`, `invitationId` present.
- **UI:** Success copy; pending invitations table shows a new row for that email (status "Pendiente").
- **DB:** New row in `project_invitations` with `status = 'pending'` and `expires_at > now()`; no row yet in `project_members`.

---

## Pending invitation listing and schema

Pending invitation listing depends on the **real** `project_invitations` schema. The table does **not** have a `created_at` column; it has `invited_at`, `updated_at`, `accepted_at`, and `expires_at`. The listing service (`getProjectPendingInvitations`) was fixed to use **`updated_at`** for select and ordering instead of the invalid `created_at`. The "Creada" column in the UI now displays `updated_at`. As an optional future improvement, the API could expose **`invited_at`** for "invitation sent at" semantics if desired; no migration has been added for `created_at`.
