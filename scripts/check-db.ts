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

import { closePool, isDatabaseConfigured } from "@/db/pool";
import { HOME_SEED } from "@/lib/content/home-seed";
import { HOME_PAGE_SPEC } from "@/lib/content/model";
import { countPageRows, importPageSeed, loadPageContent, savePageContent } from "@/lib/content/repository";
import { itemKeyOf } from "@/lib/content/sql";
import { errorsOf, validateContent } from "@/lib/content/validate";
import type { PageContent } from "@/lib/content/types";

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

  await closePool();

  process.stdout.write(`\n${CHECKS.join("\n")}\n\n✓ check:db ผ่านทั้งหมด (${Date.now() - started} ms)\n`);
}

await main();
