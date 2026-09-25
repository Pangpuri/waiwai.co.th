/**
 * ตัวช่วยสำหรับ "จางเนื้อหาตอนเลื่อน" (scroll reveal)
 *
 * ที่นี่เป็น pure module — ตัดสินใจอย่างเดียวว่า "ควรเปิดกลไกไหม" จึงเขียน unit test คุมได้
 * การผูก IntersectionObserver จริงอยู่ที่ features/shell/ui/scroll-reveal.tsx
 */

/** attribute บน <html> ที่บอกว่าเปิดกลไกจางแล้ว (สคริปต์ก่อน paint เป็นคนติด) */
export const REVEAL_ATTRIBUTE = "data-reveal";

/** ค่าของ REVEAL_ATTRIBUTE ที่แปลว่า "เปิด" */
export const REVEAL_READY = "ready";

/** attribute บน section ที่ IntersectionObserver ติดเมื่อเนื้อหาเข้ามาในจอแล้ว */
export const REVEALED_ATTRIBUTE = "data-revealed";

/**
 * ระยะเวลาจางเข้า (ms) — ต้องตรงกับ `transition` ของกฎ `[data-reveal="ready"]` ใน app/globals.css
 *
 * รอบที่ 21: การตลาดขอ "เพิ่ม motion delay ตอนเลื่อนเพจลงอีกนิด" → 700 → 900ms
 * (ของเดิม 700ms รู้สึกจบเร็วเกินไป แทบไม่ทันเห็นว่ามีอะไรโผล่มา)
 */
export const REVEAL_DURATION_MS = 900;

/**
 * หน่วงก่อนเริ่มจาง (ms) — ต้องตรงกับ delay ใน transition ของ CSS
 *
 * นี่คือ "motion delay" ที่การตลาดขอ: นิ่งนิดหนึ่งก่อนค่อยจางเข้า ไม่ใช่โผล่ทันทีที่แตะขอบจอ
 * (ยังสั้นพอไม่ให้รู้สึกหน่วง)
 */
export const REVEAL_DELAY_MS = 90;

/**
 * ขอบเขตที่ถือว่า "เข้ามาในจอแล้ว" — ส่งให้ IntersectionObserver
 *
 * ค่าลบด้านล่าง = ต้องเลื่อน section ให้พ้นขอบล่างของจอขึ้นมาเท่านั้นก่อนจึงเริ่มจาง
 * รอบที่ 21: −12% → −18% (เริ่มช้าลงอีกนิด ให้สอดคล้องกับที่ขอให้หน่วงขึ้น)
 */
export const REVEAL_ROOT_MARGIN = "0px 0px -18% 0px";

export type RevealEnv = {
  readonly hasIntersectionObserver: boolean;
  readonly prefersReducedMotion: boolean;
};

/**
 * ควรเปิดกลไกจางเนื้อหาไหม
 *
 * - ไม่มี IntersectionObserver → ไม่เปิด (เนื้อหาต้องแสดงปกติเสมอ ดีกว่าเสี่ยงเนื้อหาหาย)
 * - ผู้ใช้ขอ reduced-motion → ไม่เปิด (ห้ามฝืน)
 */
export function shouldRevealOnScroll({ hasIntersectionObserver, prefersReducedMotion }: RevealEnv): boolean {
  return hasIntersectionObserver && !prefersReducedMotion;
}

/**
 * สคริปต์ก่อน paint — ติด attribute ที่ <html> เพื่อให้ CSS ซ่อนเนื้อหาได้ตั้งแต่เฟรมแรก
 * (ถ้ารอ React ค่อยซ่อน ผู้ใช้จะเห็นเนื้อหาโผล่มาก่อนแล้วค่อยหายไป = จอวาบ)
 *
 * ⚠️ ตรรกะต้องตรงกับ shouldRevealOnScroll() ด้านบน (ฝั่ง client เช็คซ้ำอีกชั้น)
 */
export const REVEAL_INIT_SCRIPT = `(function(){try{if(!("IntersectionObserver" in window))return;if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;document.documentElement.setAttribute(${JSON.stringify(REVEAL_ATTRIBUTE)},${JSON.stringify(REVEAL_READY)});}catch(_){}})();`;
