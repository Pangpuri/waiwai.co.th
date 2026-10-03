import type { MetadataRoute } from "next";

import { LOCALES } from "@/lib/i18n/config";
import { isMaintenanceEnabled } from "@/lib/maintenance/plan";
import { buildMaintenanceRobots, buildRobots } from "@/lib/site-settings/sitemap";
import { SITE } from "@/lib/site";

/**
 * `robots.txt` อัตโนมัติ (X1.4) + รู้จักโหมดปิดปรับปรุง (X2.5)
 *
 * - ปกติ: เปิดให้จัดทำดัชนีทั้งเว็บ **ยกเว้น** หลังบ้าน (`/admin`) และหน้าพรีวิว (`/<lang>/preview`) + ชี้ sitemap
 * - **โหมดปิดปรับปรุง:** `Disallow: /` ทั้งเว็บ และไม่ชี้ sitemap
 *   (ระหว่างนั้นทุกหน้าเสิร์ฟข้อความชั่วคราว ⇒ ปล่อยให้ crawler เก็บไป = ได้หน้าว่างติดดัชนี)
 * ⚠️ หน้า /news ตั้ง `noindex` ไว้ในโค้ด (หน้าตัวอย่าง) ⇒ จะไม่อยู่ใน sitemap แต่ยังเข้าได้ปกติ
 *
 * ⚠️ `force-dynamic` **จำเป็น ไม่ใช่ของแถม**
 *   ไฟล์นี้ตัดสินจาก env ⇒ ถ้าปล่อยให้ prerender ค่าจะถูก "อบ" ไว้ตั้งแต่ตอนบิลด์
 *   เคสจริง 2026-10-03: รัน `next start` ด้วย `MAINTENANCE_MODE=1` แต่ `/robots.txt` ยังคืนค่าเดิม
 *   (เพราะบิลด์ครั้งก่อนไม่มี env นั้น) · ไฟล์นี้เล็กมาก การเรนเดอร์สดต่อคำขอจึงไม่มีต้นทุนที่รู้สึกได้
 */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const rules = isMaintenanceEnabled(process.env)
    ? buildMaintenanceRobots()
    : buildRobots({ siteUrl: SITE.url, locales: LOCALES });

  return {
    rules: rules.rules.map((rule) => ({ userAgent: rule.userAgent, allow: rule.allow, disallow: [...rule.disallow] })),
    ...(rules.sitemap === null ? {} : { sitemap: rules.sitemap }),
  };
}
