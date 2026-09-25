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
