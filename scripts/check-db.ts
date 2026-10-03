/**
 * `npm run check:db` — ตรวจ "ชั้นฐานข้อมูล" ของเนื้อหาแบบครบวงจร
 *
 * ต้องมี: `DATABASE_URL` ใน `.env.local` + รัน `db/schema.sql` แล้ว
 * (ไม่ใช่ด่าน DoD เพราะเครื่องที่ไม่มี DB ต้องรันด่านทั้ง 7 ข้อได้ — สคริปต์นี้เป็น "ด่านเสริม" สำหรับเครื่องที่มี DB)
 *
 * สิ่งที่ตรวจ (และคืนสภาพข้อมูลเดิมทุกข้อ)
 *   1. เชื่อมต่อได้ + อ่านจำนวนแถว
 *   2. อ่านจาก DB → ประกอบเป็นโครงเนื้อหา → validator ผ่าน (error 0)
 *   3. บันทึกซ้ำด้วยเนื้อหาเดิม = idempotent (จำนวนแถวไม่เพิ่ม)
 *   4. แก้ข้อความ 1 ฟิลด์ → อ่านกลับได้ค่าใหม่
 *   5. เพิ่มรายการ 1 รายการ → จำนวนแถวเพิ่มเท่ากับจำนวนฟิลด์ของกลุ่มนั้น
 *   6. ลบรายการนั้น → จำนวนแถวกลับมาเท่าเดิม (ไม่มีแถวขยะค้าง — ตรรกะ `planOrphanKeys`)
 *   7. คืนเนื้อหาเดิมกลับลง DB
 */
import assert from "node:assert/strict";

import { closePool, getPool, isDatabaseConfigured } from "@/db/pool";
import { HOME_SEED } from "@/lib/content/home-seed";
import { HOME_PAGE_SPEC } from "@/lib/content/model";
import { countPageRows, importPageSeed, loadPageContent, savePageContent } from "@/lib/content/repository";
import { itemKeyOf } from "@/lib/content/sql";
import { errorsOf, validateContent } from "@/lib/content/validate";
import type { PageContent } from "@/lib/content/types";
import { RETENTION_CLASSES, summarizePurge } from "@/lib/retention/plan";
import { purgeExpired, retentionOverview } from "@/lib/retention/purge";
import { eraseSubject, erasurePreview } from "@/lib/privacy/repository";

type MutableText = { th: string; en: string };
type MutableItem = { order: number; fields: Record<string, MutableText>; media: Record<string, never> };
type MutableContent = {
  page: string;
  sections: Record<string, { fields: Record<string, MutableText>; items: Record<string, MutableItem[]> }>;
};

function cloneSeed(): MutableContent {
  return structuredClone(HOME_SEED) as unknown as MutableContent;
}

function asContent(content: MutableContent): PageContent {
  return content as unknown as PageContent;
}

const CHECKS: string[] = [];

function done(label: string, detail = ""): void {
  CHECKS.push(`  ✓ ${label}${detail === "" ? "" : ` — ${detail}`}`);
}

async function main(): Promise<void> {
  if (!isDatabaseConfigured()) {
    process.stderr.write("✗ ไม่พบ DATABASE_URL — ใส่ใน .env.local ก่อน (ดู AGENTS.md § ตั้งค่า env)\n");
    process.exit(1);
  }

  const started = Date.now();

  /* 1) จำนวนแถวเริ่มต้น */
  const initialRows = await countPageRows(HOME_PAGE_SPEC.page);
  done("เชื่อมต่อฐานข้อมูลได้", `หน้า ${HOME_PAGE_SPEC.page} มี ${initialRows} แถว`);

  if (initialRows === 0) {
    process.stderr.write("✗ ยังไม่มีข้อมูลในตาราง — รัน `npm run db:seed` ก่อน\n");
    process.exit(1);
  }

  /* 2) อ่าน → ประกอบ → ตรวจ */
  const loaded = await loadPageContent(HOME_PAGE_SPEC);
  const issues = errorsOf(validateContent(HOME_PAGE_SPEC, loaded.content));
  assert.equal(issues.length, 0, `เนื้อหาที่อ่านจาก DB ต้องผ่าน validator (พบ ${issues.length} error)`);
  assert.equal(loaded.unknownKeys.length, 0, `ต้องไม่มีแถวที่โครงไม่รู้จัก (พบ ${loaded.unknownKeys.length})`);
  done("อ่านจาก DB แล้วประกอบเป็นโครงได้ และ validator ผ่าน", "error 0");

  const working = cloneSeed();

  /* ทุกข้อที่เขียน DB อยู่ใน try/finally เดียว → **คืนสภาพเสมอ** แม้ข้อใดข้อหนึ่งพัง
     (บทเรียน 2026-10-02: การตรวจสอบที่อยู่นอก try ทำให้ข้อมูลใน DB ไม่ถูกคืนสภาพ) */
  try {
    /* 3) บันทึกซ้ำด้วยเนื้อหาเดิม = idempotent */
    const again = await savePageContent(HOME_PAGE_SPEC, loaded.content, "check-db");
    const rowsAfterRepeat = await countPageRows(HOME_PAGE_SPEC.page);
    assert.equal(rowsAfterRepeat, initialRows, "บันทึกซ้ำต้องไม่เพิ่ม/ลดจำนวนแถว");
    done("บันทึกซ้ำ (เนื้อหาเดิม) ไม่ทำให้จำนวนแถวเปลี่ยน", `เขียน ${again.written} · ลบ ${again.deleted}`);

    /* 4) แก้ข้อความ 1 ฟิลด์ */
    const marker = `ตรวจ DB ${new Date().toISOString()}`;
    const hero = working.sections.hero;
    assert.ok(hero, "ต้องมี section hero ในชุดข้อมูลตั้งต้น");
    const title = hero.fields.title;
    assert.ok(title, "ต้องมีฟิลด์ hero.title");
    title.th = marker;
    await savePageContent(HOME_PAGE_SPEC, asContent(working), "check-db");

    const reloaded = await loadPageContent(HOME_PAGE_SPEC);
    assert.equal(reloaded.content.sections.hero?.fields.title?.th, marker, "อ่านกลับต้องได้ค่าที่แก้");
    done("แก้ข้อความแล้วอ่านกลับได้ค่าใหม่");

    /* 5) เพิ่มรายการ 1 รายการในกลุ่ม recipes */
    const recipes = working.sections.recipes;
    assert.ok(recipes, "ต้องมี section recipes");
    const list = recipes.items.recipes;
    assert.ok(list, "ต้องมีกลุ่ม recipes.recipes");
    const groupSpec = HOME_PAGE_SPEC.sections.find((section) => section.key === "recipes")?.items.find((group) => group.key === "recipes");
    assert.ok(groupSpec, "ต้องมี spec ของกลุ่ม recipes");

    const before = list.length;
    list.push({
      order: before + 1,
      fields: Object.fromEntries(groupSpec.fields.filter((field) => field.kind !== "media").map((field) => [field.key, { th: "เมนูทดสอบ", en: "" }])),
      media: {},
    });
    await savePageContent(HOME_PAGE_SPEC, asContent(working), "check-db");

    const expectedExtra = groupSpec.fields.length;
    const rowsAfterAdd = await countPageRows(HOME_PAGE_SPEC.page);
    assert.equal(rowsAfterAdd, initialRows + expectedExtra, `เพิ่ม 1 รายการต้องเพิ่ม ${expectedExtra} แถว`);
    done("เพิ่มรายการในหน้าจอ → ลง DB ครบทุกฟิลด์", `${itemKeyOf("recipes", before + 1)} · +${expectedExtra} แถว`);

    /* 6) ลบรายการนั้น → ต้องไม่มีแถวขยะค้าง */
    list.pop();
    const removed = await savePageContent(HOME_PAGE_SPEC, asContent(working), "check-db");
    const rowsAfterRemove = await countPageRows(HOME_PAGE_SPEC.page);
    assert.equal(rowsAfterRemove, initialRows, "ลบรายการแล้วจำนวนแถวต้องกลับมาเท่าเดิม");
    assert.ok(removed.deleted >= expectedExtra, `ต้องลบแถวที่หายไปด้วย (ลบ ${removed.deleted})`);
    done("ลบรายการ → แถวถูกลบจริง (ไม่เหลือขยะ)", `ลบ ${removed.deleted} แถว`);
  } finally {
    /* 7) คืนสภาพเดิมเสมอ (แม้ข้อก่อนหน้าจะพัง) */
    const restored = await importPageSeed(HOME_PAGE_SPEC, HOME_SEED);
    const rowsRestored = await countPageRows(HOME_PAGE_SPEC.page);
    assert.equal(rowsRestored, initialRows, "คืนสภาพต้องได้จำนวนแถวเท่าเดิม");
    done("คืนเนื้อหาตั้งต้นกลับลง DB แล้ว", `เขียน ${restored.written} แถว`);
  }

  /* 8) ระยะเก็บข้อมูลส่วนบุคคล (X2b) — วงจรจริง: สร้างแถวเก่า/ใหม่ → นับ → ลบ → ตรวจทีละแถว */
  await checkRetention();

  /* 9) ข้อมูลที่การ์ดบนหน้าภาพรวมใช้ (อ่านล้วน — ต้องไม่พังและต้องตรงกับนโยบาย) */
  await checkRetentionOverview();

  /* 10) ระยะเก็บของ "ประวัติเนื้อหา" (มติรอบที่ 77) — ลบของเก่า แต่เก็บรุ่นล่าสุดของแต่ละหน้าไว้เสมอ */
  await checkRevisionPurge();

  /* 11) คำขอใช้สิทธิ์: ลบข้อมูลของอีเมลหนึ่ง ต้องไม่แตะของอีเมลอื่น (PDPA · รอบที่ 77) */
  await checkErasure();

  await closePool();

  process.stdout.write(`\n${CHECKS.join("\n")}\n\n✓ check:db ผ่านทั้งหมด (${Date.now() - started} ms)\n`);
}

/** อีเมล/ป้ายที่ใช้ตามหารอยทดสอบของข้อ 8 — ต้องไม่ชนกับข้อมูลจริงของผู้ใช้ */
const RETENTION_TEST_EMAIL = "check-db-retention@example.invalid";
const RETENTION_TEST_ACTION = "check-db-retention";

async function countWhere(sql: string, params: readonly unknown[]): Promise<number> {
  const { rows } = await getPool().query<{ n: number }>(`select count(*)::int as n from ${sql}`, [...params]);
  return rows[0]?.n ?? 0;
}

/**
 * 8) ระยะเก็บข้อมูลส่วนบุคคล (X2b) — **วงจรจริงกับฐานข้อมูล**
 *
 * พิสูจน์ว่า "ตัวลบ" ลบเฉพาะของที่หมดอายุ และลบไฟล์เรซูเม่ตามใบสมัครไปด้วย
 *   วิธี: สร้างแถวสังเคราะห์ที่รู้อายุแน่นอน (เก่า/ใหม่) → นับ (dry run) → ลบจริง → ตรวจทีละแถว
 *   แล้ว **ลบรอยทดสอบทั้งหมด** ให้จำนวนแถวกลับมาเท่าเดิม (กติกาเดียวกับข้อ 1–7)
 * ⚠️ เรียก `purgeExpired()` ตรง ๆ (ไม่ผ่าน `purgeNow`) ⇒ **การทดสอบไม่เขียน audit log เอง**
 */
async function checkRetention(): Promise<void> {
  const before = {
    submissions: await countWhere("form_submission where email = $1", [RETENTION_TEST_EMAIL]),
    attempts: await countWhere("login_attempt where email = $1", [RETENTION_TEST_EMAIL]),
    audit: await countWhere("audit_log where action = $1", [RETENTION_TEST_ACTION]),
  };
  assert.deepEqual(before, { submissions: 0, attempts: 0, audit: 0 }, "ต้องไม่มีรอยทดสอบค้างจากรอบก่อน");

  const pool = getPool();
  let oldCareersId = 0;

  try {
    /* แถว "เก่า" — เกินระยะเก็บทุกชั้น */
    await pool.query(
      `insert into form_submission (form, email, name, message, consent, created_at) values
         ('contact',    $1, 'เก่า-ติดต่อ',   'เกิน 1 ปี',    true, now() - interval '2 years'),
         ('newsletter', $1, '',              'เกิน 1 ปี',    true, now() - interval '2 years'),
         ('careers',    $1, 'เก่า-สมัครงาน', 'เกิน 6 เดือน', true, now() - interval '1 year')`,
      [RETENTION_TEST_EMAIL],
    );

    /* แถว "ใหม่" — ยังไม่ถึงกำหนด ⇒ ต้องรอด */
    await pool.query(
      `insert into form_submission (form, email, name, message, consent, created_at) values
         ('contact', $1, 'ใหม่-ติดต่อ',   'เพิ่งส่ง', true, now()),
         ('careers', $1, 'ใหม่-สมัครงาน', 'เพิ่งส่ง', true, now())`,
      [RETENTION_TEST_EMAIL],
    );

    /* ไฟล์แนบของใบสมัคร "เก่า" — ต้องถูกลบตามแถวแม่ (on delete cascade) */
    const careers = await pool.query<{ id: string }>(
      "select id from form_submission where email = $1 and form = 'careers' and created_at < now() - interval '30 days'",
      [RETENTION_TEST_EMAIL],
    );
    oldCareersId = Number(careers.rows[0]?.id ?? 0);
    assert.ok(oldCareersId > 0, "ต้องหาแถวใบสมัครงานเก่าเจอ");
    await pool.query(
      "insert into form_attachment (submission_id, filename, mime, size_bytes, data) values ($1, $2, $3, $4, $5)",
      [oldCareersId, "resume.pdf", "application/pdf", 4, Buffer.from("%PDF")],
    );

    await pool.query(
      `insert into login_attempt (email, succeeded, created_at) values
         ($1, false, now() - interval '60 days'),
         ($1, true,  now())`,
      [RETENTION_TEST_EMAIL],
    );
    await pool.query(
      `insert into audit_log (actor_email, action, target, detail, created_at) values
         ($1, $2, 'retention-test', 'เก่า', now() - interval '200 days'),
         ($1, $2, 'retention-test', 'ใหม่', now())`,
      [RETENTION_TEST_EMAIL, RETENTION_TEST_ACTION],
    );

    assert.equal(
      await countWhere("form_submission where email = $1", [RETENTION_TEST_EMAIL]),
      5,
      "ต้องสร้างแถวสังเคราะห์ครบ 5 แถว",
    );

    /* นับก่อนลบ (dry run) */
    const dry = await purgeExpired({ dryRun: true });
    assert.ok(dry !== null, "dry run ต้องได้ผลลัพธ์เมื่อมี DATABASE_URL");
    assert.ok(dry.counts.contact >= 1, "dry run ต้องนับข้อความติดต่อที่หมดอายุ");
    assert.ok(dry.counts.careers >= 1, "dry run ต้องนับใบสมัครงานที่หมดอายุ");
    assert.ok(dry.counts.loginAttempt >= 1, "dry run ต้องนับร่องรอยล็อกอินที่หมดอายุ");
    assert.ok(dry.counts.auditLog >= 1, "dry run ต้องนับ audit log ที่หมดอายุ");
    done("dry run นับแถวหมดอายุได้โดยไม่ลบ", `รวม ${dry.total} แถว`);

    /* ลบจริง */
    const purged = await purgeExpired();
    assert.ok(purged !== null, "ลบจริงต้องได้ผลลัพธ์");
    assert.equal(purged.dryRun, false, "ลบจริงต้องไม่ใช่ dry run");
    done("ลบจริงตามระยะเก็บ", summarizePurge(purged.counts));

    /* ของเก่าต้องหาย — ตรวจทีละชนิด (ไม่ดูยอดรวม เพราะอาจมีข้อมูลจริงปนอยู่) */
    const gone = {
      oldContact: await countWhere(
        "form_submission where email = $1 and form = 'contact' and created_at < now() - interval '1 year'",
        [RETENTION_TEST_EMAIL],
      ),
      oldNewsletter: await countWhere("form_submission where email = $1 and form = 'newsletter'", [RETENTION_TEST_EMAIL]),
      oldCareers: await countWhere("form_submission where id = $1", [oldCareersId]),
      oldAttachment: await countWhere("form_attachment where submission_id = $1", [oldCareersId]),
      oldAttempt: await countWhere(
        "login_attempt where email = $1 and created_at < now() - interval '30 days'",
        [RETENTION_TEST_EMAIL],
      ),
      oldAudit: await countWhere(
        "audit_log where action = $1 and created_at < now() - interval '90 days'",
        [RETENTION_TEST_ACTION],
      ),
    };
    assert.deepEqual(
      gone,
      { oldContact: 0, oldNewsletter: 0, oldCareers: 0, oldAttachment: 0, oldAttempt: 0, oldAudit: 0 },
      "แถวที่หมดอายุต้องถูกลบครบ (รวมไฟล์แนบของใบสมัคร)",
    );
    done("ของที่หมดอายุถูกลบครบ + ไฟล์เรซูเม่ถูกลบตามใบสมัคร", `ไฟล์แนบของใบสมัคร #${oldCareersId} หายไปแล้ว`);

    /* ของใหม่ต้องยังอยู่ */
    const kept = {
      freshContact: await countWhere("form_submission where email = $1 and form = 'contact'", [RETENTION_TEST_EMAIL]),
      freshCareers: await countWhere("form_submission where email = $1 and form = 'careers'", [RETENTION_TEST_EMAIL]),
      freshAttempt: await countWhere("login_attempt where email = $1", [RETENTION_TEST_EMAIL]),
      freshAudit: await countWhere("audit_log where action = $1", [RETENTION_TEST_ACTION]),
    };
    assert.deepEqual(
      kept,
      { freshContact: 1, freshCareers: 1, freshAttempt: 1, freshAudit: 1 },
      "แถวที่ยังไม่ถึงกำหนดต้องไม่ถูกลบ",
    );
    done("ของที่ยังไม่ถึงกำหนดยังอยู่ครบ", "ติดต่อ 1 · สมัครงาน 1 · ล็อกอิน 1 · audit 1");
  } finally {
    /* คืนสภาพ: ลบรอยทดสอบทั้งหมด (ไฟล์แนบหายตาม cascade) */
    await getPool().query("delete from form_submission where email = $1", [RETENTION_TEST_EMAIL]);
    await getPool().query("delete from login_attempt where email = $1", [RETENTION_TEST_EMAIL]);
    await getPool().query("delete from audit_log where action = $1", [RETENTION_TEST_ACTION]);

    const after = {
      submissions: await countWhere("form_submission where email = $1", [RETENTION_TEST_EMAIL]),
      attempts: await countWhere("login_attempt where email = $1", [RETENTION_TEST_EMAIL]),
      audit: await countWhere("audit_log where action = $1", [RETENTION_TEST_ACTION]),
    };
    assert.deepEqual(after, before, "ลบรอยทดสอบต้องไม่เหลืออะไรค้าง");
    done("คืนสภาพตารางข้อมูลส่วนบุคคลแล้ว", "ไม่เหลือรอยทดสอบ");
  }
}

/**
 * 9) ข้อมูลที่ "การ์ดระยะเก็บ" บนหน้าภาพรวมใช้ — อ่านล้วน ไม่เขียนอะไร
 * (พิสูจน์ว่าหน้าจอหลังบ้านมีข้อมูลแสดงจริง และรอบถัดไปสอดคล้องกับประวัติการลบ)
 */
async function checkRetentionOverview(): Promise<void> {
  const overview = await retentionOverview();
  assert.ok(overview !== null, "ต้องอ่านสถานะระยะเก็บได้เมื่อมี DATABASE_URL");
  assert.equal(overview.steps.length, RETENTION_CLASSES.length, "ตารางระยะเก็บต้องครบทุกชั้นข้อมูล");
  assert.ok(overview.dueTotal >= 0, "จำนวนแถวค้างลบต้องไม่ติดลบ");

  if (overview.lastPurgeAt === null) {
    assert.equal(overview.nextDueAt, null, "ไม่เคยลบ = ลบได้เดี๋ยวนี้ (ไม่มีรอบถัดไป)");
  } else {
    assert.ok(Number.isFinite(new Date(overview.lastPurgeAt).getTime()), "เวลาลบรอบล่าสุดต้องเป็นวันที่จริง");
    assert.ok(overview.nextDueAt !== null, "เคยลบแล้วต้องบอกเวลารอบถัดไปได้");
  }

  done("การ์ดระยะเก็บบนหน้าภาพรวมอ่านข้อมูลได้", `ชั้นข้อมูล ${overview.steps.length} · ค้างลบ ${overview.dueTotal} แถว`);
}

/**
 * 10) ระยะเก็บของ "ประวัติเนื้อหา" (มติรอบที่ 77 — ผู้ใช้เลือกเอง)
 *
 * พิสูจน์ 2 อย่างที่สำคัญที่สุด
 * 1. ประวัติที่เก่ากว่าระยะเก็บ **ถูกลบจริง** (ไม่งั้นนโยบายที่ประกาศบน `/privacy` เป็นเท็จ)
 * 2. **รุ่นล่าสุดของแต่ละหน้ารอดเสมอ** — หน้าที่ทั้งหน้าถูกแก้ครั้งสุดท้ายนานกว่า 1 ปี
 *    ต้องยังเหลือ 1 รุ่นให้ย้อนกลับ (กันเคส "ผู้ใช้กู้คืนประวัติแล้วเจอ pageless")
 *
 * ใช้ชื่อหน้า `check-db-*` ที่ไม่มีอยู่จริง (ทั้งสองตารางไม่มี FK) ⇒ ไม่แตะเนื้อหาจริงเลย
 * และลบรอยทดสอบใน `finally` เหมือนข้ออื่น
 */
async function checkRevisionPurge(): Promise<void> {
  const pool = getPool();

  /* หน้า A: เก่าทั้ง 3 รุ่น → ต้องเหลือรุ่น 3 · หน้า B: เก่า 1 + ใหม่ 1 → ต้องเหลือทั้งคู่ */
  const oldPage = "check-db-revision-old";
  const freshPage = "check-db-revision-fresh";
  const oldContentPage = "check-db-content-revision-old";

  const leftovers = {
    blockOld: await countWhere("page_document_revision where page like 'check-db-revision-%'", []),
    contentOld: await countWhere("content_revision where page like 'check-db-content-revision-%'", []),
  };
  assert.deepEqual(leftovers, { blockOld: 0, contentOld: 0 }, "ต้องไม่มีรอยทดสอบประวัติค้างจากรอบก่อน");

  try {
    /* แถวเก่า: 800 วัน (เกิน 365 วันแน่นอน) — ของใหม่: เดี๋ยวนี้ */
    await pool.query(
      `insert into page_document_revision (page, revision, document, created_at, created_by) values
        ($1, 1, '{"blocks":[]}'::jsonb, now() - interval '800 days', $3),
        ($1, 2, '{"blocks":[]}'::jsonb, now() - interval '700 days', $3),
        ($1, 3, '{"blocks":[]}'::jsonb, now() - interval '600 days', $3),
        ($2, 1, '{"blocks":[]}'::jsonb, now() - interval '700 days', $3),
        ($2, 2, '{"blocks":[]}'::jsonb, now(), $3)`,
      [oldPage, freshPage, "check-db"],
    );
    await pool.query(
      `insert into content_revision (page, revision, status, snapshot, created_at, created_by) values
        ($1, 1, 'archived', '{}'::jsonb, now() - interval '800 days', $2),
        ($1, 2, 'archived', '{}'::jsonb, now() - interval '700 days', $2)`,
      [oldContentPage, "check-db"],
    );
    done("สร้างประวัติสังเคราะห์", "บล็อกเก่า 3 รุ่น + ใหม่ 1 · ฟิลด์เก่า 2 รุ่น");

    /* นับก่อนลบ (dry run) — ต้องเห็น >= 4 (บล็อก 2 + ฟิลด์ 1 + ... ตามจริง 3) */
    const dry = await purgeExpired({ dryRun: true });
    assert.ok(dry !== null, "ต้องอ่านสถานะได้");
    assert.ok(
      dry.counts.blockRevision >= 2,
      `ต้องเห็นประวัติบล็อกหมดอายุอย่างน้อย 2 รุ่น (เห็น ${dry.counts.blockRevision})`,
    );
    assert.ok(dry.counts.contentRevision >= 1, `ต้องเห็นประวัติฟิลด์หมดอายุ (เห็น ${dry.counts.contentRevision})`);
    done(
      "นับประวัติที่หมดอายุก่อนลบ (dry run)",
      `บล็อก ${dry.counts.blockRevision} · ฟิลด์ ${dry.counts.contentRevision}`,
    );

    /* ลบจริงด้วยเส้นทางเดียวกับตัวลบอัตโนมัติ */
    const purged = await purgeExpired();
    assert.ok(purged !== null, "ลบจริงต้องได้รายงาน");

    /* หน้า A: ต้องเหลือรุ่น 3 (รุ่นล่าสุด) เท่านั้น — 1 กับ 2 ถูกลบ */
    const keepLatest = await countWhere("page_document_revision where page = $1 and revision = 3", [oldPage]);
    const olderGone = await countWhere("page_document_revision where page = $1 and revision < 3", [oldPage]);
    assert.equal(keepLatest, 1, "รุ่นล่าสุดของหน้าที่เก่าทั้งหน้า ต้องถูกเก็บไว้เสมอ");
    assert.equal(olderGone, 0, "รุ่นที่เก่ากว่าต้องถูกลบ");
    done("ประวัติเก่าถูกลบ แต่รุ่นล่าสุดของหน้ายังอยู่", `${oldPage} เหลือรุ่น 3`);

    /* หน้า B: ทั้งสองรุ่นยังอยู่ (รุ่น 2 ใหม่ · รุ่น 1 เก่าแต่เป็นรุ่นเดียว... ต้องถูกลบเพราะไม่ใช่รุ่นล่าสุด) */
    const fresh = {
      newest: await countWhere("page_document_revision where page = $1 and revision = 2", [freshPage]),
      older: await countWhere("page_document_revision where page = $1 and revision = 1", [freshPage]),
    };
    assert.equal(fresh.newest, 1, "รุ่นใหม่ต้องอยู่");
    assert.equal(fresh.older, 0, "รุ่นเก่าของหน้าเดียวกันต้องถูกลบ (ไม่ใช่รุ่นล่าสุด)");
    done("หน้าเดียวกัน: เก็บเฉพาะรุ่นล่าสุด", `${freshPage} เหลือรุ่น 2`);

    /* ประวัติแบบฟิลด์: เหลือรุ่น 2 เท่านั้น */
    const content = {
      kept: await countWhere("content_revision where page = $1 and revision = 2", [oldContentPage]),
      gone: await countWhere("content_revision where page = $1 and revision = 1", [oldContentPage]),
    };
    assert.deepEqual(content, { kept: 1, gone: 0 }, "ประวัติฟิลด์ต้องเหลือรุ่นล่าสุดและลบรุ่นเก่า");
    done("ประวัติฟิลด์ (content_revision) ทำงานตามกฎเดียวกัน");
  } finally {
    /* คืนสภาพ: ลบรอยทดสอบทั้งหมด แล้วยืนยันว่าไม่เหลือ */
    await pool.query("delete from page_document_revision where page like 'check-db-revision-%'");
    await pool.query("delete from content_revision where page like 'check-db-content-revision-%'");

    const after = {
      blockOld: await countWhere("page_document_revision where page like 'check-db-revision-%'", []),
      contentOld: await countWhere("content_revision where page like 'check-db-content-revision-%'", []),
    };
    assert.deepEqual(after, { blockOld: 0, contentOld: 0 }, "ลบรอยทดสอบประวัติต้องไม่เหลืออะไรค้าง");
    done("คืนสภาพตารางประวัติแล้ว", "ไม่เหลือรอยทดสอบ");
  }
}

/**
 * 11) คำขอใช้สิทธิ์: "ลบข้อมูลทั้งหมดของอีเมลนี้" (PDPA · รอบที่ 77)
 *
 * พิสูจน์ 5 อย่าง
 * 1. ลบ **ครบทุกฟอร์ม** ของอีเมลนั้น (ติดต่อ + ข่าวสาร + ใบสมัครงาน) ในคำสั่งเดียว
 * 2. **ไฟล์เรซูเม่หายตามใบสมัคร** (`on delete cascade`)
 * 3. **ไม่แตะข้อมูลของอีเมลอื่น** (ข้อนี้สำคัญที่สุด — ลบเกิน = ข้อมูลคนอื่นหายถาวร)
 * 4. ตัวพิมพ์ใหญ่/ช่องว่างต้องไม่ทำให้ลบไม่ครบ
 * 5. บันทึก audit ใช้ **อีเมลแบบปิดบางส่วน** เท่านั้น
 */
async function checkErasure(): Promise<void> {
  const pool = getPool();
  const target = "check-db-erase-target@example.invalid";
  /* ตัวพิมพ์ต่าง = ต้องถูกลบด้วย (พิสูจน์ว่าเทียบแบบ normalize จริง) */
  const targetMixedCase = "Check-DB-Erase-Target@Example.INVALID";
  const bystander = "check-db-erase-bystander@example.invalid";
  const actor = "check-db@example.invalid";

  const before = {
    target: await countWhere("form_submission where lower(btrim(email)) = $1", [target]),
    bystander: await countWhere("form_submission where lower(btrim(email)) = $1", [bystander]),
    audit: await countWhere("audit_log where actor_email = $1", [actor]),
  };
  assert.deepEqual(before, { target: 0, bystander: 0, audit: 0 }, "ต้องไม่มีรอยทดสอบค้างจากรอบก่อน");

  let careersId = 0;

  try {
    await pool.query(
      `insert into form_submission (form, email, name, message, consent) values
        ('contact', $1, 'ผู้ขอ', 'ขอให้ลบข้อมูล', true),
        ('newsletter', $2, 'ผู้ขอ', 'สมัครข่าว', true)`,
      [target, targetMixedCase],
    );
    const { rows } = await pool.query<{ id: string }>(
      `insert into form_submission (form, email, name, message, consent) values
        ('careers', $1, 'ผู้ขอ', 'สมัครงาน', true) returning id`,
      [target],
    );
    careersId = Number(rows[0]?.id ?? 0);
    assert.ok(careersId > 0, "ต้องสร้างใบสมัครทดสอบได้");

    await pool.query(
      `insert into form_attachment (submission_id, filename, mime, size_bytes, data)
       values ($1, 'cv.pdf', 'application/pdf', 4, $2)`,
      [careersId, Buffer.from("test")],
    );
    await pool.query(
      `insert into form_submission (form, email, name, message, consent) values
        ('contact', $1, 'คนข้าง ๆ', 'ต้องไม่ถูกลบ', true)`,
      [bystander],
    );

    const preview = await erasurePreview(target);
    assert.ok(preview !== null, "ต้องอ่านตัวอย่างก่อนลบได้");
    assert.deepEqual(
      preview.counts,
      { contact: 1, newsletter: 1, careers: 1, attachments: 1 },
      "ต้องเห็นครบทุกฟอร์มของอีเมลนี้ (รวมแบบตัวพิมพ์ผสม)",
    );
    done(
      "นับข้อมูลของอีเมลเป้าหมายก่อนลบ",
      `ติดต่อ ${preview.counts.contact} · ข่าวสาร ${preview.counts.newsletter} · สมัครงาน ${preview.counts.careers} · ไฟล์แนบ ${preview.counts.attachments}`,
    );

    const report = await eraseSubject({ email: target, actorEmail: actor });
    assert.ok(report !== null, "ลบต้องได้รายงาน");
    assert.equal(report.total, 3, "ต้องลบครบ 3 รายการ");
    assert.equal(report.nothingFound, false);
    assert.ok(report.masked.includes("***") && !report.masked.includes(target), "รายงานต้องเป็นแบบปิดบางส่วน");

    const after = {
      targetRows: await countWhere("form_submission where lower(btrim(email)) = $1", [target]),
      targetAttachments: await countWhere("form_attachment where submission_id = $1", [careersId]),
      bystanderRows: await countWhere("form_submission where lower(btrim(email)) = $1", [bystander]),
      auditRows: await countWhere("audit_log where actor_email = $1 and action = 'erase-subject'", [actor]),
    };
    assert.deepEqual(
      after,
      { targetRows: 0, targetAttachments: 0, bystanderRows: 1, auditRows: 1 },
      "ลบครบ + ไฟล์แนบหายตาม + ห้ามแตะอีเมลอื่น + ต้องมีบันทึกการลบ 1 แถว",
    );
    done("ลบข้อมูลอีเมลเป้าหมายครบ + ไม่แตะอีเมลอื่น", "ไฟล์เรซูเม่หายตามใบสมัคร · audit 1 แถว");

    const { rows: detailRows } = await pool.query<{ detail: string | null }>(
      "select detail from audit_log where actor_email = $1 order by created_at desc limit 1",
      [actor],
    );
    const detail = detailRows[0]?.detail ?? "";
    assert.ok(!detail.includes(target), "บันทึกการลบห้ามมีอีเมลเต็ม");
    assert.ok(detail.includes("***"), "บันทึกต้องเป็นแบบปิดบางส่วน");
    done("บันทึกการลบไม่เก็บอีเมลเต็ม", `detail = ${detail}`);

    const second = await eraseSubject({ email: target, actorEmail: actor });
    assert.equal(second?.nothingFound, true, "ลบซ้ำต้องบอกว่าไม่พบข้อมูล ไม่ใช่พัง");
    done("ลบซ้ำอย่างปลอดภัย", "ไม่พบข้อมูล · ไม่เกิด error");
  } finally {
    /* คืนสภาพ: ลบรอยทดสอบทั้งหมด (ไฟล์แนบหายตาม cascade) */
    await pool.query("delete from form_submission where lower(btrim(email)) in ($1, $2)", [target, bystander]);
    await pool.query("delete from audit_log where actor_email = $1", [actor]);

    const after = {
      target: await countWhere("form_submission where lower(btrim(email)) = $1", [target]),
      bystander: await countWhere("form_submission where lower(btrim(email)) = $1", [bystander]),
      audit: await countWhere("audit_log where actor_email = $1", [actor]),
    };
    assert.deepEqual(after, { target: 0, bystander: 0, audit: 0 }, "ลบรอยทดสอบต้องไม่เหลืออะไรค้าง");
    done("คืนสภาพตารางคำขอใช้สิทธิ์แล้ว", "ไม่เหลือรอยทดสอบ");
  }
}

await main();
