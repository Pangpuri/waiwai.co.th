import type { Metadata } from "next";

import { buildAlternates, type Locale } from "@/lib/i18n/config";
import { hasSeoOverride, type PageSeo } from "@/lib/pages/model";

/**
 * ใช้ค่าตั้ง SEO จากหลังบ้านทับ metadata ของหน้า (W2 — ผู้ใช้สั่งตามแผน WP-model)
 *
 * ⚠️ กฎเหล็กของโปรเจกต์: **ไม่ตั้งค่า = เหมือนเดิมเป๊ะ**
 *    ⇒ ถ้าหน้านั้นไม่มีค่าตั้ง SEO เลย ฟังก์ชันนี้คืน `defaults` เดิมทั้งก้อน (ไม่แตะอะไร)
 *
 * แยกเป็น 2 ส่วน
 * - `applySeoToMetadata()` = ตรรกะล้วน (ทดสอบได้ ไม่ต้องมีฐานข้อมูล)
 * - `withPageSeo()` = อ่านค่าจากฐานข้อมูลแล้วเรียกตัวบน (ใช้ใน `generateMetadata`)
 */

export function pickSeoText(th: string, en: string, locale: Locale): string {
  if (locale === "en" && en.trim() !== "") return en;
  return th;
}

/**
 * ค่า SEO ที่จะใช้จริงสำหรับภาษานั้น (คืน null = ไม่มีให้ใช้ → คงค่าเดิม)
 * - ถ้าภาษานั้นว่าง ใช้ค่าของไทยก่อน (ถ้าไทยก็ว่าง = ไม่ใช้)
 */
export function resolveSeo(seo: PageSeo, locale: Locale): { readonly title: string | null; readonly description: string | null; readonly ogImagePath: string | null; readonly noindex: boolean } {
  const title = pickSeoText(seo.titleTh, seo.titleEn, locale).trim();
  const description = pickSeoText(seo.descriptionTh, seo.descriptionEn, locale).trim();

  return {
    title: title === "" ? null : title,
    description: description === "" ? null : description,
    ogImagePath: seo.ogImagePath.trim() === "" ? null : seo.ogImagePath.trim(),
    noindex: seo.noindex,
  };
}

export function applySeoToMetadata(defaults: Metadata, seo: PageSeo, locale: Locale): Metadata {
  /* ไม่มีค่าตั้งเลย ⇒ คืนค่าเดิมทั้งก้อน (ห้ามเปลี่ยนพฤติกรรมเดิม) */
  if (!hasSeoOverride(seo)) return defaults;

  const resolved = resolveSeo(seo, locale);
  const next: Metadata = { ...defaults };

  if (resolved.title !== null) {
    next.title = { absolute: resolved.title };
  }

  if (resolved.description !== null) {
    next.description = resolved.description;
  }

  /* Open Graph: รวมกับของเดิม (ไม่ทับทั้งก้อน) */
  const baseOpenGraph = defaults.openGraph ?? {};
  next.openGraph = {
    ...baseOpenGraph,
    ...(resolved.title === null ? {} : { title: resolved.title }),
    ...(resolved.description === null ? {} : { description: resolved.description }),
    ...(resolved.ogImagePath === null ? {} : { images: [resolved.ogImagePath] }),
  };

  if (resolved.noindex) {
    next.robots = { index: false, follow: false };
  }

  return next;
}

/**
 * อ่านค่า SEO ของหน้านั้นจากฐานข้อมูล แล้วทับ metadata
 *
 * @param loadSeo ฟังก์ชันอ่านค่า (ส่งเข้ามาเพื่อไม่ให้ไฟล์นี้ผูกกับฐานข้อมูล — เทสต์ได้ง่าย)
 */
export async function withPageSeo(
  locale: Locale,
  path: string,
  defaults: Metadata,
  loadSeo: () => Promise<PageSeo | null>,
): Promise<Metadata> {
  const seo = await loadSeo();
  const withDefaults: Metadata = { ...defaults, alternates: defaults.alternates ?? buildAlternates(locale, path) };
  if (seo === null) return withDefaults;
  return applySeoToMetadata(withDefaults, seo, locale);
}
