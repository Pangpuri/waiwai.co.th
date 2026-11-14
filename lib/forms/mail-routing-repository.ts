import { loadDocumentRow, saveJsonDraft } from "@/lib/blocks/repository";
import { FORM_MAIL_ROUTING_PAGE_KEY, parseFormMailRouting, DEFAULT_FORM_MAIL_ROUTING, type FormMailRouting } from "@/lib/forms/mail-routing";
import { isDatabaseConfigured } from "@/lib/content/repository";

export async function loadFormMailRouting(): Promise<FormMailRouting> {
  if (!isDatabaseConfigured()) return DEFAULT_FORM_MAIL_ROUTING;
  const row = await loadDocumentRow(FORM_MAIL_ROUTING_PAGE_KEY, "draft");
  if (row === null) return DEFAULT_FORM_MAIL_ROUTING;

  const parsed = parseFormMailRouting(row.raw);
  if (parsed === null) throw new Error("Form mail routing settings are invalid");
  return parsed;
}

export async function saveFormMailRouting(value: FormMailRouting, actor: string): Promise<void> {
  await saveJsonDraft(FORM_MAIL_ROUTING_PAGE_KEY, value, actor);
}
