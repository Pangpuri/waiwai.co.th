/**
 * ค่าคงที่ของระบบสองภาษา TH/EN
 *
 * ที่นี่เป็น pure module — ไม่แตะ DOM/DB/Next.js จึงเขียน unit test คุมได้
 * (ดู scripts/test-i18n.ts)
 */

export const LOCALES = ["th", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "th";

/** ป้ายชื่อภาษาที่แสดงบนปุ่มสลับภาษา */
export const LOCALE_LABELS: Record<Locale, string> = {
  th: "ไทย",
  en: "English",
};

/** ค่าที่ใส่ใน <html lang="..."> */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  th: "th",
  en: "en",
};

/** ข้อความ alt ของธงชาติ ใช้กับปุ่มสลับภาษา */
export const LOCALE_SWITCH_LABEL: Record<Locale, string> = {
  th: "สลับเป็นภาษาไทย",
  en: "Switch to English",
};

/**
 * type guard — ใช้ narrowing ค่าที่มาจาก URL
 * คืน false ถ้าไม่ใช่ภาษาที่รองรับ (ห้าม throw เพราะค่ามาจากผู้ใช้)
 */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** ตัดสินใจว่าควรใช้ภาษาไหนจาก Accept-Language (ใช้ใน proxy.ts) */
export function resolveLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag = "", q] = part.trim().split(";q=");
      const quality = q === undefined ? 1 : Number.parseFloat(q);
      return {
        tag: tag.trim().toLowerCase(),
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .filter((entry) => entry.tag.length > 0 && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }

  return DEFAULT_LOCALE;
}

/** ต่อ path ให้มี prefix ภาษา — localePath('en', '/products') => '/en/products' */
export function localePath(locale: Locale, path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized === "/" ? `/${locale}` : `/${locale}${normalized}`;
}

/**
 * สร้าง path ของภาษาเป้าหมายจาก pathname ปัจจุบัน
 * ตัด prefix ภาษาเดิมออกก่อน แล้วใส่ภาษาใหม่
 *
 * ตัวอย่าง: switchLocalePath('/en/news/1', 'th') => '/th/news/1'
 */
export function switchLocalePath(pathname: string, next: Locale): string {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);
  const withoutLocale = isLocale(segments[0]) ? segments.slice(1) : segments;
  return `/${[next, ...withoutLocale].join("/")}`;
}

/**
 * สร้าง metadata.alternates (canonical + hreflang) ของหน้าหนึ่ง ๆ
 *
 * ต้องเรียกเป็นรายหน้า — ถ้าไปตั้งที่ layout ทุกหน้าจะประกาศตัวเองเป็นหน้าแรก
 * ทำให้เครื่องค้นหาเข้าใจว่าเนื้อหาอื่นเป็นสำเนาของหน้าแรก
 *
 * ตัวอย่าง: buildAlternates('en', '/about')
 *   → { canonical: '/en/about', languages: { th: '/th/about', en: '/en/about' } }
 */
export function buildAlternates(
  locale: Locale,
  path = "/",
): { readonly canonical: string; readonly languages: Record<string, string> } {
  const suffix = pathSuffix(path);
  const languages: Record<string, string> = {};

  for (const supported of LOCALES) {
    languages[supported] = `/${supported}${suffix}`;
  }

  return { canonical: `/${locale}${suffix}`, languages };
}

/** แปลง path เป็นส่วนต่อท้ายที่ลงท้ายด้วย slash หนึ่งตัวหรือไม่ลงท้ายเลย — หน้าแรกได้สตริงว่าง */
function pathSuffix(path: string): string {
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  const trimmed = withLeadingSlash.replace(/\/+$/, "");
  return trimmed === "/" ? "" : trimmed;
}

/** path ที่ต้องข้ามการ redirect ของ proxy (ไฟล์ static และ internal ของ Next) */
export const PROXY_BYPASS_PREFIXES = [
  "/_next",
  "/api",
  "/icons",
  "/images",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
] as const;

/** true ถ้า pathname นี้ไม่ต้องเติมภาษานำหน้า */
export function shouldBypassLocaleRouting(pathname: string): boolean {
  if (pathname === "/") return false;

  const hasFileExtension = /\.[a-z0-9]+$/i.test(pathname);
  if (hasFileExtension) return true;

  return PROXY_BYPASS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
