import type { Locale } from "@/lib/i18n/config";
import { PAGES_ALWAYS_NOINDEX, pathForPage } from "@/lib/pages/paths";
import type { PageRecord } from "@/lib/pages/model";

/**
 * สร้างข้อมูล `sitemap.xml` (X1.4) — **ตรรกะล้วน ทดสอบได้**
 *
 * กติกา
 * - ใส่เฉพาะหน้าที่ **ควรให้เครื่องค้นหาจัดทำดัชนี**: ไม่ถูกตั้ง `noindex` และยังอยู่ในเมนู
 * - มีทั้งภาษาไทยและอังกฤษ (แต่ละภาษาเป็น URL ของตัวเอง)
 * - ลำดับความสำคัญ: หน้าแรกสูงสุด → หน้าหลัก → หน้าอื่น
 */

export type SitemapEntry = {
  readonly url: string;
  readonly changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  readonly priority: number;
};

export function buildSitemapEntries(options: {
  readonly siteUrl: string;
  readonly pages: readonly PageRecord[];
  readonly locales: readonly Locale[];
}): readonly SitemapEntry[] {
  const base = options.siteUrl.replace(/\/+$/, "");
  const entries: SitemapEntry[] = [];

  for (const page of options.pages) {
    /* หน้าที่ไม่ให้จัดทำดัชนี (ตั้งในหลังบ้าน หรือตั้งในโค้ด) หรือซ่อนจากเมนู = ไม่อยู่ใน sitemap */
    if (page.seo.noindex || !page.inMenu) continue;
    if (PAGES_ALWAYS_NOINDEX.includes(page.id)) continue;

    const path = pathForPage(page.id);
    for (const locale of options.locales) {
      const url = `${base}/${locale}${path === "/" ? "" : path}`;
      entries.push({
        url,
        changeFrequency: page.id === "home" ? "weekly" : "monthly",
        priority: page.id === "home" ? 1 : path.split("/").length <= 2 ? 0.8 : 0.6,
      });
    }
  }

  return entries;
}

/** ข้อมูล `robots.txt` (X1.4) — ห้ามให้เครื่องค้นหาเข้าไปในหลังบ้าน/พรีวิว */
export type RobotsRules = {
  readonly rules: readonly { readonly userAgent: string; readonly allow: string; readonly disallow: readonly string[] }[];
  readonly sitemap: string;
};

export function buildRobots(options: { readonly siteUrl: string; readonly locales: readonly Locale[] }): RobotsRules {
  const base = options.siteUrl.replace(/\/+$/, "");
  const previewPaths = options.locales.map((locale) => `/${locale}/preview`);

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", ...previewPaths],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
