import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * แบบจำลองเมนู — pure module ไม่แตะ DOM/Next.js
 * เรียงเมนูหลักตาม IA เดิมของ waiwai.co.th (ตรวจจริง 2026-09-22)
 */

export type NavLabelKey = keyof Messages["nav"];
export type FooterLinkKey = keyof Messages["footer"]["links"];

export type NavDefinition = {
  readonly id: string;
  readonly labelKey: NavLabelKey;
  /** path แบบไม่รวม prefix ภาษา */
  readonly path: string;
  /**
   * ถ้ามี = ลิงก์ไปยัง anchor ในหน้านั้น (ไม่ต้องใส่ `#`)
   * ใช้กับปุ่ม "สั่งซื้อสินค้าออนไลน์" ที่พาไปยังส่วนช่องทางสั่งซื้อในหน้าแรก
   */
  readonly anchor?: string;
  /** true = ต้องตรงทั้งหมดจึงถือว่า active (ใช้กับหน้าแรก) */
  readonly exact: boolean;
};

export type NavLink = {
  readonly id: string;
  readonly labelKey: NavLabelKey;
  readonly href: string;
  readonly exact: boolean;
};

/**
 * เมนูหลัก — ยึดรายการตามเว็บเดิม waiwai.co.th (ผู้ใช้ยืนยัน 2026-09-25)
 * ลำดับ: หน้าแรก · บริษัท · ใบรับรองมาตรฐาน · คณะผู้บริหาร · ผลิตภัณฑ์ ·
 *        เมนูอาหาร · ข่าวสาร & กิจกรรม · ร่วมงานกับไวไว · ติดต่อเรา
 *
 * ⚠️ บางปลายทางยังไม่ถูกสร้าง (ดู PRODUCT_ROADMAP.md § 9) — ตั้งใจให้เมนูตรง IA ก่อน
 *    ผู้ใช้จะทยอยส่งข้อมูลทีละส่วน แล้วค่อยเติมหน้าปลายทาง
 */
export const PRIMARY_NAV: readonly NavDefinition[] = [
  { id: "home", labelKey: "home", path: "/", exact: true },
  { id: "about", labelKey: "about", path: "/about", exact: true },
  { id: "certifications", labelKey: "certifications", path: "/about/certifications", exact: true },
  { id: "executives", labelKey: "executives", path: "/about/executives", exact: true },
  { id: "products", labelKey: "products", path: "/products", exact: false },
  { id: "recipes", labelKey: "recipes", path: "/recipes", exact: false },
  { id: "news", labelKey: "news", path: "/news", exact: false },
  { id: "careers", labelKey: "careers", path: "/careers", exact: false },
  { id: "contact", labelKey: "contact", path: "/contact", exact: false },
];

/**
 * ปุ่มหลักบน header (CTA) = "สั่งซื้อสินค้าออนไลน์"
 *
 * ยังไม่มีหน้า /where-to-buy จึงพาไปยังส่วน "ที่ซื้อสินค้า" ในหน้าแรก ที่มีปุ่ม
 * Shopee / Lazada / LINE Shop อยู่จริง — ไม่ปล่อยให้ปุ่มหลักของเว็บไป 404
 * (เมื่อทำหน้า /where-to-buy เสร็จ ให้เปลี่ยน path กลับมาเป็น "/where-to-buy")
 */
export const HEADER_CTA: NavDefinition = {
  id: "shop-online",
  labelKey: "shopOnline",
  path: "/",
  anchor: "where-to-buy",
  exact: false,
};

function toNavLink(item: NavDefinition, locale: Locale): NavLink {
  const base = localePath(locale, item.path);
  const href = item.anchor === undefined ? base : `${base}#${item.anchor}`;

  return {
    id: item.id,
    labelKey: item.labelKey,
    href,
    exact: item.exact,
  };
}

/** เมนูหลักของภาษาเป้าหมาย (ไม่รวมปุ่ม CTA) */
export function buildPrimaryNav(locale: Locale): readonly NavLink[] {
  return PRIMARY_NAV.map((item) => toNavLink(item, locale));
}

/** ปุ่ม CTA บน header ของภาษาเป้าหมาย */
export function buildHeaderCta(locale: Locale): NavLink {
  return toNavLink(HEADER_CTA, locale);
}

/** normalize path ก่อนเทียบ: ตัด trailing slash และ query ออก */
export function normalizePath(pathname: string): string {
  const withoutQuery = pathname.split("?")[0]?.split("#")[0] ?? "";
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

/**
 * เมนูนี้ตรงกับหน้าปัจจุบันหรือไม่
 * - exact = true ต้องเท่ากันเท่านั้น (หน้าแรก ไม่ควร active ทุกหน้า)
 * - exact = false ให้ active กับหน้าลูกด้วย เช่น /products/tom-yum
 */
export function isActivePath(
  currentPath: string,
  href: string,
  exact = false,
): boolean {
  const current = normalizePath(currentPath);
  const target = normalizePath(href);

  if (current === target) return true;
  if (exact) return false;

  return current.startsWith(`${target}/`);
}

/**
 * id ของเมนูที่ควร active — เลือกตัวที่ path ตรง "ยาวที่สุด" เพียงตัวเดียว
 *
 * เหตุผล: เมนูหลักมีทั้งเมนูแม่และเมนูลูก ("บริษัท" = /about และ
 * "ใบรับรองมาตรฐาน" = /about/certifications) ถ้าเช็ค isActivePath ทีละอัน
 * ทั้งสองจะ active พร้อมกัน → ที่นี่ให้เมนูที่เฉพาะเจาะจงที่สุดชนะ
 * คืน null เมื่อไม่มีเมนูใดตรง (เช่นหน้าที่ยังไม่มีในเมนู)
 */
export function activeNavId(
  currentPath: string,
  links: readonly { readonly id: string; readonly href: string; readonly exact: boolean }[],
): string | null {
  let bestId: string | null = null;
  let bestLength = -1;

  for (const link of links) {
    if (!isActivePath(currentPath, link.href, link.exact)) continue;

    const length = normalizePath(link.href).length;
    if (length > bestLength) {
      bestId = link.id;
      bestLength = length;
    }
  }

  return bestId;
}

/* ── เมนูส่วนท้าย ─────────────────────────────────────────── */

type FooterColumnTitleKey = "companyColumn" | "productsColumn" | "supportColumn";

export type FooterLinkDefinition = {
  readonly labelKey: FooterLinkKey;
  readonly path: string;
};

export type FooterColumnDefinition = {
  readonly id: string;
  readonly titleKey: FooterColumnTitleKey;
  readonly links: readonly FooterLinkDefinition[];
};

export const FOOTER_COLUMNS: readonly FooterColumnDefinition[] = [
  {
    id: "company",
    titleKey: "companyColumn",
    links: [
      { labelKey: "about", path: "/about" },
      { labelKey: "executives", path: "/about/executives" },
      { labelKey: "certifications", path: "/about/certifications" },
      { labelKey: "sustainability", path: "/sustainability" },
      { labelKey: "careers", path: "/careers" },
    ],
  },
  {
    id: "products",
    titleKey: "productsColumn",
    links: [
      { labelKey: "allProducts", path: "/products" },
      { labelKey: "recipes", path: "/recipes" },
      { labelKey: "whereToBuy", path: "/where-to-buy" },
      { labelKey: "news", path: "/news" },
    ],
  },
  {
    id: "support",
    titleKey: "supportColumn",
    links: [
      { labelKey: "contact", path: "/contact" },
      { labelKey: "faq", path: "/contact" },
      { labelKey: "privacy", path: "/privacy" },
      { labelKey: "cookies", path: "/cookie-policy" },
      { labelKey: "terms", path: "/terms" },
    ],
  },
];

export function buildFooterColumns(
  locale: Locale,
): readonly {
  readonly id: string;
  readonly titleKey: FooterColumnTitleKey;
  readonly links: readonly { readonly labelKey: FooterLinkKey; readonly href: string }[];
}[] {
  return FOOTER_COLUMNS.map((column) => ({
    id: column.id,
    titleKey: column.titleKey,
    links: column.links.map((link) => ({
      labelKey: link.labelKey,
      href: localePath(locale, link.path),
    })),
  }));
}
