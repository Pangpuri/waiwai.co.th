import "server-only";

import { createTransport } from "nodemailer";

import type { SubmissionDraft } from "@/lib/forms/model";
import { loadFormMailRouting } from "@/lib/forms/mail-routing-repository";
import { resolveMailRecipients } from "@/lib/forms/mail-routing";
import { buildFormNotificationMessage, normalizeSmtpFrom, type FormNotificationAttachment } from "@/lib/forms/email-message";
import { isValidEmail } from "@/lib/validate";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value === "") throw new Error(`Missing ${name}`);
  return value;
}

function mailPort(): 465 | 587 {
  const raw = process.env["SMTP_PORT"]?.trim() || "587";
  if (raw !== "465" && raw !== "587") throw new Error("SMTP_PORT must be 465 or 587");
  return raw === "465" ? 465 : 587;
}

export async function sendFormNotification(draft: SubmissionDraft, attachments: readonly FormNotificationAttachment[] = []): Promise<void> {
  if (draft.form !== "contact" && draft.form !== "careers") throw new Error("Newsletter notifications are not supported");

  const routing = await loadFormMailRouting();
  const recipients = resolveMailRecipients(routing, draft.form, draft.topic);
  if (recipients === null) throw new Error("No mail recipients configured for this form topic");

  const host = process.env["SMTP_HOST"]?.trim() || "mail.waiwai.co.th";
  const port = mailPort();
  const user = requiredEnv("SMTP_USER");
  const password = requiredEnv("SMTP_PASS");
  const from = normalizeSmtpFrom(process.env["SMTP_FROM"]?.trim() || `Wai Wai <${user}>`, user);
  if (!isValidEmail(user)) throw new Error("SMTP_USER must be a valid email address");
  if (from === null) throw new Error("SMTP_FROM must use the authenticated SMTP_USER address");

  const transport = createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass: password },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });

  const message = buildFormNotificationMessage({ ...draft, form: draft.form }, recipients, from, attachments);
  const { attachments: messageAttachments, ...messageFields } = message;
  await transport.sendMail({
    ...messageFields,
    ...(messageAttachments === undefined
      ? {}
      : {
          attachments: messageAttachments.map((attachment) => ({
            ...attachment,
            content: Buffer.from(attachment.content),
          })),
        }),
  });
}
