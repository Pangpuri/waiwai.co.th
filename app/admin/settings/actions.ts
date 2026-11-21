"use server";

import { revalidatePath } from "next/cache";
import { refreshPublicSite } from "@/lib/cache/refresh";

import type { SettingsState } from "@/features/admin/settings-state";
import type { CoverUploadState } from "@/features/admin/ui/cover-image-picker";
import { recordAudit } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import { publishDraft, saveJsonDraft } from "@/lib/blocks/repository";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { storeImageFile } from "@/lib/media/upload";
import { SITE_SETTINGS_PAGE_KEY, parseSiteSettings, siteSettingsErrorsOf, validateSiteSettings } from "@/lib/site-settings/model";

/**
 * Server Actions ของ "ข้อมูลองค์กร & SEO" (X1.3)
 *
 * ลำดับเดียวกับส่วนอื่น: ตรวจสิทธิ์ → parse (ไม่เชื่อเบราว์เซอร์) → validate → บันทึก/เผยแพร่
 * ⚠️ ค่าที่บันทึกเป็น "พาธในเว็บ" (favicon/OG) ตามมติ D9 — ตรวจแล้วใน validateSiteSettings
 */

/* ⚠️ ห้าม export ค่าคงที่จากไฟล์ "use server" (ดู features/admin/settings-state.ts) */

function readFields(formData: FormData): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  return fields;
}

function toRaw(fields: Readonly<Record<string, string>>): unknown {
  const socials = fields["socials"] === undefined ? [] : fields["socials"].split("\n");

  return {
    name: { th: fields["nameTh"] ?? "", en: fields["nameEn"] ?? "" },
    defaultOgImage: fields["defaultOgImage"] ?? "",
    favicon: fields["favicon"] ?? "",
    organization: {
      legalName: { th: fields["legalNameTh"] ?? "", en: fields["legalNameEn"] ?? "" },
      address: { th: fields["addressTh"] ?? "", en: fields["addressEn"] ?? "" },
      phone: fields["phone"] ?? "",
      email: fields["email"] ?? "",
    },
    socials,
    notices: {
      contactForm: {
        th: fields["contactNoticeTh"] ?? "",
        en: fields["contactNoticeEn"] ?? "",
      },
      careers: {
        th: fields["careersNoticeTh"] ?? "",
        en: fields["careersNoticeEn"] ?? "",
      },
    },
  };
}

async function prepare(formData: FormData): Promise<{ readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly state: SettingsState }> {
  const messages = await getMessagesFor("th");
  const parsed = parseSiteSettings(toRaw(readFields(formData)), messages);
  if (!parsed.ok) return { ok: false, state: { status: "invalid", problems: parsed.problems } };

  const errors = siteSettingsErrorsOf(validateSiteSettings(parsed.value));
  if (errors.length > 0) {
    return {
      ok: false,
      state: { status: "invalid", problems: errors.map((issue) => `${issue.code} · ${issue.path}`) },
    };
  }

  return { ok: true, value: parsed.value };
}

/**
 * อัปโหลดภาพของหน้าตั้งค่า (ไอคอนเว็บ / รูปแชร์เริ่มต้น)
 * - ใช้ท่อกลาง `storeImageFile` ตัวเดียวกับคลังภาพ/ข่าว/สินค้า (sniff + 5MB + ย่อ/WebP ฝั่งเบราว์เซอร์)
 * - คืน **พาธ** `/media/<id>` (มติ D9) แล้วฟอร์มเก็บลง hidden input
 */
export async function uploadSettingsImageAction(
  _previous: CoverUploadState,
  formData: FormData,
): Promise<CoverUploadState> {
  await requireAdminUser("settings");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "invalid", path: "", reason: "no-file" };
  }

  const stored = await storeImageFile(file, "site-settings");
  if (!stored.ok) return { status: "invalid", path: "", reason: stored.reason };

  revalidatePath("/admin/settings");
  return { status: "ok", path: stored.path, reason: "" };
}

export async function saveSettingsAction(_previous: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireAdminUser("settings");
  const prepared = await prepare(formData);
  if (!prepared.ok) return prepared.state;

  try {
    await saveJsonDraft(SITE_SETTINGS_PAGE_KEY, prepared.value, user.email);
  } catch {
    return { status: "failed", problems: ["บันทึกลงฐานข้อมูลไม่สำเร็จ"] };
  }

  revalidatePath("/admin/settings");
  return { status: "saved", problems: [] };
}

export async function publishSettingsAction(_previous: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireAdminUser("settings");
  const prepared = await prepare(formData);
  if (!prepared.ok) return prepared.state;

  try {
    await saveJsonDraft(SITE_SETTINGS_PAGE_KEY, prepared.value, user.email);
    await publishDraft(SITE_SETTINGS_PAGE_KEY, user.email, "site-settings");
    await recordAudit({ action: "pages-update", actorEmail: user.email, target: "site-settings", detail: "published" });
  } catch {
    return { status: "failed", problems: ["เผยแพร่ไม่สำเร็จ"] };
  }

  revalidatePath("/admin/settings");
  /* ตั้งค่าส่วนกลาง (ชื่อเว็บ/ไอคอน/OG/JSON-LD) อยู่ทุกหน้า ⇒ สดใหม่ทั้งเว็บ (X1.7) */
  await refreshPublicSite("settings");
  return { status: "published", problems: [] };
}
