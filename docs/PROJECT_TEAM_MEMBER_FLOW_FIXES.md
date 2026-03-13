# Project Team Member / Invite Flow – Audit and Fixes

This document describes the add-member and invite-user flow in the project "Equipo" tab, the issues found, and the fixes applied.

## 1. Flow overview

**Entry:** Project → Equipo tab → "Añadir miembro" form (email + role) → "Añadir al equipo".

**Backend:** `POST /api/projects/[id]/invitations` with `{ email, role }`. Requires `manage_project_members` on the project.

**Branching:**

1. **Existing user (email in platform):** Add to `project_members` with chosen role → return `{ added: true }` → frontend refreshes members list.
2. **New user (email not in platform):** Create row in `project_invitations` with token → try to send email → return either:
   - Email sent: `{ invited: true, invitationId, emailSent: true }`
   - Email not sent but link generated: `{ invited: true, invitationId, emailSent: false, actionLink, message }`
   - Link not generated (missing env): `{ invited: true, invitationId, emailSent: false, message }` (no `actionLink`).

## 2. Root causes of “silent” or broken behavior

1. **Invite link empty in dev:** The API excluded `request.nextUrl.origin` when it contained `"localhost"`, so in local dev no base URL was used and `inviteLink` was often `""`. The response was `invited: true` with `actionLink: undefined`, so the UI showed “Invitación enviada” but no way to get the link.
2. **Unclear success copy:** The frontend always showed “Invitación enviada.” for any `invited: true`, even when the email was not sent or the link was missing.
3. **No handling of unexpected 200:** If the response was 200 but neither `added` nor `invited` was set (e.g. bad or empty JSON), the UI did nothing: no success, no error, no refresh.
4. **403 not specific:** On 403 the UI showed a generic “Error al añadir el miembro” instead of “No tiene permiso para gestionar miembros.”
5. **Duplicate invitations:** The API did not check for an existing pending invitation for the same project + email, so duplicate invites were possible and feedback was unclear.
6. **No email format check:** The frontend did not validate email format before calling the API.

## 3. Response contract (after fixes)

| Scenario | HTTP | Response body |
|----------|------|----------------|
| Member added (existing user) | 200 | `{ added: true, message: "Usuario añadido al proyecto correctamente." }` |
| Invitation created, email sent | 200 | `{ invited: true, invitationId, emailSent: true, message: "Invitación creada y correo enviado." }` |
| Invitation created, email not sent, link available | 200 | `{ invited: true, invitationId, emailSent: false, actionLink, message: "Invitación creada; no se pudo enviar el correo. Usa el enlace de abajo..." }` |
| Invitation created, link not generated | 200 | `{ invited: true, invitationId, emailSent: false, message: "Invitación creada pero no se pudo generar el enlace (configura NEXT_PUBLIC_SITE_URL...). Revisa la sección «Invitaciones pendientes»." }` |
| Validation (missing email/role, invalid role) | 400 | `{ error: "..." }` |
| Duplicate pending invitation | 400 | `{ error: "Ya existe una invitación pendiente para este correo..." }` |
| No permission | 403 | `{ error: "..." }` (frontend shows “No tiene permiso para gestionar miembros.”) |
| Internal error | 500 | `{ error: "..." }` |

## 4. Email sending

- **Implementation:** `lib/email/sendInvitationEmail.ts` uses **Resend** when `RESEND_API_KEY` is set.
- **When not configured:** If `RESEND_API_KEY` is missing or empty, `sendInvitationEmail` returns without throwing. The API then returns `invited: true` with `emailSent: false` and, when possible, `actionLink`.
- **When configured but send fails:** The API catches the error, logs it, and still returns `invited: true` with `actionLink` so the user can share the link.
- **Conclusion:** No email is sent unless Resend is configured. The flow is **fallback-based**: when email is not sent, the UI must show the invitation link or the message that the link could not be generated.

## 5. Files changed

| File | Change |
|------|--------|
| `app/api/projects/[id]/invitations/route.ts` | Use `request.nextUrl?.origin` even for localhost so the invite link is generated in dev when no env URL is set. Added duplicate-invitation check (existing pending same project+email → 400). Explicit response bodies: `message` and `emailSent` for all branches; when link is missing, return a clear `message` without `actionLink`. |
| `app/(private)/projects/[id]/members/page.tsx` | Frontend: 403 → “No tiene permiso para gestionar miembros.” Success messages use server `message` or explicit fallbacks (“Usuario añadido…”, “Invitación creada y correo enviado.”). Handle `res.ok` but neither `added` nor `invited` → “Respuesta inesperada del servidor.” Basic client-side email format validation before submit. Action-link box text aligned with API message. |

## 6. Final flow behavior

1. User enters email and role and submits. Frontend validates email format; if invalid, shows “Introduce una dirección de correo válida.” and does not call the API.
2. If the email belongs to an existing user, they are added to the project and the members list is refreshed; success: “Usuario añadido al proyecto correctamente.”
3. If the email is new and there is no pending invitation for that project+email, an invitation is created. If Resend is configured and the send succeeds, the UI shows “Invitación creada y correo enviado.” and the pending invitations list is refreshed.
4. If the invitation is created but the email is not sent (or send fails), the API returns an `actionLink` when the base URL is known (including localhost in dev). The UI shows the amber box with the link and “Copia este enlace…”. Pending invitations list is refreshed.
5. If the invitation is created but the base URL could not be determined, the API returns no `actionLink` and a `message` telling the user to set `NEXT_PUBLIC_SITE_URL` and to check “Invitaciones pendientes”. The UI shows that message and refreshes the list so the new invitation appears in the table.
6. Duplicate invite (same project + email already pending): API returns 400 with a clear error; frontend shows it.
7. Permission error (403): Frontend shows “No tiene permiso para gestionar miembros.”

## 7. Remaining limitations

- Email delivery depends on Resend (`RESEND_API_KEY` and optional `RESEND_FROM_EMAIL`). Without it, invitations are created but no email is sent; the user must share the link or the invitee must be added by another path.
- Multiple pending invitations for the same email in the same project are now rejected. Re-inviting requires revoking the existing invitation first (or using a different email).
- Rate limits and abuse (e.g. many invites) are not addressed in this flow.

## 8. RBAC

No changes to permissions. `POST /api/projects/[id]/invitations` still requires `manage_project_members` on the project (enforced by `requireAuthAndProjectPermission`). The frontend only shows the add-member form when `canManageMembers` is true from `GET /api/projects/[id]/permissions`.
