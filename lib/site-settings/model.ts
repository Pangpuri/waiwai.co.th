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
 */

export const SITE_SETTINGS_PAGE_KEY = "site-settings";

export const MAX_SITE_NAME_LENGTH = 60;
export const MAX_URL_LENGTH = 300;
export const MAX_HOURS_LENGTH = 200;
export const MAX_SOCIALS = 8;

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
    readonly hours: LocalizedValue;
    /** ลิงก์เปิดแผนที่ (ไม่ฝังสคริปต์ของบุคคลที่สาม) */
    readonly mapUrl: string;
  };
  /** ลิงก์โซเชียลอย่างเป็นทางการ (ใช้กับ JSON-LD sameAs) */
  readonly socials: readonly string[];
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
    hours: { th: "", en: "" },
    mapUrl: "",
  },
  socials: [],
};

/** ค่าเริ่มต้น = สิ่งที่เว็บใช้อยู่จริงวันนี้ */
export function defaultSiteSettings(messages: Messages): SiteSettings {
  return {
    name: { th: messages.meta.siteName, en: messages.meta.siteName },
    defaultOgImage: "",
    favicon: "",
    organization: {
      legalName: { th: SITE.legalName, en: SITE.legalName },
      address: { th: SITE.contact.address, en: SITE.contact.address },
      phone: SITE.contact.phone,
      email: SITE.contact.email,
      hours: { th: "", en: "" },
      mapUrl: "",
    },
    socials: SITE.social.map((item) => item.href),
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

export type SiteSettingsParseResult =
  | { readonly ok: true; readonly value: SiteSettings }
  | { readonly ok: false; readonly problems: readonly string[] };

export function parseSiteSettings(raw: unknown, messages: Messages): SiteSettingsParseResult {
  const fallback = defaultSiteSettings(messages);
  if (!isRecord(raw)) return { ok: false, problems: ["ข้อมูลที่ส่งมาไม่ใช่ออบเจ็กต์"] };

  const rawOrg = isRecord(raw["organization"]) ? raw["organization"] : {};
  const rawSocials = raw["socials"];

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
        hours: toLocalized(rawOrg["hours"], fallback.organization.hours, MAX_HOURS_LENGTH),
        mapUrl: toText(rawOrg["mapUrl"], fallback.organization.mapUrl, MAX_URL_LENGTH),
      },
      socials,
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

  const mapIssue = externalIssue("organization.mapUrl", value.organization.mapUrl);
  if (mapIssue !== null) issues.push(mapIssue);

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
