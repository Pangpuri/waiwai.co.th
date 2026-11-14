import { CONTACT_TOPICS, type ContactTopicId } from "@/features/contact/content";
import { isValidEmail } from "@/lib/validate";

export const FORM_MAIL_ROUTING_PAGE_KEY = "form-mail-routing";

export type MailRecipients = {
  readonly to: string;
  readonly cc: string;
};

export type FormMailRouting = {
  readonly contact: Readonly<Record<ContactTopicId, MailRecipients>>;
  readonly careers: MailRecipients;
};

export const DEFAULT_FORM_MAIL_ROUTING: FormMailRouting = {
  contact: {
    productIssue: { to: "kanoktip@waiwai.co.th", cc: "waiwaiqccenter@gmail.com" },
    orderDomestic: { to: "salecenter@waiwai.co.th", cc: "" },
    orderInternational: { to: "export@waiwai.co.th", cc: "" },
    marketingSupport: { to: "waiwaimkt@gmail.com", cc: "" },
    quickTerrace: { to: "yuttakornchaivanit@hotmail.com", cc: "" },
    salesAndFleet: { to: "salecenter@waiwai.co.th", cc: "" },
    supplierOffer: { to: "suchat@waiwai.co.th", cc: "" },
  },
  careers: { to: "hrd@waiwai.co.th", cc: "" },
};

const MAX_RECIPIENTS_PER_FIELD = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedAddressList(value: unknown, required: boolean): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  const addresses = value.split(/[,\n;]/).map((part) => part.trim()).filter(Boolean);
  if ((required && addresses.length === 0) || addresses.length > MAX_RECIPIENTS_PER_FIELD) return null;
  if (!addresses.every(isValidEmail)) return null;
  return addresses.join(", ");
}

function parseRecipients(value: unknown): MailRecipients | null {
  if (!isRecord(value)) return null;
  const to = normalizedAddressList(value["to"], true);
  const cc = normalizedAddressList(value["cc"], false);
  return to === null || cc === null ? null : { to, cc };
}

export function parseFormMailRouting(value: unknown): FormMailRouting | null {
  if (!isRecord(value) || !isRecord(value["contact"])) return null;

  const contactEntries: Record<ContactTopicId, MailRecipients> = { ...DEFAULT_FORM_MAIL_ROUTING.contact };
  for (const topic of CONTACT_TOPICS) {
    const recipients = parseRecipients(value["contact"][topic]);
    if (recipients === null) return null;
    contactEntries[topic] = recipients;
  }

  const careers = parseRecipients(value["careers"]);
  if (careers === null) return null;

  return { contact: contactEntries, careers };
}

export function resolveMailRecipients(
  routing: FormMailRouting,
  form: "contact" | "careers" | "newsletter",
  topic: string,
): MailRecipients | null {
  if (form === "careers") return routing.careers;
  if (form !== "contact") return null;
  const matchedTopic = CONTACT_TOPICS.find((candidate) => candidate === topic);
  return matchedTopic === undefined ? null : routing.contact[matchedTopic];
}
