/**
 * "ส่วนไหนของหน้าแรกแก้ที่ไหน" — รอบที่ 226 (เคลียร์หนี้ "แก้ได้สองที่" ตามที่เจ้าของสั่ง)
 *
 * ปัญหาที่เจ้าของชี้: *"เคลียส่วนซ้ำซ้อนก่อนเลยครับ ผู้นำไปใช้เข้าใจผิดง่าย"*
 * หน้าจอ `/admin/content/home` เปิดฟิลด์ของ **ทุกส่วน** แต่ของจริงหน้าเว็บอ่านค่าเพียงบางส่วน
 * ⇒ ฟิลด์ที่เหลือกลายเป็น **UI หลอกตา** (กรอกแล้วไม่มีผล) และซ้ำกับที่อื่น (ตัวสร้างหน้าเว็บ/เมนูสไลด์/ฐานข้อมูล)
 *
 * กติกา (แหล่งความจริงเดียวต่อส่วน)
 * - `whereToBuy` = **แก้ที่นี่เท่านั้น** (หน้าเว็บอ่านค่าจริง — รอบ 209) ⇒ ไม่มีป้ายเตือน
 * - ส่วนอื่น = แสดงจากระบบอื่น (ตัวสร้างหน้าเว็บ · เมนูสไลด์ · ฐานข้อมูล · ตั้งค่า SEO)
 *   ⇒ หน้าจอต้อง **บอกตรง ๆ** ว่าค่าที่กรอกตรงนี้ยังไม่ถูกนำไปแสดง (ไม่ลบฟิลด์ทิ้ง = ไม่ทำข้อมูลหาย)
 *
 * ตรรกะล้วน ⇒ ทดสอบได้ด้วย `node --test`
 */
export type SectionOwner = {
  /** คีย์ของส่วนใน `HOME_SECTIONS` */
  readonly key: string;
  /** หน้าจอที่ "เป็นเจ้าของ" ค่าจริง */
  readonly screen: string;
};

export const HOME_SECTION_OWNERS: readonly SectionOwner[] = [
  /* หัวหน้าแรก + สไลด์ + การ์ด PR: เจ้าของคือเมนู "สไลด์ & แคมเปญ" (หน้าแรกเรนเดอร์จากที่นั่น — รอบ 217) */
  { key: "hero", screen: "/admin/hero" },
  /* ส่วนข้อมูลจริง 3 ส่วน + จดหมายข่าว: เจ้าของคือตัวสร้างหน้าเว็บ/ฐานข้อมูล (บล็อกไดนามิก รอบ 211–224) */
  /* "ที่ซื้อสินค้า": เจ้าของย้ายมาที่ตัวสร้างหน้าเว็บ (บล็อก marketplaceLinks · รอบที่ 229) */
  { key: "whereToBuy", screen: "/admin/builder/home" },
  { key: "products", screen: "/admin/builder/home" },
  { key: "recipes", screen: "/admin/builder/home" },
  { key: "news", screen: "/admin/builder/home" },
  { key: "newsletter", screen: "/admin/builder/home" },
  /* SEO รายหน้า: เจ้าของคือหน้าตั้งค่าส่วนกลาง */
  { key: "seo", screen: "/admin/settings" },
];

/** ส่วนนี้ถูกดูแลที่อื่นไหม (คืน null = หน้านี้เป็นเจ้าของค่าจริง) */
export function ownerOfSection(key: string): SectionOwner | null {
  return HOME_SECTION_OWNERS.find((entry) => entry.key === key) ?? null;
}

/** คีย์ที่หน้าจอนี้เป็นเจ้าของค่าจริง (ใช้ล็อกด้วยเทสต์) */
export const HOME_SECTIONS_OWNED_HERE: readonly string[] = [];
