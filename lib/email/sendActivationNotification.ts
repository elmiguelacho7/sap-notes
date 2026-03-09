/**
 * Send account activation notification when a superadmin activates a pending user.
 * Uses Resend when RESEND_API_KEY is set. If not configured, no-op (integration point for future SMTP/provider).
 */

const DEFAULT_FROM = "SAP Notes Hub <onboarding@resend.dev>";

export async function sendActivationNotification(
  toEmail: string,
  fullName?: string | null
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !toEmail?.trim()) {
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM;
  const name = fullName?.trim() || "Usuario";
  const loginUrl =
    (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "") ||
    "https://app.example.com";

  try {
    const resend = await import("resend").then((m) => new m.Resend(apiKey));

    const { error } = await resend.emails.send({
      from,
      to: [toEmail.trim()],
      subject: "Tu cuenta está activa — SAP Notes Hub",
      html: `
        <p>Hola ${escapeHtml(name)},</p>
        <p>Tu cuenta en <strong>SAP Notes Hub</strong> ha sido activada por un administrador.</p>
        <p>Ya puedes acceder a la plataforma. Inicia sesión con el mismo correo y la contraseña que definiste al registrarte.</p>
        <p><a href="${escapeHtml(loginUrl)}">Iniciar sesión en SAP Notes Hub</a></p>
        <p style="color:#64748b;font-size:12px;">Si no solicitaste el acceso, puedes ignorar este mensaje.</p>
      `,
    });

    if (error) {
      throw new Error(
        typeof error === "object" && error !== null && "message" in error
          ? (error as { message: string }).message
          : "Failed to send email"
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message === "Failed to send email") throw err;
    throw new Error(
      "Resend not configured or failed. Add RESEND_API_KEY and install resend package."
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
