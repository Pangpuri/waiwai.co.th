import assert from "node:assert/strict";
import { test } from "node:test";

import { codeOf } from "./source-scan.ts";

/**
 * เทสต์ "พรีวิวต้องอยู่ในสายตาตลอดเวลาเมื่อกล่องตั้งค่ายาว" (รอบที่ 301)
 *
 * ที่มา (คำเจ้าของ): *"พวก live view นี่เรายืดด้านล่างให้ลงไปเทียบเท่ากับกล่องตั้งค่าได้ไหม
 * เวลากล่องตั้งค่าเยอะ ๆ มันต้องเลื่อนขึ้นลงเพื่อมาดู live view ตลอด"*
 *
 * ต้นเหตุจริง: กล่องพ่อของฟอร์มใช้ `lg:items-start` ⇒ คอลัมน์พรีวิวสูงเท่าตัวเอง
 * ⇒ `sticky` มีพื้นที่ให้เลื่อนแค่ไม่กี่ร้อยพิกเซล แล้วหลุดจอเมื่อฟอร์มยาว
 *
 * ด่านนี้ล็อก 3 อย่าง
 * 1. CSS กลาง `.admin-preview-rail` ต้อง sticky + จำกัดความสูงไม่เกินวิวพอร์ต (พรีวิวยาวเลื่อนในกล่องเอง)
 * 2. จอแก้ทั้ง 3 (สินค้า · เมนูอาหาร · ข่าว/กิจกรรม) ต้องใช้คลาสกลางนี้
 * 3. ฟอร์มของจอเหล่านั้น **ห้าม** ใส่ `lg:items-start` (ต้นเหตุเดิม) และห้ามกลับไปเขียน sticky เอง
 */

const CSS = codeOf("app/globals.css");
const RAIL_RULE = CSS.match(/\.admin-preview-rail\s*\{([^}]*)\}/);

test("preview rail: CSS กลางต้อง sticky + จำกัดความสูงไม่เกินจอ", () => {
  assert.ok(RAIL_RULE !== null, "ต้องมีกฎ .admin-preview-rail ใน app/globals.css");

  const body = RAIL_RULE[1] ?? "";
  assert.ok(body.includes("position: sticky"), "คอลัมน์พรีวิวต้อง sticky");
  assert.ok(body.includes("top: 1.5rem"), "ต้องติดขอบบน 1.5rem (เท่า top-6 เดิม)");
  assert.ok(
    body.includes("max-height: calc(100dvh - 3rem)"),
    "ต้องจำกัดความสูงไม่เกินวิวพอร์ต (พรีวิวที่ยาวเกินให้เลื่อนในกล่องเอง)",
  );
  assert.ok(body.includes("overflow-y: auto"), "พรีวิวที่สูงเกินจอต้องเลื่อนในกล่องได้");
  /*
    ⚠️ บทเรียนรอบที่ 301: เจ้าของรายงาน "แรนเดอร์ไม่หยุด" หลังใส่ overflow-y: auto
    ⇒ แถบเลื่อนโผล่/หาย → ความกว้างที่ PreviewFrame วัดเปลี่ยน → ResizeObserver วน
    ⇒ ต้องจองที่แถบเลื่อนไว้เสมอ (scrollbar-gutter: stable) ห้ามถอดออก
  */
  assert.ok(
    body.includes("scrollbar-gutter: stable"),
    "ห้ามลืม scrollbar-gutter: stable (กันลูปวัดขนาดของ PreviewFrame — เจอจริงรอบ 301)",
  );
  assert.ok(
    CSS.includes("@media (min-width: 64rem)") && CSS.indexOf("@media (min-width: 64rem)") < CSS.indexOf(".admin-preview-rail"),
    "กฎนี้ต้องอยู่ภายใต้จอใหญ่ (มือถือเรียงลงมาเป็นคอลัมน์เดียว)",
  );
});

test("preview rail: PreviewFrame ต้องกัน re-render ซ้ำเมื่อค่าที่วัดไม่เปลี่ยน", () => {
  /* อีกชั้นของการกันลูป: วัดแล้วเท่าเดิมต้องไม่ setState (functional update คืนค่าเดิม) */
  const frame = codeOf("features/admin/ui/preview-frame.tsx");
  assert.ok(
    frame.includes("setScale((current)"),
    "ต้องเทียบ scale กับค่าล่าสุดก่อนตั้ง state (กัน ResizeObserver สั่งเรนเดอร์รัว ๆ)",
  );
  assert.ok(
    frame.includes("setInnerHeight((current)"),
    "ต้องเทียบความสูงกับค่าล่าสุดก่อนตั้ง state",
  );
});

test("preview rail: ตัวสร้างหน้าเว็บยืดช่องพรีวิวเต็มคอลัมน์ + iframe สูงพอดีช่อง", () => {
  /*
    รอบที่ 302 (เจ้าของ): "ส่วนล่างไม่ได้ยืดลงมา" — จอตัวสร้างหน้าเว็บ
    ⇒ กล่องพรีวิวต้องกินทุกแถวของคอลัมน์ตั้งค่า และช่อง iframe ต้องสูงพอดีช่อง (ไม่ใช่สูงคงที่ตามอุปกรณ์)
  */
  const builder = codeOf("features/admin/ui/block-builder.tsx");

  assert.ok(builder.includes("md:row-span-5"), "กล่องพรีวิวต้องกินทุกแถวของคอลัมน์ตั้งค่า (ปัจจุบัน 5 แถว)");
  assert.ok(builder.includes("admin-preview-pane"), "ช่องพรีวิวต้องใช้คลาสกลาง (overflow + scrollbar-gutter)");
  assert.ok(builder.includes("md:min-h-0 md:flex-1"), "ช่องพรีวิวต้องยืดเต็มที่เหลือบนจอใหญ่");
  assert.ok(builder.includes("const renderedHeight ="), "ต้องคำนวณความสูง iframe จากความสูงช่องพรีวิว");
  assert.ok(builder.includes("floor(paneInnerHeight / scale)"), "ความสูง iframe ต้องมาจาก paneInnerHeight / scale");
  assert.ok(builder.includes("height: `${renderedHeight}px`"), "iframe ต้องใช้ renderedHeight (ไม่ใช่ความสูงอุปกรณ์)");
  assert.ok(
    !builder.includes("height: `${previewSize.height}px`"),
    "ห้ามกลับไปตั้ง iframe สูงคงที่ตามขนาดอุปกรณ์ (ทำให้ไม่ยืด)",
  );

  const paneRule = CSS.match(/\.admin-preview-pane\s*\{([^}]*)\}/);
  assert.ok(paneRule !== null, "ต้องมีกฎ .admin-preview-pane ใน app/globals.css");
  const paneBody = paneRule[1] ?? "";
  assert.ok(paneBody.includes("overflow: auto"), "ช่องพรีวิวต้องเลื่อนในตัวเองได้");
  assert.ok(
    paneBody.includes("scrollbar-gutter: stable"),
    "ห้ามลืม scrollbar-gutter: stable (กันลูปวัดขนาดของช่องพรีวิว)",
  );
});

const SCREENS: readonly { readonly file: string; readonly label: string }[] = [
  { file: "features/admin/ui/product-editor-form.tsx", label: "สินค้า" },
  { file: "features/admin/ui/recipe-editor-form.tsx", label: "เมนูอาหาร" },
  { file: "features/admin/ui/news-editor-form.tsx", label: "ข่าว/กิจกรรม" },
];

test("preview rail: จอแก้ทุกจอใช้คลาสกลาง + ไม่มีต้นเหตุ items-start อีก", () => {
  for (const screen of SCREENS) {
    const source = codeOf(screen.file);
    assert.ok(source.includes("admin-preview-rail"), `${screen.label}: ต้องใช้คลาสกลาง admin-preview-rail`);
    assert.ok(
      !source.includes("lg:items-start"),
      `${screen.label}: กล่องพ่อฟอร์มห้ามใช้ lg:items-start (ทำให้คอลัมน์พรีวิวสั้นจน sticky เลื่อนไม่ถึง)`,
    );
    assert.ok(
      !source.includes("lg:sticky lg:top-6"),
      `${screen.label}: ห้ามเขียน sticky เองอีก — ใช้คลาสกลางเพื่อไม่ให้พฤติกรรมหลุดจากกัน`,
    );
  }
});
