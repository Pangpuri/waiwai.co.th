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
  /** ⚠️ true = ยังมีลายน้ำของเพจต้นทางติดอยู่ในภาพ */
  readonly watermarked: boolean;
};

export const HERO_SLIDES: readonly HeroSlide[] = [
  {
    id: "flavours",
    src: "/slide/flavours-banner.jpg",
    width: 1693,
    height: 845,
    // ป้าย 2 รสซ้าย/ขวา — เอาตรงกลางไว้ให้เห็นทั้งสองฝั่ง (ฝั่งซ้ายจะถูกฉากมืดกับข้อความทับ)
    objectPosition: "center center",
    watermarked: false,
  },
  {
    id: "event",
    src: "/slide/event2.jpg",
    width: 1280,
    height: 720,
    // ผู้บริหารถือซอง WOW หน้าเวที "54th ANNIVERSARY" — ผู้แสดงอยู่ค่อนไปทางขวา จึงดันกรอบขึ้นเล็กน้อย
    objectPosition: "center 35%",
    watermarked: true,
  },
  {
    id: "promotion",
    src: "/slide/products.jpg",
    width: 1200,
    height: 675,
    // ป้ายเปิดตัว WOW 3 รส (พื้นเหลือง) — หัวข้ออยู่ช่วงบน จึงดันกรอบขึ้นเล็กน้อยไม่ให้ข้อความถูกตัด
    objectPosition: "center 35%",
    watermarked: false,
  },
];

/** ข้อมูลสไลด์ + alt ที่แปลแล้ว (ประกอบใน Server Component แล้วส่งเข้า Client Component) */
export type HeroSlideView = HeroSlide & { readonly alt: string };
