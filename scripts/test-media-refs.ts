import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  describeMediaRefIssue,
  mediaIdsOfDocument,
  mediaRefIssues,
  type MediaCatalogEntry,
  type PageDocumentRow,
} from "@/lib/db/media-refs";

/**
 * เทสต์ด่าน "ภาพที่เอกสารอ้างต้องมีจริงบนปลายทาง" (รอบที่ 305 · 2026-10-20)
 *
 * เคสจริง: `db:sync` ซิงก์ `page_document` ขึ้นคลาวด์ แต่ **ไม่ซิงก์ `media`** (id คนละชุด)
 * ⇒ เอกสารบนคลาวด์อ้าง `/media/<id ของเครื่อง>` ⇒ `/about` มีภาพ 13 ใบตอบ 404 ทั้งที่หน้าเว็บ 200
 */

const documentOf = (paths: readonly string[]) => ({
  page: "about",
  blocks: [
    { id: "block-1", type: "hero", image: { path: paths[0] ?? "" } },
    {
      id: "block-6",
      type: "gallery",
      items: paths.slice(1).map((path, index) => ({ id: `item-${String(index)}`, image: path })),
    },
  ],
});

test("media-refs: ดึง id ภาพจากเอกสารได้ทุกชั้น และไม่ซ้ำ", () => {
  const doc = documentOf(["/media/aaa111", "/media/bbb222", "/media/aaa111", "/brand/logo-navbar.png"]);
  assert.deepEqual(mediaIdsOfDocument(doc), ["aaa111", "bbb222"]);
  assert.deepEqual(mediaIdsOfDocument({ blocks: [] }), []);
  /* รองรับกรณีที่ผู้เรียกส่ง JSON string มาแล้ว */
  assert.deepEqual(mediaIdsOfDocument('{"image":"/media/ccc333"}'), ["ccc333"]);
});

test("media-refs: ภาพที่ไม่มีแถวใน media = missing · ภาพในถังขยะ = trashed", () => {
  const rows: readonly PageDocumentRow[] = [
    { page: "about", status: "published", document: documentOf(["/media/ok1", "/media/gone1"]) },
    { page: "executives", status: "published", document: documentOf(["/media/trash1"]) },
    { page: "contact", status: "draft", document: documentOf(["/media/ok1"]) },
  ];
  const catalog: readonly MediaCatalogEntry[] = [
    { id: "ok1", deletedAt: null },
    { id: "trash1", deletedAt: "2026-10-01T00:00:00.000Z" },
  ];

  const issues = mediaRefIssues(rows, catalog);
  assert.equal(issues.length, 2);
  assert.deepEqual(issues[0], { page: "about", status: "published", ids: ["gone1"], reason: "missing" });
  assert.deepEqual(issues[1], { page: "executives", status: "published", ids: ["trash1"], reason: "trashed" });
});

test("media-refs: เอกสารที่อ้างภาพครบ (หรือไม่อ้างภาพเลย) ต้องไม่มีปัญหา", () => {
  const rows: readonly PageDocumentRow[] = [
    { page: "home", status: "published", document: documentOf(["/media/a"]) },
    { page: "privacy", status: "published", document: { blocks: [{ type: "richText", body: { th: "x" } }] } },
  ];
  assert.deepEqual(mediaRefIssues(rows, [{ id: "a", deletedAt: null }]), []);
});

test("media-refs: ข้อความสรุปบอกหน้า/สถานะ/จำนวน/สาเหตุ ครบ", () => {
  const missing = describeMediaRefIssue({ page: "about", status: "published", ids: ["x1", "x2"], reason: "missing" });
  assert.ok(missing.includes("about"));
  assert.ok(missing.includes("published"));
  assert.ok(missing.includes("2 ใบ"));
  assert.ok(missing.includes("ไม่มีแถวในตาราง media"));

  const trashed = describeMediaRefIssue({ page: "about", status: "draft", ids: ["y"], reason: "trashed" });
  assert.ok(trashed.includes("ถังขยะ"));
});

test("media-refs: check:target ต้องเรียกด่านนี้ และยังไม่มีคำสั่งเขียน SQL", () => {
  const source = readFileSync("scripts/check-target.ts", "utf8");
  assert.ok(source.includes("mediaRefIssues("), "ต้องประเมินผลด้วยตรรกะกลาง");
  assert.ok(source.includes("readMediaReferenceData("), "ต้องอ่านเอกสาร+คลังจากปลายทาง");
  assert.ok(source.includes("issue.status === \"published\""), "published ต้องเป็นความล้มเหลว ไม่ใช่แค่เตือน");
  /* กติกาเดิมของด่านนี้: อ่านเท่านั้น */
  for (const pattern of [/\binsert\s+into\b/i, /\bupdate\s+\w+\s+set\b/i, /\bdelete\s+from\b/i, /\bdrop\s+table\b/i]) {
    assert.equal(pattern.test(source), false, `check-target ต้องไม่มีคำสั่งเขียน: ${String(pattern)}`);
  }
});
