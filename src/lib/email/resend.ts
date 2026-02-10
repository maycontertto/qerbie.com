import { Resend } from "resend";

export async function sendEmailWithResend(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BILLING_EMAIL_FROM;

  if (!apiKey || !from) {
    return { ok: false, reason: "missing_resend_env" };
  }

  const resend = new Resend(apiKey);

  const result = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });

  if ((result as unknown as { error?: { message?: string } }).error) {
    const msg = (result as unknown as { error?: { message?: string } }).error?.message ?? "send_failed";
    return { ok: false, reason: msg };
  }

  return { ok: true };
}
