import type { Locale } from "@/lib/i18n/config";
import { CODE_ONLY_PAGE_PATHS, PAGES_ALWAYS_NOINDEX, pathForPage } from "@/lib/pages/paths";
import type { PageRecord } from "@/lib/pages/model";

/**
 * สร้างข้อมูล `sitemap.xml` (X1.4) — **ตรรกะล้วน ทดสอบได้**
 *
 * กติกา
 * - ใส่เฉพาะหน้าที่ **ควรให้เครื่องค้นหาจัดทำดัชนี**: ไม่ถูกตั้ง `noindex` และยังอยู่ในเมนู
 * - มีทั้งภาษาไทยและอังกฤษ (แต่ละภาษาเป็น URL ของตัวเอง)
 * - ลำดับความสำคัญ: หน้าแรกสูงสุด → หน้าหลัก → หน้าอื่น
 * - **หน้าในโค้ด** (เช่น `/privacy`) ไม่ได้อยู่ในตาราง `page` ⇒ ใส่ผ่าน `CODE_ONLY_PAGE_PATHS`
 *   (ไม่งั้นหน้าด้านกฎหมายจะไม่ปรากฏใน sitemap เลย และผู้ใช้ที่กดยินยอมก็หานโยบายไม่เจอจากเครื่องค้นหา)
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

  /* หน้าในโค้ด (ไม่มีแถวในตาราง `page`) — ใส่ตรงนี้เพื่อให้เครื่องค้นหาจัดทำดัชนีได้ */
  for (const page of CODE_ONLY_PAGE_PATHS) {
    for (const locale of options.locales) {
      entries.push({
        url: `${base}/${locale}${page.path}`,
        changeFrequency: "yearly",
        priority: page.priority,
      });
    }
  }

  return entries;
}

/** ข้อมูล `robots.txt` (X1.4) — ห้ามให้เครื่องค้นหาเข้าไปในหลังบ้าน/พรีวิว */
export type RobotsRules = {
  readonly rules: readonly { readonly userAgent: string; readonly allow: string; readonly disallow: readonly string[] }[];
  /** `null` = ไม่ต้องชี้ sitemap (ใช้ตอนปิดปรับปรุง — ยังไม่มีหน้าที่การันตีว่าใช้ได้) */
  readonly sitemap: string | null;
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

/**
 * `robots.txt` ตอนเปิดโหมดปิดปรับปรุง (X2.5)
 *
 * ทำไมต้องเปลี่ยน: ระหว่างปิดปรับปรุง ทุกหน้าเสิร์ฟข้อความชั่วคราว ⇒ ถ้าให้เครื่องค้นหาเก็บไป
 * เราจะได้หน้าว่างติดดัชนี และตอนเปิดเว็บคืนต้องรอ crawler กลับมาใหม่
 * ⇒ บอก "ห้ามเก็บอะไรเลย" + **ไม่ชี้ sitemap** (sitemap คือรายการหน้าที่การันตีว่าใช้ได้ ซึ่งตอนนี้ไม่จริง)
 */
export function buildMaintenanceRobots(): RobotsRules {
  return {
    rules: [{ userAgent: "*", allow: "", disallow: ["/"] }],
    sitemap: null,
  };
}
