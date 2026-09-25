/**
 * อ่านสถานะ "แสดง/ไม่แสดง" จาก attribute บน `<html>` — แหล่งความจริงเดียวของประกาศที่ CSS คุมการแสดง
 *
 * ทำไมต้องอ่านจาก DOM: การแสดงผลถูกตัดสินด้วย CSS ตั้งแต่ก่อน paint (สคริปต์ก่อน paint ติด attribute)
 * React จึงไม่ใช่เจ้าของสถานะนั้น · ฝั่งคอมโพเนนต์แค่ "เฝ้าดู" ว่า attribute เปลี่ยนเมื่อไหร่
 *
 * ใช้ `useSyncExternalStore` แทน `useEffect` + `setState` เพราะ:
 *  - ไม่เกิด cascading render (อ่านค่าได้ทันทีในรอบ render แรกฝั่ง client)
 *  - มี `getServerSnapshot` แยกให้ จึงไม่พังตอน prerender (ฝั่งเซิร์ฟเวอร์ตอบ false เสมอ
 *    แล้ว CSS เปิดให้เองตั้งแต่ก่อน paint — ไม่ต้องรอ JS ของ React)
 *
 * `read` ต้องเสถียร (module-level store ตัวเดียวต่อ attribute) ไม่งั้น useSyncExternalStore จะ resubscribe ทุกรอบ
 */

export type AttributeStore = {
  /** เฝ้าการเปลี่ยน attribute บน <html> — คืนฟังก์ชันเลิกรับฟัง */
  readonly subscribe: (onStoreChange: () => void) => () => void;
  /** ค่าปัจจุบัน (อ่านจาก DOM จริง) */
  readonly read: () => boolean;
  /** ค่าตอน prerender ฝั่งเซิร์ฟเวอร์ — ไม่มี DOM ให้อ่าน */
  readonly readOnServer: () => boolean;
};

export function createAttributeStore(attribute: string, shownValue: string): AttributeStore {
  return {
    subscribe(onStoreChange) {
      if (typeof MutationObserver === "undefined") return () => {};

      const observer = new MutationObserver(onStoreChange);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: [attribute] });

      return () => observer.disconnect();
    },
    read() {
      return document.documentElement.getAttribute(attribute) === shownValue;
    },
    readOnServer() {
      return false;
    },
  };
}
