/**
 * Professional invitation email template for SAP Notes Hub.
 * Inline styles only; no external CSS. Includes HTML and plain-text fallback.
 */

const PRODUCT_NAME = "SAP Notes Hub";

export type ProjectInvitationTemplateParams = {
  inviteLink: string;
  projectName?: string;
  expirationDays?: number;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Returns HTML body for the invitation email.
 */
export function projectInvitationHtml(params: ProjectInvitationTemplateParams): string {
  const { inviteLink, projectName, expirationDays = 7 } = params;
  const projectLabel = projectName?.trim() ? escapeHtml(projectName.trim()) : "un proyecto";
  const expiryText = expirationDays === 1 ? "1 día" : `${expirationDays} días`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitación a ${PRODUCT_NAME}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); overflow: hidden;">
          <tr>
            <td style="padding: 32px 28px;">
              <h1 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #0f172a;">
                ${PRODUCT_NAME}
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #475569;">
                Te han invitado a unirse a <strong style="color: #0f172a;">${projectLabel}</strong>.
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.5; color: #475569;">
                Haz clic en el botón de abajo para aceptar la invitación y acceder al proyecto.
              </p>
              <p style="margin: 0 0 20px 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                Si aún no tienes cuenta, podrás crearla al abrir esta invitación y definir tu contraseña.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td>
                    <a href="${escapeHtml(inviteLink)}" style="display: inline-block; padding: 12px 24px; font-size: 14px; font-weight: 600; color: #ffffff; background-color: #4f46e5; text-decoration: none; border-radius: 8px;">
                      Aceptar invitación
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="margin: 0 0 20px 0; font-size: 12px; word-break: break-all; color: #475569;">
                <a href="${escapeHtml(inviteLink)}" style="color: #4f46e5;">${escapeHtml(inviteLink)}</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Este enlace caduca en ${expiryText}. Si ya has aceptado esta invitación, puedes ignorar este correo.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

/**
 * Returns plain-text fallback body for the invitation email.
 */
export function projectInvitationText(params: ProjectInvitationTemplateParams): string {
  const { inviteLink, projectName, expirationDays = 7 } = params;
  const projectLabel = projectName?.trim() || "un proyecto";
  const expiryText = expirationDays === 1 ? "1 día" : `${expirationDays} días`;

  return [
    `${PRODUCT_NAME}`,
    "",
    `Te han invitado a unirse a ${projectLabel}.`,
    "",
    "Si aún no tienes cuenta, podrás crearla al abrir esta invitación y definir tu contraseña.",
    "",
    "Acepta la invitación visitando el siguiente enlace:",
    inviteLink,
    "",
    `Este enlace caduca en ${expiryText}. Si ya has aceptado esta invitación, puedes ignorar este correo.`,
  ].join("\n");
}
