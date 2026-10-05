import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  BRAND_APPLE_TOUCH_ICON,
  BRAND_ASSET_PATHS,
  BRAND_FAVICON,
  BRAND_ICONS,
  BRAND_LOGO,
  BRAND_OG_IMAGE,
} from "@/lib/brand/assets";
import { readImageInfo } from "@/lib/media/image-info";

/**
 * เทสต์ "ไฟล์แบรนด์" (รอบที่ 109) — โลโก้ navbar/footer · favicon · ไอคอนแอป · การ์ดแชร์
 *
 * บริบทจริง
 * - เจ้าของส่ง `logo/logo_navbar_footer.gif` (8192×1463 · 211 KB) และ `logo/logo_title.png` (1536×820 · 1.4 MB)
 *   ⇒ ใหญ่เกินใช้บนเว็บ และ `next/image` ปรับขนาด GIF ไม่ได้ ⇒ ต้อง **เตรียมไฟล์ใหม่** ไว้ใน `public/`
 * - โฟลเดอร์ `logo/` **ไม่ถูก commit** (เหมือน /slide/ · /cer/) ⇒ โค้ดเว็บห้ามอ้างไฟล์ในโฟลเดอร์นั้น
 *   (ถ้าอ้าง build บนเซิร์ฟเวอร์จะพัง) — เทสต์นี้กันไว้
 *
 * สิ่งที่ล็อกไว้
 * 1. ไฟล์ที่ประกาศใน `lib/brand/assets.ts` มีจริง และ **ขนาดตรงกับที่ประกาศ** (กันคนเปลี่ยนภาพแล้วลืมอัปเดตตัวเลข)
 * 2. เป็น PNG/JPEG และ **ไฟล์ไม่ใหญ่เกินงบ** (โลโก้/ไอคอน ≤ 120 KB · การ์ดแชร์ ≤ 150 KB)
 * 3. favicon เป็น ICO จริง (magic bytes) และมี `apple-touch-icon` ขนาด 180
 * 4. โลโก้ใน navbar/footer ใช้ค่าจากแหล่งเดียว + เป็นภาพ **decorative** (`alt=""`) เพราะลิงก์มี `aria-label` แล้ว
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/** `/brand/x.png` → พาธบนดิสก์ใน `public/` */
function publicPathOf(assetPath: string): string {
  return path.join(ROOT, "public", assetPath.replace(/^\//, ""));
}

test("brand: ไฟล์โลโก้/ไอคอน/การ์ดแชร์มีจริง และขนาดตรงกับที่ประกาศ", () => {
  const logo = readImageInfo(readFileSync(publicPathOf(BRAND_LOGO.path)));
  assert.ok(logo !== null, `${BRAND_LOGO.path} ต้องเป็น PNG/JPEG/WebP ที่อ่านหัวไฟล์ได้`);
  assert.equal(logo.width, BRAND_LOGO.width, "ความกว้างโลโก้ต้องตรงกับ lib/brand/assets.ts");
  assert.equal(logo.height, BRAND_LOGO.height, "ความสูงโลโก้ต้องตรงกับ lib/brand/assets.ts");
  assert.equal(logo.mime, "image/png", "โลโก้ต้องเป็น PNG (รักษาพื้นหลังโปร่งใส)");

  const og = readImageInfo(readFileSync(publicPathOf(BRAND_OG_IMAGE.path)));
  assert.ok(og !== null, "การ์ดแชร์ต้องอ่านหัวไฟล์ได้");
  assert.equal(og.width, BRAND_OG_IMAGE.width);
  assert.equal(og.height, BRAND_OG_IMAGE.height);
  assert.equal(og.width / og.height, BRAND_OG_IMAGE.width / BRAND_OG_IMAGE.height, "อัตราส่วนต้องคงเดิม");

  /* ไอคอน: ขนาดที่ประกาศใน metadata ต้องตรงกับไฟล์จริง (192/512/180) */
  for (const icon of BRAND_ICONS) {
    const info = readImageInfo(readFileSync(publicPathOf(icon.path)));
    assert.ok(info !== null, `${icon.path} ต้องอ่านหัวไฟล์ได้`);
    assert.equal(icon.sizes, `${info.width}x${info.height}`, `sizes ของ ${icon.path} ต้องตรงกับไฟล์จริง`);
    assert.equal(info.width, info.height, "ไอคอนแท็บต้องเป็นจัตุรัส");
    assert.equal(icon.width, info.width, "ความกว้างที่ประกาศต้องตรงกับไฟล์");
  }

  const apple = readImageInfo(readFileSync(publicPathOf(BRAND_APPLE_TOUCH_ICON.path)));
  assert.ok(apple !== null);
  assert.equal(
    BRAND_APPLE_TOUCH_ICON.sizes,
    `${apple.width}x${apple.height}`,
    "sizes ของ apple-touch-icon ต้องตรงกับไฟล์จริง",
  );
  assert.equal(apple.width, apple.height, "ไอคอนแอปต้องเป็นจัตุรัส");
});

test("brand: ไฟล์ไม่ใหญ่เกินงบ (บทเรียน: ต้นฉบับ 211 KB / 1.4 MB ใช้บนเว็บตรง ๆ ไม่ได้)", () => {
  const budgetKb: Readonly<Record<string, number>> = {
    [BRAND_LOGO.path]: 120,
    ...Object.fromEntries(BRAND_ICONS.map((icon) => [icon.path, 120])),
    [BRAND_APPLE_TOUCH_ICON.path]: 120,
    [BRAND_OG_IMAGE.path]: 150,
    [BRAND_FAVICON.path]: 20,
  };

  for (const assetPath of BRAND_ASSET_PATHS) {
    const sizeKb = statSync(publicPathOf(assetPath)).size / 1024;
    const limit = budgetKb[assetPath] ?? 120;
    assert.ok(sizeKb > 0, `${assetPath} ต้องไม่ใช่ไฟล์ว่าง`);
    assert.ok(sizeKb <= limit, `${assetPath} ใหญ่เกินงบ: ${sizeKb.toFixed(0)} KB > ${limit} KB`);
  }

  /* favicon ต้องเป็น ICO จริง (00 00 01 00) ไม่ใช่ PNG ที่เปลี่ยนชื่อ */
  const ico = readFileSync(publicPathOf(BRAND_FAVICON.path));
  assert.equal(ico.readUInt16LE(0), 0, "favicon ต้องเริ่มด้วย 00 00");
  assert.equal(ico.readUInt16LE(2), 1, "favicon ต้องเป็นชนิด ICO (1)");
});

test("brand: โลโก้ที่ใช้ในเว็บต้องอยู่ใน public/ เท่านั้น (ห้ามอ้างโฟลเดอร์ต้นทาง logo/)", () => {
  for (const assetPath of BRAND_ASSET_PATHS) {
    assert.ok(
      !assetPath.startsWith("/logo"),
      `${assetPath}: โฟลเดอร์ logo/ ไม่ถูก commit ⇒ build บนเซิร์ฟเวอร์จะพัง`,
    );
    assert.ok(assetPath.startsWith("/brand/") || assetPath === "/favicon.ico");
  }

  const files = ["features/shell/ui/brand-mark.tsx", "app/[lang]/layout.tsx"];
  for (const file of files) {
    const source = sourceOf(file);
    assert.ok(!/["'`]\/logo\//.test(source), `${file} ห้ามอ้างไฟล์ในโฟลเดอร์ต้นทาง logo/`);
  }
});

test("brand: navbar/footer ใช้โลโก้ภาพจริง (ไม่ใช่ตัวอักษรจัดวาง) และเป็นภาพ decorative", () => {
  const brandMark = sourceOf("features/shell/ui/brand-mark.tsx");

  assert.ok(brandMark.includes("BRAND_LOGO.path"), "ต้องใช้พาธจาก lib/brand/assets.ts (แหล่งเดียว)");
  assert.ok(brandMark.includes('alt=""'), "ลิงก์มี aria-label อยู่แล้ว ⇒ รูปต้องเป็น decorative");
  assert.ok(brandMark.includes("aria-label={label}"), "ต้องคง accessible name เดิมไว้");
  assert.ok(
    brandMark.includes("BRAND_LOGO.width") && brandMark.includes("BRAND_LOGO.height"),
    "ต้องระบุ width/height จริง กันภาพกระตุก (CLS)",
  );
  assert.ok(brandMark.includes("WORDMARK"), "ยังต้องมี WORDMARK ให้ส่วนอื่น (เรื่องราวแบรนด์) ใช้เป็นข้อความ");

  /* header = จอแรก ⇒ โหลดก่อน ; footer = ไม่ต้อง */
  assert.ok(sourceOf("features/shell/ui/site-header.tsx").includes("eager"), "โลโก้ใน header ควรโหลดก่อน");
  assert.ok(!sourceOf("features/shell/ui/site-footer.tsx").includes("eager"), "โลโก้ใน footer ไม่ต้อง eager");
});

/*
  รอบที่ 113 — เจ้าของแจ้งว่า "โลโก้ใน navbar ล้นจอบนมือถือ"
  สาเหตุจริง: โลโก้กว้าง 5.52 เท่าของความสูง (ไม่ใช่สี่เหลี่ยมจัตุรัส) ⇒ ต้องคิด "ความกว้าง" ไม่ใช่ดูแค่ความสูง
  เทสต์นี้คำนวณความกว้างที่ต้องใช้จริงเทียบกับจอแคบสุดที่ต้องรองรับ (320px) โดยใช้ "สัดส่วนไฟล์จริง"
  ⇒ ถ้าใครขยับขนาดโลโก้บนมือถือให้ใหญ่ขึ้น (เช่นกลับไป h-8/h-9) เทสต์จะฟ้องทันทีพร้อมตัวเลข
*/
test("brand: โลโก้ใน navbar ต้องพอดีจอแคบ (คำนวณจากสัดส่วนไฟล์จริง)", () => {
  const ratio = BRAND_LOGO.width / BRAND_LOGO.height; // 800/145 = 5.52
  /** ความกว้างที่ต้องใช้ = ความสูงโลโก้ × สัดส่วน + ระยะห่าง/ปุ่มที่แชร์แถวเดียวกัน */
  const widthAt = (heightPx: number): number =>
    heightPx * ratio +
    8 + // padding ของลิงก์โลโก้ (p-1 = 4px × 2)
    12 + // gap-3 ระหว่างโลโก้กับกลุ่มปุ่ม
    (40 + 8 + 40) + // ปุ่มธีม (h-10 w-10) + gap-2 + ปุ่มเมนูมือถือ (h-10 w-10)
    40; // padding ของ container-site (1.25rem × 2)

  const NARROWEST_PHONE = 320; // จอแคบสุดที่ต้องรองรับ (iPhone SE รุ่นแรก และมือถือรุ่นเล็ก)
  const mobileWidth = widthAt(28); // h-7 = 28px = ค่าที่ใช้บนมือถือ

  assert.ok(
    mobileWidth <= NARROWEST_PHONE,
    `โลโก้บนมือถือ (h-7) ต้องพอดีจอ ${NARROWEST_PHONE}px — คำนวณได้ ${mobileWidth.toFixed(1)}px`,
  );
  assert.ok(
    widthAt(32) > NARROWEST_PHONE,
    "ยืนยันโจทย์เดิม: h-8 (ค่าก่อนแก้) ต้องล้นจอ 320px — ถ้าเลขนี้ไม่ล้น แปลว่าสูตรคำนวณผิด",
  );

  /* ต้องมีตัวกันล้นสำรองสำหรับจอเล็กกว่า 320px (เช่น Galaxy Fold ปิดฝา = 280px) */
  const brandMark = sourceOf("features/shell/ui/brand-mark.tsx");
  assert.ok(brandMark.includes("max-w-[46vw]"), "ต้องจำกัดความกว้างโลโก้เป็นสัดส่วนของจอ (กันล้น)");
  assert.ok(brandMark.includes("object-contain"), "ย่อแล้วห้ามยืด/ตัดสัดส่วนรูป");
  /* ขนาดต้องไล่บันได h-7 (มือถือ) → sm:h-8 → lg:h-11 (ตรวจทีละคลาส ไม่ผูกกับลำดับในสตริง) */
  for (const sizeClass of ["h-7", "sm:h-8", "lg:h-11"]) {
    assert.ok(brandMark.includes(sizeClass), `ขนาดโลโก้ต้องมีคลาส ${sizeClass}`);
  }

  /* โลโก้ที่อัปโหลดจากหลังบ้านก็ต้องมีตัวกันล้นเหมือนกัน (ไม่ใช่แค่โลโก้ในโค้ด) */
  for (const file of ["features/shell/ui/site-header.tsx", "features/shell/ui/site-footer.tsx"]) {
    assert.ok(sourceOf(file).includes("max-w-[46vw]"), `${file}: โลโก้ที่อัปโหลดต้องมีตัวกันล้น`);
  }
});

test("brand: favicon/OG ตั้งเป็นค่าเริ่มต้นของแบรนด์ แต่หลังบ้านยัง override ได้", () => {
  const layout = sourceOf("app/[lang]/layout.tsx");

  assert.ok(layout.includes("BRAND_ICONS.map"), "ไอคอนเริ่มต้นต้องมาจากไฟล์แบรนด์ (ทุกระดับขนาด)");
  assert.ok(layout.includes("BRAND_APPLE_TOUCH_ICON.path"), "ต้องมี apple-touch-icon");
  assert.ok(layout.includes("BRAND_OG_IMAGE.path"), "การ์ดแชร์เริ่มต้นต้องมาจากไฟล์แบรนด์");
  assert.ok(
    layout.includes('settings.favicon !== ""'),
    "ยังต้องให้ค่าจากหลังบ้าน (ตั้งค่าส่วนกลาง) override favicon ได้",
  );
  assert.ok(
    layout.includes('settings.defaultOgImage === ""'),
    "ยังต้องให้ค่าจากหลังบ้าน override การ์ดแชร์ได้",
  );
});
