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

import { buildHomeTemplate } from "@/lib/blocks/home-template";
import { listBlockPresets, saveBlockPreset } from "@/lib/blocks/presets";
import { ENV_ADMIN_ID } from "@/lib/auth/user-store";
import { ensureEnvAdminUser } from "@/lib/auth/users-repository";
import { closePool, getPool, isDatabaseConfigured } from "@/db/pool";
import { HOME_SEED } from "@/lib/content/home-seed";
import { HOME_PAGE_SPEC } from "@/lib/content/model";
import { countPageRows, importPageSeed, loadPageContent, savePageContent } from "@/lib/content/repository";
import { itemKeyOf } from "@/lib/content/sql";
import { errorsOf, validateContent } from "@/lib/content/validate";
import type { PageContent } from "@/lib/content/types";
import {
  findMediaUsage,
  getMediaBinary,
  getTrashedMediaBinary,
  insertMedia,
  listMedia,
  mediaStats,
  newMediaId,
  searchMedia,
} from "@/lib/media/repository";
import type { ProductInput } from "@/lib/products/model";
import {
  countProductsByCategory,
  deleteProduct,
  deleteProductCategory,
  deleteProductForever,
  listProductCategoriesForAdmin,
  listProductCategoryCards,
  listProductHighlights,
  listProductsByCategory,
  listProductsForAdmin,
  loadProductForAdmin,
  replaceProductIngredients,
  setProductTrashed,
  upsertProduct,
  upsertProductCategory,
} from "@/lib/products/repository";
import { newsIdOfSourceId, type NewsInput } from "@/lib/news/model";
import { parseNewsBody } from "@/lib/news/body";
import { newsBlocksToEditor, parseNewsEditorBlocks } from "@/lib/news/editor-blocks";
import { newsBlocksToText, newsTextToBlocks } from "@/lib/news/editor-text";
import {
  adminNewsCounts,
  countNews,
  createNewsForAdmin,
  deleteNews,
  listNews,
  listNewsForAdmin,
  listNewsSourceIds,
  loadNewsBySourceId,
  loadNewsForAdmin,
  setNewsTrashed,
  updateNewsForAdmin,
  upsertNews,
} from "@/lib/news/repository";
import { recipeIdOfSourceId } from "@/lib/recipes/model";
import {
  adminRecipeCounts,
  createRecipeForAdmin,
  deleteRecipe,
  deleteRecipeForever,
  listRecipes,
  listRecipesForAdmin,
  loadRecipeForAdmin,
  setRecipeTrashed,
  updateRecipeForAdmin,
  upsertRecipe,
  type AdminRecipeInput,
} from "@/lib/recipes/repository";
import { RETENTION_CLASSES, summarizePurge } from "@/lib/retention/plan";
import { purgeExpired, retentionOverview } from "@/lib/retention/purge";
import { eraseSubject, erasurePreview } from "@/lib/privacy/repository";
import {
  applyChromePreset,
  countChromePresets,
  listChromePresets,
  readChromeDraftUndo,
  saveChromePresetFromRow,
  undoChromePreset,
} from "@/lib/chrome/preset-repository";
import { chromePresetPageKey, defaultChromePresetPayload } from "@/lib/chrome/presets";
import { countRawBlocks } from "@/lib/blocks/migrate";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { BLOCK_TEMPLATE_PAGE_IDS, buildBlockTemplate } from "@/lib/blocks/templates";
import {
  createAdminUser,
  createDbUserStore,
  deleteAdminUser,
  resetAdminUserPassword,
  setAdminUserDisabled,
  setAdminUserRole,
} from "@/lib/auth/users-repository";
import { verifyPassword } from "@/lib/auth/password";
import {
  createAdminSession,
  findAdminSession,
  hashSessionId,
  listActiveAdminSessions,
  newSessionId,
  revokeAdminSessions,
  revokeSessionsForUser,
} from "@/lib/auth/sessions-repository";
import { SESSION_TTL_MS } from "@/lib/auth/session";
import { documentErrorsOf, validateDocument } from "@/lib/blocks/validate";
import { loadLiveBlockDocument } from "@/lib/blocks/page-loader";
import { th } from "@/lib/i18n/messages/th";
import {
  countActivePreviewLinks,
  createPreviewLink,
  hashPreviewToken,
  listPreviewLinks,
  purgeExpiredPreviewLinks,
  resolvePreviewLink,
  revokePreviewLink,
} from "@/lib/preview-link/repository";
import {
  isPageLive,
  listDueSchedules,
  loadDocumentRow,
  publishDraft,
  publishDuePage,
  readPublishSchedule,
  saveDraft,
  saveJsonDraft,
  setPageLive,
  setPublishSchedule,
} from "@/lib/blocks/repository";
import { publishDueScheduled, scheduledPublishOverview } from "@/lib/blocks/publish-scheduler";
import {
  deleteTrashItemPermanently,
  listTrash,
  purgeExpiredTrash,
  restoreTrashItem,
  trashBlockPreset,
  trashChromePreset,
  trashMedia,
  trashStats,
} from "@/lib/trash/repository";

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

  /* 12) ถังขยะ: ย้ายเข้า → ซ่อนจากหน้าเว็บ → กู้คืน → ลบถาวร → ลบตามกำหนด (X2.4 · รอบที่ 78) */
  await checkTrash();

  /* 13) ลิงก์พรีวิวชั่วคราว: สร้าง → เปิดได้ → ปลอม/หมดอายุ/ยกเลิกใช้ไม่ได้ → เก็บกวาด (X2.6 · รอบที่ 79) */
  await checkPreviewLinks();

  /* 14) พรีเซ็ตของส่วนกลาง: เก็บชุด → ใช้ชุด (เฉพาะฉบับร่าง) → ลบเข้าถัง → กู้คืน (W3b · รอบที่ 80) */
  await checkChromePresets();

  /* 15) ตัวสร้างหลายหน้า (S2): เทมเพลต → บันทึกฉบับร่าง → เผยแพร่ → สวิตช์ "ใช้กับเว็บจริง" รายหน้า (รอบที่ 82) */
  await checkPageTemplates();

  /* 16) บัญชีผู้ดูแลในฐานข้อมูล + บทบาท (X1.10 · RBAC · รอบที่ 84) */
  await checkAdminUsers();

  /* 17) ตั้งเวลาเผยแพร่: ตั้งกำหนดในอดีต → ครบกำหนด → เผยแพร่ครั้งเดียว → ล้างกำหนด (X2.7 · รอบที่ 100) */
  await checkScheduledPublish();

  /* 18) สินค้าจากเว็บเดิม: หมวด → สินค้า + ส่วนผสม → อ่านกลับ → ภาพถูกใช้ที่ไหน → ลบ (S3 ส่วนที่ 3 · รอบที่ 103) */
  await checkProductCatalog();

  /* 19) เมนูอาหาร (วิดีโอ) จากเว็บเดิม: เขียน → อ่านกลับ → ภาพถูกใช้ที่ไหน → ลบ (S3 ส่วนที่ 4 · รอบที่ 104) */
  await checkRecipeVideos();

  /* 20) ข่าวสาร & กิจกรรม: เขียน (เนื้อหาเป็นบล็อก) → อ่านกลับ (เวลาไทย) → ภาพถูกใช้ที่ไหน → ลบ (หน้า /news · รอบที่ 105) */
  await checkNews();

  /* 21) หลังบ้านข่าว: ร่าง/เผยแพร่/ถังขยะ คุมการมองเห็นบนเว็บ (รอบที่ 123) */
  await checkNewsAdmin();

  /* 22) ข่าวจริงทุกชิ้น: ข้อความ ↔ บล็อก ไป-กลับไม่เพี้ยน (กันกดบันทึกแล้วเนื้อหาเดิมเสีย) */
  await checkNewsEditorRoundTrip();

  /* 23) บัญชีโหมด env ต้องล็อกอินได้ (FK admin_session → admin_user) */
  await checkEnvAdminSession();

  /* 24) หลังบ้านสินค้า: ตัวอ่านของจอ (การ์ด/แก้ไข/หมวด) + โหมดเขียนภาพ keep/set (รอบที่ 134) */
  await checkProductAdmin();

  /* 25) หลังบ้านเมนูอาหาร: ร่าง/เผยแพร่/ถังขยะ คุมการมองเห็นบนเว็บจริง (รอบที่ 135) */
  await checkRecipeAdmin();

  /* 26) ถังขยะ + ลบถาวร: ประตู "ต้องอยู่ในถังก่อน" อยู่ที่ SQL ทั้งสินค้าและเมนู (รอบที่ 139) */
  await checkTrashForever();

  /* 27) นำเข้าสินค้าซ้ำ: ต้องไม่ทับงานที่แก้จากหลังบ้าน (รอบที่ 140) */
  await checkProductImportGuard();

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

/**
 * 12) ถังขยะ (X2.4 · รอบที่ 78) — **วงจรจริงกับฐานข้อมูล**
 *
 * พิสูจน์ 7 อย่างที่ผู้ใช้รู้สึกได้จริง
 * 1. ย้ายภาพเข้าถัง → **หายจากทุกทางที่เว็บใช้** (ไบนารี/รายการ/ค้นหา/สถิติ) แต่ยังอยู่ในถัง
 * 2. **กู้คืนแล้วกลับมาใช้ได้** (พาธ `/media/<id>` เดิม ⇒ บล็อกที่อ้างถึงไม่พัง)
 * 3. กู้คืนซ้ำ = บอกว่าไม่พบ ไม่ใช่พัง
 * 4. **ลบถาวรของที่ยังใช้งานอยู่ไม่ได้** (ด่านอยู่ใน SQL ไม่ใช่แค่ UI)
 * 5. พรีเซ็ตบล็อกใช้กลไกเดียวกัน (ย้ายเข้า/กู้คืน)
 * 6. **ตัวลบตามกำหนด** ลบเฉพาะของที่พ้นระยะเก็บ — ของที่เพิ่งลบยังอยู่
 * 7. ลบถาวรแล้วแถวหายจริง
 *
 * ⚠️ ไม่เรียก `emptyTrash()` ในด่านนี้โดยเจตนา — คำสั่งนั้นล้างของจริงทุกชิ้นในถังของฐานข้อมูลที่รันอยู่
 *    (การพิสูจน์เส้นทางนั้นใช้การสแกนซอร์สใน `scripts/test-trash.ts` แทน)
 * ⚠️ รอยทดสอบใช้คำนำหน้า `check-db-trash` และถูกลบใน `finally` เสมอ
 */
const TRASH_TEST_PREFIX = "check-db-trash";

async function checkTrash(): Promise<void> {
  const pool = getPool();

  const mediaId = `${TRASH_TEST_PREFIX}-media`;
  const oldMediaId = `${TRASH_TEST_PREFIX}-media-old`;
  const presetName = `${TRASH_TEST_PREFIX}-preset`;
  const actor = "check-db@example.invalid";

  const leftovers = {
    media: await countWhere("media where id like $1", [`${TRASH_TEST_PREFIX}%`]),
    preset: await countWhere("block_preset where name like $1", [`${TRASH_TEST_PREFIX}%`]),
  };
  assert.deepEqual(leftovers, { media: 0, preset: 0 }, "ต้องไม่มีรอยทดสอบถังขยะค้างจากรอบก่อน");

  let presetId = "";

  try {
    /* ── เตรียมของทดสอบ: ภาพ 1 ใบ (ใช้อยู่) · ภาพเก่า 1 ใบ (อยู่ในถังมานาน) · พรีเซ็ต 1 ใบ ── */
    await insertMedia({
      id: mediaId,
      filename: "check-db-trash.png",
      mime: "image/png",
      sizeBytes: 11,
      width: 2,
      height: 2,
      data: Buffer.from("trash-bytes"),
      altTh: "ภาพทดสอบถังขยะ",
      altEn: "",
      createdBy: "check-db",
    });
    await insertMedia({
      id: oldMediaId,
      filename: "check-db-trash-old.png",
      mime: "image/png",
      sizeBytes: 11,
      width: 2,
      height: 2,
      data: Buffer.from("trash-old--"),
      altTh: "ภาพทดสอบที่พ้นกำหนด",
      altEn: "",
      createdBy: "check-db",
    });
    /* ของ "เก่า": เข้าถังมานานเกินระยะเก็บ (จำลองด้วย SQL ตรง ๆ เพราะของจริงต้องรอ 30 วัน) */
    await pool.query("update media set deleted_at = now() - interval '60 days', deleted_by = $2 where id = $1", [
      oldMediaId,
      actor,
    ]);

    const template = buildHomeTemplate();
    const block = template.blocks[0];
    assert.ok(block !== undefined, "ต้องมีบล็อกตั้งต้นของหน้าแรกให้บันทึกเป็นพรีเซ็ต");
    await saveBlockPreset(presetName, block, "check-db");
    const presetRow = await pool.query<{ id: string }>("select id from block_preset where lower(name) = lower($1)", [
      presetName,
    ]);
    presetId = presetRow.rows[0]?.id ?? "";
    assert.ok(presetId !== "", "ต้องสร้างพรีเซ็ตทดสอบได้");

    /* ── 1) ของที่ยังใช้งานปกติต้องมองเห็นครบทุกทาง ── */
    const before = {
      binary: await getMediaBinary(mediaId),
      inList: (await listMedia(200)).some((item) => item.id === mediaId),
      inSearch: (await searchMedia("check-db-trash")).some((item) => item.id === mediaId),
      stats: (await mediaStats()).count,
      presets: (await listBlockPresets()).some((preset) => preset.id === presetId),
    };
    assert.ok(before.binary !== null, "อ่านไบนารีของภาพที่ใช้งานได้");
    assert.equal(before.inList, true, "ภาพต้องอยู่ในรายการคลัง");
    assert.equal(before.inSearch, true, "ค้นหาชื่อไฟล์ต้องเจอ");
    assert.ok(before.stats >= 1, "สถิติคลังต้องนับภาพ");
    assert.equal(before.presets, true, "พรีเซ็ตต้องอยู่ในรายการ");
    done("ของที่ใช้งานปกติมองเห็นครบทุกทาง", `คลัง ${before.stats} ภาพ`);

    /* ── 2) ด่านกันพลาด: ลบถาวรของที่ยังใช้งานอยู่ = ต้องไม่เกิด (A ยังไม่ได้เข้าถัง) ── */
    assert.equal(await deleteTrashItemPermanently("media", mediaId, actor), false, "ลบถาวรของที่ยังใช้งานอยู่ต้องไม่สำเร็จ");
    assert.ok((await getMediaBinary(mediaId)) !== null, "ภาพที่ยังใช้งานต้องไม่หายไปจากการกดลบถาวร");
    assert.equal(await restoreTrashItem("media", mediaId, actor), false, "กู้คืนของที่ไม่ได้อยู่ในถังต้องไม่สำเร็จ");

    /* ── 3) ย้ายเข้าถัง: หายจากทางที่เว็บใช้ แต่ยังอยู่ในถัง ── */
    assert.equal(await trashMedia(mediaId, actor), true, "ย้ายภาพเข้าถังต้องสำเร็จ");
    const hidden = {
      binary: await getMediaBinary(mediaId),
      inList: (await listMedia(200)).some((item) => item.id === mediaId),
      inSearch: (await searchMedia("check-db-trash")).some((item) => item.id === mediaId),
      inTrash: (await listTrash()).some((entry) => entry.kind === "media" && entry.id === mediaId),
      trashStats: (await trashStats()).media,
    };
    assert.equal(hidden.binary, null, "ภาพในถังต้องไม่ถูกเสิร์ฟบนเว็บ");
    assert.equal(hidden.inList, false, "ภาพในถังต้องไม่โผล่ในคลัง");
    assert.equal(hidden.inSearch, false, "ภาพในถังต้องไม่โผล่ในผลค้นหา");
    assert.equal(hidden.inTrash, true, "ภาพต้องอยู่ในถังขยะ");
    assert.ok(hidden.trashStats >= 2, `ถังต้องมีอย่างน้อย 2 ภาพ (ของใหม่ + ของเก่า) — พบ ${hidden.trashStats}`);
    done("ย้ายเข้าถัง → หายจากหน้าเว็บ แต่ยังกู้คืนได้", `ในถัง ${hidden.trashStats} ภาพ`);

    /* ── 4) กู้คืน → กลับมาใช้ได้ที่พาธเดิม ── */
    assert.equal(await restoreTrashItem("media", mediaId, actor), true, "กู้คืนภาพต้องสำเร็จ");
    const restored = await getMediaBinary(mediaId);
    assert.ok(restored !== null, "หลังกู้คืนต้องอ่านไบนารีได้เหมือนเดิม");
    assert.equal((await listMedia(200)).some((item) => item.id === mediaId), true, "หลังกู้คืนต้องกลับเข้าคลัง");
    assert.equal(await restoreTrashItem("media", mediaId, actor), false, "กู้คืนซ้ำต้องบอกว่าไม่พบ ไม่ใช่พัง");
    done("กู้คืนแล้วกลับมาใช้งานได้ที่พาธเดิม", `/media/${mediaId}`);

    /* ── 5) พรีเซ็ตใช้กลไกเดียวกัน ── */
    assert.equal(await trashBlockPreset(presetId, actor), true, "ย้ายพรีเซ็ตเข้าถังต้องสำเร็จ");
    assert.equal(
      await countWhere("block_preset where id = $1 and deleted_at is not null", [presetId]),
      1,
      "พรีเซ็ตต้องถูกทำเครื่องหมายว่าอยู่ในถัง",
    );
    assert.equal(
      (await listBlockPresets()).some((preset) => preset.id === presetId),
      false,
      "พรีเซ็ตในถังต้องไม่โผล่ในคลังพรีเซ็ต",
    );
    assert.equal(await restoreTrashItem("preset", presetId, actor), true, "กู้คืนพรีเซ็ตต้องสำเร็จ");
    assert.equal(
      (await listBlockPresets()).some((preset) => preset.id === presetId),
      true,
      "หลังกู้คืนพรีเซ็ตต้องกลับเข้าคลัง",
    );
    done("พรีเซ็ตบล็อกใช้กลไกถังขยะเดียวกัน", "ย้ายเข้า → กู้คืน ครบวงจร");

    /* ── 6) ตัวลบตามกำหนด: ของเก่า (B) หาย · ของใหม่ (A) ยังอยู่ในถัง ── */
    assert.equal(await trashMedia(mediaId, actor), true, "ย้ายภาพ A เข้าถังอีกครั้งเพื่อทดสอบตัวลบตามกำหนด");
    const dryTrash = await purgeExpiredTrash({ dryRun: true });
    assert.ok(dryTrash !== null, "dry run ต้องได้ผลลัพธ์เมื่อมี DATABASE_URL");
    assert.ok(dryTrash.counts.media >= 1, `ต้องนับภาพที่พ้นกำหนด (พบ ${dryTrash.counts.media})`);

    const purgedTrash = await purgeExpiredTrash();
    assert.ok(purgedTrash !== null, "ลบจริงต้องได้รายงาน");
    assert.ok(purgedTrash.counts.media >= 1, "ต้องลบภาพที่พ้นกำหนดจริง");
    assert.equal(await countWhere("media where id = $1", [oldMediaId]), 0, "ภาพที่พ้นกำหนดต้องถูกลบถาวร");
    assert.equal(
      await countWhere("media where id = $1 and deleted_at is not null", [mediaId]),
      1,
      "ภาพที่เพิ่งลบต้องยังอยู่ในถัง (ไม่ถูกลบก่อนกำหนด)",
    );
    done("ตัวลบตามกำหนดลบเฉพาะของที่พ้นระยะเก็บ", `ลบ ${purgedTrash.counts.media} แถว`);

    /* ── 7) ลบถาวรแล้วแถวหายจริง ── */
    assert.equal(await deleteTrashItemPermanently("media", mediaId, actor), true, "ลบถาวรของในถังต้องสำเร็จ");
    assert.equal(await countWhere("media where id = $1", [mediaId]), 0, "แถวต้องหายจากฐานข้อมูล");
    assert.equal(await getMediaBinary(mediaId), null, "ลบถาวรแล้วต้องอ่านไม่ได้");
    done("ลบถาวรจากถังแล้วแถวหายจริง", "ภาพทดสอบ");

    /* ── 8) ปิดหนี้ รอบที่ 81: ตัวอย่างภาพของในถัง (หลังบ้านเท่านั้น) ── */
    {
      const thumbId = `${TRASH_TEST_PREFIX}thumb`;
      await pool.query(
        `insert into media (id, filename, mime, size_bytes, width, height, alt_th, alt_en, data, deleted_at, deleted_by)
           values ($1, 'check-db-thumb.png', 'image/png', 4, 1, 1, 'ทดสอบ', 'test', $2::bytea, now(), $3)
         on conflict (id) do update set deleted_at = now(), deleted_by = $3, data = excluded.data`,
        [thumbId, Buffer.from([0x89, 0x50, 0x4e, 0x47]), actor],
      );

      /* ฝั่งสาธารณะ: ของในถังต้องไม่ถูกเสิร์ฟ */
      assert.equal(await getMediaBinary(thumbId), null, "ของในถังต้องไม่ถูกเสิร์ฟผ่านเส้นทางสาธารณะ");

      /* ฝั่งหลังบ้าน: ตัวอ่านเฉพาะของในถังได้ไฟล์จริง (เส้นทาง /admin/trash/thumbnail ตรวจสิทธิ์ก่อนใช้) */
      const trashed = await getTrashedMediaBinary(thumbId);
      assert.ok(trashed !== null, "ตัวอ่านของในถังต้องได้ไฟล์สำหรับตัวอย่างในหลังบ้าน");
      assert.equal(trashed.mime, "image/png", "ต้องคืนชนิดไฟล์ให้ตั้ง content-type ได้");
      done("ตัวอย่างภาพของในถัง (หลังบ้านเท่านั้น)", "สาธารณะยัง 404 · ของในถังอ่านได้เฉพาะเส้นทางที่ล็อกอิน");
    }
  } finally {
    /* คืนสภาพ: ลบรอยทดสอบทั้งหมด (ทั้งที่ยังอยู่ในถังและที่กู้คืนแล้ว) */
    await pool.query("delete from media where id like $1", [`${TRASH_TEST_PREFIX}%`]);
    await pool.query("delete from block_preset where lower(name) like $1", [`${TRASH_TEST_PREFIX}%`]);
    await pool.query("delete from audit_log where target like $1 or actor_email = $2", [
      `${TRASH_TEST_PREFIX}%`,
      actor,
    ]);

    const after = {
      media: await countWhere("media where id like $1", [`${TRASH_TEST_PREFIX}%`]),
      preset: await countWhere("block_preset where name like $1", [`${TRASH_TEST_PREFIX}%`]),
    };
    assert.deepEqual(after, { media: 0, preset: 0 }, "ลบรอยทดสอบถังขยะต้องไม่เหลืออะไรค้าง");
    done("คืนสภาพตารางถังขยะแล้ว", "ไม่เหลือรอยทดสอบ");
  }
}

/**
 * 13) ลิงก์พรีวิวชั่วคราว (X2.6 · รอบที่ 79) — **วงจรจริงกับฐานข้อมูล**
 *
 * พิสูจน์ 5 อย่างที่สำคัญที่สุดของ "ลิงก์ที่ไม่ต้องล็อกอิน"
 * 1. สร้างแล้ว **โทเคนมีรูปแบบถูกต้อง** และเปิดได้จริง (คืนหน้าเป้าหมาย + นับการใช้งาน)
 * 2. **โทเคนที่ถูกแก้/รูปแบบผิด = ใช้ไม่ได้** (ไม่ใช่แค่ซ่อนปุ่ม)
 * 3. **หมดอายุแล้วใช้ไม่ได้**
 * 4. **ยกเลิกแล้วใช้ไม่ได้ทันที** และยกเลิกซ้ำปลอดภัย
 * 5. **รายการที่ส่งให้หน้าจอไม่มีโทเคน/hash** + **ตัวลบกลางเก็บกวาดเฉพาะลิงก์ที่พ้นอายุเก็บ**
 *
 * ⚠️ ล้างรอยทดสอบด้วย `created_by` ของด่านนี้เท่านั้น — **ไม่แตะลิงก์จริงของผู้ใช้**
 */
const PREVIEW_LINK_TEST_ACTOR = "check-db-preview@example.invalid";

async function checkPreviewLinks(): Promise<void> {
  const pool = getPool();

  const before = await countWhere("preview_link where created_by = $1", [PREVIEW_LINK_TEST_ACTOR]);
  assert.equal(before, 0, "ต้องไม่มีรอยทดสอบลิงก์พรีวิวค้างจากรอบก่อน");

  try {
    /* ── 1) สร้าง + เปิดได้ ── */
    const created = await createPreviewLink({ page: "home", actorEmail: PREVIEW_LINK_TEST_ACTOR });
    assert.equal(created.ok, true, "สร้างลิงก์ต้องสำเร็จ");
    if (!created.ok) return;

    assert.match(created.token, /^[A-Za-z0-9_-]{43}$/, "โทเคนต้องเป็น base64url 43 ตัวอักษร");
    assert.ok(new Date(created.expiresAt).getTime() > Date.now(), "ลิงก์ใหม่ต้องยังไม่หมดอายุ");

    const opened = await resolvePreviewLink(created.token);
    assert.deepEqual(opened, { ok: true, page: "home" }, "เปิดลิงก์ที่ยังใช้ได้ต้องได้หน้าเป้าหมาย");

    const listed = await listPreviewLinks();
    const mine = listed.filter((link) => link.createdBy === PREVIEW_LINK_TEST_ACTOR);
    assert.equal(mine.length, 1, "ลิงก์ที่สร้างต้องอยู่ในรายการ");
    assert.ok(!Object.hasOwn(mine[0] ?? {}, "token"), "รายการต้องไม่มีฟิลด์โทเคน");
    assert.ok(!Object.hasOwn(mine[0] ?? {}, "tokenHash"), "รายการต้องไม่มี hash ของโทเคน");
    assert.ok((mine[0]?.useCount ?? 0) >= 1, "การเปิดลิงก์ต้องถูกนับ");

    const active = await countActivePreviewLinks("home");
    assert.ok(active >= 1, "ต้องนับลิงก์ที่ยังใช้ได้");
    done("สร้างลิงก์พรีวิวแล้วเปิดได้ + นับการใช้งาน", `เปิด ${mine[0]?.useCount ?? 0} ครั้ง`);

    /* ── 2) โทเคนปลอม/รูปแบบผิด = ใช้ไม่ได้ ── */
    const tampered = `${created.token.slice(0, -1)}${created.token.endsWith("A") ? "B" : "A"}`;
    assert.deepEqual(await resolvePreviewLink(tampered), { ok: false, page: null }, "โทเคนที่ถูกแก้ต้องใช้ไม่ได้");
    assert.deepEqual(await resolvePreviewLink("too-short"), { ok: false, page: null }, "รูปแบบผิดต้องใช้ไม่ได้");
    done("โทเคนปลอม/รูปแบบผิดใช้ไม่ได้", "ทั้งที่ถูกแก้และที่สั้นเกิน");

    /* ── 3) หมดอายุ = ใช้ไม่ได้ (แถวหมดอายุ + แถวเก่าที่ควรถูกเก็บกวาด) ── */
    const expiredToken = "e".repeat(43);
    await pool.query(
      `insert into preview_link (id, token_hash, page, expires_at, created_by) values
        ($1, $2, 'home', now() - interval '1 hour', $3),
        ($4, $5, 'home', now() - interval '60 days', $3)`,
      [
        "check-db-preview-expired",
        hashPreviewToken(expiredToken),
        PREVIEW_LINK_TEST_ACTOR,
        "check-db-preview-old",
        hashPreviewToken("o".repeat(43)),
      ],
    );
    assert.deepEqual(await resolvePreviewLink(expiredToken), { ok: false, page: null }, "ลิงก์หมดอายุต้องใช้ไม่ได้");
    done("ลิงก์ที่หมดอายุใช้ไม่ได้", "หมดอายุ 1 ชม. ที่แล้ว");

    /* ── 4) ยกเลิกแล้วใช้ไม่ได้ทันที + ยกเลิกซ้ำปลอดภัย ── */
    const id = mine[0]?.id ?? "";
    assert.ok(id !== "", "ต้องได้ id ของลิงก์ที่สร้าง");
    assert.equal(await revokePreviewLink(id, PREVIEW_LINK_TEST_ACTOR), true, "ยกเลิกต้องสำเร็จ");
    assert.deepEqual(await resolvePreviewLink(created.token), { ok: false, page: null }, "ลิงก์ที่ยกเลิกแล้วต้องใช้ไม่ได้");
    assert.equal(await revokePreviewLink(id, PREVIEW_LINK_TEST_ACTOR), false, "ยกเลิกซ้ำต้องบอกว่าไม่พบ ไม่ใช่พัง");
    done("ยกเลิกลิงก์แล้วใช้ไม่ได้ทันที", `ลิงก์ ${id}`);

    /* ── 5) ตัวลบกลางเก็บกวาด: ลิงก์เก่าหาย · ลิงก์ที่เพิ่งปิดยังอยู่ ── */
    const dryLinks = await purgeExpiredPreviewLinks({ dryRun: true });
    assert.ok(dryLinks !== null, "dry run ต้องได้ผลลัพธ์เมื่อมี DATABASE_URL");
    assert.ok(dryLinks.deleted >= 1, `ต้องนับลิงก์ที่พ้นอายุเก็บ (พบ ${dryLinks.deleted})`);

    const purgedLinks = await purgeExpiredPreviewLinks();
    assert.ok(purgedLinks !== null && purgedLinks.deleted >= 1, "ต้องลบลิงก์ที่พ้นอายุเก็บจริง");
    assert.equal(await countWhere("preview_link where id = $1", ["check-db-preview-old"]), 0, "ลิงก์เก่าต้องถูกลบ");
    assert.equal(
      await countWhere("preview_link where id = $1", ["check-db-preview-expired"]),
      1,
      "ลิงก์ที่เพิ่งหมดอายุต้องยังอยู่ (ยังไม่พ้นอายุเก็บ)",
    );
    assert.equal(await countWhere("preview_link where id = $1", [id]), 1, "ลิงก์ที่เพิ่งยกเลิกต้องยังอยู่");
    done("เก็บกวาดเฉพาะลิงก์ที่พ้นอายุเก็บ", `ลบ ${purgedLinks.deleted} แถว`);
  } finally {
    /* คืนสภาพ: ลบเฉพาะลิงก์/ร่องรอยของด่านนี้ (ไม่แตะลิงก์จริงของผู้ใช้) */
    await pool.query("delete from preview_link where created_by = $1", [PREVIEW_LINK_TEST_ACTOR]);
    await pool.query("delete from audit_log where actor_email = $1", [PREVIEW_LINK_TEST_ACTOR]);

    const after = await countWhere("preview_link where created_by = $1", [PREVIEW_LINK_TEST_ACTOR]);
    assert.equal(after, 0, "ลบรอยทดสอบลิงก์พรีวิวต้องไม่เหลืออะไรค้าง");
    done("คืนสภาพตารางลิงก์พรีวิวแล้ว", "ไม่เหลือรอยทดสอบ");
  }
}

/**
 * 14) พรีเซ็ตของส่วนกลาง (W3b · รอบที่ 80) — **วงจรจริงกับฐานข้อมูล**
 *
 * พิสูจน์ "สามฉาก" ที่ผู้ใช้ขอไว้ (รอบที่ 58)
 * 1. **เก็บชุด** จากของใหม่ (ฉบับร่าง) และจากของเก่า (ฉบับเผยแพร่) ได้ · ชื่อซ้ำ = เขียนทับ (ไม่เกิดชุดซ้ำ)
 * 2. **ใช้ชุดนี้** เขียนทับ **เฉพาะฉบับร่าง** — ยืนยันด้วยการเทียบ JSON ของแถว draft
 * 3. **ของเก่าไม่ถูกแตะ** — แถว published ต้องเหมือนเดิมเป๊ะหลังใช้ชุด
 * 4. **ลบ = เข้าถังขยะกลาง** และ **กู้คืนได้** · บันทึกชื่อเดิมทับ = กู้คืนอัตโนมัติ
 * 5. **ชนิดต้องตรงกัน** — ใช้ชุดของส่วนหนึ่งกับอีกส่วนไม่ได้
 *
 * ⚠️ ล้างรอยทดสอบด้วยชื่อ/ผู้บันทึกของด่านนี้เท่านั้น — ไม่แตะพรีเซ็ตจริงของผู้ใช้
 * ⚠️ ถ้าส่วนนั้นยังไม่มีแถวใน `page_document` เลย ด่านนี้จะ **สร้างฉบับร่างชั่วคราว** แล้วลบทิ้งในตอนจบ
 */
const CHROME_PRESET_TEST_ACTOR = "check-db-chrome-preset@example.invalid";
const CHROME_PRESET_TEST_NAME = "check-db-navbar-set";

async function checkChromePresets(): Promise<void> {
  const pool = getPool();
  const navbarKey = chromePresetPageKey("navbar");
  const footerKey = chromePresetPageKey("footer");

  const before = await countWhere("chrome_preset where name like $1", [`${CHROME_PRESET_TEST_NAME}%`]);
  assert.equal(before, 0, "ต้องไม่มีรอยทดสอบพรีเซ็ตส่วนกลางค้างจากรอบก่อน");

  /* จำสภาพเดิมของแถว draft/published ของ navbar ไว้คืนตอนจบ */
  const navbarDraftBefore = await loadDocumentRow(navbarKey, "draft");
  const navbarPublishedBefore = await loadDocumentRow(navbarKey, "published");

  try {
    /* เตรียม "ของใหม่" ให้มีจริง: ถ้ายังไม่มีฉบับร่าง ใช้ค่าเริ่มต้นของส่วนนั้น (แล้วลบทิ้งตอนจบ) */
    if (navbarDraftBefore === null) {
      await saveJsonDraft(navbarKey, defaultChromePresetPayload("navbar", th).config, CHROME_PRESET_TEST_ACTOR);
      done("เตรียมฉบับร่างของแถบเมนูสำหรับทดสอบ", "จากค่าเริ่มต้น (จะลบทิ้งตอนจบ)");
    }

    /* ── 1) เก็บชุดจาก "ของใหม่" ── */
    const saved = await saveChromePresetFromRow({
      kind: "navbar",
      name: CHROME_PRESET_TEST_NAME,
      source: "draft",
      actor: CHROME_PRESET_TEST_ACTOR,
      messages: th,
    });
    assert.equal(saved.ok, true, "บันทึกชุดจากฉบับร่างต้องสำเร็จ");
    if (!saved.ok) return;

    /* จำฉบับร่าง ณ ตอนนี้ไว้เทียบตอนย้อนกลับ (คือ "ของใหม่" ที่จะถูกทับเมื่อใช้ชุด) */
    const draftBeforeApply = (await loadDocumentRow(navbarKey, "draft"))?.raw ?? null;

    const listed = await listChromePresets(th);
    const mine = listed.filter((preset) => preset.name === CHROME_PRESET_TEST_NAME);
    assert.equal(mine.length, 1, "ชุดที่บันทึกต้องอยู่ในคลัง");
    assert.equal(mine[0]?.kind, "navbar", "ชนิดต้องตรงกับที่บันทึก");
    assert.equal(await countChromePresets("navbar"), mine.length);
    done("เก็บชุดจากฉบับร่าง (ของใหม่)", `ชุด ${CHROME_PRESET_TEST_NAME}`);

    /* ── 2) ชื่อซ้ำ = เขียนทับ ไม่เกิดชุดซ้ำ ── */
    const again = await saveChromePresetFromRow({
      kind: "navbar",
      name: CHROME_PRESET_TEST_NAME.toUpperCase(),
      source: "draft",
      actor: CHROME_PRESET_TEST_ACTOR,
      messages: th,
    });
    assert.equal(again.ok, true, "บันทึกชื่อเดิม (ต่างตัวพิมพ์) ต้องสำเร็จ");
    assert.equal(again.ok && again.replaced, true, "ต้องบอกว่าเป็นการเขียนทับ");
    assert.equal(await countWhere("chrome_preset where lower(name) = lower($1)", [CHROME_PRESET_TEST_NAME]), 1, "ต้องมีชุดเดียว");
    done("ชื่อซ้ำ (ไม่สนตัวพิมพ์) = เขียนทับ", "ไม่เกิดชุดซ้ำในคลัง");

    /* ── 3) ใช้ชุดนี้ → เขียนเฉพาะฉบับร่าง · ของเก่าไม่ถูกแตะ ── */
    const applied = await applyChromePreset({
      kind: "navbar",
      id: saved.id,
      actor: CHROME_PRESET_TEST_ACTOR,
      messages: th,
    });
    assert.equal(applied.ok, true, "ใช้ชุดต้องสำเร็จ");

    const draftAfter = await loadDocumentRow(navbarKey, "draft");
    assert.ok(draftAfter !== null, "หลังใช้ชุด ฉบับร่างต้องมีอยู่");
    assert.deepEqual(
      draftAfter.raw,
      mine[0]?.payload.config,
      "ฉบับร่างต้องเท่ากับชุดที่บันทึกไว้เป๊ะ",
    );

    const publishedAfter = await loadDocumentRow(navbarKey, "published");
    assert.deepEqual(
      publishedAfter?.raw ?? null,
      navbarPublishedBefore?.raw ?? null,
      "ของเก่า (ฉบับเผยแพร่) ต้องไม่ถูกแตะ",
    );
    done("ใช้ชุดนี้เขียนทับเฉพาะฉบับร่าง", "ของเก่าไม่ถูกแตะ");

    /* ── 3.5) ปิดหนี้ รอบที่ 81: ภาพที่พรีเซ็ตอ้างถึงต้องถูกนับเป็น "ใช้งานอยู่" ── */
    {
      const mediaId = "check-db-preset-media";
      await pool.query(
        `insert into media (id, filename, mime, size_bytes, width, height, alt_th, alt_en, data)
           values ($1, 'check-db-preset.png', 'image/png', 4, 1, 1, 'ทดสอบ', 'test', $2::bytea)
         on conflict (id) do update set deleted_at = null, deleted_by = null`,
        [mediaId, Buffer.from([0x89, 0x50, 0x4e, 0x47])],
      );

      /* พรีเซ็ตของส่วนกลางที่อ้างภาพนี้ (โลโก้ในแถบเมนู) */
      const withLogo = {
        ...defaultChromePresetPayload("navbar", th).config,
        logo: { path: `/media/${mediaId}`, altTh: "ทดสอบ", altEn: "test" },
      };
      await saveJsonDraft(navbarKey, withLogo, CHROME_PRESET_TEST_ACTOR);
      const linked = await saveChromePresetFromRow({
        kind: "navbar",
        name: `${CHROME_PRESET_TEST_NAME}-logo`,
        source: "draft",
        actor: CHROME_PRESET_TEST_ACTOR,
        messages: th,
      });
      assert.equal(linked.ok, true, "บันทึกชุดที่มีภาพต้องสำเร็จ");

      const usage = await findMediaUsage(mediaId);
      const fromChrome = usage.filter((entry) => entry.kind === "chrome-preset");
      assert.ok(fromChrome.length >= 1, "findMediaUsage ต้องเห็นภาพที่พรีเซ็ตของส่วนกลางอ้างถึง");

      /* ภาพที่ถูกพรีเซ็ตอ้าง = ย้ายเข้าถังไม่ได้ (ด่านเดียวกับที่ library-actions ใช้) */
      const blocked = usage.length > 0;
      assert.equal(blocked, true, "ภาพที่พรีเซ็ตใช้อยู่ต้องถูกล็อกไม่ให้ลบ");
      done("ภาพที่พรีเซ็ตของส่วนกลางอ้าง ถูกนับว่าใช้งานอยู่", `${usage.length} ที่อ้างอิง`);
    }

    /* ── 4) ชนิดต้องตรง: ใช้ชุด navbar กับ footer ไม่ได้ ── */
    const wrongKind = await applyChromePreset({
      kind: "footer",
      id: saved.id,
      actor: CHROME_PRESET_TEST_ACTOR,
      messages: th,
    });
    assert.equal(wrongKind.ok, false, "ชุดของส่วนอื่นต้องใช้ไม่ได้");
    assert.equal(await loadDocumentRow(footerKey, "published"), null, "ห้ามสร้างแถวของส่วนอื่นขึ้นมาเอง");
    done("ใช้ชุดข้ามส่วนไม่ได้", "กันความผิดพลาดจากค่าที่ส่งมา");

    /* ── 5) ลบ = เข้าถังขยะกลาง แล้วกู้คืนได้ ── */
    assert.equal(await trashChromePreset(saved.id, CHROME_PRESET_TEST_ACTOR), true, "ลบต้องสำเร็จ");
    assert.equal(await countWhere("chrome_preset where id = $1 and deleted_at is not null", [saved.id]), 1, "ต้องอยู่ในถัง");
    assert.equal((await listChromePresets(th)).some((preset) => preset.id === saved.id), false, "ของในถังต้องไม่อยู่ในคลัง");

    const stats = await trashStats();
    assert.ok(stats.chromePreset >= 1, "ยอดในถังต้องนับพรีเซ็ตส่วนกลาง");
    const trashEntry = (await listTrash()).find((entry) => entry.id === saved.id);
    assert.equal(trashEntry?.kind, "chromePreset", "รายการในถังต้องบอกชนิดถูกต้อง");

    assert.equal(await restoreTrashItem("chromePreset", saved.id, CHROME_PRESET_TEST_ACTOR), true, "กู้คืนต้องสำเร็จ");
    assert.equal((await listChromePresets(th)).some((preset) => preset.id === saved.id), true, "กู้คืนแล้วต้องกลับมาอยู่ในคลัง");
    done("ลบเข้าถังขยะกลาง → กู้คืนได้", "ชนิด chromePreset ทำงานครบวงจร");

    /* ── 6) บันทึกชื่อเดิมทับขณะอยู่ในถัง = กู้คืนอัตโนมัติ ── */
    assert.equal(await trashChromePreset(saved.id, CHROME_PRESET_TEST_ACTOR), true, "ย้ายเข้าถังอีกครั้ง");
    const resaved = await saveChromePresetFromRow({
      kind: "navbar",
      name: CHROME_PRESET_TEST_NAME,
      source: "draft",
      actor: CHROME_PRESET_TEST_ACTOR,
      messages: th,
    });
    assert.equal(resaved.ok, true, "บันทึกชื่อเดิมทับต้องสำเร็จ");
    assert.equal(
      await countWhere("chrome_preset where id = $1 and deleted_at is null", [saved.id]),
      1,
      "บันทึกชื่อเดิมต้องกู้คืนกลับมาใช้อัตโนมัติ",
    );
    done("บันทึกชื่อเดิมทับ = กู้คืนจากถังอัตโนมัติ", "ไม่มีชุดค้างในถังแบบงง ๆ");
    /* ── 4.5) ปิดหนี้ รอบที่ 81: ย้อนกลับฉบับร่างก่อนใช้ชุดได้จริง ── */
    {
      const beforeUndo = await readChromeDraftUndo("navbar");
      assert.ok(beforeUndo !== null, "หลังใช้ชุดต้องมีข้อมูลให้ย้อนกลับ");

      const undone = await undoChromePreset({ kind: "navbar", actor: CHROME_PRESET_TEST_ACTOR, messages: th });
      assert.equal(undone.ok, true, "ย้อนกลับต้องสำเร็จ");

      const draftAfterUndo = await loadDocumentRow(navbarKey, "draft");
      /*
        "ก่อนใช้ชุด" ในที่นี้ = ฉบับร่างที่มีตอนก่อนกดใช้ชุด (ด่านนี้สร้างเองถ้ายังไม่มี)
        ⚠️ ต้องเทียบกับ **สิ่งที่บันทึกไว้ในข้อมูลย้อนกลับ** ซึ่งคือสภาพ ณ ตอนนั้น
        ⇒ เทียบกับค่าที่ด่านนี้เซ็ตไว้ (withLogo) หรือของเดิมก่อนทดสอบ
      */
      const expectedDraft = draftBeforeApply;
      assert.deepEqual(draftAfterUndo?.raw ?? null, expectedDraft, "ฉบับร่างหลังย้อนกลับต้องเป็นชุดก่อนใช้ชุด");
      assert.equal(await readChromeDraftUndo("navbar"), null, "ย้อนกลับสำเร็จแล้วต้องลบข้อมูลย้อนกลับ (ใช้ได้ครั้งเดียว)");

      const again = await undoChromePreset({ kind: "navbar", actor: CHROME_PRESET_TEST_ACTOR, messages: th });
      assert.equal(again.ok, false, "ย้อนกลับซ้ำต้องบอกว่าไม่มีให้ย้อน ไม่ใช่พัง");
      done("ย้อนกลับฉบับร่างก่อนใช้ชุดได้", "และย้อนซ้ำอย่างปลอดภัย");
    }
  } finally {
    /* คืนสภาพ: ลบเฉพาะของด่านนี้ + คืนแถว navbar ให้เหมือนก่อนทดสอบ */
    await pool.query("delete from chrome_preset where name like $1 or created_by = $2", [
      `${CHROME_PRESET_TEST_NAME}%`,
      CHROME_PRESET_TEST_ACTOR,
    ]);
    await pool.query("delete from chrome_draft_undo where page = $1", [navbarKey]);
    await pool.query("delete from media where id = $1", ["check-db-preset-media"]);
    await pool.query("delete from audit_log where actor_email = $1", [CHROME_PRESET_TEST_ACTOR]);

    if (navbarDraftBefore === null && navbarPublishedBefore === null) {
      /* เราเป็นคนสร้างฉบับร่างชั่วคราวเอง (เพราะเดิมไม่มีแถวเลย) ⇒ ลบทิ้งให้สะอาด */
      await pool.query("delete from page_document where page = $1 and updated_by = $2", [navbarKey, CHROME_PRESET_TEST_ACTOR]);
    }

    assert.equal(
      await countWhere("chrome_preset where name like $1", [`${CHROME_PRESET_TEST_NAME}%`]),
      0,
      "ต้องไม่เหลือรอยทดสอบ",
    );
    assert.deepEqual(
      (await loadDocumentRow(navbarKey, "draft"))?.raw ?? null,
      navbarDraftBefore?.raw ?? null,
      "ฉบับร่างของแถบเมนูต้องกลับมาเหมือนก่อนทดสอบ",
    );
    done("คืนสภาพตารางพรีเซ็ตส่วนกลางแล้ว", "ไม่เหลือรอยทดสอบ");
  }
}

/**
 * 15) ตัวสร้างหลายหน้า (S2 · รอบที่ 82) — **วงจรจริงของหน้าที่เพิ่งแปลง**
 *
 * พิสูจน์ว่า "หน้าที่แปลงแล้วขึ้นจากฉบับเผยแพร่จริง" ไม่ใช่แค่มีเทมเพลตในโค้ด
 * 1. เทมเพลตของหน้านั้นผ่าน parser + validator (ก่อนเขียนลงฐานข้อมูล)
 * 2. บันทึกฉบับร่าง → เผยแพร่ → **สวิตช์ยังปิด = หน้าเว็บยังใช้ของเดิม** (`loadLiveBlockDocument` คืน null)
 * 3. เปิดสวิตช์ → อ่านได้เอกสารที่เผยแพร่ (จำนวนบล็อกตรงกับเทมเพลต)
 * 4. ปิดสวิตช์ → กลับเป็น null (ปิดแล้วกลับไปใช้เลย์เอาต์เดิมได้ทันที)
 *
 * ⚠️ ล้างทุกอย่างที่สร้างในตอนจบ (แถว draft/published + ประวัติ + audit ของหน้านี้)
 *    และ **ไม่แตะหน้าแรก** (มีข้อมูลจริงของผู้ใช้อยู่)
 */
const TEMPLATE_TEST_PAGES = BLOCK_TEMPLATE_PAGE_IDS.filter((page) => page !== "home");
const TEMPLATE_TEST_ACTOR = "check-db-template@example.invalid";

/** แถวของเอกสารหน้าที่จะคืนกลับหลังทดสอบ (จำของเดิมไว้แบบครบทุกคอลัมน์) */
type DocumentSnapshot = {
  readonly page: string;
  readonly status: string;
  readonly document: unknown;
  readonly updated_by: string | null;
  readonly updated_at: string | null;
  readonly published_at: string | null;
  readonly is_live: boolean | null;
};

/**
 * 15) ตัวสร้างหลายหน้า (S2 · รอบที่ 82–83) — **วงจรจริงของทุกหน้าที่มีเทมเพลต**
 *
 * พิสูจน์ว่า "หน้าที่แปลงแล้วขึ้นจากฉบับเผยแพร่จริง" ไม่ใช่แค่มีเทมเพลตในโค้ด
 * 1. เทมเพลตของหน้านั้นผ่าน parser + validator (ก่อนเขียนลงฐานข้อมูล)
 * 2. บันทึกฉบับร่าง → เผยแพร่ → **สวิตช์ปิด = หน้าเว็บยังใช้ของเดิม** (`loadLiveBlockDocument` คืน null)
 * 3. เปิดสวิตช์ → อ่านได้เอกสารที่เผยแพร่ (จำนวนบล็อกตรงกับเทมเพลต)
 * 4. ปิดสวิตช์ → กลับเป็น null (ปิดแล้วกลับไปใช้เลย์เอาต์เดิมได้ทันที)
 *
 * ⚠️ **ไม่แตะข้อมูลจริง**: ก่อนทดสอบจะ **จำแถวเดิมของหน้านั้นไว้** (ถ้ามี) แล้วคืนกลับให้เหมือนเดิมทุกคอลัมน์
 *    ⇒ ด่านนี้รันซ้ำได้แม้วันหนึ่งเจ้าของจะเริ่มแก้หน้านั้นในหลังบ้าน (เดิมด่านบังคับว่า "ต้องว่าง" ซึ่งจะพังเมื่อมีข้อมูลจริง)
 * ⚠️ ไม่แตะหน้าแรก (ใช้จริงอยู่) — ตรวจหน้าแรกซ้ำผ่านเทสต์ `scripts/test-templates.ts`
 */
async function checkPageTemplates(): Promise<void> {
  const pool = getPool();

  for (const page of TEMPLATE_TEST_PAGES) {
    const template = buildBlockTemplate(page);
    assert.ok(template !== null, `${page}: ต้องมีเทมเพลต`);

    const parsed = parseBlockDocument(page, template);
    assert.ok(parsed.ok, `${page}: เทมเพลตต้องผ่าน parser`);
    if (!parsed.ok) continue;

    const errors = documentErrorsOf(validateDocument(parsed.document));
    assert.equal(errors.length, 0, `${page}: เทมเพลตต้องไม่มี error`);
    const expectedBlocks = countRawBlocks(parsed.document);

    /* ── จำสภาพเดิมของหน้านี้ (รวมของจริงถ้ามี) ── */
    const snapshot = await pool.query<DocumentSnapshot>(
      `select page, status, document, updated_by, updated_at, published_at, is_live
         from page_document where page = $1`,
      [page],
    );

    try {
      /* ── 1) บันทึกฉบับร่างจากเทมเพลต → เผยแพร่ ── */
      await saveDraft(page, parsed.document, TEMPLATE_TEST_ACTOR);
      const { revision } = await publishDraft(page, TEMPLATE_TEST_ACTOR, "check:db");
      assert.ok(revision >= 1, `${page}: เผยแพร่ต้องได้เลขรุ่น`);

      /* ── 2) สวิตช์: ค่าเริ่มต้นต้องเป็น "ปิด" และหน้าเว็บยังใช้เลย์เอาต์เดิม ── */
      assert.equal(await isPageLive(page), false, `${page}: ค่าเริ่มต้นคือสวิตช์ปิด`);
      assert.equal(await loadLiveBlockDocument(page), null, `${page}: ปิดสวิตช์แล้วต้องไม่ใช้เอกสารบล็อก`);

      /* ── 3) เปิดสวิตช์ ⇒ ได้เอกสารที่เผยแพร่จริง ── */
      await setPageLive(page, true, TEMPLATE_TEST_ACTOR);
      const live = await loadLiveBlockDocument(page);
      assert.ok(live !== null, `${page}: เปิดสวิตช์แล้วต้องได้เอกสาร`);
      assert.equal(live?.page, page, `${page}: เอกสารต้องเป็นของหน้านั้น`);
      assert.equal(live === null ? -1 : countRawBlocks(live), expectedBlocks, `${page}: จำนวนบล็อกต้องตรงกับเทมเพลต`);

      /* ── 4) ปิดสวิตช์ ⇒ กลับไปใช้เลย์เอาต์เดิม ── */
      await setPageLive(page, false, TEMPLATE_TEST_ACTOR);
      assert.equal(await loadPageLiveFlag(page), false, `${page}: ปิดสวิตช์แล้วต้องเป็น false`);
      assert.equal(await loadLiveBlockDocument(page), null, `${page}: ปิดสวิตช์แล้วต้องกลับไปใช้ของเดิม`);
      done(`หน้า ${page}: เทมเพลต → เผยแพร่ → สวิตช์รายหน้า`, `${expectedBlocks} บล็อก`);
    } finally {
      /* ── คืนสภาพเดิมเป๊ะ: ลบของที่ด่านสร้าง + ใส่แถวเดิมกลับ (ถ้ามี) ── */
      await pool.query("delete from page_document_revision where page = $1 and created_by = $2", [page, TEMPLATE_TEST_ACTOR]);
      await pool.query("delete from page_document where page = $1", [page]);
      for (const row of snapshot.rows) {
        await pool.query(
          `insert into page_document (page, status, document, updated_by, updated_at, published_at, is_live)
             values ($1, $2, $3::jsonb, $4, coalesce($5::timestamptz, now()), $6, $7)`,
          [row.page, row.status, JSON.stringify(row.document), row.updated_by, row.updated_at, row.published_at, row.is_live],
        );
      }
      await pool.query("delete from audit_log where actor_email = $1", [TEMPLATE_TEST_ACTOR]);

      /* ยืนยันว่าคืนครบจริง (ถ้ามีของเดิม ต้องได้เท่าเดิม) */
      const restored = await countWhere("page_document where page = $1", [page]);
      assert.equal(restored, snapshot.rows.length, `${page}: ต้องได้แถวเดิมกลับมาครบ (${snapshot.rows.length})`);
    }
  }
}

/**
 * 16) บัญชีผู้ดูแลในฐานข้อมูล (X1.10 · RBAC · รอบที่ 84)
 *
 * พิสูจน์กับ DB จริง (ไม่ใช่แค่อ่านซอร์ส)
 * 1. สร้างบัญชี → hash ถูกเก็บจริง · รหัสผ่านที่ถูกต้องผ่าน · รหัสผิดไม่ผ่าน
 * 2. อีเมลซ้ำ (ต่างตัวพิมพ์) ถูกปฏิเสธ
 * 3. ปิดบัญชี → `attemptLogin` ต้องไม่ผ่าน · เปิดกลับ → ผ่าน
 * 4. เปลี่ยนบทบาทแล้วค่ามีผลจริง (และผู้ใช้ที่ถูกเปลี่ยนต้องไม่ใช่แถวของ "ผู้ดูแลคนสุดท้าย")
 * 5. **กันล็อกตัวเองออก**: ปิด/ถอดบทบาทผู้ดูแลที่ยังใช้งานได้คนสุดท้ายต้องถูกปฏิเสธ
 * 6. เปลี่ยนรหัสผ่าน → รหัสเก่าใช้ไม่ได้ รหัสใหม่ใช้ได้
 *
 * ⚠️ ล้างบัญชีทดสอบทั้งหมดในตอนจบเสมอ (ทั้งกรณีผ่านและล้มเหลว)
 */
const RBAC_TEST_EMAIL = "check-db-rbac@example.invalid";
/** ผู้ทำรายการของด่านนี้ (แยกจากผู้ใช้อื่น เพื่อล้าง audit ได้ตรง) */
const CHECK_ACTOR = "check-db@example.invalid";

/**
 * รันฉากทดสอบโดยให้ `keepId` เป็นผู้ดูแลที่ยังใช้งานได้ **คนเดียว** ชั่วคราว แล้วคืนค่าทุกกรณี (รอบที่ 127)
 *
 * ⚠️ เคสจริง: ด่าน RBAC รอบก่อน "เดา" ว่าตาราง `admin_user` มีเฉพาะบัญชีทดสอบ
 * แต่ฐานข้อมูลจริงมี **บัญชีจาก env** (`env-admin` ที่ระบบสร้างตอนเจ้าของล็อกอิน) และอาจมีแถวค้างจากรันก่อน
 * ⇒ ด่าน "ผู้ดูแลคนสุดท้าย" แดงทั้งที่ระบบถูก · ด่านที่เชื่อถือไม่ได้จะถูกปิดตาในที่สุด
 * ⇒ ทางแก้ที่ถูกคือ **คุมสถานะเองในฉาก** แล้วคืนค่า (ไม่แก้ที่ข้อมูล)
 */
async function withSoloAdmin<T>(keepId: string, run: () => Promise<T>): Promise<T> {
  const pool = getPool();
  const { rows } = await pool.query<{ readonly id: string }>(
    "select id from admin_user where role = 'admin' and disabled = false and id <> $1",
    [keepId],
  );
  const disabled = rows.map((row) => row.id);
  if (disabled.length > 0) {
    await pool.query("update admin_user set disabled = true where id = any($1::text[])", [disabled]);
  }
  try {
    return await run();
  } finally {
    if (disabled.length > 0) {
      await pool.query("update admin_user set disabled = false where id = any($1::text[])", [disabled]);
    }
  }
}

/** ล้างบัญชีทดสอบ RBAC ที่อาจค้างจากรันก่อน + เปิดบัญชี env คืนถ้าเคยถูกปิดไว้ (ทำให้รันซ้ำได้เสมอ) */
async function prepareAdminScenario(): Promise<void> {
  const pool = getPool();
  await pool.query("delete from admin_session where user_id in (select id from admin_user where email like $1)", [
    "check-db-rbac%",
  ]);
  await pool.query("delete from admin_user where email like $1", ["check-db-rbac%"]);
  /* ⚠️ ความปลอดภัย: ถ้ารันก่อนหน้าล้มกลางฉาก บัญชีจาก env อาจถูกปิดค้าง ⇒ เปิดคืน */
  await pool.query("update admin_user set disabled = false where id = $1 and disabled = true", [ENV_ADMIN_ID]);
}

async function checkAdminUsers(): Promise<void> {
  const pool = getPool();
  const { equalizeTiming } = await import("@/lib/auth/user-store");
  const { attemptLogin } = await import("@/lib/auth/login");

  /* เตรียมฉาก: ล้างบัญชีทดสอบที่ค้าง + เปิดบัญชี env คืนถ้าเคยถูกปิดค้าง */
  await prepareAdminScenario();
  await pool.query("delete from admin_user where lower(email) = $1", [RBAC_TEST_EMAIL]);
  await pool.query("delete from audit_log where target like 'usr_%' and actor_email = $1", [CHECK_ACTOR]);

  const created = await createAdminUser({
    email: RBAC_TEST_EMAIL,
    displayName: "ทดสอบ RBAC",
    role: "editor",
    password: "check-db-Password-1",
    actor: CHECK_ACTOR,
  });
  assert.equal(created.ok, true, "สร้างบัญชีในฐานข้อมูลต้องสำเร็จ");
  if (!created.ok) return;

  const accountId = created.user.id;
  const store = createDbUserStore();
  assert.ok(store !== null, "ต้องได้ store ที่อ่านจากฐานข้อมูล");

  try {
    /* ── 1) เก็บเฉพาะ hash + ตรวจรหัสผ่านได้จริง ── */
    const { rows: raw } = await pool.query<{ readonly password_hash: string }>(
      "select password_hash from admin_user where id = $1",
      [accountId],
    );
    const hash = raw[0]?.password_hash ?? "";
    assert.ok(hash.startsWith("scrypt:"), "ต้องเก็บ hash แบบ scrypt (ไม่ใช่รหัสผ่านตรง ๆ)");
    assert.ok(!hash.includes("check-db-Password-1"), "ห้ามมีรหัสผ่านอยู่ในค่าที่เก็บ");

    const deps = { store, verify: verifyPassword, equalize: equalizeTiming };
    const good = await attemptLogin({ email: RBAC_TEST_EMAIL, password: "check-db-Password-1" }, deps);
    assert.equal(good.kind, "ok", "รหัสผ่านที่ถูกต้องต้องล็อกอินผ่าน");
    const wrong = await attemptLogin({ email: RBAC_TEST_EMAIL, password: "wrong-password-1" }, deps);
    assert.equal(wrong.kind, "invalid", "รหัสผ่านผิดต้องไม่ผ่าน");

    /* ── 2) อีเมลซ้ำ (ต่างตัวพิมพ์) ต้องถูกปฏิเสธ ── */
    const duplicate = await createAdminUser({
      email: RBAC_TEST_EMAIL.toUpperCase(),
      displayName: "ซ้ำ",
      role: "editor",
      password: "another-Password-2",
      actor: CHECK_ACTOR,
    });
    assert.equal(duplicate.ok, false, "อีเมลซ้ำต้องสร้างไม่ได้ (ไม่สนตัวพิมพ์)");

    /* ── 3) ปิดบัญชี → เข้าไม่ได้ · เปิดกลับ → เข้าได้ ── */
    assert.equal(
      (await setAdminUserDisabled({ id: accountId, disabled: true, actor: CHECK_ACTOR })).ok,
      true,
      "ปิดบัญชีต้องสำเร็จ",
    );
    const afterDisable = await attemptLogin({ email: RBAC_TEST_EMAIL, password: "check-db-Password-1" }, deps);
    assert.equal(afterDisable.kind, "invalid", "บัญชีที่ถูกปิดต้องล็อกอินไม่ได้");
    assert.equal(
      (await setAdminUserDisabled({ id: accountId, disabled: false, actor: CHECK_ACTOR })).ok,
      true,
      "เปิดบัญชีกลับต้องสำเร็จ",
    );

    /* ── 4) เปลี่ยนบทบาทมีผลจริง ── */
    assert.equal(
      (await setAdminUserRole({ id: accountId, role: "publisher", actor: CHECK_ACTOR })).ok,
      true,
      "เปลี่ยนบทบาทต้องสำเร็จ",
    );
    const reloaded = await store?.findById(accountId);
    assert.equal(reloaded?.role, "publisher", "บทบาทที่อ่านสดต้องเป็นค่าใหม่ ⇒ เปลี่ยนแล้วมีผลทันที");

    /* ── 5) กันล็อกตัวเองออก: ถอดบทบาทผู้ดูแลคนสุดท้ายต้องถูกปฏิเสธ ── */
    const owner = await createAdminUser({
      email: "check-db-rbac-owner@example.invalid",
      displayName: "ผู้ดูแลทดสอบ",
      role: "admin",
      password: "check-db-Owner-3",
      actor: CHECK_ACTOR,
    });
    assert.equal(owner.ok, true, "สร้างผู้ดูแลทดสอบต้องสำเร็จ");
    if (owner.ok) {
      /* ฉาก "ผู้ดูแลคนสุดท้าย" — ปิดบัญชีจริงชั่วคราวแล้วคืนค่าให้เสมอ (รอบที่ 127) */
      await withSoloAdmin(owner.user.id, async () => {
        /* มีผู้ดูแลที่ยังใช้งานได้ 1 คน (คนนี้) ⇒ ถอดบทบาท/ปิด ต้องถูกปฏิเสธ */
      const demote = await setAdminUserRole({ id: owner.user.id, role: "editor", actor: CHECK_ACTOR });
      assert.equal(demote.ok, false, "ถอดบทบาทผู้ดูแลคนสุดท้ายต้องถูกปฏิเสธ");
      const disable = await setAdminUserDisabled({ id: owner.user.id, disabled: true, actor: CHECK_ACTOR });
      assert.equal(disable.ok, false, "ปิดผู้ดูแลคนสุดท้ายต้องถูกปฏิเสธ");

      /* มีผู้ดูแลคนที่สองแล้ว ⇒ ครั้งนี้ทำได้ */
      const second = await createAdminUser({
        email: "check-db-rbac-owner2@example.invalid",
        displayName: "ผู้ดูแลทดสอบ 2",
        role: "admin",
        password: "check-db-Owner-4",
        actor: CHECK_ACTOR,
      });
      assert.equal(second.ok, true, "สร้างผู้ดูแลคนที่สองต้องสำเร็จ");
      if (second.ok) {
        const demoteNow = await setAdminUserRole({ id: owner.user.id, role: "editor", actor: CHECK_ACTOR });
        assert.equal(demoteNow.ok, true, "มีผู้ดูแลคนอื่นแล้ว ⇒ ถอดบทบาทได้");
      }
      });
      await pool.query("delete from admin_user where email like 'check-db-rbac-owner%'");
    }

    /*
      ── 5.4) เซสชันหลังบ้านที่เพิกถอนได้ (รอบที่ 95) ──
      พิสูจน์วงจรจริง: สร้าง → อ่านได้ (ใช้งานได้) → เพิกถอน → ใช้ไม่ได้ · ตัดทั้งบัญชี (ยกเว้นเซสชันปัจจุบัน)
      ⚠️ ตรวจว่า "เซสชันที่ยังใช้งานได้" ไม่ถูกลบโดยตัวลบกลาง และบันทึก audit ทุกครั้งที่เพิกถอน
    */
    /* ⚠️ try/finally: แม้ข้อใดพังกลางทาง ต้องล้างร่องรอยของตัวเอง (ไม่งั้นรอบถัดไปเจอ "รอยค้าง") */
    try {
      const ownerForSessions = await createAdminUser({
        email: "check-db-rbac-session@example.invalid",
        displayName: "ผู้ใช้ทดสอบเซสชัน",
        role: "editor",
        password: "check-db-Session-1",
        actor: CHECK_ACTOR,
      });
      assert.equal(ownerForSessions.ok, true, "สร้างบัญชีสำหรับทดสอบเซสชันต้องสำเร็จ");

      if (ownerForSessions.ok) {
        const userId = ownerForSessions.user.id;
        const sidA = newSessionId();
        const sidB = newSessionId();
        const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

        assert.equal(
          await createAdminSession({ userId, sid: sidA, expiresAt, userAgent: "check-db/1.0" }),
          true,
          "บันทึกเซสชันต้องสำเร็จ",
        );
        assert.equal(await createAdminSession({ userId, sid: sidB, expiresAt, userAgent: null }), true);

        /* อ่านกลับได้ + ใช้งานได้ */
        const found = await findAdminSession(sidA);
        assert.ok(found !== null, "ต้องอ่านเซสชันที่เพิ่งสร้างได้");
        assert.equal(found?.userId, userId, "เซสชันต้องผูกกับบัญชีที่สร้าง");
        assert.equal(found?.active, true, "เซสชันใหม่ต้องใช้งานได้");
        assert.equal(await findAdminSession("sid-ที่ไม่มีอยู่จริง"), null, "sid มั่วต้องไม่เจอ");

        /* เก็บเป็น hash: ค่าดิบต้องไม่ถูกเก็บลงตาราง */
        assert.equal(await countWhere("admin_session where token_hash = $1", [sidA]), 0, "ห้ามเก็บ sid ดิบ");
        assert.equal(await countWhere("admin_session where token_hash = $1", [hashSessionId(sidA)]), 1, "ต้องเก็บ hash");

        /* รายการเซสชันของบัญชีนี้ต้องมี 2 รายการ */
        const listA = await listActiveAdminSessions(userId);
        assert.equal(listA.length, 2, "ต้องเห็นเซสชันที่ใช้งานได้ทั้งสอง");

        /* เพิกถอนรายตัว */
        const revoked = await revokeAdminSessions({ hash: hashSessionId(sidA), actor: CHECK_ACTOR });
        assert.equal(revoked.ok, true);
        assert.equal(revoked.ok ? revoked.revoked : 0, 1, "ต้องเพิกถอนได้ 1 รายการ");
        assert.equal((await findAdminSession(sidA))?.active, false, "เซสชันที่ถูกเพิกถอนต้องใช้งานไม่ได้");
        assert.equal((await findAdminSession(sidB))?.active, true, "เซสชันอื่นต้องไม่ถูกกระทบ");
        assert.equal((await listActiveAdminSessions(userId)).length, 1, "เหลือเซสชันที่ใช้งานได้ 1 รายการ");

        /* เพิกถอนทั้งบัญชี แต่ยกเว้นเซสชันปัจจุบัน */
        const sidC = newSessionId();
        await createAdminSession({ userId, sid: sidC, expiresAt, userAgent: null });
        const revokedAll = await revokeSessionsForUser({ userId, actor: CHECK_ACTOR, exceptSid: sidC, detail: "check-db" });
        assert.equal(revokedAll, 1, "ต้องเพิกถอน 1 รายการ (ยกเว้นเซสชันปัจจุบัน)");
        assert.equal((await findAdminSession(sidC))?.active, true, "เซสชันที่ยกเว้นไว้ต้องยังใช้งานได้");

        /* audit: ต้องมีร่องรอยการเพิกถอน */
        assert.equal(
          await countWhere("audit_log where actor_email = $1 and action = 'admin-session-revoke'", [CHECK_ACTOR]) >= 2,
          true,
          "การเพิกถอนต้องลง audit ทุกครั้ง",
        );

        /*
          ตัวลบกลางต้องเก็บเฉพาะ "ที่หมดอายุหรือถูกเพิกถอนนานเกินระยะเก็บ"
          ⚠️ ตัวลบวัดจาก coalesce(revoked_at, expires_at) ⇒ ต้องทดสอบทั้งสองทาง:
             (ก) หมดอายุเองแล้วไม่มีใครเพิกถอน  (ข) ถูกเพิกถอนแล้วและเลยระยะเก็บมานาน
        */
        const sidExpired = newSessionId();
        await createAdminSession({ userId, sid: sidExpired, expiresAt, userAgent: null });
        await pool.query("update admin_session set expires_at = now() - interval '40 days' where token_hash = $1", [
          hashSessionId(sidExpired),
        ]);

        const sidRevokedLongAgo = newSessionId();
        await createAdminSession({ userId, sid: sidRevokedLongAgo, expiresAt, userAgent: null });
        await pool.query(
          "update admin_session set revoked_at = now() - interval '40 days', expires_at = now() - interval '41 days' where token_hash = $1",
          [hashSessionId(sidRevokedLongAgo)],
        );

        const purge = await purgeExpired({ now: new Date() });
        assert.ok(purge !== null);
        assert.equal(await countWhere("admin_session where token_hash = $1", [hashSessionId(sidExpired)]), 0, "เซสชันที่หมดอายุนานแล้วต้องถูกลบ");
        assert.equal(await countWhere("admin_session where token_hash = $1", [hashSessionId(sidRevokedLongAgo)]), 0, "เซสชันที่ถูกเพิกถอนนานแล้วต้องถูกลบ");
        assert.equal(await countWhere("admin_session where token_hash = $1", [hashSessionId(sidC)]), 1, "เซสชันที่ยังใช้งานได้ต้องไม่ถูกลบ");
        assert.equal(await countWhere("admin_session where token_hash = $1", [hashSessionId(sidA)]), 1, "เซสชันที่ถูกเพิกถอนเมื่อกี้ยังไม่พ้นระยะเก็บ");

        /* ลบบัญชี = เซสชันหายตาม (foreign key cascade) */
        await pool.query("delete from admin_user where id = $1", [userId]);
        assert.equal(await countWhere("admin_session where user_id = $1", [userId]), 0, "ลบบัญชีต้องลบเซสชันตาม");
      }
    } finally {
      await pool.query("delete from audit_log where actor_email = $1 and action = 'admin-session-revoke'", [CHECK_ACTOR]);
    }

    /*
      ── 5.5) ลบบัญชีถาวร (B3 · รอบที่ 90) — พิสูจน์ด่านครบทุกข้อบนฐานข้อมูลจริง ──
      ลำดับ: ปฏิเสธก่อน (ตัวเอง · อีเมลไม่ตรง · ผู้ดูแลคนสุดท้าย) แล้วจึงลบจริง
    */
    const doomed = await createAdminUser({
      email: "check-db-rbac-doomed@example.invalid",
      displayName: "บัญชีที่จะถูกลบ",
      role: "editor",
      password: "check-db-Doomed-5",
      actor: CHECK_ACTOR,
    });
    assert.equal(doomed.ok, true, "สร้างบัญชีสำหรับทดสอบลบต้องสำเร็จ");

    if (doomed.ok) {
      /* 1) ลบตัวเอง = ปฏิเสธ */
      assert.equal(
        (await deleteAdminUser({ id: doomed.user.id, actor: CHECK_ACTOR, actorId: doomed.user.id, confirmEmail: doomed.user.email })).ok,
        false,
        "ห้ามลบบัญชีตัวเอง",
      );

      /* 2) อีเมลยืนยันไม่ตรง = ปฏิเสธ (และบัญชีต้องยังอยู่) */
      assert.equal(
        (await deleteAdminUser({ id: doomed.user.id, actor: CHECK_ACTOR, actorId: "check-db-other", confirmEmail: "wrong@example.invalid" })).ok,
        false,
        "อีเมลยืนยันไม่ตรง ต้องไม่ลบ",
      );
      assert.equal(await countWhere("admin_user where id = $1", [doomed.user.id]), 1, "บัญชีต้องยังอยู่หลังการปฏิเสธ");

      /* 3) ผู้ดูแลที่ยังใช้งานได้คนสุดท้าย = ปฏิเสธ */
      const solo = await createAdminUser({
        email: "check-db-rbac-solo@example.invalid",
        displayName: "ผู้ดูแลเดี่ยว",
        role: "admin",
        password: "check-db-Solo-6",
        actor: CHECK_ACTOR,
      });
      assert.equal(solo.ok, true, "สร้างผู้ดูแลเดี่ยวต้องสำเร็จ");
      if (solo.ok) {
      /* ฉาก "ห้ามลบผู้ดูแลคนสุดท้าย" — ปิดบัญชีจริงชั่วคราวแล้วคืนค่าให้เสมอ (รอบที่ 127) */
      await withSoloAdmin(solo.user.id, async () => {
        assert.equal(
          (await deleteAdminUser({ id: solo.user.id, actor: CHECK_ACTOR, actorId: "check-db-other", confirmEmail: solo.user.email })).ok,
          false,
          "ห้ามลบผู้ดูแลคนสุดท้าย (หลังแยกฉาก)",
        );

        /* มีผู้ดูแลคนที่สองที่ยังใช้งานได้ ⇒ ลบได้ (ด่านไม่บล็อกเกินจำเป็น) */
        const spare = await createAdminUser({
          email: "check-db-rbac-spare@example.invalid",
          displayName: "ผู้ดูแลสำรอง",
          role: "admin",
          password: "check-db-Spare-7",
          actor: CHECK_ACTOR,
        });
        assert.equal(spare.ok, true, "สร้างผู้ดูแลสำรองต้องสำเร็จ");
        assert.equal(
          (await deleteAdminUser({ id: solo.user.id, actor: CHECK_ACTOR, actorId: "check-db-other", confirmEmail: solo.user.email })).ok,
          true,
          "มีผู้ดูแลคนอื่นแล้ว ⇒ ลบได้",
        );
      });
      }

      /* 4) ลบจริงสำเร็จ (อีเมลที่พิมพ์ต่างตัวพิมพ์ก็ต้องผ่าน — เทียบแบบ normalize) + บัญชีหายจากตาราง */
      assert.equal(
        (await deleteAdminUser({
          id: doomed.user.id,
          actor: CHECK_ACTOR,
          actorId: "check-db-other",
          confirmEmail: doomed.user.email.toUpperCase(),
        })).ok,
        true,
        "ลบบัญชีถาวรต้องสำเร็จ",
      );
      assert.equal(await countWhere("admin_user where id = $1", [doomed.user.id]), 0, "บัญชีต้องหายจากตารางจริง");

      /* 5) ร่องรอยการลบต้องอยู่ใน audit log */
      const { rows: deleted } = await pool.query<{ readonly n: string }>(
        "select count(*)::text as n from audit_log where actor_email = $1 and action = 'admin-user-delete'",
        [CHECK_ACTOR],
      );
      assert.ok(Number.parseInt(deleted[0]?.n ?? "0", 10) >= 1, "การลบบัญชีต้องลง audit");
    }

    /* ── 6) รีเซ็ตรหัสผ่าน: เก่าใช้ไม่ได้ ใหม่ใช้ได้ ── */
    assert.equal(
      (await resetAdminUserPassword({ id: accountId, password: "check-db-Password-9", actor: CHECK_ACTOR })).ok,
      true,
      "รีเซ็ตรหัสผ่านต้องสำเร็จ",
    );
    const oldPassword = await attemptLogin({ email: RBAC_TEST_EMAIL, password: "check-db-Password-1" }, deps);
    assert.equal(oldPassword.kind, "invalid", "รหัสผ่านเก่าต้องใช้ไม่ได้หลังรีเซ็ต");
    const newPassword = await attemptLogin({ email: RBAC_TEST_EMAIL, password: "check-db-Password-9" }, deps);
    assert.equal(newPassword.kind, "ok", "รหัสผ่านใหม่ต้องใช้ได้");

    /* ── audit: ต้องมีร่องรอยการเปลี่ยนบัญชี ── */
    const { rows: audit } = await pool.query<{ readonly n: string }>(
      "select count(*)::text as n from audit_log where actor_email = $1 and action like 'admin-user-%'",
      [CHECK_ACTOR],
    );
    assert.ok(Number.parseInt(audit[0]?.n ?? "0", 10) >= 4, "การเปลี่ยนบัญชีต้องลง audit ทุกครั้ง");
    done("บัญชีผู้ดูแลในฐานข้อมูล + บทบาท", "hash · ปิด/เปิด · กันล็อกตัวเองออก · รีเซ็ตรหัส · audit");
  } finally {
    /* ⚠️ ล้างทุกบัญชีทดสอบของรอบนี้ (owner · doomed · solo · spare) — ต้องไม่เหลือร่องรอยในฐานข้อมูล dev */
    await pool.query("delete from admin_user where lower(email) = $1 or email like 'check-db-rbac-%'", [RBAC_TEST_EMAIL]);
    await pool.query("delete from audit_log where actor_email = $1 and action like 'admin-user-%'", [CHECK_ACTOR]);
    assert.equal(await countWhere("admin_user where lower(email) = $1", [RBAC_TEST_EMAIL]), 0, "ต้องไม่เหลือบัญชีทดสอบ");
    assert.equal(await countWhere("admin_user where email like 'check-db-rbac-%'", []), 0, "ต้องไม่เหลือบัญชีทดสอบ (รวมบัญชีที่สร้างรอบที่ 90)");
  }
}


/**
 * 17) ตั้งเวลาเผยแพร่ (X2.7 ส่วนที่ 1 · รอบที่ 100) — วงจรจริงกับฐานข้อมูล
 *
 * พิสูจน์
 * 1. ตั้งกำหนดเวลาแล้วอ่านกลับได้ (เวลาที่ตั้ง + ใครตั้ง)
 * 2. งานที่ครบกำหนดปรากฏในรายการที่การ์ดหน้าภาพรวมใช้
 * 3. ตัวเผยแพร่ตามกำหนดเผยแพร่จริง → ล้างกำหนด → เขียนประวัติ → ลง audit
 * 4. รันซ้ำไม่เผยแพร่ซ้ำ · claim แย่งกันได้หน้าละครั้งเดียว (idempotent)
 * 5. กำหนดในอนาคตยังไม่ถูกแตะ
 * 6. "กดเผยแพร่เอง" ก็ล้างกำหนดเวลาเดิม
 *
 * ⚠️ ใช้ page key สำหรับทดสอบโดยเฉพาะ และล้างทุกอย่างใน `finally` (ทั้งกรณีผ่านและล้มเหลว)
 */
const SCHEDULE_TEST_PAGE = "check-scheduled-publish";
const SCHEDULE_TEST_ACTOR = "check-db-schedule@example.invalid";

async function checkScheduledPublish(): Promise<void> {
  const pool = getPool();

  const cleanup = async (): Promise<void> => {
    /* ⚠️ ต้องลบ "ประวัติ" ด้วย — ถ้าลบแค่ page_document รอบถัดไปจะนับประวัติของรอบก่อนปนเข้ามา */
    await pool.query("delete from page_document where page = $1", [SCHEDULE_TEST_PAGE]);
    await pool.query("delete from page_document_revision where page = $1", [SCHEDULE_TEST_PAGE]);
    await pool.query("delete from audit_log where target = $1", [SCHEDULE_TEST_PAGE]);
  };

  await cleanup(); /* กันร่องรอยจากรอบก่อน */

  const now = new Date();
  const past = new Date(now.getTime() - 60 * 1000);
  const future = new Date(now.getTime() + 60 * 60 * 1000);
  const document = { page: SCHEDULE_TEST_PAGE, blocks: [] };

  try {
    await saveDraft(SCHEDULE_TEST_PAGE, document, SCHEDULE_TEST_ACTOR);
    assert.equal(await readPublishSchedule(SCHEDULE_TEST_PAGE), null, "ยังไม่ตั้งกำหนด = ต้องเป็น null");

    /* ── ตั้งกำหนดในอดีต (จำลองว่าเวลาผ่านมาแล้ว) ── */
    await setPublishSchedule(SCHEDULE_TEST_PAGE, past.toISOString(), SCHEDULE_TEST_ACTOR);
    const stored = await readPublishSchedule(SCHEDULE_TEST_PAGE);
    assert.ok(stored !== null, "ตั้งกำหนดแล้วต้องอ่านกลับได้");
    assert.equal(stored?.at, past.toISOString(), "เวลาที่อ่านกลับต้องตรง (UTC)");
    assert.equal(stored?.by, SCHEDULE_TEST_ACTOR, "ต้องรู้ว่าใครตั้งกำหนด");

    const due = await listDueSchedules(now.toISOString());
    assert.equal(due.filter((row) => row.page === SCHEDULE_TEST_PAGE).length, 1, "ต้องเห็นงานที่ครบกำหนด");

    const overview = await scheduledPublishOverview({ now });
    assert.ok(overview !== null, "การ์ดหน้าภาพรวมต้องอ่านได้");
    assert.ok((overview?.dueCount ?? 0) >= 1, "การ์ดต้องนับงานที่ครบกำหนด");
    assert.ok((overview?.upcoming ?? []).some((row) => row.page === SCHEDULE_TEST_PAGE), "ต้องมีหน้านี้ในรายการที่ตั้งไว้");

    /* ── เผยแพร่ตามกำหนด: ต้องเกิดจริงครั้งเดียว ── */
    const report = await publishDueScheduled({ now, actorEmail: SCHEDULE_TEST_ACTOR });
    assert.ok(report !== null, "ตัวเผยแพร่ต้องทำงานได้");
    const publishedItem = report?.published.find((item) => item.page === SCHEDULE_TEST_PAGE);
    assert.ok(publishedItem !== undefined, "ต้องเผยแพร่หน้านี้");
    assert.ok((publishedItem?.revision ?? 0) >= 1, "ต้องได้เลขรุ่น");

    assert.equal(await readPublishSchedule(SCHEDULE_TEST_PAGE), null, "เผยแพร่แล้วต้องล้างกำหนดเวลา");
    const draftRow = await loadDocumentRow(SCHEDULE_TEST_PAGE, "draft");
    const liveRow = await loadDocumentRow(SCHEDULE_TEST_PAGE, "published");
    assert.ok(draftRow !== null && liveRow !== null, "ต้องมีทั้งฉบับร่างและฉบับเผยแพร่");
    assert.equal(JSON.stringify(liveRow?.raw), JSON.stringify(draftRow?.raw), "ฉบับเผยแพร่ต้องเป็นสำเนาของฉบับร่าง");
    assert.equal(
      await countWhere("page_document_revision where page = $1", [SCHEDULE_TEST_PAGE]),
      1,
      "ต้องมีประวัติการเผยแพร่ 1 รุ่น",
    );
    assert.equal(
      await countWhere("audit_log where target = $1 and action = 'publish-scheduled'", [SCHEDULE_TEST_PAGE]),
      1,
      "ต้องมีร่องรอย publish-scheduled ใน audit log",
    );

    /*
      ⚠️ บทเรียนจากการยิงจริง: Postgres `returning` คืนค่า "หลัง" update
      ⇒ ถ้าลืมอ่านค่าเดิมของ `scheduled_by` ก่อนล้าง ประวัติ/audit จะไม่รู้ว่าใครตั้งกำหนด (กลายเป็น fallback)
    */
    assert.equal(liveRow?.updatedBy, SCHEDULE_TEST_ACTOR, "ผู้ทำรายการในประวัติต้องเป็นคนที่ตั้งกำหนด (ไม่ใช่ fallback)");
    const { rows: scheduleAudit } = await pool.query<{ readonly detail: string | null }>(
      "select detail from audit_log where target = $1 and action = 'publish-scheduled'",
      [SCHEDULE_TEST_PAGE],
    );
    assert.ok((scheduleAudit[0]?.detail ?? "").includes(SCHEDULE_TEST_ACTOR), "audit ต้องบอกว่าใครเป็นคนตั้งกำหนด");

    /* ── รันซ้ำ = ไม่ทำอะไร (idempotent) ── */
    const second = await publishDueScheduled({ now, actorEmail: SCHEDULE_TEST_ACTOR });
    assert.equal(second?.published.length ?? -1, 0, "รันซ้ำต้องไม่เผยแพร่ซ้ำ");
    assert.equal(
      await countWhere("page_document_revision where page = $1", [SCHEDULE_TEST_PAGE]),
      1,
      "รันซ้ำต้องไม่เพิ่มประวัติ",
    );

    /* ── กำหนดในอนาคต = ยังไม่ถูกแตะ ── */
    await setPublishSchedule(SCHEDULE_TEST_PAGE, future.toISOString(), SCHEDULE_TEST_ACTOR);
    const early = await publishDueScheduled({ now, actorEmail: SCHEDULE_TEST_ACTOR });
    assert.equal(early?.published.length ?? -1, 0, "ยังไม่ถึงกำหนด = ต้องไม่เผยแพร่");
    assert.ok((await readPublishSchedule(SCHEDULE_TEST_PAGE)) !== null, "กำหนดในอนาคตต้องยังอยู่");

    /* ── claim แย่งกัน: ครั้งแรกได้ ครั้งที่สองไม่ได้ ── */
    assert.ok(
      (await publishDuePage(SCHEDULE_TEST_PAGE, future.toISOString(), "system", "check:db")) !== null,
      "ครบกำหนดแล้ว claim ต้องได้",
    );
    assert.equal(
      await publishDuePage(SCHEDULE_TEST_PAGE, future.toISOString(), "system", "check:db"),
      null,
      "claim ซ้ำต้องไม่ได้ (กันเผยแพร่ซ้ำ)",
    );

    /* ── กดเผยแพร่เอง = ล้างกำหนดเวลาเดิมด้วย ── */
    await setPublishSchedule(SCHEDULE_TEST_PAGE, future.toISOString(), SCHEDULE_TEST_ACTOR);
    await publishDraft(SCHEDULE_TEST_PAGE, SCHEDULE_TEST_ACTOR, "check:db");
    assert.equal(await readPublishSchedule(SCHEDULE_TEST_PAGE), null, "กดเผยแพร่เองต้องล้างกำหนดเวลาเดิม");

    done("ตั้งเวลาเผยแพร่: ครบกำหนด → เผยแพร่ครั้งเดียว → ล้างกำหนด", "idempotent · claim แย่งกัน · audit");
  } finally {
    await cleanup();
    assert.equal(await countWhere("page_document where page = $1", [SCHEDULE_TEST_PAGE]), 0, "ต้องไม่เหลือแถวทดสอบ");
    assert.equal(
      await countWhere("page_document_revision where page = $1", [SCHEDULE_TEST_PAGE]),
      0,
      "ต้องไม่เหลือประวัติทดสอบ (ไม่งั้นรอบถัดไปนับปน)",
    );
    assert.equal(await countWhere("audit_log where target = $1", [SCHEDULE_TEST_PAGE]), 0, "ต้องไม่เหลือร่องรอยทดสอบ");
  }
}

/**
 * 18) สินค้าที่นำเข้าจากเว็บเดิม (S3 ส่วนที่ 3 · รอบที่ 103) — **วงจรจริงกับฐานข้อมูล**
 *
 * พิสูจน์ว่าชั้นข้อมูลสินค้าครบวงจร: เขียนหมวด → เขียนสินค้า + ส่วนผสม → อ่านกลับ (ลำดับ/พาธภาพถูก)
 * → นับต่อหมวด → **ภาพของสินค้าถูก `findMediaUsage` เห็น** (กันผู้ดูแลกดลบภาพที่สินค้ายังใช้)
 * → เขียนซ้ำ/แทนที่ส่วนผสม = ผลเท่าเดิม (idempotent) → ลบแล้วต้องไม่เหลืออะไร
 */
const PRODUCT_CHECK_CATEGORY = "check-db-products";
const PRODUCT_CHECK_ID = "p999999";
const PRODUCT_CHECK_ACTOR = "check-db-products@example.invalid";

/* 24) หลังบ้านสินค้า (รอบที่ 134) — ประกาศไว้ตรงนี้เพราะ `main()` ถูกเรียกก่อนนิยามฟังก์ชันส่วนท้าย */
const PRODUCT_ADMIN_CHECK_CATEGORY = "check-db-products-admin";
const PRODUCT_ADMIN_CHECK_ID = "p999998";
const PRODUCT_ADMIN_CHECK_ACTOR = "check-db-products-admin@example.invalid";

async function checkProductCatalog(): Promise<void> {
  const mediaId = newMediaId();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
    "base64",
  );

  const productInput: ProductInput = {
    id: PRODUCT_CHECK_ID,
    categoryId: PRODUCT_CHECK_CATEGORY,
    sourceId: "999999",
    sourceUrl: "/th/pages/999999-check",
    nameTh: "สินค้าทดสอบ (ด่านตรวจ)",
    nameEn: "Check-db product",
    groupTh: "กลุ่มทดสอบ",
    groupEn: "Check group",
    taglineTh: "คำโปรยจากด่านตรวจ",
    taglineEn: "",
    detailsTh: "รายละเอียดจากด่านตรวจ",
    allergensTh: "ไม่มี",
    netWeightTh: "60 กรัม",
    fdaNumber: "73-1-30323-2-0000",
    packagingTh: "กล่อง 30 ซอง",
    sortOrder: 3,
  };

  try {
    await insertMedia({
      id: mediaId,
      filename: "check-db-product.png",
      mime: "image/png",
      sizeBytes: png.length,
      width: 1,
      height: 1,
      data: png,
      altTh: "สินค้าทดสอบ",
      altEn: "Check product",
      createdBy: PRODUCT_CHECK_ACTOR,
    });

    await upsertProductCategory(
      { id: PRODUCT_CHECK_CATEGORY, sourceId: "999999", descriptionTh: "คำอธิบายหมวดทดสอบ", descriptionEn: "" },
      PRODUCT_CHECK_ACTOR,
      null,
    );
    await upsertProduct(productInput, PRODUCT_CHECK_ACTOR, mediaId);
    await replaceProductIngredients(PRODUCT_CHECK_ID, [
      { nameTh: "แป้งสาลี", nameEn: "Wheat Flour", percentText: "53.00%" },
      { nameTh: "น้ำมันปาล์ม", nameEn: "Palm Oil", percentText: "16.00%" },
    ]);

    const items = await listProductsByCategory(PRODUCT_CHECK_CATEGORY);
    assert.equal(items.length, 1, "ต้องอ่านสินค้าในหมวดได้");
    const first = items[0];
    assert.ok(first !== undefined, "ต้องมีสินค้า 1 รายการ");
    assert.equal(first.id, PRODUCT_CHECK_ID);
    assert.equal(first.imagePath, `/media/${mediaId}`, "ภาพต้องถูกส่งเป็นพาธ /media/<id> (มติ D9)");
    assert.equal(first.imageWidth, 1, "ต้องอ่านขนาดภาพจากตาราง media ได้");
    assert.equal(first.netWeightTh, "60 กรัม");
    assert.deepEqual(
      first.ingredients.map((entry) => entry.nameTh),
      ["แป้งสาลี", "น้ำมันปาล์ม"],
      "ส่วนผสมต้องเรียงตามที่บันทึก",
    );

    const counts = await countProductsByCategory();
    assert.equal(counts[PRODUCT_CHECK_CATEGORY], 1, "นับสินค้าต่อหมวดได้");

    /*
      ตัวอ่านที่ "หน้าแรก" ใช้ (รอบที่ 108) — ต้องได้หมวด + จำนวน + ภาพ และสินค้าเด่น 1 ตัวต่อหมวด
      ⚠️ จุดสำคัญ: DB คืน `product_category.id` = slug ⇒ หน้าแรกต้องจับคู่กับ CATALOG_ITEMS ด้วย slug
         (ถ้าจับคู่ผิดคีย์ จำนวน/คำอธิบาย/ภาพจะไม่ขึ้นสักหมวด — เคยพลาดจริงและเทสต์จับได้)
    */
    const categoryCards = await listProductCategoryCards();
    const tempCard = categoryCards.find((card) => card.id === PRODUCT_CHECK_CATEGORY);
    assert.ok(tempCard !== undefined, "ต้องเห็นหมวดทดสอบในการ์ดหมวดของหน้าแรก");
    assert.equal(tempCard.productCount, 1, "การ์ดหมวดต้องบอกจำนวนสินค้าจริง");
    assert.equal(tempCard.descriptionTh, "คำอธิบายหมวดทดสอบ", "การ์ดหมวดต้องได้คำอธิบายจริง");

    const highlights = await listProductHighlights();
    const tempHighlight = highlights.find((row) => row.categoryId === PRODUCT_CHECK_CATEGORY);
    assert.ok(tempHighlight !== undefined, "สินค้าเด่นของหมวดทดสอบต้องถูกเลือก (1 ตัวต่อหมวด)");
    assert.equal(tempHighlight.id, PRODUCT_CHECK_ID);
    assert.equal(tempHighlight.imagePath, `/media/${mediaId}`, "สินค้าเด่นต้องมีภาพ (พาธ /media/<id>)");
    assert.equal(
      highlights.filter((row) => row.categoryId === PRODUCT_CHECK_CATEGORY).length,
      1,
      "ต้องได้หมวดละ 1 ตัวเท่านั้น",
    );

    const usage = await findMediaUsage(mediaId);
    assert.ok(
      usage.some((entry) => entry.kind === "product" && entry.target === `product:${PRODUCT_CHECK_ID}`),
      "findMediaUsage ต้องเห็นภาพที่สินค้าใช้ (ไม่งั้นผู้ดูแลลบภาพที่ยังใช้ได้)",
    );

    /* เขียนซ้ำ = แถวเดิม (idempotent) · แทนที่ส่วนผสม = เหลือชุดใหม่เท่านั้น */
    await upsertProduct(productInput, PRODUCT_CHECK_ACTOR, mediaId);
    assert.equal(await countWhere("product where id = $1", [PRODUCT_CHECK_ID]), 1, "นำเข้าซ้ำต้องไม่สร้างแถวใหม่");
    await replaceProductIngredients(PRODUCT_CHECK_ID, [{ nameTh: "เกลือ", nameEn: "Salt", percentText: "" }]);
    const replaced = await listProductsByCategory(PRODUCT_CHECK_CATEGORY);
    assert.deepEqual(
      replaced[0]?.ingredients.map((entry) => entry.nameTh),
      ["เกลือ"],
      "แทนที่ส่วนผสมแล้วต้องเหลือชุดใหม่เท่านั้น",
    );

    done("สินค้าจากเว็บเดิม: หมวด → สินค้า + ส่วนผสม → อ่านกลับ → ภาพถูกใช้ที่ไหน → ลบ", "พาธภาพ · ลำดับส่วนผสม · idempotent");
  } finally {
    await deleteProduct(PRODUCT_CHECK_ID);
    assert.equal(
      await countWhere("product_ingredient where product_id = $1", [PRODUCT_CHECK_ID]),
      0,
      "ส่วนผสมต้องถูกลบตามสินค้า (cascade)",
    );
    await deleteProductCategory(PRODUCT_CHECK_CATEGORY);
    await getPool().query("delete from media where id = $1", [mediaId]);

    assert.equal(await countWhere("product where category_id = $1", [PRODUCT_CHECK_CATEGORY]), 0, "ต้องไม่เหลือสินค้าทดสอบ");
    assert.equal(await countWhere("product_category where id = $1", [PRODUCT_CHECK_CATEGORY]), 0, "ต้องไม่เหลือหมวดทดสอบ");
    assert.equal(await countWhere("media where id = $1", [mediaId]), 0, "ต้องไม่เหลือภาพทดสอบ");
  }
}

/**
 * 19) เมนูอาหาร (วิดีโอ) ที่นำเข้าจากเว็บเดิม (S3 ส่วนที่ 4 · รอบที่ 104) — **วงจรจริงกับฐานข้อมูล**
 *
 * พิสูจน์ว่าชั้นข้อมูลเมนูครบวงจร: เขียนเมนู (พร้อมภาพปก) → อ่านกลับ (พาธภาพ/วันที่/วีดีโอถูก)
 * → **ภาพปกถูก `findMediaUsage` เห็น** (กันผู้ดูแลกดลบภาพที่เมนูยังใช้) → เขียนซ้ำ = แถวเดิม → ลบแล้วไม่เหลือ
 */
const RECIPE_CHECK_ID = "r999999";
const RECIPE_CHECK_SOURCE_ID = "999999";
/* 25) หลังบ้านเมนูอาหาร (รอบที่ 135) — ประกาศก่อน `await main()` (ไม่งั้น TDZ) */
const RECIPE_ADMIN_CHECK_ACTOR = "check-db-recipes-admin@example.invalid";
const RECIPE_CHECK_ACTOR = "check-db-recipes@example.invalid";

/* 26) ถังขยะ + ลบถาวร (รอบที่ 139) — ประกาศก่อน `await main()` (ไม่งั้น TDZ) */
const TRASH_CHECK_ACTOR = "check-db-trash-forever@example.invalid";
const TRASH_CHECK_PRODUCT_ID = "p999997";

/* 27) นำเข้าสินค้าซ้ำต้องไม่ทับงานคน (รอบที่ 140) — ประกาศก่อน `await main()` (ไม่งั้น TDZ) */
const IMPORT_GUARD_CHECK_ID = "p999996";
const IMPORT_GUARD_IMPORT_ACTOR = "import:waiwai.co.th";
const IMPORT_GUARD_HUMAN_ACTOR = "check-db-human-editor@example.invalid";

async function checkRecipeVideos(): Promise<void> {
  const mediaId = newMediaId();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
    "base64",
  );

  const recipeInput = {
    id: recipeIdOfSourceId(RECIPE_CHECK_SOURCE_ID),
    sourceId: RECIPE_CHECK_SOURCE_ID,
    sourceUrl: `/th/articles/${RECIPE_CHECK_SOURCE_ID}-check`,
    titleTh: "เมนูทดสอบ (ด่านตรวจ)",
    titleEn: "",
    videoId: "6XkLdl6C_Xo",
    publishedOn: "2018-10-09",
    sortOrder: 99,
  };

  try {
    assert.equal(recipeInput.id, RECIPE_CHECK_ID, "id ของเมนูต้องมาจาก source id (r<source>)");

    await insertMedia({
      id: mediaId,
      filename: "check-db-recipe.png",
      mime: "image/png",
      sizeBytes: png.length,
      width: 1,
      height: 1,
      data: png,
      altTh: "เมนูทดสอบ",
      altEn: "Check recipe",
      createdBy: RECIPE_CHECK_ACTOR,
    });

    await upsertRecipe(recipeInput, RECIPE_CHECK_ACTOR, mediaId);

    const items = await listRecipes();
    const found = items.find((entry) => entry.id === RECIPE_CHECK_ID);
    assert.ok(found !== undefined, "ต้องอ่านเมนูที่เพิ่งเขียนได้");
    assert.equal(found.coverPath, `/media/${mediaId}`, "ภาพปกต้องถูกส่งเป็นพาธ /media/<id> (มติ D9)");
    assert.equal(found.coverWidth, 1, "ต้องอ่านขนาดภาพปกจากตาราง media ได้");
    assert.equal(found.videoId, "6XkLdl6C_Xo");
    assert.equal(found.publishedOn, "2018-10-09", "วันที่ต้องเป็นสตริง ISO ไม่ถูกเลื่อนเขตเวลา");
    assert.equal(found.sortOrder, 99);

    const usage = await findMediaUsage(mediaId);
    assert.ok(
      usage.some((entry) => entry.kind === "recipe" && entry.target === `recipe:${RECIPE_CHECK_ID}`),
      "findMediaUsage ต้องเห็นภาพปกที่เมนูใช้ (ไม่งั้นผู้ดูแลลบภาพที่ยังใช้ได้)",
    );

    await upsertRecipe(recipeInput, RECIPE_CHECK_ACTOR, mediaId);
    assert.equal(await countWhere("recipe where id = $1", [RECIPE_CHECK_ID]), 1, "นำเข้าซ้ำต้องไม่สร้างแถวใหม่");

    /* อัปเดตได้: เปลี่ยนชื่อ + วันที่ ต้องทับของเดิม (ไม่เพิ่มแถว) */
    await upsertRecipe({ ...recipeInput, titleTh: "เมนูทดสอบ (แก้แล้ว)", publishedOn: "2024-08-24" }, RECIPE_CHECK_ACTOR, mediaId);
    const updated = (await listRecipes()).find((entry) => entry.id === RECIPE_CHECK_ID);
    assert.equal(updated?.titleTh, "เมนูทดสอบ (แก้แล้ว)");
    assert.equal(updated?.publishedOn, "2024-08-24");

    done("เมนูอาหาร (วิดีโอ) จากเว็บเดิม: เขียน → อ่านกลับ → ภาพถูกใช้ที่ไหน → ลบ", "พาธภาพ · วันที่ ISO · idempotent");
  } finally {
    await deleteRecipe(RECIPE_CHECK_ID);
    await getPool().query("delete from media where id = $1", [mediaId]);

    assert.equal(await countWhere("recipe where id = $1", [RECIPE_CHECK_ID]), 0, "ต้องไม่เหลือเมนูทดสอบ");
    assert.equal(await countWhere("media where id = $1", [mediaId]), 0, "ต้องไม่เหลือภาพทดสอบ");
  }
}

/**
 * 20) ข่าวสาร & กิจกรรม (หน้า /news · รอบที่ 105) — **วงจรจริงกับฐานข้อมูล**
 *
 * พิสูจน์ว่าชั้นข้อมูลข่าวครบวงจร: เขียนข่าว (เนื้อหาเป็นบล็อก + ภาพปก + รูปในเนื้อหา) → อ่านกลับ
 * (**เวลาที่อ่านได้ต้องเป็น "เวลาไทย" ค่าเดิมเป๊ะ** — กันบั๊กเขตเวลาตอนย้ายเซิร์ฟเวอร์)
 * → นับจำนวน/ดึงหน้าที่ 1 ได้ → **ทั้งภาพปกและรูปในเนื้อหาถูก `findMediaUsage` เห็น** → เขียนซ้ำ = แถวเดิม → ลบไม่เหลือ
 */
const NEWS_CHECK_SOURCE_ID = "999999";
const NEWS_CHECK_ID = newsIdOfSourceId(NEWS_CHECK_SOURCE_ID);
const NEWS_CHECK_ACTOR = "check-db-news@example.invalid";

async function checkNews(): Promise<void> {
  const coverId = newMediaId();
  const bodyImageId = newMediaId();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
    "base64",
  );

  const input: NewsInput = {
    id: NEWS_CHECK_ID,
    sourceId: NEWS_CHECK_SOURCE_ID,
    sourceUrl: `/th/news/${NEWS_CHECK_SOURCE_ID}-check`,
    titleTh: "ข่าวทดสอบ (ด่านตรวจ)",
    titleEn: "",
    excerptTh: "คำโปรยทดสอบ",
    excerptEn: "",
    publishedLocal: "2026-12-31T09:45",
    publishedLabel: "31 ธันวาคม 2026 09:45",
  };

  const body = [
    { type: "paragraph", text: "ย่อหน้าแรกของข่าวทดสอบ" },
    { type: "heading", text: "หัวข้อย่อย" },
    { type: "image", mediaId: bodyImageId, alt: "ข่าวทดสอบ — ภาพที่ 1" },
    { type: "paragraph", text: "ย่อหน้าปิดท้าย" },
  ] as const;

  try {
    for (const [id, filename] of [
      [coverId, "check-db-news-cover.png"],
      [bodyImageId, "check-db-news-body.png"],
    ] as const) {
      await insertMedia({
        id,
        filename,
        mime: "image/png",
        sizeBytes: png.length,
        width: 1,
        height: 1,
        data: png,
        altTh: "ข่าวทดสอบ",
        altEn: "Check news",
        createdBy: NEWS_CHECK_ACTOR,
      });
    }

    await upsertNews(input, NEWS_CHECK_ACTOR, coverId, body);

    const loaded = await loadNewsBySourceId(NEWS_CHECK_SOURCE_ID);
    assert.ok(loaded !== null, "ต้องอ่านข่าวจาก source id ได้");
    assert.equal(loaded.titleTh, "ข่าวทดสอบ (ด่านตรวจ)");
    assert.equal(loaded.coverPath, `/media/${coverId}`, "ภาพปกต้องเป็นพาธ /media/<id> (มติ D9)");
    assert.equal(loaded.coverWidth, 1, "ต้องอ่านขนาดภาพปกจากตาราง media ได้");
    assert.equal(
      loaded.publishedLocal,
      "2026-12-31T09:45",
      "วันที่ต้องกลับมาเป็นเวลาไทยค่าเดิม (ห้ามเลื่อนเขตเวลา)",
    );
    assert.deepEqual(
      loaded.body.map((block) => block.type),
      ["paragraph", "heading", "image", "paragraph"],
      "บล็อกต้องเรียงตามที่บันทึก",
    );

    assert.ok((await countNews()) >= 1, "นับจำนวนข่าวได้");

    /* ข่าวใหม่สุดต้องอยู่บนสุดของหน้าแรก (published_at desc) */
    const firstPage = await listNews(3, 0);
    assert.equal(firstPage[0]?.id, NEWS_CHECK_ID, "ข่าวที่ใหม่สุดต้องมาก่อน");

    const coverUsage = await findMediaUsage(coverId);
    assert.ok(
      coverUsage.some((entry) => entry.kind === "news" && entry.target === `news:${NEWS_CHECK_ID}`),
      "findMediaUsage ต้องเห็นภาพปกของข่าว",
    );
    const bodyUsage = await findMediaUsage(bodyImageId);
    assert.ok(
      bodyUsage.some((entry) => entry.kind === "news" && entry.target === `news:${NEWS_CHECK_ID}`),
      "findMediaUsage ต้องเห็นรูปในเนื้อหาข่าว (ค้นด้วย JSONB @>)",
    );

    /* เขียนซ้ำ = แถวเดิม · แก้หัวข้อ = ทับของเดิม */
    await upsertNews(input, NEWS_CHECK_ACTOR, coverId, body);
    assert.equal(await countWhere("news where id = $1", [NEWS_CHECK_ID]), 1, "นำเข้าซ้ำต้องไม่สร้างแถวใหม่");
    await upsertNews({ ...input, titleTh: "ข่าวทดสอบ (แก้แล้ว)" }, NEWS_CHECK_ACTOR, null, body);
    const updated = await loadNewsBySourceId(NEWS_CHECK_SOURCE_ID);
    assert.equal(updated?.titleTh, "ข่าวทดสอบ (แก้แล้ว)");
    assert.equal(updated?.coverPath, `/media/${coverId}`, "ส่ง cover = null ต้องไม่ลบภาพเดิม (coalesce)");

    done("ข่าวสาร & กิจกรรม: เขียน → อ่านกลับ → ภาพถูกใช้ที่ไหน → ลบ", "บล็อกเนื้อหา · เวลาไทย · JSONB usage");
  } finally {
    await deleteNews(NEWS_CHECK_ID);
    await getPool().query("delete from media where id = any($1::text[])", [[coverId, bodyImageId]]);

    assert.equal(await countWhere("news where id = $1", [NEWS_CHECK_ID]), 0, "ต้องไม่เหลือข่าวทดสอบ");
    assert.equal(await countWhere("media where id = any($1::text[])", [[coverId, bodyImageId]]), 0, "ต้องไม่เหลือภาพทดสอบ");
  }
}

/** อ่านสวิตช์ตรงจากตาราง (ใช้ยืนยันว่าปิดจริงหลังทดสอบ) */
async function loadPageLiveFlag(page: string): Promise<boolean> {
  const { rows } = await getPool().query<{ readonly is_live: boolean | null }>(
    "select is_live from page_document where page = $1 and status = 'published'",
    [page],
  );
  return rows[0]?.is_live === true;
}

await main();

/**
 * 21) หลังบ้านข่าว (รอบที่ 123): สร้าง (ฉบับร่าง) → ยืนยันว่า **ยังไม่ขึ้นเว็บ** → เผยแพร่ → ขึ้นเว็บจริง →
 *     ย้ายเข้าถังขยะ → หายจากเว็บแต่ยังกู้คืนได้ → ค้นหาในหลังบ้านเจอ → ลบถาวร
 *
 * ทำไมต้องมีรอบนี้: ตรรกะ "ร่าง/ถังขยะ" อยู่ที่ SQL ใน `lib/news/repository.ts`
 * ⇒ ถ้าลืมกรองที่ใดที่หนึ่งใน 4 คำสั่งอ่านฝั่งเว็บ ข่าวที่ยังไม่พร้อมจะหลุดขึ้นเว็บทันที (ผิดทั้ง SEO และความน่าเชื่อถือ)
 */
async function checkNewsAdmin(): Promise<void> {
  const created: string[] = [];

  try {
    const id = await createNewsForAdmin(
      {
        titleTh: "ข่าวทดสอบหลังบ้าน (ด่านตรวจ)",
        titleEn: "Admin news check",
        excerptTh: "คำโปรยทดสอบหลังบ้าน",
        excerptEn: "",
        coverPath: null,
        publishedLocal: "2026-06-01T10:30",
        status: "draft",
        body: [
          { type: "paragraph", text: "ย่อหน้าแรกจากหลังบ้าน" },
          { type: "heading", text: "หัวข้อย่อย" },
        ],
      },
      NEWS_CHECK_ACTOR,
    );
    created.push(id);

    const sourceId = id.startsWith("n") ? id.slice(1) : id;
    assert.ok(/^\d{3,}$/.test(sourceId), "id ที่สร้างจากหลังบ้านต้องมี source_id เป็นตัวเลข (ใช้เป็นพาธ /news/<source_id>)");

    const draft = await loadNewsForAdmin(id);
    assert.ok(draft !== null, "หลังบ้านต้องอ่านข่าวที่สร้างเองได้");
    assert.equal(draft.status, "draft", "ค่าเริ่มต้นของงานที่ยังไม่พร้อมต้องเป็นฉบับร่าง");
    assert.equal(draft.trashed, false);
    assert.equal(draft.body.length, 2, "เนื้อหาต้องถูกเก็บเป็นบล็อกตามที่ส่งไป");

    /* ⚠️ ฉบับร่างต้อง **ไม่** ขึ้นเว็บ (ทั้งหน้ารวม หน้าข่าวรายชิ้น และรายการ static params) */
    assert.equal(await loadNewsBySourceId(sourceId), null, "ฉบับร่างต้องไม่ขึ้นเว็บ");
    assert.equal((await listNewsSourceIds()).includes(sourceId), false, "ฉบับร่างต้องไม่อยู่ในรายการ static params");

    /* เผยแพร่ ⇒ ต้อง দেখাได้จากเว็บทันที */
    await updateNewsForAdmin(
      id,
      {
        titleTh: "ข่าวทดสอบหลังบ้าน (ด่านตรวจ)",
        titleEn: "Admin news check",
        excerptTh: "คำโปรยทดสอบหลังบ้าน",
        excerptEn: "",
        coverPath: null,
        publishedLocal: "2026-06-01T10:30",
        status: "published",
        body: [{ type: "paragraph", text: "เนื้อหาหลังเผยแพร่" }],
      },
      NEWS_CHECK_ACTOR,
    );
    const published = await loadNewsBySourceId(sourceId);
    assert.ok(published !== null, "เผยแพร่แล้วต้องอ่านจากเว็บได้");
    assert.equal(published.publishedLocal, "2026-06-01T10:30", "เวลาไทยต้องกลับมาค่าเดิม");

    /* ค้นหาในหลังบ้านเจอ */
    const found = await listNewsForAdmin({ tab: "published", search: "ทดสอบหลังบ้าน", page: 1 });
    assert.ok(
      found.items.some((item) => item.id === id),
      "ค้นหาในหลังบ้านต้องเจอข่าวที่เพิ่งเผยแพร่",
    );

    /* ย้ายเข้าถังขยะ ⇒ หายจากเว็บ แต่หลังบ้านยังเห็น + กู้คืนได้ */
    await setNewsTrashed(id, true, NEWS_CHECK_ACTOR);
    assert.equal(await loadNewsBySourceId(sourceId), null, "ของในถังขยะต้องไม่ขึ้นเว็บ");
    const trashed = await loadNewsForAdmin(id);
    assert.ok(trashed !== null && trashed.trashed, "หลังบ้านต้องยังเห็นของในถังขยะ");

    await setNewsTrashed(id, false, NEWS_CHECK_ACTOR);
    assert.ok((await loadNewsBySourceId(sourceId)) !== null, "กู้คืนแล้วต้องกลับขึ้นเว็บ");

    /* นับตามแท็บต้องสอดคล้อง */
    const counts = await adminNewsCounts();
    assert.ok(counts.all >= 1 && counts.published >= 1, "ตัวเลขบนแท็บต้องนับข่าวที่เผยแพร่แล้ว");

    CHECKS.push("  ✓ หลังบ้านข่าว: ร่าง/เผยแพร่/ถังขยะ คุมการมองเห็นบนเว็บได้จริง");
  } finally {
    for (const id of created) await deleteNews(id);
    assert.equal(
      (await listNewsForAdmin({ tab: "all", search: "ทดสอบหลังบ้าน", page: 1 })).items.length,
      0,
      "ลบข่าวทดสอบแล้วต้องไม่เหลือ",
    );
  }
}

/**
 * 22) ข่าวจริงที่นำเข้ามาทั้งหมด: ข้อความ ↔ บล็อก ต้อง **ไป-กลับไม่เพี้ยน**
 *
 * ทำไมต้องมี: หลังบ้านใช้ "ฟอร์มง่าย" (ข้อความช่องเดียว) แต่ข้อมูลเก็บเป็นบล็อก
 * ⇒ ถ้าตัวแปลงกลืน/เสียรูปอะไรกับ **ข้อมูลจริง** การตลาดกดบันทึกครั้งแรก = ข่าวเดิมเสียทันที
 * เทสต์นี้จึงไล่ข่าวทุกชิ้นในฐานข้อมูล (ปัจจุบัน 151 ชิ้น) แล้วเทียบกลับแบบเป๊ะ
 */
async function checkNewsEditorRoundTrip(): Promise<void> {
  const { rows } = await getPool().query<{ id: string; body: unknown }>(
    "select id, body from news where deleted_at is null order by id",
  );

  assert.ok(rows.length > 0, "ต้องมีข่าวในฐานข้อมูลให้ตรวจ (รัน npm run news:import ก่อน)");

  const broken: string[] = [];
  for (const row of rows) {
    const original = parseNewsBody(row.body);
    const text = newsBlocksToText(original);
    const back = newsTextToBlocks(text);
    /* รอบที่ 125: ตัวแก้แบบบล็อกส่ง JSON มา ⇒ ตรวจเส้นทางนั้นด้วย (การ์ด ข้อความ/ภาพ เรียงตามเดิม) */
    const editor = newsBlocksToEditor(original);
    const editorJson = editor.map((item) =>
      item.kind === "image" ? { kind: "image", mediaId: item.mediaId, alt: item.alt } : { kind: item.kind, text: item.text },
    );
    const backFromEditor = parseNewsEditorBlocks(JSON.parse(JSON.stringify(editorJson)) as unknown);
    if (JSON.stringify(back) !== JSON.stringify(original) || JSON.stringify(backFromEditor) !== JSON.stringify(original)) {
      broken.push(row.id);
    }
  }

  assert.deepEqual(broken, [], `ข่าวที่แปลงไป-กลับแล้วไม่เหมือนเดิม (${String(broken.length)} ชิ้น): ${broken.slice(0, 5).join(", ")}`);
  CHECKS.push(`  ✓ ข่าวจริงทั้ง ${String(rows.length)} ชิ้น: ข้อความ↔บล็อก ไป-กลับไม่เพี้ยน (ปลอดภัยต่อการกดบันทึก)`);
}

/**
 * 23) บัญชีโหมด env ต้องล็อกอินได้: สร้างแถว `admin_user` ให้ (`env-admin`) → สร้างเซสชันได้จริง
 *
 * ⚠️ บั๊กจริงบนคลาวด์ (2026-10-05): `admin_session.user_id` มี FK → `admin_user(id)`
 * แต่ฐานข้อมูลที่เพิ่งย้ายขึ้นคลาวด์มี `admin_user` ว่าง ⇒ ล็อกอินไม่ผ่านทั้งที่รหัสถูก
 * (หน้า login ขึ้น "เกิดข้อผิดพลาดในระบบ") — เครื่อง dev ไม่เจอเพราะเคยมีแถวจากงาน RBAC มาก่อน
 */
async function checkEnvAdminSession(): Promise<void> {
  const email = "check-db-env@example.invalid";
  const sid = `check-db-env-${String(Date.now())}`;

  try {
    const ensured = await ensureEnvAdminUser({
      id: ENV_ADMIN_ID,
      email,
      displayName: "Check DB",
      role: "admin",
    });
    assert.ok(ensured, "ต้องสร้างแถว admin_user ให้บัญชีโหมด env ได้");

    /* ⚠️ FK: ถ้าไม่มีแถวใน admin_user การสร้างเซสชันจะล้ม (นี่คือบั๊กจริงบนคลาวด์) */
    const created = await createAdminSession({
      userId: ENV_ADMIN_ID,
      sid,
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: "check-db",
    });
    assert.ok(created, "บัญชีโหมด env ต้องสร้างเซสชันได้ (ถ้าล้ม = ล็อกอินไม่ได้ทั้งระบบ)");

    const found = await findAdminSession(sid);
    assert.ok(found !== null, "ต้องอ่านเซสชันที่เพิ่งสร้างกลับได้");
    CHECKS.push("  ✓ บัญชีจาก env: สร้างแถว admin_user + เซสชันได้จริง (FK admin_session ครบ)");
  } finally {
    await getPool().query("delete from admin_session where user_agent = 'check-db'");
    /* ⚠️ ลบแถวที่สร้างเฉพาะกรณีที่เพิ่งสร้างใหม่ (ถ้ามีอยู่ก่อนแล้ว = ของเจ้าของ ห้ามแตะ) */
    await getPool().query("delete from admin_user where id = $1 and email = $2", [ENV_ADMIN_ID, email]);
  }
}

/**
 * 24) หลังบ้านสินค้า (รอบที่ 134) — **วงจรจริงกับฐานข้อมูล**
 *
 * พิสูจน์ตัวอ่านของจอหลังบ้าน (การ์ด/แก้ไข/หมวด) + "โหมดเขียนภาพ" ที่ต้องแยกให้ชัด
 *   · `listProductsForAdmin` — กรองหมวด + ค้นหา ใช้คู่กันได้ และไม่คืนของที่ไม่ตรง
 *   · `loadProductForAdmin` — ทุกฟิลด์ + ส่วนผสมเรียงลำดับ + พาธภาพ `/media/<id>`
 *   · `listProductCategoriesForAdmin` — sourceId/คำอธิบาย/ภาพ/จำนวนสินค้า ครบ (ฟอร์มใช้ 4 อย่างนี้)
 *   · `imageMode "keep"` = ภาพ null ไม่ลบของเดิม (สคริปต์นำเข้า) · `"set"` = ล้างได้จริง (หลังบ้าน)
 *   · ค่า `sourceId` ว่างจากฟอร์มต้อง **ไม่** ลบ source id เดิม
 */
async function checkProductAdmin(): Promise<void> {
  const mediaId = newMediaId();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
    "base64",
  );

  const input: ProductInput = {
    id: PRODUCT_ADMIN_CHECK_ID,
    categoryId: PRODUCT_ADMIN_CHECK_CATEGORY,
    sourceId: "999998",
    sourceUrl: "",
    nameTh: "สินค้าหลังบ้าน (ด่านตรวจ)",
    nameEn: "Admin check product",
    groupTh: "กลุ่มหลังบ้าน",
    groupEn: "",
    taglineTh: "",
    taglineEn: "",
    detailsTh: "รายละเอียดหลังบ้าน",
    allergensTh: "",
    netWeightTh: "",
    fdaNumber: "",
    packagingTh: "",
    sortOrder: 5,
  };

  const categoryInput = { id: PRODUCT_ADMIN_CHECK_CATEGORY, sourceId: "444444", descriptionTh: "หมวดหลังบ้าน", descriptionEn: "" };

  try {
    await insertMedia({
      id: mediaId,
      filename: "check-db-product-admin.png",
      mime: "image/png",
      sizeBytes: png.length,
      width: 1,
      height: 1,
      data: png,
      altTh: "สินค้าหลังบ้าน",
      altEn: "Admin product",
      createdBy: PRODUCT_ADMIN_CHECK_ACTOR,
    });

    await upsertProductCategory(categoryInput, PRODUCT_ADMIN_CHECK_ACTOR, mediaId, { imageMode: "set" });
    await upsertProduct(input, PRODUCT_ADMIN_CHECK_ACTOR, mediaId, { imageMode: "set" });
    await replaceProductIngredients(PRODUCT_ADMIN_CHECK_ID, [
      { nameTh: "ส่วนผสมหนึ่ง", nameEn: "One", percentText: "10.00%" },
      { nameTh: "ส่วนผสมสอง", nameEn: "Two", percentText: "" },
    ]);

    /* การ์ดหลังบ้าน: กรองหมวด / ค้นหา / กรอง+ค้นหาพร้อมกัน */
    const byCategory = await listProductsForAdmin({ categoryId: PRODUCT_ADMIN_CHECK_CATEGORY });
    assert.ok(
      byCategory.items.some((item) => item.id === PRODUCT_ADMIN_CHECK_ID),
      "กรองตามหมวดต้องเจอสินค้าทดสอบ",
    );
    assert.equal(byCategory.total, byCategory.items.length, "จำนวนรวมต้องตรงกับรายการที่คืน");
    assert.equal(byCategory.items[0]?.ingredientCount, 2, "การ์ดต้องบอกจำนวนส่วนผสมจริง");

    const bySearch = await listProductsForAdmin({ search: "สินค้าหลังบ้าน" });
    assert.ok(
      bySearch.items.some((item) => item.id === PRODUCT_ADMIN_CHECK_ID),
      "ค้นหาด้วยชื่อไทยต้องเจอ",
    );

    const noneFound = await listProductsForAdmin({ categoryId: PRODUCT_ADMIN_CHECK_CATEGORY, search: "ไม่ตรงแน่นอน-zzz" });
    assert.equal(noneFound.items.length, 0, "กรอง+ค้นหาพร้อมกันต้องไม่คืนของที่ไม่ตรง");

    /* จอแก้ไข: ทุกฟิลด์ + ส่วนผสมเรียงลำดับ */
    const detail = await loadProductForAdmin(PRODUCT_ADMIN_CHECK_ID);
    assert.ok(detail !== null, "ต้องโหลดสินค้าสำหรับจอแก้ได้");
    assert.equal(detail.id, PRODUCT_ADMIN_CHECK_ID);
    assert.equal(detail.sourceId, "999998", "ต้องคืน source id ให้ฟอร์มส่งกลับ (id ถูก derive จากค่านี้)");
    assert.equal(detail.imagePath, `/media/${mediaId}`, "พาธภาพต้องเป็น /media/<id> (มติ D9)");
    assert.equal(detail.detailsTh, "รายละเอียดหลังบ้าน");
    /* เคสจริงรอบที่ 134: หน้าจอแก้เคยส่ง sortOrder = 0 คงที่ ⇒ แก้สินค้าแล้วลำดับในหมวดหาย */
    assert.equal(detail.sortOrder, 5, "ต้องอ่านลำดับการแสดงกลับมาได้ (แก้สินค้าแล้วลำดับต้องไม่หาย)");
    assert.deepEqual(
      detail.ingredients.map((item) => item.nameTh),
      ["ส่วนผสมหนึ่ง", "ส่วนผสมสอง"],
      "ส่วนผสมต้องเรียงตามลำดับที่บันทึก",
    );

    /* ฟอร์มหมวด: ต้องได้ sourceId + คำอธิบาย + ภาพ + จำนวนสินค้า */
    const categories = await listProductCategoriesForAdmin();
    const row = categories.find((entry) => entry.id === PRODUCT_ADMIN_CHECK_CATEGORY);
    assert.ok(row !== undefined, "ต้องเห็นหมวดทดสอบในตัวอ่านหลังบ้าน");
    assert.equal(row.sourceId, "444444", "ต้องคืน sourceId ให้ช่องซ่อนของฟอร์ม");
    assert.equal(row.descriptionTh, "หมวดหลังบ้าน");
    assert.equal(row.imagePath, `/media/${mediaId}`);
    assert.equal(row.productCount, 1, "ต้องนับจำนวนสินค้าในหมวด");

    /* โหมด keep (ค่าตั้งต้น = สคริปต์นำเข้าต้องไม่ลบภาพที่ผู้ดูแลเลือก) */
    await upsertProductCategory({ ...categoryInput, descriptionTh: "หมวดหลังบ้าน (แก้คำอธิบาย)" }, PRODUCT_ADMIN_CHECK_ACTOR, null);
    const keptRow = (await listProductCategoriesForAdmin()).find((entry) => entry.id === PRODUCT_ADMIN_CHECK_CATEGORY);
    assert.equal(keptRow?.imagePath, `/media/${mediaId}`, "โหมด keep: ภาพ null ต้องคงภาพเดิมไว้");
    assert.equal(keptRow?.descriptionTh, "หมวดหลังบ้าน (แก้คำอธิบาย)", "คำอธิบายต้องถูกเขียนทับได้");

    /* โหมด set (หลังบ้าน): ล้างภาพได้จริง + sourceId ว่างต้องไม่ลบ source id เดิม */
    await upsertProductCategory(
      { ...categoryInput, sourceId: "", descriptionTh: "หมวดหลังบ้าน (ล้างภาพ)" },
      PRODUCT_ADMIN_CHECK_ACTOR,
      null,
      { imageMode: "set" },
    );
    const clearedRow = (await listProductCategoriesForAdmin()).find((entry) => entry.id === PRODUCT_ADMIN_CHECK_CATEGORY);
    assert.equal(clearedRow?.imagePath, null, "โหมด set: เลือกไม่ใช้ภาพแล้วต้องล้างได้จริง");
    assert.equal(clearedRow?.sourceId, "444444", "ส่ง sourceId ว่างมาต้องไม่ลบ source id เดิม");

    /* สินค้า: ล้างภาพได้ และไม่กระทบส่วนผสม */
    await upsertProduct(input, PRODUCT_ADMIN_CHECK_ACTOR, null, { imageMode: "set" });
    const clearedProduct = await loadProductForAdmin(PRODUCT_ADMIN_CHECK_ID);
    assert.equal(clearedProduct?.imagePath, null, "ล้างภาพสินค้าได้จริง");
    assert.equal(clearedProduct?.ingredients.length, 2, "ล้างภาพต้องไม่กระทบส่วนผสม");

    done("หลังบ้านสินค้า: การ์ด/แก้ไข/หมวด ครบ + โหมดภาพ keep/set ทำงานจริง", "กรอง · ค้นหา · จำนวนส่วนผสม · ล้างภาพ");
  } finally {
    await deleteProduct(PRODUCT_ADMIN_CHECK_ID);
    await deleteProductCategory(PRODUCT_ADMIN_CHECK_CATEGORY);
    await getPool().query("delete from media where id = $1", [mediaId]);

    assert.equal(await countWhere("product where id = $1", [PRODUCT_ADMIN_CHECK_ID]), 0, "ต้องไม่เหลือสินค้าทดสอบ");
    assert.equal(
      await countWhere("product_category where id = $1", [PRODUCT_ADMIN_CHECK_CATEGORY]),
      0,
      "ต้องไม่เหลือหมวดทดสอบ",
    );
    assert.equal(await countWhere("media where id = $1", [mediaId]), 0, "ต้องไม่เหลือภาพทดสอบ");
  }
}

/**
 * 25) หลังบ้านเมนูอาหาร (รอบที่ 135) — **วงจรจริงกับฐานข้อมูล**
 *
 * พิสูจน์ว่า "ร่าง/เผยแพร่/ถังขยะ" คุมการมองเห็นบนเว็บจริง (ตรรกะอยู่ที่ SQL ⇒ ถ้าลืมกรองที่ใด ร่างหลุดขึ้นเว็บทันที)
 *   · สร้างเป็น "เผยแพร่" → หน้าเว็บ (listRecipes) เห็น
 *   · เปลี่ยนเป็น "ร่าง" → หน้าเว็บไม่เห็น · ตัวนับแท็บขยับถูก
 *   · ย้ายเข้าถังขยะ → ไม่เห็น · แท็บถังขยะเห็น · กู้คืนได้
 *   · ค้นหาด้วยชื่อ/รหัสวิดีโอ · `loadRecipeForAdmin` คืนฟิลด์ครบ (พาธภาพ/วันเผยแพร่)
 *   · ตัวเลขในตัวนับใช้ค่าสัมพัทธ์ (ไม่ assume ว่าฐานข้อมูลว่าง — บทเรียนรอบที่ 124/127)
 */
async function checkRecipeAdmin(): Promise<void> {
  const mediaId = newMediaId();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
    "base64",
  );
  const marker = `เมนูหลังบ้าน ${String(Date.now())}`;

  const baseInput: AdminRecipeInput = {
    titleTh: marker,
    titleEn: "Admin check recipe",
    videoId: "dQw4w9WgXcQ",
    publishedOn: "2018-10-09",
    sortOrder: 7,
    coverPath: `/media/${mediaId}`,
    status: "published",
  };

  let createdId = "";
  const before = await adminRecipeCounts();

  try {
    await insertMedia({
      id: mediaId,
      filename: "check-db-recipe-admin.png",
      mime: "image/png",
      sizeBytes: png.length,
      width: 1,
      height: 1,
      data: png,
      altTh: "เมนูหลังบ้าน",
      altEn: "Admin recipe",
      createdBy: RECIPE_ADMIN_CHECK_ACTOR,
    });

    /* 1) สร้างเป็น "เผยแพร่" → หน้าเว็บต้องเห็น */
    createdId = await createRecipeForAdmin(baseInput, RECIPE_ADMIN_CHECK_ACTOR);
    assert.ok(createdId.startsWith("r"), `id ต้องขึ้นต้นด้วย r (ได้ "${createdId}")`);

    const publicAfterCreate = await listRecipes();
    const visible = publicAfterCreate.find((entry) => entry.id === createdId);
    assert.ok(visible !== undefined, "เมนูที่เผยแพร่ต้องขึ้นหน้าเว็บ");
    assert.equal(visible.coverPath, `/media/${mediaId}`, "ภาพปกต้องเป็นพาธ /media/<id> (มติ D9)");
    assert.equal(visible.publishedOn, "2018-10-09", "วันเผยแพร่ต้องอ่านกลับเป็น ISO");

    const afterCreate = await adminRecipeCounts();
    assert.equal(afterCreate.published, before.published + 1, "ตัวนับ 'เผยแพร่' ต้อง +1");
    assert.equal(afterCreate.draft, before.draft, "ตัวนับ 'ฉบับร่าง' ต้องไม่ขยับ");
    assert.equal(afterCreate.trashed, before.trashed, "ตัวนับ 'ถังขยะ' ต้องไม่ขยับ");

    /* 2) จอแก้ต้องอ่านได้ครบ */
    const detail = await loadRecipeForAdmin(createdId);
    assert.ok(detail !== null, "ต้องโหลดเมนูสำหรับจอแก้ได้");
    assert.equal(detail.titleTh, marker);
    assert.equal(detail.videoId, "dQw4w9WgXcQ");
    assert.equal(detail.sortOrder, 7);
    assert.equal(detail.status, "published");
    assert.equal(detail.trashed, false);

    /* 3) เปลี่ยนเป็น "ร่าง" → หน้าเว็บต้องไม่เห็น */
    await updateRecipeForAdmin(createdId, { ...baseInput, titleTh: `${marker} (ร่าง)`, status: "draft" }, RECIPE_ADMIN_CHECK_ACTOR);
    assert.equal(
      (await listRecipes()).some((entry) => entry.id === createdId),
      false,
      "ฉบับร่างต้องไม่ขึ้นหน้าเว็บ",
    );
    const afterDraft = await adminRecipeCounts();
    assert.equal(afterDraft.draft, before.draft + 1, "ตัวนับ 'ฉบับร่าง' ต้อง +1");
    assert.equal(afterDraft.published, before.published, "ตัวนับ 'เผยแพร่' ต้องกลับมาเท่าเดิม");

    /* 4) กลับไปเผยแพร่ แล้วย้ายเข้าถังขยะ → หน้าเว็บไม่เห็น แต่ยังกู้คืนได้ */
    await updateRecipeForAdmin(createdId, baseInput, RECIPE_ADMIN_CHECK_ACTOR);
    await setRecipeTrashed(createdId, true, RECIPE_ADMIN_CHECK_ACTOR);
    assert.equal(
      (await listRecipes()).some((entry) => entry.id === createdId),
      false,
      "ของในถังขยะต้องไม่ขึ้นหน้าเว็บ",
    );
    const trashList = await listRecipesForAdmin({ tab: "trash", search: marker });
    assert.ok(
      trashList.items.some((entry) => entry.id === createdId),
      "แท็บถังขยะต้องเห็นเมนูที่เพิ่งย้ายเข้า",
    );
    const afterTrash = await adminRecipeCounts();
    assert.equal(afterTrash.trashed, before.trashed + 1, "ตัวนับ 'ถังขยะ' ต้อง +1");
    assert.equal(afterTrash.all, before.all, "'ทั้งหมด' นับเฉพาะของที่ไม่อยู่ในถังขยะ");

    await setRecipeTrashed(createdId, false, RECIPE_ADMIN_CHECK_ACTOR);
    assert.ok(
      (await listRecipes()).some((entry) => entry.id === createdId),
      "กู้คืนแล้วต้องกลับขึ้นหน้าเว็บ",
    );

    /* 5) ค้นหาได้ทั้งชื่อและรหัสวิดีโอ */
    const byTitle = await listRecipesForAdmin({ tab: "published", search: marker });
    assert.ok(byTitle.items.some((entry) => entry.id === createdId), "ค้นหาด้วยชื่อไทยต้องเจอ");
    const byVideo = await listRecipesForAdmin({ tab: "all", search: "dQw4w9WgXcQ" });
    assert.ok(byVideo.items.some((entry) => entry.id === createdId), "ค้นหาด้วยรหัสวิดีโอต้องเจอ");

    done("หลังบ้านเมนูอาหาร: ร่าง/เผยแพร่/ถังขยะ คุมการมองเห็นบนเว็บได้จริง", "ตัวนับแท็บ · ค้นหา · พาธภาพ · กู้คืน");
  } finally {
    if (createdId !== "") await deleteRecipe(createdId);
    await getPool().query("delete from media where id = $1", [mediaId]);

    assert.equal(createdId === "" ? 0 : await countWhere("recipe where id = $1", [createdId]), 0, "ต้องไม่เหลือเมนูทดสอบ");
    assert.equal(await countWhere("media where id = $1", [mediaId]), 0, "ต้องไม่เหลือภาพทดสอบ");
    assert.deepEqual(await adminRecipeCounts(), before, "ตัวนับต้องกลับมาเท่าเดิมหลังลบรอยทดสอบ");
  }
}

/**
 * 26) ถังขยะ + ลบถาวร (รอบที่ 139) — **วงจรจริงกับฐานข้อมูล**
 *
 * เจ้าของสั่ง "ลุยที่ยังเหลือ" = ปิดหนี้ "ลบให้ครบวงจร" ⇒ วงจรนี้พิสูจน์ 4 อย่าง
 *   1. **ของในถังหายจากเว็บจริงทุกเส้นทาง** (การ์ดหมวด · สินค้าในหมวด · สินค้าเด่น · ตัวนับ)
 *   2. **ประตูลบถาวรอยู่ที่ SQL** — ของที่ยังใช้งานอยู่ `deleteProductForever()` ต้องคืน `false` และไม่ลบจริง
 *   3. **ภาพของในถังยังนับเป็น "ถูกใช้"** (`findMediaUsage`) ⇒ ผู้ดูแลลบภาพไม่ได้ระหว่างที่ยังกู้คืนได้
 *   4. เมนูอาหารมีประตูเดียวกัน (`deleteRecipeForever`)
 *
 * ⚠️ ตัวเลขทุกตัวใช้ **ค่าสัมพัทธ์** (เทียบก่อน/หลัง) ไม่ assume ว่าฐานข้อมูลว่าง — บทเรียนรอบที่ 124/127
 */
async function checkTrashForever(): Promise<void> {
  const mediaId = newMediaId();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
    "base64",
  );

  const categories = await listProductCategoriesForAdmin();
  const categoryId = categories[0]?.id ?? "";
  assert.ok(categoryId !== "", "ต้องมีหมวดสินค้าอย่างน้อย 1 หมวดในฐานข้อมูลก่อนรันวงจรนี้");

  const beforeCounts = await countProductsByCategory();
  const beforeCount = beforeCounts[categoryId] ?? 0;
  const beforeRecipeCounts = await adminRecipeCounts();
  let recipeId = "";

  /* sort_order ติดลบมาก = การ์ด "สินค้าเด่น" ของหมวดนี้ต้องเป็นของทดสอบ (พิสูจน์เส้นทาง highlights ได้จริง) */
  const productInput: ProductInput = {
    id: TRASH_CHECK_PRODUCT_ID,
    categoryId,
    sourceId: "999997",
    sourceUrl: "",
    nameTh: "สินค้าด่านถังขยะ",
    nameEn: "Trash check product",
    groupTh: "",
    groupEn: "",
    taglineTh: "",
    taglineEn: "",
    detailsTh: "",
    allergensTh: "",
    netWeightTh: "",
    fdaNumber: "",
    packagingTh: "",
    sortOrder: -99999,
  };

  const inCategoryList = async (): Promise<boolean> =>
    (await listProductsByCategory(categoryId)).some((item) => item.id === TRASH_CHECK_PRODUCT_ID);
  const inHighlights = async (): Promise<boolean> =>
    (await listProductHighlights()).some((item) => item.id === TRASH_CHECK_PRODUCT_ID);
  const cardCount = async (): Promise<number> =>
    (await listProductCategoryCards()).find((card) => card.id === categoryId)?.productCount ?? -1;
  const countOfCategory = async (): Promise<number> => (await countProductsByCategory())[categoryId] ?? 0;
  const inAdminTab = async (tab: "all" | "trash"): Promise<boolean> =>
    (await listProductsForAdmin({ tab })).items.some((item) => item.id === TRASH_CHECK_PRODUCT_ID);
  const mediaUsageTargets = async (): Promise<readonly string[]> =>
    (await findMediaUsage(mediaId)).map((usage) => usage.target);

  try {
    await insertMedia({
      id: mediaId,
      filename: "check-db-trash-forever.png",
      mime: "image/png",
      sizeBytes: png.length,
      width: 1,
      height: 1,
      data: png,
      altTh: "สินค้าด่านถังขยะ",
      altEn: "Trash check product",
      createdBy: TRASH_CHECK_ACTOR,
    });
    await upsertProduct(productInput, TRASH_CHECK_ACTOR, mediaId, { imageMode: "set" });

    /* 1) ตอนใช้งาน: ต้องเห็นครบทุกเส้นทางของเว็บ */
    assert.equal(await inCategoryList(), true, "สินค้าที่ใช้งานต้องอยู่ในรายการหมวด");
    assert.equal(await inHighlights(), true, "สินค้าที่ใช้งานต้องเป็นสินค้าเด่นของหมวด (sort_order ต่ำสุด)");
    assert.equal(await countOfCategory(), beforeCount + 1, "ตัวนับต่อหมวดต้อง +1");
    assert.equal(await cardCount(), beforeCount + 1, "จำนวนบนการ์ดหมวดต้อง +1");
    assert.equal(await inAdminTab("all"), true, "แท็บ 'ใช้งาน' ต้องเห็นสินค้านี้");
    assert.equal(await inAdminTab("trash"), false, "แท็บ 'ถังขยะ' ต้องไม่เห็นสินค้าที่ใช้งานอยู่");
    assert.ok(
      (await mediaUsageTargets()).includes(`product:${TRASH_CHECK_PRODUCT_ID}`),
      "ภาพของสินค้าต้องถูกนับเป็น 'ใช้งาน' (กันผู้ดูแลกดลบภาพที่สินค้ายังใช้)",
    );

    /* 2) ⭐ ประตูจริง: ลบถาวรของที่ยังใช้งานอยู่ ต้องไม่สำเร็จ */
    assert.equal(
      await deleteProductForever(TRASH_CHECK_PRODUCT_ID),
      false,
      "deleteProductForever ต้องปฏิเสธสินค้าที่ไม่ได้อยู่ในถังขยะ",
    );
    assert.ok((await loadProductForAdmin(TRASH_CHECK_PRODUCT_ID)) !== null, "สินค้าต้องยังอยู่หลังลบถาวรไม่สำเร็จ");
    assert.equal(await inCategoryList(), true, "สินค้าต้องยังขึ้นเว็บอยู่");

    /* 3) ย้ายเข้าถังขยะ → หายจากเว็บทุกเส้นทาง + แท็บถังขยะเห็น */
    assert.equal(
      await setProductTrashed(TRASH_CHECK_PRODUCT_ID, true, TRASH_CHECK_ACTOR),
      true,
      "ย้ายเข้าถังขยะต้องสำเร็จ",
    );
    assert.equal(await inCategoryList(), false, "ของในถังต้องหายจากรายการหมวด");
    assert.equal(await inHighlights(), false, "ของในถังต้องหายจากสินค้าเด่น");
    assert.equal(await countOfCategory(), beforeCount, "ตัวนับต่อหมวดต้องกลับมาเท่าเดิม");
    assert.equal(await cardCount(), beforeCount, "จำนวนบนการ์ดหมวดต้องกลับมาเท่าเดิม");
    assert.equal(await inAdminTab("all"), false, "ของในถังต้องไม่อยู่ในแท็บ 'ใช้งาน'");
    assert.equal(await inAdminTab("trash"), true, "ของในถังต้องอยู่ในแท็บ 'ถังขยะ'");
    const trashedDetail = await loadProductForAdmin(TRASH_CHECK_PRODUCT_ID);
    assert.equal(trashedDetail?.trashed, true, "จอแก้ต้องรู้ว่าของอยู่ในถัง");
    assert.ok(
      (await mediaUsageTargets()).includes(`product:${TRASH_CHECK_PRODUCT_ID}`),
      "⚠️ ของในถังต้องยังนับว่าภาพ 'ถูกใช้' (กู้คืนได้ ⇒ ลบภาพไม่ได้)",
    );

    /* 4) กู้คืน → กลับขึ้นเว็บ */
    assert.equal(
      await setProductTrashed(TRASH_CHECK_PRODUCT_ID, false, TRASH_CHECK_ACTOR),
      true,
      "กู้คืนต้องสำเร็จ",
    );
    assert.equal(await inCategoryList(), true, "กู้คืนแล้วต้องกลับขึ้นเว็บ");
    assert.equal(await countOfCategory(), beforeCount + 1, "ตัวนับต้องกลับมา +1");

    /* 5) ย้ายเข้าถังอีกรอบ → ลบถาวรสำเร็จ + ไม่เหลือรอย + ตัวนับกลับมาเท่าเดิม */
    await setProductTrashed(TRASH_CHECK_PRODUCT_ID, true, TRASH_CHECK_ACTOR);
    assert.equal(await deleteProductForever(TRASH_CHECK_PRODUCT_ID), true, "ลบถาวรของในถังต้องสำเร็จ");
    assert.equal(await loadProductForAdmin(TRASH_CHECK_PRODUCT_ID), null, "ลบถาวรแล้วต้องไม่เหลือแถว");
    assert.equal(await countOfCategory(), beforeCount, "ตัวนับต้องกลับมาเท่าเดิมหลังลบถาวร");
    assert.equal(
      await deleteProductForever(TRASH_CHECK_PRODUCT_ID),
      false,
      "ลบถาวรซ้ำต้องไม่สำเร็จ (idempotent · ไม่มีแถวให้ลบ)",
    );
    assert.ok(
      !(await mediaUsageTargets()).includes(`product:${TRASH_CHECK_PRODUCT_ID}`),
      "ลบถาวรแล้วภาพต้องไม่ถูกนับว่าใช้งานอีก",
    );

    /* 6) เมนูอาหาร: ประตูเดียวกัน */
    recipeId = await createRecipeForAdmin(
      {
        titleTh: `เมนูด่านลบถาวร ${String(Date.now())}`,
        titleEn: "Trash check recipe",
        videoId: "dQw4w9WgXcQ",
        publishedOn: "2018-10-09",
        sortOrder: 7,
        coverPath: null,
        status: "published",
      },
      TRASH_CHECK_ACTOR,
    );
    assert.equal(await deleteRecipeForever(recipeId), false, "ลบถาวรเมนูที่ยังเผยแพร่อยู่ต้องไม่สำเร็จ");
    assert.ok((await loadRecipeForAdmin(recipeId)) !== null, "เมนูต้องยังอยู่หลังลบถาวรไม่สำเร็จ");
    await setRecipeTrashed(recipeId, true, TRASH_CHECK_ACTOR);
    assert.equal(await deleteRecipeForever(recipeId), true, "ลบถาวรเมนูในถังต้องสำเร็จ");
    assert.equal(await loadRecipeForAdmin(recipeId), null, "ลบถาวรแล้วเมนูต้องไม่เหลือแถว");
    recipeId = "";

    done(
      "ถังขยะ + ลบถาวร: ของในถังหายจากเว็บทุกเส้นทาง · ประตู 'ต้องอยู่ในถัง' อยู่ที่ SQL",
      "การ์ดหมวด · สินค้าเด่น · ตัวนับ · ภาพของในถัง · เมนูอาหาร",
    );
  } finally {
    await deleteProduct(TRASH_CHECK_PRODUCT_ID);
    if (recipeId !== "") await deleteRecipe(recipeId);
    await getPool().query("delete from media where id = $1", [mediaId]);

    assert.equal(await countWhere("product where id = $1", [TRASH_CHECK_PRODUCT_ID]), 0, "ต้องไม่เหลือสินค้าทดสอบ");
    assert.equal(await countWhere("media where id = $1", [mediaId]), 0, "ต้องไม่เหลือภาพทดสอบ");
    assert.equal(await countOfCategory(), beforeCount, "ตัวนับต่อหมวดต้องกลับมาเท่าเดิม");
    assert.deepEqual(await adminRecipeCounts(), beforeRecipeCounts, "ตัวนับเมนูต้องกลับมาเท่าเดิม");
  }
}

/**
 * 27) นำเข้าสินค้าซ้ำต้อง **ไม่ทับงานที่แก้จากหลังบ้าน** (รอบที่ 140)
 *
 * ที่มา: เจ้าของถามว่า "ส่วนสินค้าปิดเซสชันหรือยัง" ⇒ ตรวจแล้วเจอกับดักจริง
 *   `products:import` (idempotent) เขียนทับ **ทุกช่อง** บน `on conflict` ⇒ ใครรันนำเข้าซ้ำ
 *   งานที่แก้จากหลังบ้าน (ชื่อ/คำโปรย/รายละเอียด/ส่วนผสม/ลำดับ) หายเงียบ ๆ
 * ⇒ รอบที่ 140 เพิ่มโหมด `protect-edited` (สคริปต์นำเข้าใช้เป็นค่าเริ่มต้น):
 *   ถ้าแถวเดิมถูกแก้โดย **ผู้ใช้อื่น** (`updated_by` ไม่ใช่ตัวนำเข้า) ให้คงค่าเดิมไว้
 *
 * วงจรนี้พิสูจน์ 6 ข้อ (ข้อ 4 คือกับดักที่เกือบพลาด — ถ้าเขียน `updated_by` ทับในโหมดป้องกัน
 * การนำเข้า "ครั้งที่สอง" จะเห็นว่าตนเองเป็นคนแก้ล่าสุด แล้วทับงานคนทันที)
 */
async function checkProductImportGuard(): Promise<void> {
  const categories = await listProductCategoriesForAdmin();
  const categoryId = categories[0]?.id ?? "";
  assert.ok(categoryId !== "", "ต้องมีหมวดสินค้าอย่างน้อย 1 หมวดในฐานข้อมูลก่อนรันวงจรนี้");

  const fromSource: ProductInput = {
    id: IMPORT_GUARD_CHECK_ID,
    categoryId,
    sourceId: "999996",
    sourceUrl: "",
    nameTh: "ชื่อจากเว็บเดิม",
    nameEn: "From source",
    groupTh: "",
    groupEn: "",
    taglineTh: "",
    taglineEn: "",
    detailsTh: "รายละเอียดจากเว็บเดิม",
    allergensTh: "",
    netWeightTh: "",
    fdaNumber: "",
    packagingTh: "",
    sortOrder: 3,
  };
  const humanEdit: ProductInput = {
    ...fromSource,
    nameTh: "ชื่อที่คนแก้จากหลังบ้าน",
    detailsTh: "รายละเอียดที่คนแก้",
    sortOrder: 77,
  };
  const actorOf = async (): Promise<string | null> => {
    const row = await getPool().query<{ updated_by: string | null }>(
      "select updated_by from product where id = $1",
      [IMPORT_GUARD_CHECK_ID],
    );
    return row.rows[0]?.updated_by ?? null;
  };

  try {
    /* 1) นำเข้าครั้งแรก = สร้างใหม่ (ยังไม่มีอะไรให้ป้องกัน) */
    const created = await upsertProduct(fromSource, IMPORT_GUARD_IMPORT_ACTOR, null, { writeMode: "protect-edited" });
    assert.equal(created.created, true, "ครั้งแรกต้องเป็นการสร้างแถวใหม่");
    assert.equal(created.protectedEdit, false, "ครั้งแรกยังไม่มีของเดิมให้ป้องกัน");

    /* 2) คนแก้จากหลังบ้าน (โหมดปกติ = ค่าที่กรอกชนะ) */
    const edited = await upsertProduct(humanEdit, IMPORT_GUARD_HUMAN_ACTOR, null, { writeMode: "replace" });
    assert.equal(edited.created, false, "ครั้งที่สองต้องไม่ใช่การสร้างใหม่");
    assert.equal(edited.protectedEdit, false, "โหมด replace ต้องไม่รายงานว่าป้องกัน");
    assert.equal((await loadProductForAdmin(IMPORT_GUARD_CHECK_ID))?.nameTh, "ชื่อที่คนแก้จากหลังบ้าน");

    /* 3) รันนำเข้าซ้ำ (โหมดป้องกัน) → ต้องคงค่าที่คนแก้ + รายงานว่าป้องกันไว้ */
    const reimported = await upsertProduct(fromSource, IMPORT_GUARD_IMPORT_ACTOR, null, { writeMode: "protect-edited" });
    assert.equal(reimported.protectedEdit, true, "ต้องรายงานว่าป้องกันงานที่คนแก้ไว้");
    const kept = await loadProductForAdmin(IMPORT_GUARD_CHECK_ID);
    assert.equal(kept?.nameTh, "ชื่อที่คนแก้จากหลังบ้าน", "นำเข้าซ้ำต้องไม่ทับชื่อที่คนแก้");
    assert.equal(kept?.detailsTh, "รายละเอียดที่คนแก้", "นำเข้าซ้ำต้องไม่ทับรายละเอียดที่คนแก้");
    assert.equal(kept?.sortOrder, 77, "ลำดับที่คนตั้งไว้ต้องไม่ถูกทับ");
    assert.equal(await actorOf(), IMPORT_GUARD_HUMAN_ACTOR, "ต้องคง updated_by ของคนไว้");

    /* 4) ⭐ นำเข้าซ้ำ "ครั้งที่สอง" ติดกัน → ต้องยังคงค่าคน (กับดักที่จับได้ตอนเขียนเทสต์) */
    const reimportedAgain = await upsertProduct(fromSource, IMPORT_GUARD_IMPORT_ACTOR, null, { writeMode: "protect-edited" });
    assert.equal(reimportedAgain.protectedEdit, true, "ครั้งที่สองต้องยังป้องกันอยู่ (ไม่ใช่ป้องกันได้ครั้งเดียว)");
    assert.equal(
      (await loadProductForAdmin(IMPORT_GUARD_CHECK_ID))?.nameTh,
      "ชื่อที่คนแก้จากหลังบ้าน",
      "⚠️ งานคนต้องรอดแม้รันนำเข้าซ้ำหลายรอบ",
    );

    /* 5) --force = เขียนทับจริงตามที่ผู้ใช้สั่ง */
    const forced = await upsertProduct(fromSource, IMPORT_GUARD_IMPORT_ACTOR, null, { writeMode: "replace" });
    assert.equal(forced.protectedEdit, false, "โหมด replace ต้องไม่รายงานว่าป้องกัน");
    assert.equal(
      (await loadProductForAdmin(IMPORT_GUARD_CHECK_ID))?.nameTh,
      "ชื่อจากเว็บเดิม",
      "--force ต้องเขียนทับจริง",
    );

    /* 6) หลัง force ค่าล่าสุดเป็นของตัวนำเข้า ⇒ รันซ้ำโหมดป้องกันได้ตามปกติ (idempotent) */
    const afterForce = await upsertProduct(fromSource, IMPORT_GUARD_IMPORT_ACTOR, null, { writeMode: "protect-edited" });
    assert.equal(afterForce.protectedEdit, false, "ไม่มีงานคนค้างอยู่ ⇒ ไม่ต้องรายงานว่าป้องกันไว้");

    done(
      "นำเข้าสินค้าซ้ำ: ไม่ทับงานที่แก้จากหลังบ้าน · --force ทับจริง · งานคนรอดแม้รันซ้ำหลายรอบ",
      "เทียบ updated_by · ลำดับ · 2 รอบติดกัน · โหมด replace",
    );
  } finally {
    await deleteProduct(IMPORT_GUARD_CHECK_ID);
    assert.equal(await countWhere("product where id = $1", [IMPORT_GUARD_CHECK_ID]), 0, "ต้องไม่เหลือสินค้าทดสอบ");
  }
}
