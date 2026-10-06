/**
 * ตัวเปลี่ยนเส้นทาง 301 สำหรับ **URL เก่าที่เราย้าย/ลบไปแล้ว** (X2.7 ส่วนที่ 2 · รอบที่ 150)
 *
 * ทำไมต้องมี: ผู้ใช้/เครื่องค้นหา/ลิงก์ที่แชร์ไว้อาจชี้ URL ที่เราเปลี่ยนไปแล้ว
 * ⇒ ต้องตอบ **301 (ย้ายถาวร)** ไปปลายทางใหม่ ไม่ปล่อย 404 (SEO เสีย + ผู้ใช้หลง)
 *
 * ⚠️ ข้อจำกัดสถาปัตยกรรม (สำคัญ)
 *   - **proxy/middleware อ่านฐานข้อมูลไม่ได้** (เอกสาร Next ห้าม + มีเทสต์สแกนซอร์สกันไว้)
 *     ⇒ รายการ 301 ที่นี่จึงเป็น **ค่าคงที่ในโค้ด** ใช้ผ่าน `next.config.ts` → `redirects()`
 *   - ประวัติ slug ที่มาจากฐานข้อมูล (ถ้าจะมีในอนาคต) ต้องทำ **ที่ระดับหน้า** (`permanentRedirect()`)
 *     ซึ่งอ่าน DB ได้อยู่แล้ว — ยังไม่ทำรอบนี้ เพราะยังไม่มีหน้าไหนที่ slug เปลี่ยนได้จากหลังบ้าน
 *     (หมวดสินค้า 6 หมวดถูก "ล็อก" ตามมติ Q-D · งานถัดไปถ้าจะเพิ่มหมวดใหม่ต้องออกแบบคู่กัน)
 *
 * กติกา
 *   1. ทุกกฎต้องมี **ที่มา** ว่าทำไมถึงย้าย (ห้ามเดา URL เอง)
 *   2. แยกทุกกฎเป็น 2 ภาษา (`/th/...` และ `/en/...`) — เว็บนี้ไม่มี URL ที่ไม่มีภาษา
 *   3. `permanent: true` เท่านั้น ⇒ **ย้ายถาวร** (Next ตอบ 308 ซึ่งเป็น permanent + รักษา method · ดีกว่า 302/307)
 *   4. ห้ามชนกับเส้นทางที่ยังใช้งานอยู่ (มีเทสต์ตรวจ)
 */

export type LegacyRedirect = {
  /** พาธเดิม (ไม่มีภาษา — จะถูกขยายเป็นทุกภาษา) */
  readonly from: string;
  /** พาธปลายทาง (ไม่มีภาษา — จะถูกขยายเป็นทุกภาษา) */
  readonly to: string;
  /** ที่มา/เหตุผล (ต้องอ้างได้ว่าใครสั่ง/รอบไหน) */
  readonly reason: string;
};

export const SUPPORTED_LANGS = ["th", "en"] as const;

/**
 * URL เก่าที่รู้จัก (ทุกกฎต้องยืนยันได้จากประวัติ repo — ดู § 10 ของ roadmap)
 *
 * 1. `/where-to-buy` — **ลบหน้า** ตามคำสั่งเจ้าของ (รอบที่ 112: "สินค้าขายตามร้านทั่วไปอยู่แล้ว")
 *    · ปุ่ม/ส่วน "ที่ซื้อสินค้าออนไลน์" ยังอยู่บนหน้าแรกที่ `id="where-to-buy"` ⇒ 301 ไปที่ส่วนนั้น
 * 2. `/about/awards` — หน้ารางวัล **ยังไม่มีเนื้อหา** (ค้างใน § 9) ⇒ 301 ไป `/about` แทนการปล่อย 404
 * 3. หมวดสินค้า 4 พาธที่ **เคยลิงก์ผิด** (รอบที่ 108 พบว่าหน้าแรกฝัง slug เอง)
 *    `packet-noodles` · `cup-noodles` · `ready-to-cook` · `seasoning` ⇒ 301 ไปหน้าหมวดสินค้า
 */
export const LEGACY_REDIRECTS: readonly LegacyRedirect[] = [
  {
    from: "/where-to-buy",
    to: "/#where-to-buy",
    reason: "ลบหน้าตามคำสั่งเจ้าของ (รอบที่ 112) — เนื้อหายังอยู่บนหน้าแรกที่ id=where-to-buy",
  },
  {
    from: "/about/awards",
    to: "/about",
    reason: "หน้ารางวัลยังไม่มีเนื้อหา (หนี้ § 9) — อย่าปล่อย 404",
  },
  { from: "/products/packet-noodles", to: "/products", reason: "slug เก่าที่เคยลิงก์ผิด (รอบที่ 108)" },
  { from: "/products/cup-noodles", to: "/products", reason: "slug เก่าที่เคยลิงก์ผิด (รอบที่ 108)" },
  { from: "/products/ready-to-cook", to: "/products", reason: "slug เก่าที่เคยลิงก์ผิด (รอบที่ 108)" },
  { from: "/products/seasoning", to: "/products", reason: "slug เก่าที่เคยลิงก์ผิด (รอบที่ 108)" },
];

export type NextRedirectRule = {
  readonly source: string;
  readonly destination: string;
  readonly permanent: true;
};

/** ประกอบ "ที่อยู่เต็ม" จากพาธที่ไม่มีภาษา (เติม `/th` หรือ `/en` ให้ทุกภาษา) */
export function localizedPath(path: string, lang: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (suffix === "/") return `/${lang}`;
  /* "/#where-to-buy" = หน้าแรก + anchor ⇒ ต้องเป็น "/th#where-to-buy" ไม่ใช่ "/th/#where-to-buy" */
  if (suffix.startsWith("/#")) return `/${lang}${suffix.slice(1)}`;
  return `/${lang}${suffix}`;
}

/** แปลงเป็นรูปแบบที่ `next.config.ts` → `redirects()` ใช้ (ทุกภาษาของทุกกฎ) */
export function legacyRedirectRules(): readonly NextRedirectRule[] {
  const rules: NextRedirectRule[] = [];
  for (const entry of LEGACY_REDIRECTS) {
    for (const lang of SUPPORTED_LANGS) {
      rules.push({
        source: localizedPath(entry.from, lang),
        destination: localizedPath(entry.to, lang),
        permanent: true,
      });
    }
  }
  return rules;
}
