import { Resend } from "resend";

import { CREDIT_REQUEST_CC_RECIPIENT, CREDIT_REQUEST_RECIPIENT } from "@/lib/credit-request-email";

// Sender must be on a domain verified in Resend.
const CREDIT_REQUEST_SENDER = "Turkana Credit <info@turkanafood.com>";

export type CreditEmailAttachment = {
  filename: string;
  content: Buffer;
};

export type SendCreditEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

/**
 * Sends the credit request email via Resend. The Return Form PDF (when present)
 * is attached. Recipients mirror the mailto draft: TO credit@, CC yerdogan@
 * plus any customer BP emails.
 */
export async function sendCreditRequestEmail({
  subject,
  text,
  ccRecipients,
  attachments = [],
  salesRepEmail,
}: {
  subject: string;
  text: string;
  ccRecipients: string[];
  attachments?: CreditEmailAttachment[];
  salesRepEmail?: string | null;
}): Promise<SendCreditEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }

  // The salesrep who submitted the request is CC'd (when their login is a valid
  // email) so they get a copy and replies naturally include them.
  const salesRepCc = salesRepEmail && isValidEmail(salesRepEmail) ? [salesRepEmail] : [];

  const cc = normalizeRecipients([CREDIT_REQUEST_CC_RECIPIENT, ...salesRepCc, ...ccRecipients]).filter(
    (email) => email.toLowerCase() !== CREDIT_REQUEST_RECIPIENT.toLowerCase(),
  );

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: CREDIT_REQUEST_SENDER,
      to: [CREDIT_REQUEST_RECIPIENT],
      cc: cc.length > 0 ? cc : undefined,
      subject,
      text,
      attachments: attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
      })),
    });

    if (error) {
      return { ok: false, error: error.message ?? "Resend rejected the email" };
    }

    return { ok: true, id: data?.id ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error sending email";
    return { ok: false, error: message };
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizeRecipients(recipients: string[]): string[] {
  const unique = new Map<string, string>();

  for (const recipient of recipients) {
    for (const email of recipient.split(/[;,]/).map((value) => value.trim()).filter(Boolean)) {
      const key = email.toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, email);
      }
    }
  }

  return [...unique.values()];
}
