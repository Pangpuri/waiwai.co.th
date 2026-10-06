import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  bilingualProductText,
  productAllergensOf,
  productDetailsOf,
  productGroupOf,
  productNameOf,
  productNetWeightOf,
  productPackagingOf,
  productTaglineOf,
  type BilingualProductText,
} from "@/lib/products/display";

/**
 * เทสต์ "ข้อความสองภาษาของสินค้า" (รอบที่ 141)
 *
 * มติเจ้าของ (2026-10-06): *"รายละเอียดสินค้า EN ข้ามได้เลย เพราะเราจะไม่ได้รับผิดชอบส่วนนี้
 * เป็นของการตลาด เขาใส่ข้อมูลเอง อาจจะทำฟิลด์ภาษาอังกฤษไว้ให้เผื่อเขาอยากจะใส่เอง"*
 * ⇒ ทีมเว็บไม่แปล แต่ **ช่องต้องมี** และ **หน้า EN ต้องแสดงค่าจริงเมื่อมี** (ว่าง = ถอยไปใช้ไทย · มติ D3/D19)
 *
 * ที่มา: ก่อนรอบนี้ `taglineEn` มีช่องให้กรอกแต่หน้าเว็บไม่เคยแสดง และ 4 ช่องหลังไม่มีฟิลด์ EN เลย
 */

const product: BilingualProductText = {
  nameTh: "บะหมี่กึ่งสำเร็จรูป",
  nameEn: "Instant noodles",
  groupTh: "กลุ่มบะหมี่",
  groupEn: "Noodle group",
  taglineTh: "คำโปรยไทย",
  taglineEn: "English tagline",
  detailsTh: "รายละเอียดไทย",
  detailsEn: "English details",
  allergensTh: "มีกลูเตน",
  allergensEn: "Contains gluten",
  netWeightTh: "55 กรัม",
  netWeightEn: "55 g",
  packagingTh: "ซอง",
  packagingEn: "Sachet",
};

const emptyEn: BilingualProductText = {
  ...product,
  nameEn: "",
  groupEn: "",
  taglineEn: "   ",
  detailsEn: "",
  allergensEn: "",
  netWeightEn: "",
  packagingEn: "",
};

test("products display: มีค่า EN แล้วต้องแสดง EN ทุกช่อง", () => {
  assert.equal(productNameOf(product, "en"), "Instant noodles");
  assert.equal(productGroupOf(product, "en"), "Noodle group");
  assert.equal(productTaglineOf(product, "en"), "English tagline");
  assert.equal(productDetailsOf(product, "en"), "English details");
  assert.equal(productAllergensOf(product, "en"), "Contains gluten");
  assert.equal(productNetWeightOf(product, "en"), "55 g");
  assert.equal(productPackagingOf(product, "en"), "Sachet");
});

test("products display: ภาษาไทยต้องเห็นไทยเสมอ (ไม่ถูกค่าอังกฤษกลบ)", () => {
  assert.equal(productNameOf(product, "th"), "บะหมี่กึ่งสำเร็จรูป");
  assert.equal(productTaglineOf(product, "th"), "คำโปรยไทย");
  assert.equal(productDetailsOf(product, "th"), "รายละเอียดไทย");
  assert.equal(productAllergensOf(product, "th"), "มีกลูเตน");
  assert.equal(productNetWeightOf(product, "th"), "55 กรัม");
  assert.equal(productPackagingOf(product, "th"), "ซอง");
});

test("products display: EN ว่าง (หรือมีแต่ช่องว่าง) ต้องถอยไปใช้ไทย", () => {
  assert.equal(productNameOf(emptyEn, "en"), "บะหมี่กึ่งสำเร็จรูป");
  assert.equal(productTaglineOf(emptyEn, "en"), "คำโปรยไทย", "ช่องว่างล้วน = ถือว่าไม่มีค่า");
  assert.equal(productDetailsOf(emptyEn, "en"), "รายละเอียดไทย");
  assert.equal(productAllergensOf(emptyEn, "en"), "มีกลูเตน");
  assert.equal(productNetWeightOf(emptyEn, "en"), "55 กรัม");
  assert.equal(productPackagingOf(emptyEn, "en"), "ซอง");
});

test("products display: กลุ่มสินค้าไทยว่างต้องถอยไปใช้ EN (ของเดิมเคยทำได้)", () => {
  const onlyEnglish = { ...product, groupTh: "" };
  assert.equal(productGroupOf(onlyEnglish, "th"), "Noodle group", "ไม่มีคำไทย ⇒ ใช้ EN แทนบรรทัดว่าง");
  assert.equal(productGroupOf(onlyEnglish, "en"), "Noodle group");
  assert.equal(productGroupOf({ ...product, groupTh: "", groupEn: "" }, "th"), "", "ไม่มีทั้งคู่ = ว่าง");
});

test("products display: bilingualProductText ตัดช่องว่างหัวท้ายก่อนตัดสิน", () => {
  assert.equal(bilingualProductText("ไทย", "  ", "en"), "ไทย");
  assert.equal(bilingualProductText("ไทย", " EN ", "en"), " EN ");
  assert.equal(bilingualProductText("ไทย", "EN", "th"), "ไทย");
});

test("products display: หน้าเว็บต้องใช้ตัวช่วยกลาง (กันหลุดอ่านไทยตรง ๆ อีกรอบ)", () => {
  const list = readFileSync("features/products/ui/product-list.tsx", "utf8");
  for (const fn of [
    "productNameOf",
    "productGroupOf",
    "productTaglineOf",
    "productDetailsOf",
    "productAllergensOf",
    "productNetWeightOf",
    "productPackagingOf",
  ]) {
    assert.ok(list.includes(`${fn}(`), `product-list ต้องใช้ ${fn}()`);
  }
  /* ห้ามกลับไปอ่านคอลัมน์ไทยตรง ๆ ใน JSX (เคสจริง: tagline_en ไม่เคยขึ้น) */
  for (const raw of ["{product.taglineTh}", "{product.detailsTh}", "value={product.netWeightTh}", "value={product.allergensTh}", "value={product.packagingTh}"]) {
    assert.ok(!list.includes(raw), `ห้ามอ่านค่าดิบ ${raw} — ต้องผ่านตัวช่วยกลาง`);
  }
});
