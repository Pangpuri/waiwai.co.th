import { PRIMARY_NAV } from "@/features/shell/nav";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * "หน้า" เป็นวัตถุจริงในฐานข้อมูล (W1 — แบบ WordPress: Posts/Pages)
 *
 * ผู้ใช้สั่ง รอบที่ 61: *"เมนูก็คงเอาไว้ตามหน้า … ซึ่งแต่ละหน้าก็เปลี่ยนชื่อได้ด้วยไปเลย"*
 * ⇒ **ชื่อหน้า = ชื่อเมนูของหน้านั้น** (ที่เดียว ไม่มีสองที่ให้ขัดกัน)
 *
 * ไฟล์นี้เป็นตรรกะล้วน (ทดสอบได้) · การอ่าน/เขียนฐานข้อมูลอยู่ที่ `repository.ts`
 */

export const MAX_PAGE_NAME_LENGTH = 40;
/** เพดานตามข้อแนะนำของเครื่องค้นหา (ยาวเกินแล้วถูกตัดทิ้ง) */
export const MAX_SEO_TITLE_LENGTH = 70;
export const MAX_SEO_DESCRIPTION_LENGTH = 170;

export type PageEditor = "blocks" | "designed";

/** ค่า SEO ต่อหน้า (ผู้ใช้สั่งตามแผน WP-model — W2) · ว่าง = ใช้ค่าเดิมจากพจนานุกรม */
export type PageSeo = {
  readonly titleTh: string;
  readonly titleEn: string;
  readonly descriptionTh: string;
  readonly descriptionEn: string;
  /** พาธรูปสำหรับแชร์ (Open Graph) — มติ D9: พาธ ไม่ใช่ URL เต็ม */
  readonly ogImagePath: string;
  readonly noindex: boolean;
};

export type PageRecord = {
  readonly id: string;
  readonly nameTh: string;
  readonly nameEn: string;
  readonly menuOrder: number;
  readonly inMenu: boolean;
  readonly editor: PageEditor;
  readonly seo: PageSeo;
};

export const EMPTY_PAGE_SEO: PageSeo = {
  titleTh: "",
  titleEn: "",
  descriptionTh: "",
  descriptionEn: "",
  ogImagePath: "",
  noindex: false,
};

/** มีค่าอะไรให้ใช้ไหม (ใช้ตัดสินว่าจะทับค่าเดิมของหน้าหรือไม่) */
export function hasSeoOverride(seo: PageSeo): boolean {
  return (
    seo.titleTh.trim() !== "" ||
    seo.titleEn.trim() !== "" ||
    seo.descriptionTh.trim() !== "" ||
    seo.descriptionEn.trim() !== "" ||
    seo.ogImagePath.trim() !== "" ||
    seo.noindex
  );
}

/** ตรวจค่า SEO: ยาวเกินเพดาน = error · OG ต้องเป็นพาธในเว็บ (ไม่ใช่ URL เต็ม) */
export function validatePageSeo(seo: PageSeo): readonly PageIssue[] {
  const issues: PageIssue[] = [];
  if (seo.titleTh.length > MAX_SEO_TITLE_LENGTH) issues.push({ code: "too-long", path: "seo.titleTh" });
  if (seo.titleEn.length > MAX_SEO_TITLE_LENGTH) issues.push({ code: "too-long", path: "seo.titleEn" });
  if (seo.descriptionTh.length > MAX_SEO_DESCRIPTION_LENGTH) issues.push({ code: "too-long", path: "seo.descriptionTh" });
  if (seo.descriptionEn.length > MAX_SEO_DESCRIPTION_LENGTH) issues.push({ code: "too-long", path: "seo.descriptionEn" });

  const path = seo.ogImagePath.trim();
  if (path !== "") {
    /* ตรวจแบบไม่ใช้ regex ที่ต้อง escape เครื่องหมาย / (เคยพิมพ์ซ้อนจนเพี้ยน) */
    if (path.includes("://") || path.startsWith("//")) {
      issues.push({ code: "media-path-is-url", path: "seo.ogImagePath" });
    } else if (!path.startsWith("/")) {
      issues.push({ code: "bad-path", path: "seo.ogImagePath" });
    }
  }

  return issues;
}

/** หน้าทั้งหมดตามเมนูปัจจุบันในโค้ด (ค่าเริ่มต้น/fallback — ห้ามเปลี่ยนพฤติกรรมเดิม) */
export function defaultPages(messages: Messages): readonly PageRecord[] {
  return PRIMARY_NAV.map((item, index) => ({
    id: item.id,
    nameTh: messages.nav[item.labelKey],
    nameEn: messages.nav[item.labelKey],
    menuOrder: (index + 1) * 10,
    inMenu: true,
    /* หน้าแรกแก้ด้วยบล็อกได้ (มีเอกสาร) · หน้าอื่นยังใช้เลย์เอาต์ที่ออกแบบไว้ */
    editor: item.id === "home" ? "blocks" : "designed",
    seo: EMPTY_PAGE_SEO,
  }));
}

/** ชื่อหน้าที่ใช้ได้: ตัดช่องว่างซ้ำ · ว่าง = ใช้ไม่ได้ · ยาวเกินเพดาน = ตัดให้พอดี */
export function normalizePageName(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed === "") return null;
  return trimmed.slice(0, MAX_PAGE_NAME_LENGTH);
}

export type PageIssue = { readonly code: string; readonly path: string };

/** ตรวจชื่อหน้า: ไทยบังคับ · อังกฤษเว้นได้ (ถ้าเว้น ใช้ชื่อไทยทั้งสองภาษา) */
export function validatePageName(nameTh: string, nameEn: string): readonly PageIssue[] {
  const issues: PageIssue[] = [];
  if (nameTh.trim() === "") issues.push({ code: "empty-th", path: "nameTh" });
  if (nameTh.length > MAX_PAGE_NAME_LENGTH) issues.push({ code: "too-long", path: "nameTh" });
  if (nameEn.length > MAX_PAGE_NAME_LENGTH) issues.push({ code: "too-long", path: "nameEn" });
  return issues;
}

/** เรียงตามลำดับเมนู แล้วค่อยตาม id (ผลลัพธ์คงที่เสมอ — เทสต์ได้) */
export function sortPages(pages: readonly PageRecord[]): readonly PageRecord[] {
  return [...pages].sort((left, right) => (left.menuOrder === right.menuOrder ? left.id.localeCompare(right.id) : left.menuOrder - right.menuOrder));
}

/** ชื่อที่ใช้แสดง: อังกฤษว่าง = ใช้ไทย */
export function pageLabel(page: PageRecord, locale: "th" | "en"): string {
  if (locale === "en" && page.nameEn.trim() !== "") return page.nameEn;
  return page.nameTh;
}

export function isPageEditor(value: unknown): value is PageEditor {
  return value === "blocks" || value === "designed";
}
