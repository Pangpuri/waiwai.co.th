/**
 * กติกาการใช้ "เริ่มจากเนื้อหาปัจจุบัน" (เทมเพลต) — รอบที่ 225 (เคลียร์หนี้ UX)
 *
 * ปัญหาที่เจ้าของชี้: *"แอดมินที่มาทำหน้าที่ปรับเปลี่ยนจะงงตายแน่"* — ปุ่มเทมเพลตเคยแสดง
 * **เฉพาะหน้าที่ไม่มีฉบับร่าง** ⇒ พอมีฉบับร่างแล้วหาไม่เจอ และไม่มีทาง "เริ่มใหม่" ได้เลย
 *
 * กติกาใหม่
 * - มีฉบับร่างอยู่ + ผู้ใช้กดใช้เทมเพลต ⇒ **ต้องติ๊กยืนยัน** (`confirm=overwrite`) ไม่งั้นไม่ทำอะไร (fail-closed)
 * - ยังไม่มีฉบับร่าง ⇒ ไม่ต้องยืนยัน (ไม่มีอะไรให้ทับ)
 *
 * ตรรกะล้วน ⇒ ทดสอบได้ด้วย `node --test`
 */
export const TEMPLATE_CONFIRM_VALUE = "overwrite";

export type TemplateApplyDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: "needs-confirm" };

export function decideTemplateApply(input: {
  readonly hasDraft: boolean;
  readonly confirmValue: string;
}): TemplateApplyDecision {
  if (!input.hasDraft) return { allowed: true };
  return input.confirmValue.trim() === TEMPLATE_CONFIRM_VALUE ? { allowed: true } : { allowed: false, reason: "needs-confirm" };
}
