import { Resend } from "resend";
import { SITE_NAME } from "@/lib/site";

// Transactional auth emails (verification, password reset, magic link) go
// through Resend. Without RESEND_API_KEY, development logs the link to the
// terminal so the flows stay testable; production throws so the caller can
// surface a real error instead of a silent "email never arrived".

const EMAIL_FROM =
  process.env.EMAIL_FROM ?? `${SITE_NAME} <no-reply@honestairport.com>`;

let resend: Resend | null | undefined;

function getResend(): Resend | null {
  if (resend === undefined) {
    resend = process.env.RESEND_API_KEY
      ? new Resend(process.env.RESEND_API_KEY)
      : null;
  }
  return resend;
}

interface AuthEmail {
  to: string;
  subject: string;
  heading: string;
  body: string;
  ctaLabel: string;
  url: string;
}

function renderHtml({ heading, body, ctaLabel, url }: AuthEmail): string {
  return `<div style="background:#f4f6fb;padding:32px 16px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e3e8f2;border-radius:12px;padding:32px;">
    <p style="margin:0 0 24px;font-size:15px;font-weight:700;letter-spacing:-0.01em;color:#0d489d;">${SITE_NAME}</p>
    <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#111827;">${heading}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5563;">${body}</p>
    <a href="${url}" style="display:inline-block;background:#0d489d;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:11px 22px;border-radius:8px;">${ctaLabel}</a>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">Or paste this link into your browser:<br /><a href="${url}" style="color:#0d489d;word-break:break-all;">${url}</a></p>
  </div>
  <p style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:1.6;color:#9ca3af;text-align:center;">If you didn't request this email, you can safely ignore it.</p>
</div>`;
}

function renderText({ heading, body, ctaLabel, url }: AuthEmail): string {
  return `${heading}\n\n${body}\n\n${ctaLabel}: ${url}\n\nIf you didn't request this email, you can safely ignore it.`;
}

async function sendAuthEmail(email: AuthEmail): Promise<void> {
  const client = getResend();

  if (!client) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not set — cannot send auth emails");
    }
    console.log(
      `[email] ${email.subject} → ${email.to}\n[email] ${email.url}`,
    );
    return;
  }

  const { error } = await client.emails.send({
    from: EMAIL_FROM,
    to: email.to,
    subject: email.subject,
    html: renderHtml(email),
    text: renderText(email),
  });

  if (error) {
    throw new Error(`Resend failed to send "${email.subject}": ${error.message}`);
  }
}

export async function sendVerificationEmail(
  to: string,
  url: string,
): Promise<void> {
  await sendAuthEmail({
    to,
    url,
    subject: `Verify your email for ${SITE_NAME}`,
    heading: "Verify your email",
    body: `Confirm this address to finish setting up your ${SITE_NAME} account.`,
    ctaLabel: "Verify email",
  });
}

export async function sendPasswordResetEmail(
  to: string,
  url: string,
): Promise<void> {
  await sendAuthEmail({
    to,
    url,
    subject: `Reset your ${SITE_NAME} password`,
    heading: "Reset your password",
    body: "Choose a new password for your account. This link expires in one hour.",
    ctaLabel: "Reset password",
  });
}
