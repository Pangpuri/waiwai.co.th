import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  jobRestoreOf,
  jobSnapshotOf,
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
  assert.deepEqual([...REVISION_KINDS], ["product", "recipe", "news", "job"], "รอบที่ 278: เพิ่มประกาศรับสมัครงาน");
});

/* ── รอบที่ 278 (ปิดหนี้ D-265-3): ประวัติรุ่นของประกาศรับสมัครงาน ─────────────── */

test("revision: สแนปช็อตประกาศรับสมัครงานครบทุกช่องที่แก้ได้ (ไม่มี id/ผู้แก้/เวลา)", () => {
  const snapshot = jobSnapshotOf({
    id: "j1700000000000",
    titleTh: "พนักงานผลิต",
    titleEn: "Production staff",
    departmentTh: "ฝ่ายผลิต",
    departmentEn: "Production",
    openings: 3,
    gender: "any",
    ageTh: "20-35 ปี",
    ageEn: "20-35 years",
    qualificationsTh: "วุฒิ ม.6",
    qualificationsEn: "High school",
    experienceTh: "ไม่จำเป็น",
    experienceEn: "Not required",
    sortOrder: 30,
    status: "published",
    deletedAt: null,
    createdAt: "2026-10-14T00:00:00.000Z",
    createdBy: "a@b.c",
    updatedAt: "2026-10-14T00:00:00.000Z",
    updatedBy: "a@b.c",
  } as unknown as Parameters<typeof jobSnapshotOf>[0]);

  for (const key of ["titleTh", "openings", "gender", "status", "sortOrder", "qualificationsTh"]) {
    assert.ok(key in snapshot, `สแนปช็อตต้องมี ${key}`);
  }
  for (const key of ["id", "createdAt", "createdBy", "updatedAt", "updatedBy", "deletedAt"]) {
    assert.ok(!(key in snapshot), `สแนปช็อตต้องไม่มี ${key} (เทียบความต่างให้สะอาด)`);
  }

  /* กู้คืน: ค่าที่อ่านไม่ได้ต้องไม่โยน error และตกไปที่ค่ากลางที่ปลอดภัย */
  const restore = jobRestoreOf({ ...snapshot, openings: "ไม่ใช่ตัวเลข", sortOrder: null, status: "อะไรก็ไม่รู้" });
  assert.equal(restore.values.openings, 0);
  assert.equal(restore.values.sortOrder, 0);
  assert.equal(restore.values.status, "published", "ค่าไม่รู้จัก ⇒ ปลอดภัยที่สุดคือคงเป็นเผยแพร่");
  assert.equal(restore.values.titleTh, "พนักงานผลิต");
});

test("revision: จอประกาศรับสมัครงานผูกเก็บรุ่น + กู้คืน + ป้าย audit ครบ", () => {
  const actions = readFileSync("app/admin/careers/actions.ts", "utf8");
  assert.ok(actions.includes('kind: "job"'), "ต้องเก็บ/อ่านรุ่นชนิด job");
  assert.ok(actions.includes("recordJobRevision(id, user.email)"), "บันทึกแล้วต้องเก็บรุ่น");
  assert.ok(actions.includes('recordJobRevision(id, user.email, "ก่อนกู้คืน")'), "กู้คืนต้องเก็บรุ่นปัจจุบันก่อนเสมอ");
  assert.ok(actions.includes("restoreJobRevisionAction"), "ต้องมี action กู้คืน");

  const page = readFileSync("app/admin/careers/[id]/page.tsx", "utf8");
  assert.ok(page.includes("RevisionHistoryPanel"), "จอแก้ต้องมีแผงประวัติรุ่น");
  assert.ok(page.includes('kind: "job"'), "แผงต้องอ่านรุ่นชนิด job");

  const labels = readFileSync("features/admin/audit-labels.ts", "utf8");
  assert.ok(labels.includes("job-revision-restore"), "ต้องมีป้ายของเหตุการณ์กู้คืนรุ่น");
});
