import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CATALOG_ITEMS,
  catalogSlugs,
  findCatalogItem,
} from "@/features/products/catalog";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

/** ขนาดจริงของไฟล์ PNG (IHDR อยู่ต้นไฟล์: กว้างที่ offset 16, สูงที่ 20) */
function readPngSize(filePath: string): { width: number; height: number } {
  const buffer = readFileSync(filePath);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test("CATALOG_ITEMS: id และ slug ไม่ซ้ำ", () => {
  const ids = CATALOG_ITEMS.map((item) => item.id);
  const slugs = CATALOG_ITEMS.map((item) => item.slug);

  assert.equal(new Set(ids).size, ids.length, "มี id ซ้ำ");
  assert.equal(new Set(slugs).size, slugs.length, "มี slug ซ้ำ");
  assert.ok(CATALOG_ITEMS.length > 0, "ไม่มีหมวดสินค้าเลย");
});

test("CATALOG_ITEMS: ไฟล์ภาพมีอยู่จริงใน public/ และเป็น PNG", () => {
  for (const item of CATALOG_ITEMS) {
    assert.ok(item.image.src.startsWith("/products/"), `${item.id}: path ต้องอยู่ใต้ /products/`);

    const filePath = path.join(PROJECT_ROOT, "public", item.image.src.replace(/^\//, ""));
    assert.ok(existsSync(filePath), `${item.id}: ไม่พบไฟล์ ${filePath}`);

    const buffer = readFileSync(filePath);
    const signature = buffer.subarray(0, 8).toString("hex");
    assert.equal(signature, "89504e470d0a1a0a", `${item.id}: ไม่ใช่ไฟล์ PNG`);
  }
});

test("CATALOG_ITEMS: ขนาดที่ประกาศต้องตรงกับไฟล์จริง (กันภาพกระตุก/สัดส่วนผิด)", () => {
  for (const item of CATALOG_ITEMS) {
    const filePath = path.join(PROJECT_ROOT, "public", item.image.src.replace(/^\//, ""));
    const actual = readPngSize(filePath);

    assert.equal(
      item.image.width,
      actual.width,
      `${item.id}: width ประกาศ ${item.image.width} แต่ไฟล์จริง ${actual.width}`,
    );
    assert.equal(
      item.image.height,
      actual.height,
      `${item.id}: height ประกาศ ${item.image.height} แต่ไฟล์จริง ${actual.height}`,
    );
  }
});

test("พจนานุกรม productsPage: ชื่อหมวดและ alt ต้องครบทั้งสองภาษา", () => {
  for (const item of CATALOG_ITEMS) {
    for (const [locale, messages] of [
      ["th", th],
      ["en", en],
    ] as const) {
      const copy = messages.productsPage.items[item.id];
      assert.ok(copy.name.trim().length > 0, `${locale} ขาดชื่อหมวด ${item.id}`);
      assert.ok(copy.imageAlt.trim().length > 0, `${locale} ขาด alt ${item.id}`);
    }
  }
});

test("productsPage: ข้อความ 'ตัวอย่างรออนุมัติ' ต้องมีจริง และ alt ต้องไม่ใช่คำ placeholder", () => {
  for (const [locale, messages] of [
    ["th", th],
    ["en", en],
  ] as const) {
    const m = messages.productsPage;

    for (const [name, value] of [
      ["eyebrow", m.eyebrow],
      ["title", m.title],
      ["intro", m.intro],
      ["notice", m.notice],
      ["cardCta", m.cardCta],
      ["detailStub.eyebrow", m.detailStub.eyebrow],
      ["detailStub.title", m.detailStub.title],
      ["detailStub.body", m.detailStub.body],
      ["detailStub.back", m.detailStub.back],
      ["meta.title", m.meta.title],
      ["meta.description", m.meta.description],
    ] as const) {
      assert.ok(value.trim().length > 0, `${locale}: ${name} ว่าง`);
    }

    for (const item of CATALOG_ITEMS) {
      const alt = m.items[item.id].imageAlt;
      assert.ok(!alt.includes("ภาพตัวอย่าง"), `${locale}: alt ของ ${item.id} ยังเป็นคำ placeholder`);
      assert.ok(
        !alt.toLowerCase().includes("placeholder"),
        `${locale}: alt ของ ${item.id} ยังเป็นคำ placeholder`,
      );
    }
  }
});

test("productsPage: ชื่อหมวดต้องไม่มีอักขระหลุดหัวท้าย (กัน ':' หลุดเข้าไปในชื่อ)", () => {
  for (const item of CATALOG_ITEMS) {
    for (const [locale, messages] of [
      ["th", th],
      ["en", en],
    ] as const) {
      const { name } = messages.productsPage.items[item.id];
      assert.equal(name, name.trim(), `${locale}/${item.id}: name มีช่องว่างหัวท้าย`);
      assert.ok(
        !/^[\s:;,.·\-–—]/.test(name),
        `${locale}/${item.id}: name มีเครื่องหมายนำหน้าโดยไม่ตั้งใจ`,
      );
    }
  }
});

test("productsPage: ต้องไม่เหลือชื่อแบรนด์เดิม (ชื่อยืนยันแล้ว vs ภาพที่ดูคล้าย)", () => {
  // บทเรียนรอบที่ 22 — โลโก้ในภาพเขียนคล้ายชื่อเดิมมาก และผลอ่านภาพเพี้ยนได้
  // ชื่อจริงคือ SERDA / Noodie (เจ้าของยืนยันแล้ว) → กันการ "แก้กลับ" ตามภาพโดยไม่ตั้งใจ
  const legacyNames = ["VIRODA", "วีรอดะ", "Noodle", "นูดเดิ้ล"];

  for (const [locale, messages] of [
    ["th", th],
    ["en", en],
  ] as const) {
    const names = CATALOG_ITEMS.map((item) => messages.productsPage.items[item.id].name);
    for (const legacy of legacyNames) {
      assert.ok(
        !names.some((name) => name.includes(legacy)),
        `${locale}: ยังมีชื่อแบรนด์เดิม "${legacy}" หลงเหลือ`,
      );
    }
  }

  assert.ok(th.productsPage.items.serda.name.includes("SERDA"), "th: serda ต้องสะกด SERDA");
  assert.ok(en.productsPage.items.serda.name.includes("Serda"), "en: serda ต้องสะกด Serda");
  assert.ok(th.productsPage.items.noodie.name.includes("Noodie"), "th: noodie ต้องสะกด Noodie");
  assert.ok(en.productsPage.items.noodie.name.includes("Noodie"), "en: noodie ต้องสะกด Noodie");
});

test("findCatalogItem / catalogSlugs: หา slug ได้ถูก และไม่รู้จักต้องคืน undefined", () => {
  assert.deepEqual(catalogSlugs(), CATALOG_ITEMS.map((item) => item.slug));

  const first = CATALOG_ITEMS[0];
  assert.ok(first, "ไม่มีรายการให้ทดสอบ");
  assert.equal(findCatalogItem(first.slug)?.id, first.id);

  assert.equal(findCatalogItem("ไม่มีหมวดนี้"), undefined);
  assert.equal(findCatalogItem(""), undefined);
});
