import type { LocalizedValue } from "@/lib/content/types";
import type { Messages } from "@/lib/i18n/messages/th";
import { SITE } from "@/lib/site";

/**
 * "ตั้งค่าส่วนกลาง" ของเว็บ (X1.3) — ที่เดียวสำหรับค่าที่ใช้ทั้งเว็บ
 *
 * เก็บด้วยกลไกเดิมของโปรเจกต์: `page_document` คีย์ `site-settings`
 *   ⇒ ได้ **ฉบับร่าง / เผยแพร่ / ประวัติ / กู้คืน** ฟรี โดยไม่ต้องเพิ่มตาราง
 *
 * ⚠️ กฎเหล็ก: **ไม่ตั้งค่า = พฤติกรรมเดิมเป๊ะ** (ค่าเริ่มต้นมาจาก `SITE` + พจนานุกรม)
 * ⚠️ พาธไฟล์ (favicon/OG) เก็บเป็นพาธในเว็บ ตามมติ D9 — ไม่เก็บ URL เต็ม
 * ⚠️ รอบ 326: ถอด `organization.hours` / `organization.mapUrl` ออก เพราะ **ไม่มีโค้ดฝั่งเว็บอ่านค่าเลย**
 *    ข้อมูลเก่าใน `page_document` ที่ยังมีสองคีย์นี้จะถูกเพิกเฉย (parse ไม่พัง) — ไม่ต้อง migration
 * ⚠️ รอบ 337: เพิ่ม `notices` = ข้อความแจ้งที่เคยฝังในพจนานุกรม (ใต้ฟอร์มติดต่อ / ท้ายหน้าสมัครงาน)
 *    ⇒ ผู้ดูแลแก้เองได้จาก `/admin/settings` โดย **เว้นว่าง = ข้อความเดิมจากพจนานุกรมเป๊ะ**
 */

export const SITE_SETTINGS_PAGE_KEY = "site-settings";

export const MAX_SITE_NAME_LENGTH = 60;
export const MAX_URL_LENGTH = 300;
export const MAX_SOCIALS = 8;
export const MAX_NOTICE_LENGTH = 600;

export type SiteSettings = {
  readonly name: LocalizedValue;
  /** รูปสำหรับแชร์เริ่มต้น (ใช้เมื่อหน้าบางหน้าไม่ได้ตั้งของตัวเอง) */
  readonly defaultOgImage: string;
  /** ไอคอนเว็บ (favicon) — ว่าง = ใช้ค่าเริ่มต้นของ Next */
  readonly favicon: string;
  readonly organization: {
    readonly legalName: LocalizedValue;
    readonly address: LocalizedValue;
    readonly phone: string;
    readonly email: string;
  };
  /** ลิงก์โซเชียลอย่างเป็นทางการ (ใช้กับ JSON-LD sameAs) */
  readonly socials: readonly string[];
  /**
   * ข้อความแจ้งบนหน้าเว็บที่ผู้ดูแลแก้เองได้
   * - `contactForm` = ข้อความใต้ฟอร์มติดต่อ (PDPA/การเก็บข้อมูล)
   * - `careers` = ข้อความท้ายหน้า "ร่วมงานกับไวไว" (จำนวนอัตราตามประกาศ)
   * ⚠️ ค่าว่าง = ใช้ข้อความเดิมจากพจนานุกรมของภาษานั้น ๆ (`resolveNotice`)
   */
  readonly notices: {
    readonly contactForm: LocalizedValue;
    readonly careers: LocalizedValue;
  };
};

export const EMPTY_SITE_SETTINGS: SiteSettings = {
  name: { th: "", en: "" },
  defaultOgImage: "",
  favicon: "",
  organization: {
    legalName: { th: "", en: "" },
    address: { th: "", en: "" },
    phone: "",
    email: "",
  },
  socials: [],
  notices: {
    contactForm: { th: "", en: "" },
    careers: { th: "", en: "" },
  },
};

/** ค่าเริ่มต้น = สิ่งที่เว็บใช้อยู่จริงวันนี้ */
export function defaultSiteSettings(messages: Messages): SiteSettings {
  return {
    name: { th: messages.meta.siteName, en: messages.meta.siteName },
    defaultOgImage: "",
    favicon: "",
    organization: {
      legalName: { th: SITE.legalName, en: SITE.legalNameEn },
      address: { th: SITE.contact.address, en: SITE.contact.addressEn },
      phone: SITE.contact.phone,
      email: SITE.contact.email,
    },
    socials: SITE.social.map((item) => item.href),
    /* เว้นว่าง = ใช้ข้อความเดิมจากพจนานุกรม (ไม่ตั้งค่า = พฤติกรรมเดิมเป๊ะ) */
    notices: {
      contactForm: { th: "", en: "" },
      careers: { th: "", en: "" },
    },
  };
}

/* ── อ่านข้อมูลจากหน้าจอ (ไม่เชื่อข้อมูลที่ส่งมา) ─────────────────────────── */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toLocalized(value: unknown, fallback: LocalizedValue, max: number): LocalizedValue {
  if (!isRecord(value)) return fallback;
  const th = typeof value["th"] === "string" ? value["th"].slice(0, max) : fallback.th;
  const en = typeof value["en"] === "string" ? value["en"].slice(0, max) : fallback.en;
  return { th, en };
}

function toText(value: unknown, fallback: string, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : fallback;
}

/** ข้อความแจ้ง: ตัดช่องว่างหัวท้าย + จำกัดความยาว (ช่องว่าง = ใช้ข้อความเดิม) */
function toNotice(value: unknown, fallback: LocalizedValue): LocalizedValue {
  if (!isRecord(value)) return fallback;
  return {
    th: typeof value["th"] === "string" ? value["th"].trim().slice(0, MAX_NOTICE_LENGTH) : fallback.th,
    en: typeof value["en"] === "string" ? value["en"].trim().slice(0, MAX_NOTICE_LENGTH) : fallback.en,
  };
}

export type SiteSettingsParseResult =
  | { readonly ok: true; readonly value: SiteSettings }
  | { readonly ok: false; readonly problems: readonly string[] };

export function parseSiteSettings(raw: unknown, messages: Messages): SiteSettingsParseResult {
  const fallback = defaultSiteSettings(messages);
  if (!isRecord(raw)) return { ok: false, problems: ["ข้อมูลที่ส่งมาไม่ใช่ออบเจ็กต์"] };

  const rawOrg = isRecord(raw["organization"]) ? raw["organization"] : {};
  const rawSocials = raw["socials"];
  const rawNotices = raw["notices"] === undefined ? {} : raw["notices"];
  if (!isRecord(rawNotices)) return { ok: false, problems: ["notices: ต้องเป็นออบเจ็กต์"] };

  const socials: string[] = [];
  if (rawSocials !== undefined && !Array.isArray(rawSocials)) {
    return { ok: false, problems: ["socials: ต้องเป็นรายการ"] };
  }
  if (Array.isArray(rawSocials)) {
    for (const entry of rawSocials.slice(0, MAX_SOCIALS)) {
      if (typeof entry === "string" && entry.trim() !== "") socials.push(entry.trim().slice(0, MAX_URL_LENGTH));
    }
  }

  return {
    ok: true,
    value: {
      name: toLocalized(raw["name"], fallback.name, MAX_SITE_NAME_LENGTH),
      defaultOgImage: toText(raw["defaultOgImage"], fallback.defaultOgImage, MAX_URL_LENGTH),
      favicon: toText(raw["favicon"], fallback.favicon, MAX_URL_LENGTH),
      organization: {
        legalName: toLocalized(rawOrg["legalName"], fallback.organization.legalName, MAX_SITE_NAME_LENGTH),
        address: toLocalized(rawOrg["address"], fallback.organization.address, 300),
        phone: toText(rawOrg["phone"], fallback.organization.phone, 40),
        email: toText(rawOrg["email"], fallback.organization.email, 80),
      },
      socials,
      notices: {
        contactForm: toNotice(rawNotices["contactForm"], fallback.notices.contactForm),
        careers: toNotice(rawNotices["careers"], fallback.notices.careers),
      },
    },
  };
}

/* ── ตรวจความถูกต้อง ─────────────────────────────────────────────────────── */

export type SiteSettingsIssue = {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly path: string;
  readonly detail: string | null;
};

/** พาธไฟล์ในเว็บต้องขึ้นต้นด้วย `/` และไม่ใช่ URL เต็ม (มติ D9) */
function pathIssue(code: string, path: string, value: string): SiteSettingsIssue | null {
  if (value === "") return null;
  if (value.includes("://") || value.startsWith("//")) {
    return { severity: "error", code: "media-path-is-url", path, detail: null };
  }
  if (!value.startsWith("/")) return { severity: "error", code: "bad-path", path, detail: null };
  return null;
}

/** ลิงก์ภายนอกต้องเป็น http(s) เท่านั้น (กัน javascript:/data:) */
function externalIssue(path: string, value: string): SiteSettingsIssue | null {
  if (value === "") return null;
  if (value.startsWith("/")) return null;
  if (/^https?:\/\//i.test(value)) return null;
  return { severity: "error", code: "bad-href", path, detail: null };
}

export function validateSiteSettings(value: SiteSettings): readonly SiteSettingsIssue[] {
  const issues: SiteSettingsIssue[] = [];

  if (value.name.th.trim() === "") issues.push({ severity: "error", code: "empty-th", path: "name.th", detail: null });

  for (const [path, raw] of [
    ["defaultOgImage", value.defaultOgImage],
    ["favicon", value.favicon],
  ] as const) {
    const issue = pathIssue("bad-path", path, raw);
    if (issue !== null) issues.push(issue);
  }

  if (value.organization.email !== "" && !value.organization.email.includes("@")) {
    issues.push({ severity: "error", code: "bad-email", path: "organization.email", detail: null });
  }

  value.socials.forEach((url, index) => {
    const issue = externalIssue(`socials[${index}]`, url);
    if (issue !== null) issues.push(issue);
  });

  if (value.organization.legalName.th.trim() === "") {
    issues.push({ severity: "warning", code: "missing-legal-name", path: "organization.legalName.th", detail: null });
  }
  if (value.organization.address.th.trim() === "") {
    issues.push({ severity: "warning", code: "missing-address", path: "organization.address.th", detail: null });
  }

  return issues;
}

export function siteSettingsErrorsOf(issues: readonly SiteSettingsIssue[]): readonly SiteSettingsIssue[] {
  return issues.filter((entry) => entry.severity === "error");
}

/** ชื่อที่ใช้แสดงสำหรับภาษานั้น (อังกฤษว่าง = ใช้ไทย) */
export function siteNameFor(value: SiteSettings, locale: "th" | "en"): string {
  if (locale === "en" && value.name.en.trim() !== "") return value.name.en;
  return value.name.th;
}

/**
 * ข้อความแจ้งที่ใช้แสดงจริง: ค่าที่ผู้ดูแลกรอก (ถ้ามี) → ไม่มี = ข้อความเดิมจากพจนานุกรม
 *
 * ⚠️ ตั้งใจไม่ถอยไปใช้ข้อความไทยบนหน้าอังกฤษ: ถ้าไม่ได้กรอก EN ให้ใช้ค่าเริ่มต้นของ EN
 *    (ผู้ดูแลกรอกทั้งสองช่องตามปกติ · ค่าว่างจึงหมายถึง "ยังไม่แก้" จริง ๆ)
 */
export function resolveNotice(value: LocalizedValue, language: "th" | "en", fallback: string): string {
  const custom = language === "en" ? value.en : value.th;
  const trimmed = custom.trim();
  return trimmed === "" ? fallback : trimmed;
}
