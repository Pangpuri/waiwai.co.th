import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SYNC_FORBIDDEN_TABLES,
  SYNC_PRUNE_TABLES,
  SYNC_TABLES,
  buildDeleteSql,
  buildUpsertSql,
  copyColumnsOf,
  needsOverriding,
  needsSequenceSync,
  rowKeyOf,
  type UpsertColumn,
} from "@/lib/db/sync";
import { codeOf } from "./source-scan.ts";

/**
 * เทสต์ของเครื่องมือดันข้อมูลขึ้นปลายทาง (`npm run db:sync` · รอบที่ 298)
 *
 * ที่มา: `db:push` ใช้ `pg_dump` 17 กับ Neon 18 ไม่ได้ ("server version mismatch")
 * ⇒ ใช้การคัดลอกแถวผ่านไดรเวอร์ `pg` แทน ⇒ ต้องล็อกวินัยไว้ให้แน่น เพราะเป็นเครื่องมือที่ **เขียนขึ้นคลาวด์**
 */

const columns: readonly UpsertColumn[] = [
  { name: "page", identityAlways: false },
  { name: "status", identityAlways: false },
  { name: "document", identityAlways: false },
  { name: "updated_at", identityAlways: false },
];

test("db:sync — upsert ด้วยคีย์จริง: ชนด้วย (page, status) และอัปเดตทุกช่องที่ไม่ใช่คีย์", () => {
  const sql = buildUpsertSql({ table: "page_document", conflictOn: ["page", "status"] }, columns);

  assert.ok(sql.startsWith('insert into "page_document" ('), "ต้องเป็น insert into ตารางที่กำหนด");
  assert.ok(sql.includes("values ($1, $2, $3, $4)"), "ค่าทุกช่องต้องเป็น parameter ($1..$n) ไม่ต่อสตริง");
  assert.ok(sql.includes('on conflict ("page", "status") do update set'), "ต้องชนด้วยคีย์จริงของตาราง");
  assert.ok(sql.includes('"document" = excluded."document"'), "ช่องข้อมูลต้องถูกอัปเดตทับ");
  assert.ok(!sql.includes('"page" = excluded."page"'), "ห้ามอัปเดตคีย์ที่ใช้ชน (ไม่จำเป็นและเสี่ยง)");
  assert.ok(!/delete/i.test(sql), "เครื่องมือนี้ต้องไม่มีคำสั่งลบเด็ดขาด");
  assert.ok(!sql.includes("overriding"), "ตารางที่คีย์ไม่ใช่ id ไม่ต้อง overriding");
});

test("db:sync — ตารางที่คง id เดิม (ฟอร์ม+ไฟล์แนบ) ต้อง overriding system value เพราะ identity = ALWAYS", () => {
  const formColumns: readonly UpsertColumn[] = [
    { name: "id", identityAlways: true },
    { name: "form", identityAlways: false },
    { name: "email", identityAlways: false },
  ];
  const plan = { table: "form_submission", conflictOn: ["id"] };

  assert.equal(needsOverriding(plan, formColumns), true);
  const sql = buildUpsertSql(plan, formColumns);
  assert.ok(sql.includes("overriding system value"), "ไม่ใส่ = insert จะถูกปฏิเสธ (identity ALWAYS)");
  assert.equal(copyColumnsOf(plan, formColumns).length, 3, "คีย์เป็น id ⇒ คัดลอกทุกคอลัมน์รวม id");

  /* ตารางที่คีย์เป็น business key ⇒ ตัด id ออก ให้ปลายทางออกรหัสเอง */
  const revisionColumns: readonly UpsertColumn[] = [
    { name: "id", identityAlways: true },
    { name: "page", identityAlways: false },
    { name: "revision", identityAlways: false },
  ];
  const revisionPlan = { table: "page_document_revision", conflictOn: ["page", "revision"] };
  assert.equal(needsOverriding(revisionPlan, revisionColumns), false);
  assert.deepEqual(
    copyColumnsOf(revisionPlan, revisionColumns).map((column) => column.name),
    ["page", "revision"],
    "ห้ามลอก id ข้ามเครื่อง (แต่ละเครื่องออก id คนละชุด)",
  );
});

test("db:sync — คีย์แถวต้องไม่ชนกันข้ามแถว (ใช้ตัวคั่น ไม่ใช่ต่อสตริงเปล่า)", () => {
  const plan = { table: "page_document_revision", conflictOn: ["page", "revision"] };

  assert.notEqual(rowKeyOf(plan, { page: "a1", revision: "1" }), rowKeyOf(plan, { page: "a", revision: "11" }));
  assert.equal(rowKeyOf(plan, { page: "a", revision: "1" }), rowKeyOf(plan, { page: "a", revision: "1" }));
});

test("db:sync — ตารางที่แตะต้องไม่ทับกับตารางที่ 'ห้ามแตะ' (ข้อมูลส่วนบุคคล/ของแต่ละสภาพแวดล้อม)", () => {
  const touched = SYNC_TABLES.map((plan) => plan.table);
  for (const forbidden of SYNC_FORBIDDEN_TABLES) {
    assert.ok(!touched.includes(forbidden), `ห้ามดันตาราง ${forbidden} ด้วยเครื่องมือนี้`);
  }

  /* ประวัติหน้าต้องชนด้วย (page, revision) ไม่ใช่ id — เป็นเหตุผลที่ต้องมีเครื่องมือนี้แทน db:push */
  const revision = SYNC_TABLES.find((plan) => plan.table === "page_document_revision");
  assert.deepEqual(revision?.conflictOn, ["page", "revision"]);
});

test("db:sync — ตัวสคริปต์ต้อง dry-run โดยค่าเริ่มต้น · ไม่มีคำสั่งลบ · ไม่พิมพ์รหัสผ่าน", () => {
  const script = codeOf("scripts/db-sync.ts");
  const raw = codeOf("lib/db/sync.ts");

  assert.ok(script.includes('process.argv.includes("--apply")'), "ต้องต้องสั่ง --apply จึงเขียนจริง");
  assert.ok(script.includes("dry-run"), "ต้องบอกผู้ใช้ว่าตอนนี้เป็น dry-run");
  assert.ok(!/delete\s+from|truncate|drop\s+table/i.test(script), "ห้ามมีคำสั่งลบ/ทำลายข้อมูล");
  assert.ok(script.includes("redactUrl"), "ต้องใช้ redactUrl (ห้ามพิมพ์รหัสผ่าน)");
  assert.ok(!/\$\{LOCAL_URL\}|\$\{TARGET_URL\}/.test(script.replace(/redactUrl\((LOCAL_URL|TARGET_URL)\)/g, "REDACTED")), "ห้ามพิมพ์ URL ดิบ");
  /* ตัวสร้าง SQL มี buildDeleteSql ได้ (ใช้เฉพาะ --prune) — ขอแค่ สคริปต์ ลบเมื่อ mayPrune เท่านั้น (เทสต์ข้อถัดไป) */
  assert.ok(raw.includes("buildDeleteSql"), "คำสั่งลบต้องมาจากตัวสร้างกลาง ไม่เขียนสดในสคริปต์");
});

/* ── รอบที่ 298 (ต่อ): --prune + บทเรียนจริง 2 ข้อ ─────────────────────────────── */

test("db:sync — ตั้ง sequence ต่อเฉพาะ id ที่เป็น identity จริง (id ข้อความต้องข้าม)", () => {
  const numericId: readonly UpsertColumn[] = [
    { name: "id", identityAlways: true },
    { name: "form", identityAlways: false },
  ];
  assert.equal(needsSequenceSync({ table: "form_submission", conflictOn: ["id"] }, numericId), true);

  /* ⚠️ เจอจริง: hero_slide.id เป็น "ข้อความ" (event/flavours) ⇒ setval จะพังด้วย
     "COALESCE types text and integer cannot be matched" */
  const textId: readonly UpsertColumn[] = [
    { name: "id", identityAlways: false },
    { name: "media_path", identityAlways: false },
  ];
  assert.equal(needsSequenceSync({ table: "hero_slide", conflictOn: ["id"] }, textId), false);
  assert.equal(
    needsSequenceSync({ table: "content_field", conflictOn: ["page", "section", "item_key", "field"] }, numericId),
    false,
    "ตารางที่คีย์ไม่ใช่ id ไม่ต้องยุ่งกับ sequence",
  );
});

test("db:sync --prune — ลบได้เฉพาะตารางที่ประกาศไว้ และคำสั่งลบต้องผูก parameter", () => {
  for (const table of SYNC_PRUNE_TABLES) {
    assert.ok(
      SYNC_TABLES.some((plan) => plan.table === table),
      `ตารางที่อนุญาตให้ลบ (${table}) ต้องอยู่ในรายการที่เครื่องมือดันข้อมูลด้วย`,
    );
  }

  const sql = buildDeleteSql({ table: "hero_slide", conflictOn: ["id"] });
  assert.equal(sql, 'delete from "hero_slide" where "id" = $1', "ต้องลบด้วยคีย์แบบ parameter ไม่ต่อค่าดิบ");
  assert.equal(
    buildDeleteSql({ table: "content_field", conflictOn: ["page", "section", "item_key", "field"] }),
    'delete from "content_field" where "page" = $1 and "section" = $2 and "item_key" = $3 and "field" = $4',
  );
});

test("db:sync — สคริปต์ต้องลบ 'เมื่อสั่ง --prune + ตารางอยู่ในรายการ' เท่านั้น และลบให้ครบทุกแถว", () => {
  const script = codeOf("scripts/db-sync.ts");

  assert.ok(script.includes("SYNC_PRUNE_TABLES.includes(plan.table)"), "ต้องเช็ค allowlist ก่อนลบ");
  assert.ok(script.includes("const mayPrune = PRUNE &&"), "ต้องมีทั้ง --prune และ allowlist");
  /* บทเรียนจริง: เคยจำกัดการลบไว้แค่ 10 แถว (เพราะใช้ตัวเดียวกับที่พิมพ์) ⇒ ลบไม่ครบแต่ดูเหมือนสำเร็จ */
  assert.ok(script.includes("for (const row of extra)"), "ต้องลบทุกแถวที่เกิน ไม่ใช่แค่ที่พิมพ์ออกจอ");
  assert.ok(script.includes("for (const row of printable)"), "การพิมพ์จำกัดจำนวนได้ (อ่านง่าย)");

  /* คำสั่งลบต้องอยู่ในลูปของ "แถวที่เกินทั้งหมด" (extra) ไม่ใช่ลิสต์ที่จำกัดเพื่อพิมพ์ (printable) */
  const deleteAt = script.indexOf("buildDeleteSql(plan)");
  const loopAt = script.indexOf("for (const row of extra)");
  const printableAt = script.indexOf("for (const row of printable)");
  assert.ok(deleteAt > loopAt, "คำสั่งลบต้องอยู่ในลูป extra");
  assert.ok(!(deleteAt > printableAt && deleteAt < loopAt), "ห้ามลบจากลิสต์ printable");
});
