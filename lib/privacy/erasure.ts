/**
 * "คำขอใช้สิทธิ์: ลบข้อมูลทั้งหมดของอีเมลนี้" (X2b · หนี้ที่ปิดในรอบที่ 77)
 *
 * บริบท PDPA (ม.30/ม.33): เจ้าของข้อมูลมีสิทธิ์ขอลบ และผู้ควบคุมต้องลบให้ได้จริง
 * ก่อนหน้านี้หลังบ้านลบได้ **ทีละรายการ** เท่านั้น ⇒ ถ้าคนหนึ่งส่ง 3 ฟอร์ม ต้องไล่ลบ 3 ที่
 * และเสี่ยงลบไม่ครบ (ซึ่งแปลว่าเรายังเก็บข้อมูลเขาไว้ทั้งที่เขาขอให้ลบ)
 *
 * ⚠️ ไฟล์นี้เป็น **ตรรกะบริสุทธิ์** (ไม่มี DB/Next) — การอ่าน/ลบจริงอยู่ที่ `lib/privacy/repository.ts`
 *
 * ขอบเขตที่ตัดสินใจไว้ (และเหตุผล — ต้องบอกผู้ขอตามความเป็นจริง ไม่ใช่บอกว่า "ลบหมดแล้ว")
 * - **ลบ:** ข้อมูลที่ผู้ใช้กรอกเองในฟอร์มทั้งหมด (`form_submission` ทุกฟอร์มของอีเมลนั้น
 *   + ไฟล์เรซูเม่ที่ผูกอยู่ ซึ่งหายตามด้วย `on delete cascade`)
 * - **เก็บ:** ร่องรอยความปลอดภัย (`login_attempt`) และบันทึกการทำงานของเจ้าหน้าที่ (`audit_log`)
 *   เพราะเป็นบันทึกเพื่อความมั่นคงปลอดภัย/การตรวจสอบ — และไม่ใช่ข้อมูลที่ผู้ใช้กรอกให้เรา
 *   (นโยบายเก็บของตัวเองมีอยู่แล้วใน `lib/retention/plan.ts`)
 * - **ไม่เขียนอีเมลเต็มลง audit log หลังลบ** — เก็บแบบปิดบางส่วน (`a***@domain`) เพื่อไม่ให้
 *   "ข้อมูลที่เพิ่งลบ" กลับเข้าไปอยู่ในบันทึกทันที (แต่ยังตรวจย้อนหลังได้ว่าใครสั่งลบเมื่อไร)
 */

/** อีเมลที่ใช้ตรวจว่าผู้ดูแลพิมพ์ยืนยันตรงกับคำขอจริง (ตัดช่องว่าง/ตัวพิมพ์ใหญ่-เล็ก) */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * ตรวจว่าอีเมล "พอเป็นอีเมล" ไหมสำหรับเครื่องมือนี้
 * ตั้งใจให้หลวม (ไม่ใช่ validator RFC) — เพราะปลายทางคือ *ต้องมีแถวในฐานข้อมูลให้ลบ*
 * แต่ต้องกันการพิมพ์ผิดจนลบผิดคน เช่นเว้นวรรค/ไม่มี @/ไม่มีโดเมน
 */
export function isPlausibleEmail(raw: string): boolean {
  const value = normalizeEmail(raw);
  if (value === "" || /\s/.test(value)) return false;

  const at = value.indexOf("@");
  if (at <= 0 || at !== value.lastIndexOf("@")) return false;

  const domain = value.slice(at + 1);
  return domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".");
}

/**
 * ปิดบางส่วนของอีเมลสำหรับใช้ในบันทึก (audit) — เก็บโดเมนไว้เพื่อให้ตรวจย้อนหลังได้
 * `someone@example.com` → `s***@example.com` · ค่าที่ไม่ใช่อีเมล → `***`
 */
export function maskEmail(raw: string): string {
  const value = normalizeEmail(raw);
  const at = value.indexOf("@");
  if (at <= 0) return "***";

  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const head = local.slice(0, 1);
  return `${head}***@${domain}`;
}

/** จำนวนแถวที่จะถูกลบ แยกตามฟอร์ม (ใช้ทั้งหน้าจอตรวจสอบก่อนลบและรายงานผล) */
export type ErasureCounts = {
  readonly contact: number;
  readonly newsletter: number;
  readonly careers: number;
  readonly attachments: number;
};

export const EMPTY_ERASURE_COUNTS: ErasureCounts = { contact: 0, newsletter: 0, careers: 0, attachments: 0 };

export function erasureTotal(counts: ErasureCounts): number {
  return counts.contact + counts.newsletter + counts.careers;
}

/** ยังไม่มีอะไรให้ลบ = ไม่ต้องทำอะไร (และต้องบอกผู้ใช้ว่าไม่พบข้อมูล ไม่ใช่เงียบ) */
export function erasureIsEmpty(counts: ErasureCounts): boolean {
  return erasureTotal(counts) === 0;
}

/** ข้อความสั้น ๆ สำหรับ `detail` ของ audit log (ไม่มีข้อมูลส่วนบุคคล) */
export function summarizeErasure(counts: ErasureCounts): string {
  return `contact=${counts.contact} newsletter=${counts.newsletter} careers=${counts.careers} attachments=${counts.attachments}`;
}

export type ErasureCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "invalid-email" | "not-confirmed" | "mismatch" | "not-verified" };

/**
 * ตรวจคำขอจากหน้าจอหลังบ้านก่อนลบจริง
 * ต้องผ่านครบ: อีเมลพอเป็นอีเมล · ยืนยันตัวตนของผู้ขอแล้ว (ติ๊ก) · พิมพ์อีเมลซ้ำตรงกับช่องแรก
 *
 * ⚠️ "ยืนยันตัวตน" ที่นี่คือ **การยืนยันว่าผู้ดูแลได้ทำตามขั้นตอนแล้ว** ไม่ใช่การพิสูจน์ตัวตนอัตโนมัติ
 *    (การพิสูจน์ตัวตนต้องคุยกับคน/อีเมลจริง ⇒ อยู่ในคู่มือปฏิบัติงาน ไม่ใช่ในโค้ด)
 */
export function checkErasureRequest(input: {
  readonly email: string;
  readonly confirmEmail: string;
  readonly verified: boolean;
}): ErasureCheck {
  if (!isPlausibleEmail(input.email)) return { ok: false, reason: "invalid-email" };
  if (!input.verified) return { ok: false, reason: "not-verified" };
  if (normalizeEmail(input.email) !== normalizeEmail(input.confirmEmail)) return { ok: false, reason: "mismatch" };
  return { ok: true };
}
