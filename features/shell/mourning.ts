import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ภาพในหน้าต่างประกาศไว้อาลัย (เด้งทุกครั้งที่โหลดหน้า — ดู lib/mourning-notice.ts)
 *
 * มี 2 ภาพ (ผู้ใช้ส่งมาในรอบที่ 21): ทั้งคู่เป็นประกาศใบเดียวกันในสองแบบ
 *   - `banner`  กรอบแสงรูปไข่ + ลำแสง + เมฆ   (3000×1000)
 *   - `banner2` กรอบลวดลายประกาย + พื้นดำเรียบ (6682×2227)
 * สัดส่วน 3:1 เท่ากันทั้งคู่ → ตอนกดเปลี่ยนภาพ ขนาดกรอบจึงไม่กระตุก
 *
 * ลำดับการแสดง = ลำดับในอาเรย์นี้ (ปุ่มหลักไล่ให้ดูครบก่อนปิด — ดู lib/slideshow.ts)
 * เพิ่มภาพใหม่: วางไฟล์ใน `public/rip/` + เพิ่มรายการที่นี่ + เพิ่มคีย์ `mourning.images.<id>.alt` ทั้ง 2 ภาษา
 * → ลูกศร/จุด/ปุ่มไล่ภาพ ขึ้นเองโดยไม่ต้องแก้คอมโพเนนต์
 */

export type MourningImageId = keyof Messages["mourning"]["images"];

export type MourningImage = {
  readonly id: MourningImageId;
  readonly src: string;
  readonly width: number;
  readonly height: number;
};

export const MOURNING_IMAGES: readonly MourningImage[] = [
  {
    id: "banner",
    src: "/rip/mourning-banner.jpg",
    width: 3000,
    height: 1000,
  },
  {
    id: "banner2",
    src: "/rip/mourning-banner-02.jpg",
    width: 6682,
    height: 2227,
  },
];

/** ข้อมูลภาพ + alt ที่แปลแล้ว (ประกอบใน Server Component แล้วส่งเข้า Client Component) */
export type MourningImageView = MourningImage & { readonly alt: string };

/**
 * เวลาที่ใช้จางหน้าต่างตอนกดปิด (ms) — ต้องตรงกับ transition ใน app/globals.css
 * ถ้าต่างกัน หน้าต่างจะหายก่อนที่ภาพจะจางสุด หรือค้างอยู่เฉย ๆ
 */
export const MOURNING_CLOSE_MS = 420;

/**
 * เวลาจางข้ามภาพตอนกด "ดูภาพต่อไป" (ms) — ต้องตรงกับกฎ `[data-mourning-frame]` ใน app/globals.css
 *
 * สั้นกว่าสไลด์ hero (1400ms) เพราะนี่คือการเปลี่ยนภาพที่ "ผู้ใช้สั่ง" ไม่ใช่ฉากหลังที่เลื่อนเอง
 * — รอนานไปจะรู้สึกหน่วง แต่สั้นเกินไปจะเหมือนภาพกระพริบ · มี unit test เทียบค่านี้กับ CSS ให้
 */
export const MOURNING_SLIDE_FADE_MS = 700;
