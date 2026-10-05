/**
 * ไฟล์แบรนด์ที่ใช้จริงบนเว็บ (รอบที่ 109 · อัปเดตไอคอนรอบที่ 110) — **แหล่งความจริงเดียว** ของพาธ + ขนาด
 *
 * ที่มา: เจ้าของส่งไฟล์ต้นทางมาในโฟลเดอร์ `logo/` (ไม่ commit — ดู .gitignore)
 * - `logo/logo_navbar_footer.gif` (8192×1463 · โปร่งใส) → `public/brand/logo-navbar.png` (กว้าง 800 · 60 KB)
 * - `logo/logo_title.png` (1536×820 · โปร่งใส)     → การ์ดแชร์ `og-default.jpg` (1200×630)
 * - `logo/icon_web.png` (1302×1302 · **พื้นขาวทึบ**) → ไอคอนเว็บ/แอป (192 · 512 · apple-touch 180 · favicon.ico)
 *   · ⚠️ รอบที่ 110 เปลี่ยนไอคอนมาใช้ไฟล์นี้ตามที่เจ้าของสั่ง (เดิมตัดจาก `logo_title.png`)
 *   · เตรียมไฟล์: ตัด **ขอบขาว** รอบลายออกให้เหลือกรอบจัตุรัสเล็กสุดที่ยังคลุมลายทั้งเส้น
 *     (ลายกินความกว้าง 100% · ความสูง 41% ของกรอบ — สูงกว่านี้ไม่ได้ถ้าไม่ตัดลายออก)
 *
 * ⚠️ กติกา
 * - **ห้ามอ้างไฟล์ใน `logo/` จากโค้ดเว็บ** (โฟลเดอร์นั้นไม่ถูก commit ⇒ build บนเซิร์ฟเวอร์จะพัง)
 * - ขนาดในไฟล์นี้ต้องตรงกับไฟล์จริง — มีเทสต์ตรวจทุกครั้ง (`scripts/test-brand-assets.ts`)
 * - เปลี่ยนภาพเมื่อไร ต้องอัปเดตตัวเลขที่นี่ + เตรียมไฟล์ใหม่ (ขั้นตอนอยู่ใน PRODUCT_ROADMAP § 10)
 */

/** โลโก้ใน navbar/footer (มีทั้งซองสินค้าและตัวอักษร ตามที่เจ้าของให้มา) */
export const BRAND_LOGO = { path: "/brand/logo-navbar.png", width: 800, height: 145 } as const;

/**
 * ไอคอนเว็บ/แอป — เรียงจากเล็กไปใหญ่ (ประกาศทั้งคู่ใน `<link rel="icon">`)
 * · 192 = ขนาดมาตรฐาน Android/Chrome · 512 = ใช้ทำไอคอนแอป/PWA ในอนาคต
 */
export const BRAND_ICONS = [
  { path: "/brand/icon-192.png", sizes: "192x192", width: 192, height: 192 },
  { path: "/brand/icon-512.png", sizes: "512x512", width: 512, height: 512 },
] as const;

/** ไอคอนแอปของ iOS — พื้นขาว (ไฟล์ต้นทางเป็นพื้นขาวอยู่แล้ว) */
export const BRAND_APPLE_TOUCH_ICON = {
  path: "/brand/apple-touch-icon.png",
  sizes: "180x180",
  width: 180,
  height: 180,
} as const;

/** การ์ดแชร์ลิงก์ (OG) ค่าเริ่มต้น — หลังบ้าน (ตั้งค่าส่วนกลาง) override ได้ */
export const BRAND_OG_IMAGE = { path: "/brand/og-default.jpg", width: 1200, height: 630 } as const;

/** favicon มาตรฐาน — วางเป็นไฟล์นิ่งที่ `public/favicon.ico` (เบราว์เซอร์ร้องขอพาธนี้เอง) */
export const BRAND_FAVICON = { path: "/favicon.ico" } as const;

/** ทุกไฟล์ที่ต้องมีบนดิสก์ (ใช้ในเทสต์/enforcement) */
export const BRAND_ASSET_PATHS: readonly string[] = [
  BRAND_LOGO.path,
  ...BRAND_ICONS.map((icon) => icon.path),
  BRAND_APPLE_TOUCH_ICON.path,
  BRAND_OG_IMAGE.path,
  BRAND_FAVICON.path,
];
