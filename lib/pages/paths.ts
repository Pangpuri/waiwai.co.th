/**
 * ที่อยู่ (path) ของแต่ละหน้า — **ที่เดียว** ที่รู้ว่า id ของหน้าไปอยู่ตรงไหนของเว็บ
 *
 * ใช้ร่วมกัน: sitemap · JSON-LD · ลิงก์ในหลังบ้าน (อนาคต: เมนูอัตโนมัติ)
 * ⚠️ ถ้าเพิ่มหน้าใหม่ ต้องเพิ่มที่ `page` (migration/seed) และที่นี่
 */

export const PAGE_PATHS: Readonly<Record<string, string>> = {
  home: "",
  about: "/about",
  certifications: "/about/certifications",
  executives: "/about/executives",
  products: "/products",
  recipes: "/recipes",
  news: "/news",
  careers: "/careers",
  contact: "/contact",
};

/**
 * หน้าที่ "ห้ามจัดทำดัชนีเสมอ" — ตั้งไว้ในโค้ดของหน้านั้น ๆ (`robots: { index: false }`)
 * ⚠️ ต้องตรงกับ sitemap: หน้าที่ noindex ต้องไม่อยู่ใน sitemap (ไม่งั้นเครื่องค้นหาสับสน)
 * ปัจจุบัน: /news = หน้าตัวอย่าง (ดู app/[lang]/news/page.tsx)
 */
export const PAGES_ALWAYS_NOINDEX: readonly string[] = ["news"];

/** path ภายในเว็บ (ไม่รวม prefix ภาษา) — หน้าแรกได้ "/" */
export function pathForPage(id: string): string {
  const path = PAGE_PATHS[id];
  return path === undefined || path === "" ? "/" : path;
}

export function isKnownPagePath(id: string): boolean {
  return id in PAGE_PATHS;
}
