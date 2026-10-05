import { localePath, type Locale } from "@/lib/i18n/config";

/**
 * เติม prefix ภาษาให้ "ลิงก์ภายในเว็บ" ของบล็อก (รอบที่ 101) — ตรรกะล้วน ทดสอบได้
 *
 * ทำไมต้องมี
 * - เนื้อหาบล็อกเก็บ `href` เป็น **พาธกลาง** (เช่น `/products/instant-noodles`) ไม่ผูกภาษา
 *   ⇒ บล็อกเดียวกันใช้ได้ทั้งหน้าไทย/อังกฤษ และไม่ต้องแก้ข้อมูลเมื่อสลับภาษา
 * - 🔴 เคสจริงที่พบรอบที่ 101: เทมเพลตสินค้าใส่ `/th/products/...` ตรง ๆ ⇒ หน้า `/en/products`
 *   การ์ดพาผู้ใช้ไปหน้าไทย และ CTA `/products` ไม่มี prefix ⇒ proxy ต้องเดาภาษาให้
 *
 * กติกา
 * - `""` / `#…` / `mailto:` / `tel:` / `https://` = **คงเดิม** (ไม่ใช่เส้นทางภายในเว็บ)
 * - พาธที่ขึ้นต้นด้วย `/` และ **ยังไม่มี prefix ภาษา** = เติม `/<ภาษา>` (ใช้ `localePath` ตัวเดียวกับที่อื่น)
 * - มี prefix `/th` หรือ `/en` อยู่แล้ว = **คงเดิม** ⇒ ข้อมูลเก่าที่บันทึกไว้ก่อนรอบนี้ไม่พัง/ไม่ซ้ำ prefix
 *   (แต่เทมเพลตใหม่ต้องเก็บพาธกลางเท่านั้น — มีเทสต์บังคับ)
 * - `/thai…` · `/energy` ไม่ถูกนับว่าเป็น prefix ภาษา (ต้องเท่ากับ `/th`·`/en` หรือขึ้นต้นด้วย `/th/`·`/en/`)
 */
export function localizedBlockHref(href: string, language: Locale): string {
  const value = href.trim();
  if (value === "") return href;
  if (!value.startsWith("/")) return href;

  const hasLocalePrefix =
    value === "/th" || value.startsWith("/th/") || value === "/en" || value.startsWith("/en/");
  if (hasLocalePrefix) return value;

  return localePath(language, value);
}
