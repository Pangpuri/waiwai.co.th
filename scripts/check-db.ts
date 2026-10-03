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

await main();
