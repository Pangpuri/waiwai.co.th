import type { SubmissionDraft } from "@/lib/forms/model";
import type { MailRecipients } from "@/lib/forms/mail-routing";
import { isValidEmail } from "@/lib/validate";

export type FormNotificationAttachment = {
  readonly filename: string;
  readonly mime: string;
  readonly data: Uint8Array;
};

export type FormNotificationDraft = SubmissionDraft & { readonly form: "contact" | "careers" };
export type FormNotificationMessage = {
  readonly from: string;
  readonly to: string;
  readonly cc?: string;
  readonly replyTo: string;
  readonly subject: string;
  readonly text: string;
  readonly attachments?: readonly {
    readonly filename: string;
    readonly content: Uint8Array;
    readonly contentType: string;
  }[];
};

export function normalizeSmtpFrom(value: string, authenticatedUser: string): string | null {
  const normalized = value.trim();
  if (normalized === "" || /[\u0000-\u001f\u007f]/.test(normalized)) return null;

  const match = /^([^<>]*)<([^<>]+)>$/.exec(normalized);
  if (match === null && /[<>]/.test(normalized)) return null;
  const address = match?.[2]?.trim() ?? normalized;
  if (!isValidEmail(address) || address.toLowerCase() !== authenticatedUser.toLowerCase()) return null;
  return normalized;
}

function headerText(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 200);
}

function messageText(draft: FormNotificationDraft): string {
  const lines = [
    `ชื่อ: ${draft.name}`,
    `อีเมล: ${draft.email}`,
    `โทรศัพท์: ${draft.phone || "—"}`,
    `เรื่องที่ติดต่อ / ตำแหน่ง: ${draft.topic}`,
  ];

  if (draft.subject !== "") lines.push(`หัวข้อ: ${draft.subject}`);
  if (draft.message !== "") lines.push("", draft.message);

  const extraFields = Object.entries(draft.payload);
  if (extraFields.length > 0) {
    lines.push("", "ข้อมูลเพิ่มเติม:");
    for (const [key, value] of extraFields) lines.push(`${key}: ${value}`);
  }

  return lines.join("\n");
}

export function buildFormNotificationMessage(
  draft: FormNotificationDraft,
  recipients: MailRecipients,
  from: string,
  attachments: readonly FormNotificationAttachment[] = [],
): FormNotificationMessage {
  return {
    from,
    to: recipients.to,
    ...(recipients.cc === "" ? {} : { cc: recipients.cc }),
    replyTo: draft.email,
    subject: draft.form === "careers"
      ? `ใบสมัครงานจากเว็บไซต์: ${headerText(draft.topic)}`
      : `ติดต่อจากเว็บไซต์: ${headerText(draft.subject || draft.topic)}`,
    text: messageText(draft),
    ...(attachments.length === 0
      ? {}
      : {
          attachments: attachments.map((attachment) => ({
            filename: attachment.filename,
            content: attachment.data,
            contentType: attachment.mime,
          })),
        }),
  };
}
