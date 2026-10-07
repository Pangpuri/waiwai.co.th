import type { HeroPageSlide } from "@/lib/hero/model";

import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ภาพสไลด์ฉากหลังของ hero หน้าแรก
 *
 * เป็น pure module (ไม่แตะ DOM) → unit test ตรวจได้ว่าไฟล์มีจริงและขนาดตรงกับที่ประกาศ
 * ข้อความ alt อยู่ในพจนานุกรม (`hero.slides.<id>.alt`) — ที่นี่เก็บเฉพาะรหัส/ไฟล์/สี
 *
 * ⚠️ ทั้งสามรูปเป็น "ภาพตัวอย่างรอการตลาดอนุมัติ" (ผู้ใช้ให้มาจากโฟลเดอร์ `slide/`)
 *    รูป `event` (event2.jpg) ยังมีลายน้ำ "METAS NEWS" ของเพจต้นทางติดมาด้วย → ห้ามใช้จริงจนกว่าจะเปลี่ยน
 */

export type HeroSlideId = keyof Messages["hero"]["slides"];

export type HeroSlide = {
  readonly id: HeroSlideId;
  /** path ใต้ public/ */
  readonly src: string;
  /** ขนาดจริงของไฟล์ — ใช้คำนวณสัดส่วน กันภาพกระตุก */
  readonly width: number;
  readonly height: number;
  /**
   * จุดที่ให้ภาพอยู่กลางกรอบ (CSS object-position)
   * ภาพจะถูกครอปเพราะกรอบ hero กว้างกว่าภาพ → ต้องเลือกจุดที่ยังเห็นหน้าคน/ซองสินค้า
   */
  readonly objectPosition: string;
  /**
   * สถานะการอนุมัติภาพ (รอบที่ 108) — เจ้าของสั่งให้ "ทำเครื่องหมายรอภาพ" ให้ชัด
   * - `"pending-owner"` = ภาพตัวอย่าง ยังรอเจ้าของ/การตลาดอนุมัติ
   * - `"watermarked"`  = **ยังมีลายน้ำของเพจต้นทางติดอยู่ในภาพ** ⇒ ห้ามใช้ขึ้นจริงก่อนเปลี่ยน
   * ทั้งสองกรณี หน้าเว็บจะติดป้ายกำกับบนสไลด์ให้เห็น (ข้อความในพจนานุกรม `hero.sampleImageBadge`/`hero.watermarkedImageBadge`)
   */
  readonly reviewStatus: "pending-owner" | "watermarked";
};

export const HERO_SLIDES: readonly HeroSlide[] = [
  {
    id: "flavours",
    src: "/slide/flavours-banner.jpg",
    width: 1693,
    height: 845,
    // ป้าย 2 รสซ้าย/ขวา — เอาตรงกลางไว้ให้เห็นทั้งสองฝั่ง (ฝั่งซ้ายจะถูกฉากมืดกับข้อความทับ)
    objectPosition: "center center",
    reviewStatus: "pending-owner",
  },
  {
    id: "event",
    src: "/slide/event2.jpg",
    width: 1280,
    height: 720,
    // ผู้บริหารถือซอง WOW หน้าเวที "54th ANNIVERSARY" — ผู้แสดงอยู่ค่อนไปทางขวา จึงดันกรอบขึ้นเล็กน้อย
    objectPosition: "center 35%",
    reviewStatus: "watermarked",
  },
  {
    id: "promotion",
    src: "/slide/products.jpg",
    width: 1200,
    height: 675,
    // ป้ายเปิดตัว WOW 3 รส (พื้นเหลือง) — หัวข้ออยู่ช่วงบน จึงดันกรอบขึ้นเล็กน้อยไม่ให้ข้อความถูกตัด
    objectPosition: "center 35%",
    reviewStatus: "pending-owner",
  },
];

/** ข้อมูลสไลด์ + alt ที่แปลแล้ว (ประกอบใน Server Component แล้วส่งเข้า Client Component) */
/**
 * วิวสไลด์ที่ส่งเข้า `HeroSlider`
 * - เทมเพลตเดิม (`HERO_SLIDES`) ส่งครบทุกฟิลด์
 * - **สไลด์จากฐานข้อมูล** (โมดูล "สไลด์ & แคมเปญ" · รอบที่ 184) ไม่มี width/height/สถานะอนุมัติ
 *   ⇒ ฟิลด์เหล่านั้นเป็นตัวเลือก · ไม่ส่ง `reviewStatus` = ไม่มีป้ายกำกับบนสไลด์ (ภาพที่เจ้าของใส่เองไม่ใช่ภาพตัวอย่าง)
 */
export type HeroSlideView = {
  readonly id: string;
  readonly src: string;
  readonly alt: string;
  readonly objectPosition: string;
  readonly width?: number;
  readonly height?: number;
  readonly reviewStatus?: HeroSlide["reviewStatus"];
};

/**
 * แปลงสไลด์จากฐานข้อมูล → วิวที่ `HeroSlider` ใช้ (ตรรกะล้วน · เทสต์ได้โดยไม่มี DOM/DB)
 * · alt: ไทยเป็นหลัก · อังกฤษว่าง = ถอยไปใช้ไทย (แบบเดียวกับสินค้า/เมนู)
 * · จุดโฟกัส (เก็บเป็นเปอร์เซ็นต์อยู่แล้ว) → `object-position` = `"X% Y%"`
 * ⚠️ ซูมยังไม่ถูกใช้ที่นี่ (HeroSlider ยังไม่รองรับ) — ค่อยต่อตอนทำหน้าจอ/เอฟเฟค
 */
export function managedHeroSlideViews(
  slides: readonly HeroPageSlide[],
  locale: "th" | "en",
): readonly HeroSlideView[] {
  return slides.map((slide) => ({
    id: slide.id,
    src: slide.mediaPath,
    alt: locale === "en" && slide.altEn.trim() !== "" ? slide.altEn : slide.altTh,
    objectPosition: `${slide.focusX}% ${slide.focusY}%`,
  }));
}
