import assert from "node:assert/strict";
import { test } from "node:test";

import {
  REVISION_KINDS,
  mediaIdFromPath,
  newsRestoreOf,
  productRestoreOf,
  productSnapshotOf,
  recipeRestoreOf,
  revisionDiff,
  revisionValueText,
} from "@/lib/revisions/model";
import type { AdminProductDetail } from "@/lib/products/repository";

/**
 * เทสต์ "ประวัติรุ่น" ของสินค้า/เมนู/ข่าว (B1 ส่วนที่ 1 · รอบที่ 143) — ตรรกะล้วน ไม่ต้องมี DB
 *
 * มติเจ้าของ: แบบเดียวกับตัวสร้างหน้าเว็บ = เก็บทุกครั้งที่บันทึก · เก็บ 1 ปี · **เทียบความต่างก่อนกู้คืน**
 */

const product: AdminProductDetail = {
  id: "p1",
  sourceId: "1",
  categoryId: "instant-noodles",
  nameTh: "บะหมี่",
  nameEn: "",
  groupTh: "กลุ่ม",
  groupEn: "",
  taglineTh: "",
  taglineEn: "",
  detailsTh: "",
  detailsEn: "",
  allergensTh: "",
  allergensEn: "",
  netWeightTh: "",
  netWeightEn: "",
  fdaNumber: "",
  packagingTh: "",
  packagingEn: "",
  sortOrder: 1,
  imagePath: "/media/m1",
  imageWidth: null,
  imageHeight: null,
  ingredientCount: 1,
  trashed: false,
  updatedLocal: null,
  ingredients: [{ nameTh: "แป้ง", nameEn: "", percentText: "80%" }],
};

test("revisions: revisionDiff บอกเฉพาะช่องที่ต่าง (เรียงตามชื่อช่อง)", () => {
  const before = { a: "1", b: "เดิม", c: 2 };
  const after = { a: "1", b: "ใหม่", c: 2, d: "เพิ่ม" };
  assert.deepEqual(revisionDiff(before, after), [
    { field: "b", before: "เดิม", after: "ใหม่" },
    { field: "d", before: "", after: "เพิ่ม" },
  ]);
  assert.deepEqual(revisionDiff(before, before), [], "ค่าเดิม = ไม่มีอะไรเปลี่ยน");
});

test("revisions: ค่าที่ซับซ้อน (อาร์เรย์/ออบเจ็กต์) ถูกเทียบเป็นข้อความบรรทัดเดียว", () => {
  assert.equal(revisionValueText([{ nameTh: "แป้ง" }, { nameTh: "น้ำ" }]), "nameTh: แป้ง · nameTh: น้ำ");
  assert.equal(revisionValueText(null), "", "null = ว่าง (ไม่ใช่ข้อความ 'null')");
  assert.equal(revisionValueText(3), "3");
});

test("revisions: สแนปช็อตสินค้าไม่เก็บ id/ผู้แก้/เวลา และกู้คืนได้ครบทุกช่อง", () => {
  const snapshot = productSnapshotOf(product);
  assert.deepEqual(Object.keys(snapshot).sort().filter((key) => key === "id" || key === "updatedLocal"), []);
  assert.equal(snapshot["nameTh"], "บะหมี่");
  assert.equal(snapshot["imagePath"], "/media/m1", "เก็บพาธภาพตามมติ D9");

  const restore = productRestoreOf(snapshot);
  assert.equal(restore.imageMediaId, "m1", "แปลง /media/<id> กลับเป็น id ได้");
  assert.equal(restore.input.nameTh, "บะหมี่");
  assert.equal(restore.input.categoryId, "instant-noodles");
  assert.deepEqual(restore.ingredients, [{ nameTh: "แป้ง", nameEn: "", percentText: "80%" }]);
  assert.equal(restore.input.id, "", "id ไม่ได้อยู่ในสแนปช็อต (ผู้เรียกเติมเอง)");
});

test("revisions: mediaIdFromPath ปฏิเสธค่าที่ไม่ใช่พาธของเรา", () => {
  assert.equal(mediaIdFromPath("/media/abc"), "abc");
  assert.equal(mediaIdFromPath("https://example.com/a.jpg"), null, "ห้ามรับ URL เต็ม (มติ D9)");
  assert.equal(mediaIdFromPath(""), null);
  assert.equal(mediaIdFromPath(null), null);
});

test("revisions: กู้คืนข่าว/เมนูอ่านค่าได้ครบ + สถานะที่ไม่รู้จักถือเป็น published", () => {
  const news = newsRestoreOf({
    titleTh: "ข่าว",
    excerptTh: "โปรย",
    coverPath: "/media/c1",
    publishedLocal: "2026-01-02T10:00",
    status: "draft",
    body: [{ type: "paragraph", text: "เนื้อหา" }],
  });
  assert.equal(news.values.status, "draft");
  assert.equal(news.body.length, 1);
  assert.equal(news.coverPath, "/media/c1");

  const recipe = recipeRestoreOf({ titleTh: "เมนู", videoId: "abcdefghijk", sortOrder: 3, status: "weird" });
  assert.equal(recipe.values.status, "published", "สถานะที่ไม่รู้จักต้องไม่ทำข้อมูลพัง");
  assert.equal(recipe.values.sortOrder, 3);
});

test("revisions: ชนิดที่รองรับต้องครบ 3 ชนิด (สินค้า/เมนู/ข่าว)", () => {
  assert.deepEqual([...REVISION_KINDS], ["product", "recipe", "news"]);
});
