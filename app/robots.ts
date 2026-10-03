import type { MetadataRoute } from "next";

import { LOCALES } from "@/lib/i18n/config";
import { buildRobots } from "@/lib/site-settings/sitemap";
import { SITE } from "@/lib/site";

/**
 * `robots.txt` อัตโนมัติ (X1.4)
 *
 * - เปิดให้จัดทำดัชนีทั้งเว็บ **ยกเว้น** หลังบ้าน (`/admin`) และหน้าพรีวิว (`/<lang>/preview`)
 * - ชี้ไปที่ sitemap.xml ของเรา
 * ⚠️ หน้า /news ตั้ง `noindex` ไว้ในโค้ด (หน้าตัวอย่าง) ⇒ จะไม่อยู่ใน sitemap แต่ยังเข้าได้ปกติ
 */
export default function robots(): MetadataRoute.Robots {
  const rules = buildRobots({ siteUrl: SITE.url, locales: LOCALES });

  return {
    rules: rules.rules.map((rule) => ({ userAgent: rule.userAgent, allow: rule.allow, disallow: [...rule.disallow] })),
    sitemap: rules.sitemap,
  };
}
