/**
 * เนื้อหาของ "การ์ดประกาศ" ที่แปะมุมขวาล่างของ hero หน้าแรก
 *
 * การ์ดนี้มีไว้ "โชว์อะไรเล็ก ๆ น้อย ๆ" เป็นครั้งคราว (โปรโมชัน/ข่าวสั้น) — ข้อความทั้งหมด
 * อยู่ในพจนานุกรม (`hero.card.*`) ไม่ได้ฝังในคอมโพเนนต์ จึงเปลี่ยนข้อความได้โดยไม่แตะโค้ด
 *
 * รูปแบบที่รองรับตอนนี้: ภาพ 1 ใบ + หัวข้อ + คำโปรย 1–2 บรรทัด + ลิงก์ 1 จุด
 * อยากได้การ์ดแบบอื่น (หลายใบ · ไม่มีภาพ · ลิงก์ภายนอก) → คุยกันก่อน เพราะกระทบดีไซน์ hero
 */

export type HeroCardImage = {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  /**
   * ⚠️ true = ภาพมีลายน้ำ/โลโก้ของเจ้าของต้นทางติดอยู่
   *
   * ภาพการ์ดเป็นโปสเตอร์แคมเปญที่เผยแพร่ทางเพจ (มีลายน้ำ "Brand think" ที่มุมขวาล่าง)
   * ผู้ใช้เลือกภาพนี้มาเพื่อทดสอบดีไซน์ — ถ้าจะขึ้นจริงควรใช้ไฟล์ต้นฉบับที่ไม่มีลายน้ำ
   * หรือขออนุญาตเจ้าของภาพก่อน (เหมือนหมายเหตุของภาพสไลด์ hero)
   */
  readonly watermarked: boolean;
};

export const HERO_CARD_IMAGE: HeroCardImage = {
  src: "/promo/save-waiwai.jpg",
  width: 1407,
  height: 1759,
  watermarked: true,
};

/**
 * เวลาจางการ์ดตอนกดปิด (ms) — ต้องตรงกับ transition ของ `[data-hero-card][data-closing]`
 * ใน app/globals.css (มี unit test เทียบค่าให้)
 */
export const HERO_CARD_CLOSE_MS = 420;

/**
 * รอบของการ "ยิก" เรียกความสนใจ (ms) — ผู้ใช้ขอว่าให้ขยับทุก 2 วินาที (ยิก ๆ แล้วหยุด สลับกัน)
 *
 * ทำด้วย CSS animation ล้วน (ดู `@keyframes hero-card-wiggle` ใน app/globals.css) — ไม่มี JS/setInterval
 * จึงไม่มี render เพิ่ม และหยุดเองเมื่อผู้ใช้ขอ reduced-motion (กฎกลางใน globals.css)
 * · หนึ่งรอบ = "ยิก" ประมาณ 0.7 วินาที แล้ว "หยุด" ที่เหลือ
 * · หยุดยิกให้ด้วยขณะผู้ใช้ hover/โฟกัสในการ์ด หรือตอนกำลังปิดการ์ด
 */
export const HERO_CARD_WIGGLE_MS = 2000;

/** ลิงก์ปลายทางของการ์ด (หน้าที่มีอยู่จริงใน IA — ดู PRODUCT_ROADMAP.md) */
export const HERO_CARD_HREF = "/news";
