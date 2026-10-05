/**
 * หน้าที่ "ยังไม่ทำ" แต่ **ต้องมีอยู่จริงเพื่อไม่ให้ลิงก์เสีย** — ตรรกะล้วน ทดสอบได้
 *
 * ที่มา (ปิดหนี้รอบที่ 81)
 * - ท้ายเว็บ (ค่าเริ่มต้นในโค้ด `features/shell/nav.ts`) ลิงก์ไป `/sustainability` · `/where-to-buy`
 *   · `/cookie-policy` · `/terms` — แต่ **ไม่เคยมีหน้าปลายทาง** ⇒ ผู้ใช้กดแล้วเจอ 404
 * - ทางเลือกคือ "ซ่อนลิงก์" แต่ IA ที่ผู้ใช้อนุมัติให้เมนูตรงตามโครงเว็บจริง ⇒ เลือก **สร้างหน้าปลายทาง**
 *   ที่บอกความจริงว่า "กำลังจัดทำ" (ไม่แต่งเนื้อหาขึ้นเอง — ตามข้อตกลงเรื่องข้อความ placeholder)
 *
 * ⚠️ หน้าที่นี่ **ห้ามขึ้น sitemap และต้อง noindex** (ยังไม่มีเนื้อหาจริง · มีเทสต์คุม)
 * ⚠️ รอบที่ 111: เมนู/ท้ายเว็บ **ไม่ลิงก์มาที่นี่แล้ว** (เจ้าของสั่งเอาลิงก์ออก) — หน้ายังอยู่เพื่อไม่ให้ URL เดิมพัง
 * ⚠️ รอบที่ 112: **`where-to-buy` ถูกลบทั้งหน้าตามคำสั่งเจ้าของ** (สินค้าขายตามร้านทั่วไปอยู่แล้ว
 *    การทำ "ค้นหาร้านใกล้บ้าน" ต้องปักพิกัด/ดูแลข้อมูลทุกร้านต่อเนื่อง ⇒ เกินขอบเขตของเว็บนี้)
 *    ⇒ URL `/where-to-buy` ตกไปที่หน้า 404 ของเว็บเอง (`app/[lang]/[...rest]`) — ถ้าต้องการย้ายแบบ 301
 *      ให้ทำพร้อมงาน "ประวัติ slug" (X2.7 ส่วนที่ 2)
 * ⚠️ พอได้ข้อความจริงจากเจ้าของ: เปลี่ยนหน้าปลายทางเป็นเนื้อหาจริง แล้วเอาชื่อออกจากรายการนี้
 */

export const PENDING_PAGE_IDS = ["sustainability", "cookiePolicy", "terms"] as const;

export type PendingPageId = (typeof PENDING_PAGE_IDS)[number];

/** path จริงบนเว็บของแต่ละหน้า (ที่เดียวที่รู้ — ใช้ทั้งตอนสร้าง route และตอนเทสต์) */
export const PENDING_PAGE_PATHS: Readonly<Record<PendingPageId, string>> = {
  sustainability: "/sustainability",
  cookiePolicy: "/cookie-policy",
  terms: "/terms",
};

export function isPendingPageId(value: string): value is PendingPageId {
  return (PENDING_PAGE_IDS as readonly string[]).includes(value);
}

export function pendingPagePath(id: PendingPageId): string {
  return PENDING_PAGE_PATHS[id];
}

/** ทางกลับที่ไม่ปล่อยให้ผู้ใช้ตัน: หน้าแรก + หน้าติดต่อ */
export const PENDING_PAGE_FALLBACK_PATHS = { home: "/", contact: "/contact" } as const;
