import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { isDateInCurrentBangkokMonth, isUpdatedThisBangkokMonth } from "@/lib/date/updated-this-month";
import { newsInstantOf } from "@/lib/news/model";

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("ป้ายใหม่: ใช้เดือนปฏิทินไทยและซ่อนข้อมูลเก่าหรือ timestamp ที่ไม่ถูกต้อง", () => {
  const now = new Date("2026-11-16T02:00:00.000Z");
  assert.equal(isUpdatedThisBangkokMonth("2026-10-31T17:00:00.000Z", now), true);
  assert.equal(isUpdatedThisBangkokMonth("2026-09-30T16:59:59.000Z", now), false);
  assert.equal(isUpdatedThisBangkokMonth("invalid", now), false);
  assert.equal(isUpdatedThisBangkokMonth(null, now), false);

  /* ข่าวเก็บเวลาไทยแบบไม่มี offset ⇒ ต้องแปลงเป็น instant ของไทยก่อนเทียบเดือน */
  assert.equal(isUpdatedThisBangkokMonth(newsInstantOf("2026-11-01T00:30"), now), true);
  assert.equal(isUpdatedThisBangkokMonth(newsInstantOf("2026-10-31T23:30"), now), false);
});

test("ป้ายใหม่: วันที่แบบ YYYY-MM-DD เทียบเดือนไทยได้ (เมนูอาหาร)", () => {
  const now = new Date("2026-11-16T02:00:00.000Z");
  assert.equal(isDateInCurrentBangkokMonth("2026-11-01", now), true);
  assert.equal(isDateInCurrentBangkokMonth("2026-10-31", now), false);
  assert.equal(isDateInCurrentBangkokMonth("2026-13-01", now), false);
  assert.equal(isDateInCurrentBangkokMonth("invalid", now), false);
  assert.equal(isDateInCurrentBangkokMonth(null, now), false);
});

test("ป้ายใหม่ของข่าว: ใช้วันเผยแพร่ ไม่ใช่วันแก้ไข", () => {
  const repository = sourceOf("lib/news/repository.ts");
  assert.ok(repository.includes("published_at"), "repository ต้องอ่าน published_at เพื่อคำนวณป้ายใหม่");
  assert.ok(!repository.includes("readonly updatedAt"), "NewsRecord ต้องไม่มี updatedAt ที่ใช้ตัดสินป้ายใหม่อีก");

  const component = sourceOf("features/news/ui/news-list.tsx");
  assert.ok(
    component.includes("isUpdatedThisBangkokMonth(newsInstantOf(record.publishedLocal)"),
    "ป้ายใหม่ของข่าวต้องเทียบเดือนจาก publishedLocal",
  );
  assert.ok(!component.includes("record.updatedAt"), "ห้ามใช้ updatedAt ตัดสินป้ายใหม่ของข่าว");
  assert.ok(component.includes("<NewBadge"), "ต้องแสดงคอมโพเนนต์ป้ายร่วม");
});

test("ป้ายใหม่ของสินค้า: ใช้วันเผยแพร่ (published_at) ไม่ใช่วันแก้ไข", () => {
  const repository = sourceOf("lib/products/repository.ts");
  assert.ok(repository.includes("p.published_at"), "ProductRecord ต้องอ่าน published_at");
  assert.ok(repository.includes("publishedAt: isoStamp(row.published_at)"), "ต้องแปลง published_at จาก DB");
  assert.ok(!repository.includes("readonly updatedAt"), "ProductRecord ต้องไม่มี updatedAt ที่ใช้ตัดสินป้ายใหม่อีก");

  const component = sourceOf("features/products/ui/product-list.tsx");
  assert.ok(component.includes("isUpdatedThisBangkokMonth(product.publishedAt"), "ป้ายใหม่ต้องเทียบเดือนจาก publishedAt");
  assert.ok(!component.includes("product.updatedAt"), "ห้ามใช้ updatedAt ตัดสินป้ายใหม่ของสินค้า");
  assert.ok(component.includes("<NewBadge"), "ต้องแสดงคอมโพเนนต์ป้ายร่วม");
});

test("ป้ายใหม่ของเมนูอาหาร: ใช้วันเผยแพร่ (published_on) ไม่ใช่วันแก้ไข", () => {
  const repository = sourceOf("lib/recipes/repository.ts");
  assert.ok(repository.includes("published_on::text as published_on"), "RecipeRecord ต้องอ่าน published_on");
  assert.ok(!repository.includes("readonly updatedAt"), "RecipeRecord ต้องไม่มี updatedAt ที่ใช้ตัดสินป้ายใหม่อีก");

  const component = sourceOf("features/recipes/ui/recipe-video-list.tsx");
  assert.ok(
    component.includes("isDateInCurrentBangkokMonth(recipe.publishedOn"),
    "ป้ายใหม่ต้องเทียบเดือนจาก publishedOn",
  );
  assert.ok(!component.includes("recipe.updatedAt"), "ห้ามใช้ updatedAt ตัดสินป้ายใหม่ของเมนู");
  assert.ok(component.includes("<NewBadge"), "ต้องแสดงคอมโพเนนต์ป้ายร่วม");
});

test("ป้ายใหม่: ข้อความร่วมของข่าว/สินค้า/เมนู", () => {
  assert.equal(th.newsPage.dbNewBadge, "ใหม่");
  assert.equal(en.newsPage.dbNewBadge, "NEW");
  assert.equal(th.productsPage.dbNewBadge, "ใหม่");
  assert.equal(en.productsPage.dbNewBadge, "NEW");
  assert.equal(th.recipesPage.dbNewBadge, "ใหม่");
  assert.equal(en.recipesPage.dbNewBadge, "NEW");
});
