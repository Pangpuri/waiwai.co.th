import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { isUpdatedThisBangkokMonth } from "@/lib/date/updated-this-month";

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
});

test("ป้ายใหม่: ข่าว/สินค้า/เมนูอ่าน updated_at และใช้คอมโพเนนต์ป้ายร่วม", () => {
  const cases = [
    ["lib/news/repository.ts", "n.updated_at", "updatedAt: isoStamp(row.updated_at)", "features/news/ui/news-list.tsx"],
    [
      "lib/products/repository.ts",
      "p.updated_at",
      "updatedAt: isoStamp(row.updated_at)",
      "features/products/ui/product-list.tsx",
    ],
    [
      "lib/recipes/repository.ts",
      "r.updated_at",
      "updatedAt: isoStamp(row.updated_at)",
      "features/recipes/ui/recipe-video-list.tsx",
    ],
  ] as const;

  for (const [repositoryPath, column, mapping, componentPath] of cases) {
    const repository = sourceOf(repositoryPath);
    assert.ok(repository.includes(column), `${repositoryPath} ต้องอ่าน updated_at`);
    assert.ok(repository.includes(mapping), `${repositoryPath} ต้องแปลง updated_at จาก DB`);

    const component = sourceOf(componentPath);
    assert.ok(component.includes("isUpdatedThisBangkokMonth"), `${componentPath} ต้องใช้เงื่อนไขเดือนกลาง`);
    assert.ok(component.includes("<NewBadge"), `${componentPath} ต้องแสดงคอมโพเนนต์ป้ายร่วม`);
  }

  assert.equal(th.newsPage.dbNewBadge, "ใหม่");
  assert.equal(en.newsPage.dbNewBadge, "NEW");
  assert.equal(th.productsPage.dbNewBadge, "ใหม่");
  assert.equal(en.productsPage.dbNewBadge, "NEW");
  assert.equal(th.recipesPage.dbNewBadge, "ใหม่");
  assert.equal(en.recipesPage.dbNewBadge, "NEW");
});
