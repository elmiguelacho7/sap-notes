/**
 * Send project invitation email via Resend when RESEND_API_KEY is set.
 * Returns { sent, error?, from? } so the caller can set emailSent and log the real failure reason.
 */

import {
  projectInvitationHtml,
  projectInvitationText,
} from "@/lib/email/templates/projectInvitationTemplate";

const DEFAULT_FROM = "SAP Notes Hub <onboarding@resend.dev>";

export type SendInvitationEmailResult = {
  sent: boolean;
  error?: string | null;
  from?: string;
};

export type SendInvitationEmailOptions = {
  projectName?: string;
  expirationDays?: number;
};

export async function sendInvitationEmail(
  toEmail: string,
  inviteLink: string,
  _projectId: string,
  options?: SendInvitationEmailOptions
): Promise<SendInvitationEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { sent: false, error: "RESEND_API_KEY is missing" };
  }
  if (!inviteLink || !inviteLink.trim()) {
    return { sent: false, error: "inviteLink is missing" };
  }

  const from = (process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM) as string;
  const expirationDays = options?.expirationDays ?? 7;
  const templateParams = {
    inviteLink: inviteLink.trim(),
    projectName: options?.projectName,
    expirationDays,
  };
  const html = projectInvitationHtml(templateParams);
  const text = projectInvitationText(templateParams);

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      from,
      to: [toEmail],
      subject: "Invitación a un proyecto – SAP Notes Hub",
      html,
      text,
    });

    if (error) {
      const reason =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : String(error);
      return { sent: false, error: reason, from };
    }
    return { sent: true, error: null, from };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { sent: false, error: reason, from };
  }
}
