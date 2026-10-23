/**
 * ขนาดโลโก้ (ส่วนกลาง) — **แหล่งความจริงเดียว** ของคำว่า "เล็ก / กลาง / ใหญ่"
 *
 * ที่มา (รอบที่ 310 · เคสจริงจากเจ้าของ):
 *   *"ทดสอบปรับโลโก้เป็นขนาดใหญ่ ไม่เป็นขนาดใหญ่แต่ยังคงเป็นขนาดกลางครับ Navbar และ footer"*
 *
 * 🐞 ต้นเหตุที่แท้จริง: บันไดขนาดเดิมของ navbar คือ
 *      sm = `h-7 sm:h-8`  ·  md = `h-8 sm:h-9 lg:h-12`  ·  lg = `h-11 sm:h-12`
 *    ⇒ ที่จอ ≥ 1024px (จอคอม/พรีวิวหลังบ้าน) **md กับ lg ได้ 48px เท่ากัน** (`lg:h-12` = `sm:h-12`)
 *    ⇒ เลือก "ใหญ่" แล้วหน้าตาไม่เปลี่ยนเลย ทั้งที่ค่าในฐานข้อมูลถูกบันทึกจริง
 *    และ footer **ไม่มีช่องตั้งขนาดเลย** (ความสูงถูกฝังในไฟล์ `site-footer.tsx`)
 *
 * กติกาที่ล็อกไว้ (มีเทสต์ `scripts/test-logo-size.ts` คุม):
 *  1. ทุกขั้นต้อง **สูงขึ้นจริงที่ทุกเบรกพอยต์** (base / sm / lg) — ห้ามมีคู่ไหนชนกัน
 *  2. `md` คือค่าที่เว็บใช้อยู่จริงวันนี้ ⇒ ผู้ที่ยังไม่แตะค่าตั้งต้องเห็นหน้าเว็บเหมือนเดิมเป๊ะ
 *  3. ขนาดใหญ่สุดของ navbar ต้อง **ไม่ล้นแถบเมนู** (แถบที่เตี้ยสุดบนจอใหญ่ = compact `lg:h-16` = 64px)
 *
 * ⚠️ คลาสทั้งหมดเป็น Tailwind literal (ห้ามประกอบสตริง) เพื่อให้ JIT สแกนเจอ
 */

export type LogoSize = "sm" | "md" | "lg";

/** ลำดับขั้นจากเล็ก → ใหญ่ (ใช้สร้างตัวเลือกในหน้าจอหลังบ้าน) */
export const LOGO_SIZES: readonly LogoSize[] = ["sm", "md", "lg"];

/**
 * บันไดของ **แถบเมนู (navbar)**
 *
 * | ขั้น | มือถือ | ≥640 | ≥1024 | กว้างโดยประมาณ (โลโก้ 988×216 ≈ 4.57:1) |
 * |---|---|---|---|---|
 * | sm | 28px | 32px | 36px | 128 / 146 / 165 px |
 * | md | 32px | 36px | **48px** | 146 / 165 / 220 px ← ค่าเริ่มต้น (ของเดิมทั้งดุ้น) |
 * | lg | 44px | 48px | **56px** | 201 / 220 / 256 px |
 *
 * 56px ยังอยู่ในแถวที่เตี้ยสุด (compact = 64px บนจอใหญ่) จึงไม่ล้น — มีเทสต์คำนวณไว้
 */
export const NAVBAR_LOGO_HEIGHTS: Readonly<Record<LogoSize, string>> = {
  sm: "h-7 sm:h-8 lg:h-9",
  md: "h-8 sm:h-9 lg:h-12",
  lg: "h-11 sm:h-12 lg:h-14",
};

/**
 * บันไดของ **ท้ายเว็บ (footer)** — โลโก้อยู่แถวของตัวเอง จึงเริ่มใหญ่กว่า navbar หนึ่งขั้น
 * `md` = `h-9 sm:h-10` = ความสูงที่ท้ายเว็บใช้อยู่จริงก่อนรอบนี้ (ผู้ที่ยังไม่ตั้งค่าเห็นเหมือนเดิม)
 */
export const FOOTER_LOGO_HEIGHTS: Readonly<Record<LogoSize, string>> = {
  sm: "h-8 sm:h-9",
  md: "h-9 sm:h-10",
  lg: "h-12 sm:h-14",
};

/** ค่าเริ่มต้นของทั้งสองส่วน = "กลาง" (พฤติกรรมเดิม) */
export const DEFAULT_LOGO_SIZE: LogoSize = "md";

export function isLogoSize(value: unknown): value is LogoSize {
  return typeof value === "string" && (LOGO_SIZES as readonly string[]).includes(value);
}

/**
 * แปลงขนาด → คลาสความสูงของส่วนนั้น
 * ⚠️ ส่ง `ladder` เข้ามาเสมอ (ไม่ให้ฟังก์ชันเดาเองว่าเป็น navbar หรือ footer)
 */
export function logoHeightClass(
  ladder: Readonly<Record<LogoSize, string>>,
  size: LogoSize,
): string {
  return ladder[size];
}
