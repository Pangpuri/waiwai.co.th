import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { NAVBAR_PAGE_KEY, defaultNavbarConfig, navbarErrorsOf, validateNavbarConfig } from "@/lib/chrome/navbar";
import { FOOTER_PAGE_KEY, defaultFooterConfig } from "@/lib/chrome/footer";
import {
  CHROME_PRESET_KINDS,
  MAX_CHROME_PRESET_NAME_LENGTH,
  MAX_CHROME_PRESETS_PER_KIND,
  chromePresetCounts,
  chromePresetPageKey,
  chromePresetsAreFull,
  defaultChromePresetPayload,
  isChromePresetKind,
  newChromePresetId,
  normalizeChromePresetName,
  parseChromePresetPayload,
  validateChromePresetConfig,
} from "@/lib/chrome/presets";
import { MOURNING_PAGE_KEY, defaultMourningConfig } from "@/lib/mourning/config";
import {
  CHROME_WORKSPACE_PATH,
  PREVIEW_PARTS_WITHOUT_NOTICE,
  chromeTabHref,
  chromeTabOf,
  isChromeMode,
  isChromePart,
  type ChromeTabState,
} from "@/lib/chrome/workspace-url";
import { TRASH_KINDS, emptyTrashCounts, isTrashKind, trashTotal } from "@/lib/trash/plan";
import { th } from "@/lib/i18n/messages/th";
import { readStrippedCss } from "./css-source.ts";

/**
 * เทสต์ W3b — พรีเซ็ตของส่วนกลาง (แถบเมนู · ท้ายเว็บ · ป้ายประกาศ)
 *
 * โจทย์ผู้ใช้ (รอบที่ 58): *"มีของเก่าเก็บไว้ในฐานข้อมูลและโชว์ก่อน · มีของใหม่เตรียมฐานข้อมูลรับ
 * · มีพรีเซ็ตที่ต้องเตรียมฐานข้อมูลรับ"*
 *
 * จุดที่ต้องคุม
 * 1. **ชนิดของส่วน** ต้องมาจากค่าคงที่ (ค่าจากฟอร์มไม่มีทางเลือกพาธ/ตารางเอง)
 * 2. **payload ต้องผ่าน parser+validator ของส่วนนั้น** ทั้งตอนบันทึกและตอนอ่าน
 * 3. **"ใช้ชุดนี้" เขียนทับเฉพาะฉบับร่าง** — ฉบับเผยแพร่ (ของเก่า) ต้องไม่ถูกแตะ
 * 4. **ลบ = เข้าถังขยะกลาง** ไม่มีทางลบถาวรจากหน้าจอพรีเซ็ต
 * 5. **ไม่มีข้อความตายตัวในพจนานุกรม** (เพดาน/ความยาวชื่อมาจากค่ากลาง)
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/* ── 1) ชนิดของส่วน ─────────────────────────────────────────────────────────── */

test("chrome-preset: มีสามส่วนตามที่ผู้ใช้สั่ง และค่าขยะไม่ผ่าน", () => {
  assert.deepEqual([...CHROME_PRESET_KINDS], ["navbar", "footer", "mourning"], "สามส่วน: แถบเมนู · ท้ายเว็บ · ป้ายประกาศ");

  assert.equal(isChromePresetKind("navbar"), true);
  assert.equal(isChromePresetKind("footer"), true);
  assert.equal(isChromePresetKind("mourning"), true);

  for (const bad of ["", "page", "navbar; drop table chrome_preset", "NAVBAR", "home"]) {
    assert.equal(isChromePresetKind(bad), false, `"${bad}" ต้องไม่ผ่าน`);
  }
});

test("chrome-preset: คีย์ของแถวในฐานข้อมูลมาจากค่าคงที่ของแต่ละส่วน (ไม่พิมพ์ซ้ำ)", () => {
  assert.equal(chromePresetPageKey("navbar"), NAVBAR_PAGE_KEY);
  assert.equal(chromePresetPageKey("footer"), FOOTER_PAGE_KEY);
  assert.equal(chromePresetPageKey("mourning"), MOURNING_PAGE_KEY);

  const keys = CHROME_PRESET_KINDS.map((kind) => chromePresetPageKey(kind));
  assert.equal(new Set(keys).size, keys.length, "แต่ละส่วนต้องคนละคีย์ (ไม่ทับกัน)");

  /* ต้องเป็นค่าที่มีจริงในโค้ดของส่วนนั้น ๆ — ไม่ใช่สตริงที่พิมพ์ขึ้นใหม่ */
  for (const kind of CHROME_PRESET_KINDS) {
    const source = sourceOf("lib/chrome/presets.ts");
    assert.ok(
      !source.includes(`= "${chromePresetPageKey(kind)}"`),
      `ห้ามกำหนดคีย์ของ "${kind}" ขึ้นใหม่ในไฟล์พรีเซ็ต — ต้อง import จากของส่วนนั้น`,
    );
  }
});

/* ── 2) ชื่อชุด ──────────────────────────────────────────────────────────────── */

test("chrome-preset: ชื่อชุดใช้กติกาเดียวกับพรีเซ็ตบล็อก", () => {
  assert.equal(normalizeChromePresetName("  แถบเมนู   งานปีใหม่ "), "แถบเมนู งานปีใหม่");
  assert.equal(normalizeChromePresetName("   "), null, "ชื่อว่าง = ใช้ไม่ได้");
  assert.equal(normalizeChromePresetName(""), null);

  const long = "ก".repeat(MAX_CHROME_PRESET_NAME_LENGTH + 50);
  assert.equal(normalizeChromePresetName(long)?.length, MAX_CHROME_PRESET_NAME_LENGTH, "ยาวเกิน = ตัดให้พอดี");

  assert.ok(newChromePresetId().length >= 8, "รหัสชุดต้องมีพอให้ไม่ชนกัน");
  assert.notEqual(newChromePresetId(), newChromePresetId());
});

/* ── 3) อ่าน/ตรวจ payload ───────────────────────────────────────────────────── */

test("chrome-preset: อ่านชุดที่ถูกต้องได้ทุกส่วน และค่าขยะถูกปฏิเสธ", () => {
  for (const kind of CHROME_PRESET_KINDS) {
    const parsed = parseChromePresetPayload(kind, defaultChromePresetPayload(kind, th).config, th);
    assert.ok(parsed !== null, `${kind}: ค่าเริ่มต้นต้องอ่านได้`);
    assert.equal(parsed.kind, kind);
    assert.deepEqual(validateChromePresetConfig(parsed), [], `${kind}: ค่าเริ่มต้นต้องไม่มี error`);

    /* ค่าที่ไม่ใช่ "ก้อนข้อมูล" เลย = ปฏิเสธทุกส่วน */
    for (const bad of [null, undefined, 42, "x", [], true]) {
      assert.equal(parseChromePresetPayload(kind, bad, th), null, `${kind}: ค่าที่ไม่ใช่ก้อนข้อมูลต้องถูกปฏิเสธ`);
    }

    /*
      ก้อนข้อมูลที่ "มีบางฟิลด์" = parser ของส่วนนั้นเติมค่าที่เหลือให้ (เจตนา — ฟิลด์ที่หายไปใช้ค่าเริ่มต้น)
      ⇒ ต้องได้ชุดที่ใช้ได้ ไม่ใช่ null และต้องไม่มี error
    */
    const lenient = parseChromePresetPayload(kind, {}, th);
    assert.ok(lenient !== null, `${kind}: ก้อนข้อมูลว่างต้องถูกเติมค่าเริ่มต้นให้`);
    assert.deepEqual(validateChromePresetConfig(lenient), [], `${kind}: ชุดที่เติมค่าเริ่มต้นแล้วต้องไม่มี error`);
  }
});

test("chrome-preset: ชุดที่มี error ถูกปฏิเสธ (ไม่เก็บของเสียลงคลัง)", () => {
  const broken = defaultNavbarConfig(th);
  const withBadItem = { ...broken, items: broken.items.map((item, index) => (index === 0 ? { ...item, label: { th: "", en: "" } } : item)) };

  assert.ok(navbarErrorsOf(validateNavbarConfig(withBadItem)).length > 0, "ชุดตัวอย่างต้องมี error จริง");
  assert.equal(parseChromePresetPayload("navbar", withBadItem, th), null, "ชุดที่มี error ต้องไม่ผ่าน");
});

test("chrome-preset: ตัวเลขสรุปของแต่ละส่วนอ่านจากชุดจริง", () => {
  const navbar = chromePresetCounts(defaultChromePresetPayload("navbar", th));
  const footer = chromePresetCounts(defaultChromePresetPayload("footer", th));
  const mourning = chromePresetCounts(defaultChromePresetPayload("mourning", th));

  assert.equal(navbar.primary, defaultNavbarConfig(th).items.length);
  assert.equal(navbar.secondary, defaultNavbarConfig(th).buttons.length);
  assert.equal(navbar.enabled, null, "แถบเมนูไม่มีแนวคิดเปิด/ปิด");

  assert.equal(footer.primary, defaultFooterConfig(th).groups.length);
  assert.equal(footer.secondary, defaultFooterConfig(th).socials.length);

  assert.equal(mourning.primary, defaultMourningConfig(th).images.length);
  assert.equal(mourning.enabled, defaultMourningConfig(th).enabled, "ป้ายประกาศต้องบอกว่าตัวป้ายเปิดอยู่ไหม");
});

test("chrome-preset: เพดานจำนวนชุดต่อส่วน", () => {
  assert.ok(MAX_CHROME_PRESETS_PER_KIND >= 1);
  assert.equal(chromePresetsAreFull(0), false);
  assert.equal(chromePresetsAreFull(MAX_CHROME_PRESETS_PER_KIND - 1), false);
  assert.equal(chromePresetsAreFull(MAX_CHROME_PRESETS_PER_KIND), true);
});

/* ── 4) ชั้นฐานข้อมูล ───────────────────────────────────────────────────────── */

test("chrome-preset: บันทึกเป็นชื่อเดียวกันในชนิดเดียวกัน = เขียนทับ และกู้คืนจากถังอัตโนมัติ", () => {
  const repo = sourceOf("lib/chrome/preset-repository.ts");

  assert.ok(repo.includes("on conflict (kind, lower(name)) do update set"), "ชนกันที่ (kind, ชื่อไม่สนตัวพิมพ์) = ทับ");
  assert.ok(repo.includes("deleted_at = null"), "ทับชื่อเดิมต้องล้างสถานะถังขยะ (กู้คืนอัตโนมัติ)");
  assert.ok(repo.includes("deleted_at is null"), "รายการที่ใช้งานต้องไม่รวมของในถัง");
  assert.ok(repo.includes("normalizeChromePresetName"), "ต้องใช้กติกาชื่อจากค่ากลาง");
  assert.ok(repo.includes("chromePresetsAreFull"), "ต้องกันคลังบวมไม่จำกัด");
});

test("chrome-preset: ใช้ชุดนี้เขียนทับเฉพาะฉบับร่าง ไม่แตะฉบับเผยแพร่", () => {
  const repo = sourceOf("lib/chrome/preset-repository.ts");

  assert.ok(repo.includes("saveJsonDraft(pageKey"), "ต้องเขียนผ่าน saveJsonDraft ของแถว draft");
  assert.ok(!repo.includes("publishDraft"), "ห้ามเผยแพร่ให้เอง — ผู้ใช้ต้องกดเอง");
  assert.ok(!/update page_document[^`]*published/.test(repo), "ห้ามเขียนทับแถว published");
  assert.ok(repo.includes('input.messages'), "ต้องตรวจ payload ด้วยพจนานุกรมของภาษาที่แสดง");
});

test("chrome-preset: ลบชุดไปที่ถังขยะกลาง (ไม่มีทางลบถาวรจากหน้าจอพรีเซ็ต)", () => {
  const repo = sourceOf("lib/chrome/preset-repository.ts");
  assert.ok(!repo.includes("delete from chrome_preset"), "ห้ามมีคำสั่งลบถาวรในชั้นพรีเซ็ต");

  const trash = sourceOf("lib/trash/repository.ts");
  assert.ok(trash.includes("trashChromePreset"), "ต้องมีตัวย้ายเข้าถังของพรีเซ็ตส่วนกลาง");
  assert.ok(trash.includes('chromePreset: "chrome_preset"'), "ตารางต้องมาจากค่าคงที่ TABLES");
  assert.ok(TRASH_KINDS.includes("chromePreset"), "ชนิดต้องอยู่ในรายการกลางของถังขยะ");
  assert.equal(isTrashKind("chromePreset"), true);

  const counts = emptyTrashCounts();
  assert.ok(Object.hasOwn(counts, "chromePreset"), "ยอดนับต้องมีชนิดใหม่");
  assert.equal(trashTotal(counts), 0);

  const trashPage = sourceOf("app/admin/trash/page.tsx");
  assert.ok(trashPage.includes("trashKindChromePreset"), "หน้าถังขยะต้องมีป้ายชื่อชนิดนี้");
});

test("chrome-preset: ด่าน DB ต้องพิสูจน์วงจรพรีเซ็ตส่วนกลาง", () => {
  const checkDb = sourceOf("scripts/check-db.ts");
  assert.ok(checkDb.includes("checkChromePresets"), "check:db ต้องมีด่านนี้");
  assert.ok(checkDb.includes("chrome_preset"), "ต้องล้างรอยทดสอบในตาราง chrome_preset");
});

/* ── 5) สิทธิ์ · หน้าจอ · พจนานุกรม ──────────────────────────────────────────── */

test("chrome-preset: ทุก action ตรวจสิทธิ์ และตรวจชนิดของส่วน", () => {
  const actions = sourceOf("app/admin/builder/chrome/preset-actions.ts");

  const exported = actions.match(/export async function/g) ?? [];
  const required = actions.match(/await requireAdminUser\("[a-z]+"\)/g) ?? [];
  assert.equal(exported.length, 5, "ต้องมี 5 action (บันทึก · ใช้ชุด · ย้อนกลับ · ลบ · นำเข้าชุด)");
  assert.equal(required.length, exported.length, "ทุก action ต้องตรวจสิทธิ์ก่อนทำงาน");

  assert.ok(actions.includes("isChromePresetKind(kind)"), "ต้องตรวจชนิดของส่วน");
  assert.ok(actions.includes("trashChromePreset("), "ลบต้องผ่านถังขยะ");
  assert.ok(actions.includes("revalidatePath(CHROME_PATH)"), "ต้องรีเฟรชหน้าจอหลังแก้");
});

test("chrome-preset: แผงที่เรนเดอร์ฝั่งเบราว์เซอร์ต้องไม่ดึงชั้นฐานข้อมูลเข้ามา", () => {
  const panel = sourceOf("features/admin/ui/chrome-preset-panel.tsx");

  assert.ok(panel.startsWith('"use client"'), "ต้องเป็น client component");
  assert.ok(!panel.includes("preset-repository"), "client ห้าม import ชั้น DB");
  assert.ok(!panel.includes("@/db/pool"), "client ห้าม import pool");
  assert.ok(panel.includes("preset-actions"), "ต้องเรียกผ่าน Server Action เท่านั้น");
});

test("chrome-preset: หน้าจอแสดงครบทั้งสามส่วน (ของเก่า/ของใหม่/พรีเซ็ต)", () => {
  const page = sourceOf("app/admin/builder/chrome/page.tsx");

  assert.ok(page.includes("listChromePresets("), "หน้าจอต้องอ่านคลังชุด");
  assert.ok(page.includes('kind="navbar"') && page.includes('kind="footer"') && page.includes('kind="mourning"'), "ต้องมีสามช่อง");
  assert.ok(page.includes("chromePresetSourcePublished"), "ต้องเลือกเก็บจากของเก่า (ฉบับเผยแพร่) ได้");
  assert.ok(page.includes("chromePresetSourceDraft"), "ต้องเลือกเก็บจากของใหม่ (ฉบับร่าง) ได้");
  assert.ok(page.includes("MAX_CHROME_PRESETS_PER_KIND"), "เพดานต้องมาจากค่ากลาง");
});

test("chrome-preset: พจนานุกรมสองภาษาใช้ตัวเติม ไม่พิมพ์ตัวเลขเอง", () => {
  for (const locale of ["th", "en"]) {
    const area = sourceOf(`lib/i18n/messages/areas/${locale}/adminChromePreset.ts`);
    assert.ok(!area.includes(String(MAX_CHROME_PRESETS_PER_KIND)), `${locale}: ห้ามพิมพ์เพดาน`);
    assert.ok(!area.includes(String(MAX_CHROME_PRESET_NAME_LENGTH)), `${locale}: ห้ามพิมพ์ความยาวชื่อ`);
    assert.ok(area.includes("{max}"), `${locale}: ต้องใช้ตัวเติม {max}`);
    assert.ok(area.includes("{time}"), `${locale}: ต้องใช้ตัวเติม {time}`);
  }
});

test("chrome-preset: migration ใหม่ idempotent และมี guard ครบ", () => {
  const migration = sourceOf("db/migrations/0010-chrome-preset.sql");

  assert.ok(migration.includes("create table if not exists chrome_preset"), "ต้องสร้างตารางแบบ idempotent");
  assert.ok(migration.includes("check (kind in ('navbar', 'footer', 'mourning'))"), "ต้องกันค่า kind นอกเหนือรายการที่ชั้น DB ด้วย");
  assert.ok(migration.includes("unique index if not exists chrome_preset_kind_name_key"), "ชื่อซ้ำในชนิดเดียวกันต้องชนกันได้");
  assert.ok(migration.includes("(kind, lower(name))"), "ต้องไม่สนตัวพิมพ์");
  assert.ok(migration.includes("deleted_at"), "ต้องเข้ากับถังขยะกลาง");
});

/* ── 6) ปิดหนี้รอบที่ 81: "ภาพถูกใช้ที่ไหน" ต้องเห็นพรีเซ็ตของส่วนกลางด้วย ──────── */

test("chrome-preset: ภาพที่พรีเซ็ตของส่วนกลางอ้างถึงต้องถูกนับเป็น 'ใช้งานอยู่'", () => {
  const repo = sourceOf("lib/media/repository.ts");

  assert.ok(repo.includes("from chrome_preset"), "findMediaUsage ต้องเดินดู chrome_preset ด้วย");
  assert.ok(repo.includes("from block_preset"), "และต้องเดินดู block_preset ด้วย");
  assert.ok(repo.includes('kind: "chrome-preset"'), "ต้องรายงานชนิด chrome-preset");
  assert.ok(repo.includes('kind: "block-preset"'), "ต้องรายงานชนิด block-preset");
  assert.ok(repo.includes("deleted_at is not null as in_trash"), "ต้องเห็นของในถังด้วย (บอกได้ว่าต้องกู้คืนก่อน)");
  assert.ok(repo.includes("payload::text like"), "ตรวจจาก payload ของพรีเซ็ตส่วนกลาง");
});

test("chrome-preset: ป้ายชื่อชนิดการใช้งานในคลังภาพมีครบ (สองภาษา)", () => {
  for (const locale of ["th", "en"]) {
    const area = sourceOf(`lib/i18n/messages/areas/${locale}/adminMedia.ts`);
    assert.ok(area.includes("mediaUsageBlockPreset"), `${locale}: ขาดป้ายพรีเซ็ตบล็อก`);
    assert.ok(area.includes("mediaUsageChromePreset"), `${locale}: ขาดป้ายพรีเซ็ตส่วนกลาง`);
    assert.ok(area.includes("mediaUsageSeo"), `${locale}: ขาดป้ายงาน SEO`);
  }

  const page = sourceOf("app/admin/media/page.tsx");
  for (const kind of ["document", "og-image", "favicon", "block-preset", "chrome-preset"]) {
    assert.ok(page.includes(`case "${kind}"`), `หน้าคลังภาพต้องมีป้ายของชนิด ${kind}`);
  }
});

/* ── 7) ปิดหนี้รอบที่ 81: ย้อนกลับหลังใช้ชุด ─────────────────────────────────── */

test("chrome-preset: ใช้ชุดแล้วต้องเก็บฉบับร่างเดิมไว้ให้ย้อนกลับ", () => {
  const repo = sourceOf("lib/chrome/preset-repository.ts");

  assert.ok(repo.includes("insert into chrome_draft_undo"), "ต้องบันทึกฉบับร่างก่อนใช้ชุด");
  assert.ok(repo.includes("on conflict (page) do update set"), "หนึ่งส่วน = หนึ่งแถว (ไม่โตตามการใช้งาน)");
  assert.ok(repo.includes("export async function undoChromePreset"), "ต้องมีฟังก์ชันย้อนกลับ");
  assert.ok(repo.includes("delete from chrome_draft_undo where page = $1"), "ย้อนสำเร็จแล้วลบข้อมูลย้อนกลับ");
  assert.ok(repo.includes("parseChromePresetPayload(input.kind, row.payload"), "ต้องตรวจรูปทรงก่อนเขียนกลับ");
  assert.ok(repo.includes('action: "chrome-preset-undo"'), "ต้องลง audit");

  const actions = sourceOf("app/admin/builder/chrome/preset-actions.ts");
  assert.ok(actions.includes("undoChromePresetAction"), "ต้องมี Server Action ของการย้อนกลับ");
  assert.ok(actions.includes("isChromePresetKind(kind)"), "ตรวจชนิดของส่วนก่อนทำงาน");
  /* X1.10: ทุก action ต้องระบุสิทธิ์ ("presets") ไม่ใช่แค่ตรวจว่าล็อกอิน
     (รอบที่ 91 เพิ่ม "นำเข้าชุด" ⇒ 5 action) */
  assert.equal(
    actions.split('requireAdminUser("presets")').length - 1,
    5,
    "action ทั้ง 5 ของพรีเซ็ตส่วนกลางต้องใช้สิทธิ์ presets",
  );

  const panel = sourceOf("features/admin/ui/chrome-preset-panel.tsx");
  assert.ok(panel.includes("undoChromePresetAction"), "แผงต้องเรียก action ย้อนกลับ");
  assert.ok(panel.includes("chromePresetUndoHint"), "ต้องบอกว่าย้อนกลับได้ครั้งเดียว/ไม่แตะเว็บจริง");

  const migration = sourceOf("db/migrations/0011-chrome-draft-undo.sql");
  assert.ok(migration.includes("create table if not exists chrome_draft_undo"), "ตารางต้อง idempotent");
  assert.ok(migration.includes("page        text        primary key"), "หนึ่งส่วน = หนึ่งแถว");
});

/* ── 8) แท็บของ "ส่วนกลาง" เก็บใน URL (รอบที่ 178) ────────────────────────────────
 *
 * ฟีดแบ็กเจ้าของ: *"ส่วนกลางของเว็บยังไม่มีการเซฟสเตท ทำแท็บไหน รีเฟรชควรยังเป็นแท็บนั้นต่อ
 *   เช่นเลือกป้ายประกาศไว้ แล้วอยากดูตัวอย่างการประกาศ พอรีเฟรชมันเด้งกลับไปแถบเมนูก่อน"*
 * ⇒ แท็บ (part) + มุมมอง (mode) ต้องอยู่ใน query string และ **ต้องไม่ถูกทับตอน mount**
 */

test("chrome-tabs: chromeTabOf อ่านค่าจาก URL และถอยค่าเริ่มต้นเมื่อค่าใช้ไม่ได้", () => {
  assert.deepEqual(chromeTabOf({}), { part: "navbar", mode: "draft" }, "ไม่ส่งค่ามา = ค่าเริ่มต้นเดิม (ไม่เปลี่ยนพฤติกรรมเก่า)");
  assert.deepEqual(chromeTabOf({ part: "notice" }), { part: "notice", mode: "draft" });
  assert.deepEqual(chromeTabOf({ mode: "overview" }), { part: "navbar", mode: "overview" });
  assert.deepEqual(chromeTabOf({ part: "footer", mode: "current" }), { part: "footer", mode: "current" });

  /* ค่าที่ไม่รู้จัก/พิมพ์ผิด/มีช่องว่าง/พยายามยัด payload → ค่าเริ่มต้น (ห้าม throw) */
  for (const bad of ["", " ", "NOTICE", "nav", "navbarx", "notice;drop", "<script>", "١٢٣"]) {
    assert.equal(isChromePart(bad), false, `part "${bad}" ต้องไม่ผ่าน`);
    const state = chromeTabOf({ part: bad });
    assert.deepEqual(state, { part: "navbar", mode: "draft" }, `part "${bad}" ต้องถอยไปค่าเริ่มต้น`);
  }
  for (const bad of ["", "draft ", "DRAFT", "preview", "overview;drop"]) {
    assert.equal(isChromeMode(bad), false, `mode "${bad}" ต้องไม่ผ่าน`);
    assert.deepEqual(chromeTabOf({ mode: bad }), { part: "navbar", mode: "draft" }, `mode "${bad}" ต้องถอยไปค่าเริ่มต้น`);
  }

  /* ตัวตรวจเดี่ยว ๆ ต้องตรงกับรายการจริง */
  for (const part of ["navbar", "notice", "footer"]) assert.equal(isChromePart(part), true);
  for (const mode of ["current", "draft", "overview"]) assert.equal(isChromeMode(mode), true);
  /* ค่าที่มีช่องว่างหัว-ท้าย: ตัวอ่าน URL ตัดให้ (URL ที่คัดลอกมามักติดช่องว่าง) แต่ตัวตรวจดิบเข้มกว่า */
  assert.equal(isChromePart("  notice"), false, "ตัวตรวจดิบไม่ตัดช่องว่างให้");
  assert.deepEqual(chromeTabOf({ part: "  notice  " }), { part: "notice", mode: "draft" }, "chromeTabOf ตัดช่องว่างก่อนตรวจ");
  assert.deepEqual(chromeTabOf({ mode: " overview " }), { part: "navbar", mode: "overview" });

  assert.equal(isChromePart("current"), false, "ค่าของอีกแกนต้องไม่ผ่าน");
  assert.equal(isChromeMode("footer"), false);
});

test("chrome-tabs: chromeTabHref ใส่เฉพาะค่าที่ไม่ใช่ค่าเริ่มต้น + ไป-กลับได้ (round-trip)", () => {
  assert.equal(chromeTabHref({ part: "navbar", mode: "draft" }), CHROME_WORKSPACE_PATH, "ค่าเริ่มต้น = URL เปล่า");
  assert.equal(chromeTabHref({ part: "notice", mode: "draft" }), `${CHROME_WORKSPACE_PATH}?part=notice`);
  assert.equal(chromeTabHref({ part: "navbar", mode: "overview" }), `${CHROME_WORKSPACE_PATH}?mode=overview`);
  assert.equal(
    chromeTabHref({ part: "footer", mode: "overview" }),
    `${CHROME_WORKSPACE_PATH}?part=footer&mode=overview`,
    "ลำดับพารามิเตอร์ต้องคงที่ (part ก่อน mode)",
  );
  assert.equal(
    chromeTabHref({ part: "notice", mode: "overview" }, "/admin/other"),
    "/admin/other?part=notice&mode=overview",
    "ใช้ base อื่นได้ (หน้าจอ/เทสต์)",
  );

  /* round-trip: สร้าง URL แล้วอ่านกลับต้องได้สถานะเดิมทุกชุด */
  const states: ChromeTabState[] = [];
  for (const part of ["navbar", "notice", "footer"] as const) {
    for (const mode of ["current", "draft", "overview"] as const) states.push({ part, mode });
  }
  for (const state of states) {
    const href = chromeTabHref(state);
    const query = new URLSearchParams(href.split("?")[1] ?? "");
    assert.deepEqual(
      chromeTabOf({ part: query.get("part") ?? undefined, mode: query.get("mode") ?? undefined }),
      state,
      `ไป-กลับต้องได้ค่าเดิม (${state.part}/${state.mode})`,
    );
  }
});

test("chrome-tabs: หน้าจอต่อสายจริง — ค่าเริ่มต้นจาก URL และไม่รีเซ็ตแท็บตอน mount", () => {
  const page = sourceOf("app/admin/builder/chrome/page.tsx");
  assert.ok(page.includes("searchParams"), "หน้าเซิร์ฟเวอร์ต้องอ่าน searchParams (ไม่งั้นรีเฟรชแล้วค่าไม่กลับมา)");
  assert.ok(page.includes("chromeTabOf(query)"), "ต้องแปลงด้วยตัวช่วยกลาง (ไม่ตีความเอง)");
  assert.ok(
    page.includes("initialPart={initialTab.part}") && page.includes("initialMode={initialTab.mode}"),
    "ต้องส่งค่าเริ่มต้นเข้าเวิร์กสเปซ",
  );

  const client = sourceOf("features/admin/ui/chrome-workspace.tsx");
  assert.ok(client.includes("useState<ChromePart>(initialPart)"), "ต้องเริ่มจากค่าที่รับมา (ห้าม hardcode \"navbar\")");
  assert.ok(client.includes("useState<ChromeMode>(initialMode)"), "ต้องเริ่มจากค่าที่รับมา (ห้าม hardcode \"draft\")");
  assert.ok(client.includes("window.history.replaceState(null, \"\", chromeTabHref(next))"), "สลับแท็บต้องอัปเดต URL");

  /* กันถอยหลัง: เขียน URL/เซ็ตแท็บได้จาก handler เท่านั้น (ถ้าใส่ใน useEffect ค่าจาก URL จะถูกทับตอน mount) */
  assert.equal(client.match(/window\.history\.replaceState\(/g)?.length, 1, "ต้องเขียน URL ที่จุดเดียว (ใน syncTabUrl)");
  assert.equal(client.match(/setPart\(/g)?.length, 1, "ต้องเซ็ต part ที่จุดเดียว (ใน selectPart)");
  assert.equal(client.match(/setMode\(/g)?.length, 1, "ต้องเซ็ต mode ที่จุดเดียว (ใน selectMode)");
  for (const hook of ["selectPart", "selectMode"]) {
    assert.ok(client.includes(`onClick={() => ${hook}(`), `ปุ่มแท็บต้องเรียก ${hook}`);
  }

  /* สถานะที่เลือกต้องบอกให้โปรแกรมอ่านรู้ด้วย (a11y) */
  assert.ok(client.includes('aria-current={part === entry.key ? "true" : undefined}'), "แท็บที่เลือกต้องมี aria-current");
  assert.ok(client.includes("aria-pressed={mode === entry.key}"), "ปุ่มมุมมองต้องมี aria-pressed");
});

/* ── 9) พรีวิว "เฉพาะส่วน": ป้ายประกาศต้องไม่เด้งกวนในโหมดที่ไม่ใช่ notice (รอบที่ 179) ──
 *
 * ฟีดแบ็กเจ้าของ: *"การตั้งค่าหน้าส่วนของท้ายเว็บ ตอนนี้มีหน้าประกาศเด้งมากวน
 *   ใช้ลักษณะเดียวกับส่วนเมนูที่ เวลาเข้าไปจัดการตั้งค่า ไม่มีป้ายประกาศกวน"*
 * ต้นเหตุจริง: กฎซ่อนป้ายของโหมด `footer` ไม่มี `html` นำหน้า ⇒ ความจำเพาะ (0,2,0)
 *   ⇒ **แพ้** กฎเปิดป้าย `html[data-mourning="shown"] [data-mourning-notice]` (0,2,1) ⇒ ป้ายเด้งทับพรีวิว
 *   (บทเรียนเดียวกับที่แก้ไว้ให้ `nav` ตั้งแต่รอบที่ 58 — รอบนี้ทำเป็นด่านกันถอยหลังทุกโหมด)
 */

test("chrome-preview: ทุกโหมดพรีวิวที่ไม่ใช่ notice ต้องซ่อนป้ายประกาศ (ความจำเพาะเท่ากฎเปิด)", async () => {
  const css = await readStrippedCss();

  /* ⚠️ ชื่อในพรีวิวไม่เหมือนชื่อแท็บ (`navbar` → `nav`) — ใช้รายการกลางจาก lib เพื่อไม่ให้ลืมโหมดใหม่ */
  const preview = sourceOf("app/[lang]/preview/[page]/page.tsx");
  for (const part of PREVIEW_PARTS_WITHOUT_NOTICE) {
    /* ต้องมี `html` นำหน้า (0,2,1) — และดักทั้งสถานะ "ยังไม่เด้ง" กับ "เด้งแล้ว" */
    assert.ok(
      css.includes(`html[data-preview-parts="${part}"] [data-mourning-notice]`),
      `โหมด ${part} ต้องซ่อนป้ายประกาศ (มี html นำหน้า)`,
    );
    assert.ok(
      css.includes(`html[data-preview-parts="${part}"] html[data-mourning="shown"] [data-mourning-notice]`),
      `โหมด ${part} ต้องซ่อนป้ายแม้ถูกเปิดแล้ว (data-mourning="shown") — ไม่งั้นป้ายเด้งทับพรีวิว`,
    );
  }

  /* ห้ามเหลือกฎแบบไม่นำหน้า `html` (คือตัวบั๊กเดิม) — เฉพาะบรรทัดที่เป็น selector ต้นบรรทัด */
  const stripped = css
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("[data-preview-parts=") && line.includes("[data-mourning-notice]"));
  assert.deepEqual(stripped, [], "ห้ามมีกฎซ่อนป้ายที่ไม่มี `html` นำหน้า (แพ้กฎเปิด ⇒ ป้ายเด้ง)");

  /* โหมด notice ต้อง "ไม่" ซ่อนป้าย (ตรงข้าม) */
  assert.ok(
    !css.includes('html[data-preview-parts="notice"] [data-mourning-notice]'),
    "โหมด notice ต้องเห็นป้ายประกาศ (ห้ามซ่อน)",
  );

  /* หน้าพรีวิวต้องรองรับทุกชื่อโหมดจริง (ค่าเพี้ยน = ไม่มีอะไรถูกซ่อน) */
  for (const part of PREVIEW_PARTS_WITHOUT_NOTICE) {
    assert.ok(preview.includes(`query.parts === "${part}"`), `หน้าพรีวิวต้องรองรับ parts=${part}`);
  }

  /* จำนวนโหมดใน CSS ต้องครบตามชนิดจริง — เพิ่มโหมดใหม่แล้วลืมใส่กฎ = แดงทันที */
  const covered = PREVIEW_PARTS_WITHOUT_NOTICE.filter((part) =>
    css.includes(`html[data-preview-parts="${part}"] html[data-mourning="shown"] [data-mourning-notice]`),
  );
  assert.equal(covered.length, PREVIEW_PARTS_WITHOUT_NOTICE.length, "ต้องมีกฎครบทุกโหมดที่ไม่ใช่ notice");
});
