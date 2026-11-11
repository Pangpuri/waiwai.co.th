import type { HeroSlideView } from "@/features/home/slides";
import { managedHeroSlideViews } from "@/features/home/slides";
import { heroCardContentOf, type HeroCardContent } from "@/lib/content/home-card";
import { heroTextsOf, type HeroTexts } from "@/lib/content/home-hero";
import { loadHomeContentSafely } from "@/lib/content/repository";
import { cardRatioOf } from "@/lib/hero/pr-card-frame";
import { listHeroPageSlides, loadHeroSetting } from "@/lib/hero/repository";
import { loadMediaSizes } from "@/lib/media/repository";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ข้อมูลของ hero หน้าแรก (สไลด์ · ข้อความ · การ์ดประกาศ) — **แหล่งเดียว**
 *
 * ทำไมต้องแยก
 * - หน้าแรกจริง (`app/[lang]/page.tsx`) กับ **ลิงก์พรีวิวชั่วคราว** (`/preview/t/<token>`)
 *   ต้องเห็น hero ชุดเดียวกัน ⇒ ถ้าต่างคนต่างโหลด/ประกอบเอง เดี๋ยวจะหลุดจากกัน
 * - ตรรกะการเลือกค่า (ค่าหลังบ้านทับพจนานุกรม) อยู่ใน `lib/content/home-*` แล้ว
 *   ที่นี่ทำแค่ "โหลด + ประกอบเป็นวิวเดียว" ให้ผู้เรียกทั้งสองทาง
 *
 * ⚠️ ไฟล์นี้แตะ DB ⇒ ใช้จาก Server Component เท่านั้น
 */

export type HomeHeroView = {
  /** เนื้อหาแบบฟิลด์ของหน้าแรก (ใช้ต่อกับ `whereToBuyViewOf` ด้วย) */
  readonly homeContent: Awaited<ReturnType<typeof loadHomeContentSafely>>;
  readonly heroSetting: Awaited<ReturnType<typeof loadHeroSetting>>;
  readonly heroCard: HeroCardContent;
  readonly heroTexts: HeroTexts;
  readonly slides: readonly HeroSlideView[];
};

export async function loadHomeHeroView(locale: Locale, messages: Messages): Promise<HomeHeroView> {
  const homeContent = await loadHomeContentSafely();
  const heroSetting = await loadHeroSetting();
  const cardContent = heroCardContentOf(homeContent, messages, locale);
  const cardMediaId = cardContent.image.src.startsWith("/media/") ? cardContent.image.src.slice("/media/".length) : "";
  const cardSizes = cardMediaId === "" ? null : await loadMediaSizes([cardMediaId]);

  return {
    homeContent,
    heroSetting,
    heroCard: {
      ...cardContent,
      frame: heroSetting.prCardFrame,
      imageRatio: cardRatioOf(heroSetting.prCardFrame, cardSizes?.get(cardMediaId)),
    },
    heroTexts: heroTextsOf(homeContent, messages, locale),
    slides: managedHeroSlideViews(await listHeroPageSlides(locale), locale),
  };
}
