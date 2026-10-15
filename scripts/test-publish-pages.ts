import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { codeOf } from "./source-scan.ts";

import {
  PUBLISH_CLI_ACTOR,
  PUBLISH_CLI_NOTE,
  blockedHint,
  parsePageList,
  planPagePublish,
} from "@/lib/blocks/publish-plan";
import { TEMPLATE_IMAGE_PAGES, needsAboutTemplateImages } from "@/lib/blocks/template-images";

/**
 * เทสต์รอบที่ 287 — **ตัวเผยแพร่หน้าเว็บผ่าน CLI** (`npm run pages:publish`)
 *
 * ที่มา (คำเจ้าของ 2026-10-15): *"หน้าบริษัทกับหน้าใบรับรองมาตรฐานใน vercel ยังไม่เปลี่ยน"*
 * ⇒ หน้าเว็บขึ้นจาก DB เมื่อมี **ฉบับเผยแพร่ + `is_live`** แต่บนคลาวด์มีแค่ฉบับร่าง/ไม่มีเอกสารเลย
 *    และการกดเผยแพร่เป็น Server Action ⇒ ไม่มีทางสั่งจาก CLI มาก่อน
 *
 * เทสต์นี้ล็อก "กติกาความปลอดภัย" ของเครื่องมือนี้ไว้:
 *   1. **ห้ามทับงานคน** — สร้างจากเทมเพลตเฉพาะเมื่อไม่มีฉบับร่าง
 *   2. **ไม่เดาเนื้อหาให้** — ไม่มีฉบับร่าง + ไม่ได้สั่ง `--from-template` ⇒ หยุดพร้อมบอกทางแก้
 *   3. **ต้องเขียนผ่าน repository ตัวเดียวกับปุ่ม** (ห้าม SQL เขียนเองในสคริปต์)
 *   4. `--pages=` ไม่มีค่าเริ่มต้น (กันการเผยแพร่ทั้งเว็บโดยไม่ได้ตั้งใจ)
 */

test("planPagePublish: มีฉบับร่างอยู่แล้ว = เผยแพร่ฉบับร่างเสมอ (ไม่ทับด้วยเทมเพลต)", () => {
  assert.deepEqual(planPagePublish({ page: "about", hasDraft: true, hasTemplate: false, fromTemplate: true }), {
    kind: "publish",
    source: "draft",
    page: "about",
  });
  assert.deepEqual(planPagePublish({ page: "certifications", hasDraft: true, hasTemplate: true, fromTemplate: true }), {
    kind: "publish",
    source: "draft",
    page: "certifications",
  });
});

test("planPagePublish: ไม่มีฉบับร่าง + สั่ง --from-template + มีเทมเพลต = สร้างจากเทมเพลต", () => {
  assert.deepEqual(
    planPagePublish({ page: "certifications", hasDraft: false, hasTemplate: true, fromTemplate: true }),
    { kind: "publish", source: "template", page: "certifications" },
  );
});

test("planPagePublish: ไม่มีฉบับร่าง + ไม่ได้สั่ง --from-template = หยุด (ไม่เดาเนื้อหาให้)", () => {
  assert.deepEqual(planPagePublish({ page: "certifications", hasDraft: false, hasTemplate: true, fromTemplate: false }), {
    kind: "blocked",
    reason: "no-draft",
    page: "certifications",
  });
});

test("planPagePublish: ไม่มีเทมเพลต (เช่น about ที่มาจากตัวนำเข้า) = CLI สร้างให้ไม่ได้", () => {
  assert.deepEqual(planPagePublish({ page: "about", hasDraft: false, hasTemplate: false, fromTemplate: true }), {
    kind: "blocked",
    reason: "no-template",
    page: "about",
  });
});

test("parsePageList: ตัดช่องว่าง/ไม่ซ้ำ · ปฏิเสธค่าที่ไม่ใช่รหัสหน้า", () => {
  assert.deepEqual(parsePageList(" about , certifications , about "), {
    pages: ["about", "certifications"],
    invalid: [],
  });
  /* หน้าตัวสร้างของหมวดสินค้าใช้รูปทรง `product-<รหัส>` ⇒ ต้องผ่าน */
  assert.deepEqual(parsePageList("product-instant-noodles"), { pages: ["product-instant-noodles"], invalid: [] });
  const bad = parsePageList("About,nope,about/../x,,x y,product-");
  assert.deepEqual(bad.pages, []);
  assert.deepEqual(bad.invalid, ["About", "nope", "about/../x", "x y", "product-"]);
  assert.deepEqual(parsePageList(""), { pages: [], invalid: [] });
});

test("ค่าคงที่ผู้กระทำ/หมายเหตุ + คำใบ้ทางแก้ อยู่ที่เดียว", () => {
  assert.equal(PUBLISH_CLI_ACTOR, "cli-publish");
  assert.equal(PUBLISH_CLI_NOTE, "cli-publish");
  assert.ok(blockedHint("no-draft").includes("--from-template"));
  assert.ok(blockedHint("no-template").includes("ตัวนำเข้า"));
});

test("เทมเพลตที่ต้องใช้ภาพจากคลัง = certifications · executives (ไม่ใช่ about/home)", () => {
  assert.deepEqual([...TEMPLATE_IMAGE_PAGES], ["certifications", "executives"]);
  assert.equal(needsAboutTemplateImages("certifications"), true);
  assert.equal(needsAboutTemplateImages("executives"), true);
  assert.equal(needsAboutTemplateImages("about"), false);
  assert.equal(needsAboutTemplateImages("home"), false);
});

test("ตัวช่วยหาภาพจากคลังมีที่เดียว — หลังบ้านต้อง import ไม่ใช่ประกาศซ้ำ", () => {
  const actions = codeOf("app/admin/builder/actions.ts");
  assert.ok(actions.includes('from "@/lib/blocks/template-images"'), "actions ต้องใช้ตัวช่วยกลาง");
  assert.ok(
    !actions.includes("async function aboutTemplateImageResolver"),
    "ห้ามประกาศตัวช่วยซ้ำในไฟล์ action (round 287 ย้ายไป lib/blocks/template-images.ts)",
  );

  const shared = codeOf("lib/blocks/template-images.ts");
  assert.ok(shared.includes("export async function aboutTemplateImageResolver"), "ตัวช่วยกลางต้องมีจริง");
  assert.ok(shared.includes("aboutImagePath("), "ต้องใช้ตรรกะ fallback ไป public/ ตัวเดิม");
});

test("สคริปต์ CLI: ใช้เส้นทางเดียวกับปุ่ม (publishDraft/setPageLive) + ห้ามเขียน SQL เอง", () => {
  const script = codeOf("scripts/publish-pages.ts");
  for (const call of ["planPagePublish(", "publishDraft(", "setPageLive(", "saveDraft(", "prepareTargetRun("]) {
    assert.ok(script.includes(call), `สคริปต์ต้องเรียก ${call}`);
  }
  for (const forbidden of ["insert into page_document", "update page_document", "delete from page_document"]) {
    assert.ok(!script.includes(forbidden), `ห้ามเขียน SQL เองในสคริปต์: ${forbidden}`);
  }
  /* เทมเพลตต้องผ่าน parser + validator ก่อนเขียน (บทเรียนรอบที่ 257) */
  assert.ok(script.includes("parseBlockDocument("), "ต้องผ่าน parser");
  assert.ok(script.includes("validateDocument("), "ต้องผ่าน validator");
  /* ไม่มีค่าเริ่มต้นของ --pages ⇒ ต้องบังคับระบุ */
  assert.ok(script.includes("ต้องระบุ --pages="), "ต้องบังคับให้ระบุ --pages");
  /* ไม่แตะ next/cache (สคริปต์ไม่มีบริบทของ Next) */
  assert.ok(!script.includes("revalidatePath"), "สคริปต์ CLI ห้ามเรียก revalidatePath");
});

test("ทะเบียนสคริปต์: มีคำสั่ง npm run pages:publish จริง", () => {
  const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  const command = pkg.scripts["pages:publish"];
  assert.ok(typeof command === "string", "ต้องมีสคริปต์ pages:publish");
  assert.ok(command.includes("scripts/publish-pages.ts"), "ชี้ไปที่สคริปต์ที่ถูกต้อง");
  assert.ok(command.includes("--env-file-if-exists=.env.local"), "โหลด .env.local เหมือนสคริปต์อื่น");
});
