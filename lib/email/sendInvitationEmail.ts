/**
 * Send project invitation email. Uses Resend when RESEND_API_KEY is set.
 * If Resend is not configured, does nothing (caller should return actionLink to the client).
 * If configured and send fails, throws.
 */

const DEFAULT_FROM = "SAP Notes Hub <onboarding@resend.dev>";

export async function sendInvitationEmail(
  toEmail: string,
  inviteLink: string,
  _projectId: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !inviteLink) {
    return; // Caller will return actionLink to client
  }

  const from = process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM;

  try {
    const resend = await import("resend").then((m) => new m.Resend(apiKey));

    const { error } = await resend.emails.send({
      from,
      to: [toEmail],
      subject: "You have been invited",
      html: `
      <p>You have been invited to a project.</p>
      <p><a href="${inviteLink}">Accept invitation</a></p>
      <p>Or copy this link: ${inviteLink}</p>
      <p>This link expires in 7 days.</p>
    `,
    });

    if (error) {
      throw new Error(typeof error === "object" && error !== null && "message" in error ? (error as { message: string }).message : "Failed to send email");
    }
  } catch (err) {
    if (err instanceof Error && err.message === "Failed to send email") throw err;
    throw new Error("Resend not configured or failed. Add RESEND_API_KEY and install resend package.");
  }
}
