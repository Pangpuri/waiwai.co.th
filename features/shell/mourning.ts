import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ภาพในหน้าต่างประกาศไว้อาลัย (แสดงครั้งเดียวเมื่อเข้าเว็บ — ดู lib/mourning-notice.ts)
 *
 * ปัจจุบันมีภาพเดียว: ผู้ใช้ส่งมา 2 ไฟล์แต่เป็นไฟล์เดียวกันเป๊ะ (md5 ตรงกัน)
 * จึงเลือกใช้ไฟล์เดียวไปก่อน — ตัวเลื่อนรองรับหลายภาพอยู่แล้ว (ดู lib/slideshow.ts)
 * เมื่อได้ภาพที่ 2 ให้: วางไฟล์ใน `public/rip/` + เพิ่มรายการที่นี่ + เพิ่มคีย์ alt ทั้งสองภาษา
 * (`mourning.images.<id>.alt`) → ปุ่มลูกศรจะขึ้นเองโดยไม่ต้องแก้คอมโพเนนต์
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
];

/** ข้อมูลภาพ + alt ที่แปลแล้ว (ประกอบใน Server Component แล้วส่งเข้า Client Component) */
export type MourningImageView = MourningImage & { readonly alt: string };

/**
 * เวลาที่ใช้จางหน้าต่างตอนกดปิด (ms) — ต้องตรงกับ transition ใน app/globals.css
 * ถ้าต่างกัน หน้าต่างจะหายก่อนที่ภาพจะจางสุด หรือค้างอยู่เฉย ๆ
 */
export const MOURNING_CLOSE_MS = 420;
