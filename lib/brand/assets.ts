/**
 * ไฟล์แบรนด์ที่ใช้จริงบนเว็บ (รอบที่ 109) — **แหล่งความจริงเดียว** ของพาธ + ขนาด
 *
 * ที่มา: เจ้าของส่งไฟล์ต้นทางมาในโฟลเดอร์ `logo/` (ไม่ commit — ดู .gitignore)
 * - `logo/logo_navbar_footer.gif` (8192×1463 · โปร่งใส) → `public/brand/logo-navbar.png` (กว้าง 800 · 60 KB)
 * - `logo/logo_title.png` (1536×820 · โปร่งใส)     → ไอคอน (`icon-192` · `apple-touch-icon`) + การ์ดแชร์ (`og-default.jpg`)
 *
 * ⚠️ กติกา
 * - **ห้ามอ้างไฟล์ใน `logo/` จากโค้ดเว็บ** (โฟลเดอร์นั้นไม่ถูก commit ⇒ build บนเซิร์ฟเวอร์จะพัง)
 * - ขนาดในไฟล์นี้ต้องตรงกับไฟล์จริง — มีเทสต์ตรวจทุกครั้ง (`scripts/test-brand-assets.ts`)
 * - เปลี่ยนภาพเมื่อไร ต้องอัปเดตตัวเลขที่นี่ + เตรียมไฟล์ใหม่ (ขั้นตอนอยู่ใน PRODUCT_ROADMAP § 10 รอบที่ 109)
 */

/** โลโก้ใน navbar/footer (มีทั้งซองสินค้าและตัวอักษร ตามที่เจ้าของให้มา) */
export const BRAND_LOGO = { path: "/brand/logo-navbar.png", width: 800, height: 145 } as const;

/** ไอคอนแท็บ/แอป (ตัดจาก `logo_title.png`) */
export const BRAND_ICON = { path: "/brand/icon-192.png", sizes: "192x192" } as const;

/** ไอคอนแอปของ iOS — พื้นขาว เพราะ iOS ทำพื้นโปร่งใสเป็นดำ */
export const BRAND_APPLE_TOUCH_ICON = { path: "/brand/apple-touch-icon.png", sizes: "180x180" } as const;

/** การ์ดแชร์ลิงก์ (OG) ค่าเริ่มต้น — หลังบ้าน (ตั้งค่าส่วนกลาง) override ได้ */
export const BRAND_OG_IMAGE = { path: "/brand/og-default.jpg", width: 1200, height: 630 } as const;

/** favicon มาตรฐาน — วางเป็นไฟล์นิ่งที่ `public/favicon.ico` (เบราว์เซอร์ร้องขอพาธนี้เอง) */
export const BRAND_FAVICON = { path: "/favicon.ico" } as const;

/** ทุกไฟล์ที่ต้องมีบนดิสก์ (ใช้ในเทสต์/enforcement) */
export const BRAND_ASSET_PATHS: readonly string[] = [
  BRAND_LOGO.path,
  BRAND_ICON.path,
  BRAND_APPLE_TOUCH_ICON.path,
  BRAND_OG_IMAGE.path,
  BRAND_FAVICON.path,
];
