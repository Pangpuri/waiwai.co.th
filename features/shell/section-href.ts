/**
 * แยก "พาธ" กับ "hash" ของลิงก์ภายในหน้า — รอบที่ 248 · **ตรรกะล้วน ทดสอบได้**
 *
 * ## เคสจริงจากเจ้าของ
 * *"หน้าแรกพัง 1 จุด ปุ่มสั่งซื้อสินค้าออนไลน์ ไม่วิ่งไปหาบล็อกสั่งซื้อสินค้า"*
 * ปุ่มบนหัวเว็บชี้ `/th#where-to-buy` ⇒ เดิมเรนเดอร์ด้วย `<Link>` ของ Next ซึ่งเป็นการนำทางฝั่งไคลเอนต์
 * ⇒ **ถ้า URL มี `#where-to-buy` อยู่แล้ว (กดครั้งที่สอง) จะไม่มีการนำทางเกิดขึ้น = ไม่เลื่อนไปหาส่วนนั้น**
 * (และแม้กดครั้งแรก ในบางเส้นทางก็ไม่เลื่อนเพราะปลายทางถูกมองว่าเป็น "หน้าเดิม")
 *
 * ⇒ ต้องแยกให้ออกว่า "ลิงก์นี้ไปที่ส่วนใน **หน้าเดียวกัน**" ไหม แล้วจัดการเองด้วย `scrollIntoView`
 *   (ดู `features/shell/ui/section-anchor.tsx`) — ที่นี่คือตรรกะการแยก ไม่มี React/เบราว์เซอร์
 */

export type SectionHref = {
  /** พาธก่อน `#` (ว่าง = ลิงก์ไปส่วนของหน้าปัจจุบัน เช่น `#where-to-buy`) */
  readonly path: string;
  /** hash ที่ตัด `#` ออกแล้ว (`null` = ลิงก์นี้ไม่มี hash) */
  readonly hash: string | null;
};

export function splitSectionHref(href: string): SectionHref {
  const index = href.indexOf("#");
  if (index < 0) return { path: href, hash: null };

  const path = href.slice(0, index);
  const hash = href.slice(index + 1);
  /* `#` เปล่า ๆ (หรือ `#` ท้ายสุด) ไม่นับว่าเป็นปลายทาง */
  return { path, hash: hash === "" ? null : hash };
}

/**
 * ลิงก์นี้เลื่อนไปยังส่วนใน **หน้าเดียวกัน** หรือไม่
 * @param href ลิงก์เต็ม (เช่น `/th#where-to-buy` หรือ `#where-to-buy`)
 * @param pathname พาธปัจจุบันจาก `usePathname()` (ไม่มี hash)
 */
export function isSamePageSection(href: string, pathname: string): boolean {
  const { path, hash } = splitSectionHref(href);
  if (hash === null) return false;
  /* `#section` (ไม่มีพาธ) = หน้าเดียวกันเสมอ · มีพาธ = ต้องตรงกับหน้าปัจจุบัน */
  return path === "" || path === pathname;
}
