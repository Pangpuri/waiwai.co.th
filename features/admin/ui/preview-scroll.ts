/**
 * ช่วย "เลื่อนหน้าจอหลังบ้านไปหาบล็อกที่เลือกในพรีวิว" — รอบที่ 232
 *
 * บทเรียนจริง (เจ้าของรายงาน): *"คลิกด้านในพรีวิว = จับบล็อกให้เลย แต่คลิกในรายการบล็อก = ไม่วิ่งตาม"*
 * พรีวิวถูกเรนเดอร์เต็มความสูงแล้วย่อด้วย `transform: scale()` (บทเรียนรอบ 33) ⇒
 *   1. เลื่อนใน iframe ไม่ช่วย (iframe ไม่มีที่ให้เลื่อน)
 *   2. `window.scrollTo` ก็ไม่ช่วย ถ้าพรีวิวอยู่ในกล่อง `overflow-auto`
 * ⇒ ต้องหา **คอนเทนเนอร์ที่เลื่อนได้จริง** ก่อน แล้วคำนวณจาก "ความสูงที่เรนเดอร์จริง" (ทนต่อ scale)
 *
 * ตรรกะคำนวณเป็นฟังก์ชันบริสุทธิ์ ⇒ ทดสอบได้ด้วย `node --test`
 */
export type ScrollTargetInput = {
  /** ความสูงของกรอบพรีวิว "ที่เรนเดอร์จริง" (หักสเกลแล้ว) */
  readonly frameHeight: number;
  /** ระยะจากบนของกรอบ (ในคอนเทนเนอร์) */
  readonly frameTop: number;
  /** สัดส่วนตำแหน่งบล็อกในเอกสารพรีวิว (0 = บนสุด) */
  readonly fraction: number;
  /** ตำแหน่งเลื่อนปัจจุบันของคอนเทนเนอร์ */
  readonly scrollTop: number;
  /** เว้นระยะหัวหน้าจอ (พิกเซล) */
  readonly lead?: number;
};

/** ตำแหน่งที่ควรเลื่อนไป (พิกเซล) */
export function scrollTargetFor(input: ScrollTargetInput): number {
  const inside = Number.isFinite(input.fraction) ? Math.min(1, Math.max(0, input.fraction)) : 0;
  const offset = input.frameHeight * inside - (input.lead ?? 120);
  return Math.max(0, input.scrollTop + input.frameTop + offset);
}

/** หาคอนเทนเนอร์ที่ "เลื่อนได้จริง" (null = ต้องเลื่อนที่ window) */
export function scrollableAncestorOf(
  element: HTMLElement | null,
  withStyle: (node: HTMLElement) => CSSStyleDeclaration,
): HTMLElement | null {
  let node = element?.parentElement ?? null;
  while (node !== null) {
    const style = withStyle(node);
    if ((style.overflowY === "auto" || style.overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}
