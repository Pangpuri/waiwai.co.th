import assert from "node:assert/strict";
import { test } from "node:test";

import { MOURNING_IMAGES } from "@/features/shell/mourning";
import { th } from "@/lib/i18n/messages/th";
import {
  MAX_MOURNING_IMAGES,
  MOURNING_PAGE_KEY,
  defaultMourningConfig,
  diffMourningConfig,
  mourningErrorsOf,
  parseMourningConfig,
  validateMourningConfig,
} from "@/lib/mourning/config";

/** เทสต์ป๊อปอัพประกาศไว้อาลัย — ค่าตั้งต้นต้องเท่ากับที่หน้าเว็บใช้อยู่จริง (ผู้ใช้สั่ง รอบที่ 35) */

test("mourning: ค่าเริ่มต้นอ้างภาพชุดเดิมใน /rip/ และข้อความจากพจนานุกรม", () => {
  const config = defaultMourningConfig(th);

  assert.equal(config.enabled, true);
  assert.equal(config.images.length, MOURNING_IMAGES.length);
  assert.equal(config.images[0]?.path, MOURNING_IMAGES[0]?.src);
  assert.ok(config.images.every((image) => image.path.startsWith("/rip/")), "ค่าเริ่มต้นชี้ไปโฟลเดอร์ /rip/");
  /* รอบที่ 36 (ผู้ใช้สั่ง "เปลี่ยนเป็นรูปประกาศแทน"): คำบรรยายตั้งต้น = ว่าง ให้ตัวภาพเป็นตัวประกาศ */
  assert.deepEqual(config.caption, { th: "", en: "" }, "ค่าเริ่มต้นไม่มีคำบรรยาย");
  assert.equal(config.closeLabel.th, th.mourning.close);
  assert.equal(config.muteTodayLabel.th, th.mourning.muteToday);
  assert.equal(config.seeNextLabel.th, th.mourning.seeNext);

  assert.equal(mourningErrorsOf(validateMourningConfig(config)).length, 0, "ค่าเริ่มต้นต้องผ่านการตรวจ");
});

test("mourning: คีย์ที่เก็บในฐานข้อมูลคือ 'mourning' (ไม่ชนกับหน้าอื่น)", () => {
  assert.equal(MOURNING_PAGE_KEY, "mourning");
});

test("mourning: ปิดอยู่ = ไม่ต้องตรวจอะไร (เก็บร่างไว้ก่อนได้)", () => {
  const config = { ...defaultMourningConfig(th), enabled: false, images: [] };
  assert.equal(validateMourningConfig(config).length, 0);
});

test("mourning: เปิดอยู่ต้องมีภาพ + ป้ายปุ่มที่จำเป็น (คำบรรยายไม่บังคับ)", () => {
  const config = {
    ...defaultMourningConfig(th),
    closeLabel: { th: "", en: "" },
    muteTodayLabel: { th: "", en: "" },
    images: [],
  };

  const codes = mourningErrorsOf(validateMourningConfig(config)).map((entry) => entry.code);
  assert.equal(codes.filter((code) => code === "empty-th").length, 2, "ต้องจับข้อความไทยว่าง 2 จุด (ปุ่มปิด + ติ๊กไม่แสดงซ้ำ)");

  /* "ไม่มีภาพ" = สภาพที่บันทึกได้ (เปิดเว็บจะข้ามป้าย) → เป็นแค่คำเตือน ไม่บล็อกการบันทึก */
  const noImages = validateMourningConfig(config).filter((entry) => entry.code === "no-images");
  assert.equal(noImages.length, 1);
  assert.equal(noImages[0]?.severity, "warning", "ไม่มีภาพต้องไม่บล็อกการบันทึก");

  const emptyImages = { ...defaultMourningConfig(th), images: [] };
  assert.equal(mourningErrorsOf(validateMourningConfig(emptyImages)).length, 0, "ลบภาพทั้งหมดได้");

  /* คำบรรยายว่าง = ใช้ได้ (ใช้รูปเป็นตัวประกาศ) */
  const withoutCaption = { ...config, closeLabel: { th: "ปิด", en: "Close" }, muteTodayLabel: { th: "ไม่แสดงอีกวันนี้", en: "" }, images: [{ path: "/media/x", altTh: "ภาพ", altEn: "", width: null, height: null }] };
  assert.equal(mourningErrorsOf(validateMourningConfig(withoutCaption)).length, 0, "ไม่มีคำบรรยายก็ต้องผ่าน");
});

test("mourning: ภาพที่ไม่มีคำอธิบาย / เก็บ URL เต็ม / พาธไม่ขึ้นต้นด้วย / = error", () => {
  const config = {
    ...defaultMourningConfig(th),
    images: [
      { path: "/media/abc", altTh: "", altEn: "", width: null, height: null },
      { path: "https://example.com/a.jpg", altTh: "ก", altEn: "", width: null, height: null },
      { path: "rip/old.jpg", altTh: "ข", altEn: "", width: null, height: null },
    ],
  };

  const issues = mourningErrorsOf(validateMourningConfig(config));
  const codes = issues.map((entry) => entry.code);
  assert.ok(codes.includes("missing-alt"));
  assert.ok(codes.includes("media-path-is-url"), "มติ D9: ห้ามเก็บ URL เต็ม");
  assert.ok(codes.includes("bad-path"));
});

test("mourning: parse รับค่าที่แก้จากหน้าจอ และตัดภาพที่เกินเพดาน", () => {
  const raw = {
    enabled: true,
    caption: { th: "ข้อความใหม่", en: "New caption" },
    closeLabel: { th: "ปิด", en: "Close" },
    muteTodayLabel: { th: "ไม่แสดงอีกในวันนี้", en: "" },
    seeNextLabel: { th: "ดูภาพต่อไป", en: "" },
    images: Array.from({ length: MAX_MOURNING_IMAGES + 2 }, (_unused, index) => ({
      path: `/media/image-${index}`,
      altTh: `ภาพ ${index}`,
      altEn: "",
      width: 1200,
      height: 400,
    })),
  };

  const outcome = parseMourningConfig(raw, th);
  assert.equal(outcome.ok, false, "เกินเพดาน = ต้องรายงาน");
  assert.ok(!outcome.ok);
  assert.ok(outcome.problems.some((problem) => problem.includes("เกินจำนวน")));
});

test("mourning: parse เติมค่าเริ่มต้นให้ช่องที่ไม่ได้ส่งมา (ไม่พังทั้งก้อน)", () => {
  const outcome = parseMourningConfig({ enabled: true, images: [{ path: "/media/x", altTh: "ภาพ" }] }, th);

  assert.equal(outcome.ok, true);
  assert.ok(outcome.ok);
  assert.equal(outcome.config.caption.th, "", "ข้อความที่ไม่ได้ส่งมา = ค่าเริ่มต้น (ว่าง = ใช้รูปเป็นตัวประกาศ)");
  assert.equal(outcome.config.images.length, 1);
  assert.equal(outcome.config.images[0]?.width, null);
});

test("mourning: ข้อมูลที่ไม่ใช่ออบเจ็กต์ถูกปฏิเสธ", () => {
  for (const bad of [null, 42, "ข้อความ", []]) {
    const outcome = parseMourningConfig(bad, th);
    assert.equal(outcome.ok, false, `ต้องปฏิเสธ: ${JSON.stringify(bad)}`);
  }
});

/* ── ตัวบอกว่าอะไรถูกแก้ (ผู้ใช้สั่ง รอบที่ 38) ─────────────────────────────── */

test("mourning: ไม่แก้อะไร = ไม่มีรายการเปลี่ยนแปลง", () => {
  const config = defaultMourningConfig(th);
  assert.equal(diffMourningConfig(config, config).length, 0);
  assert.equal(diffMourningConfig(config, structuredClone(config)).length, 0);
});

test("mourning: จับได้ว่าข้อความ/สวิตช์ส่วนไหนถูกแก้", () => {
  const base = defaultMourningConfig(th);
  const current = {
    ...base,
    enabled: false,
    caption: { th: "ข้อความใหม่", en: "" },
    closeLabel: { th: "ปิด", en: "Close" },
  };

  const kinds = diffMourningConfig(base, current).map((entry) => entry.kind);
  assert.deepEqual([...kinds].sort(), ["caption", "close", "enabled"]);
});

test("mourning: จับได้ว่าภาพถูกเพิ่ม/ลบ/แก้ (บอกลำดับภาพ)", () => {
  const base = defaultMourningConfig(th);
  const oneMore = { ...base, images: [...base.images, { path: "/media/new", altTh: "ใหม่", altEn: "", width: null, height: null }] };
  assert.deepEqual(diffMourningConfig(base, oneMore).map((entry) => `${entry.kind}:${entry.imageNumber}`), ["image-added:3"]);

  const oneLess = { ...base, images: base.images.slice(0, 1) };
  assert.deepEqual(diffMourningConfig(base, oneLess).map((entry) => `${entry.kind}:${entry.imageNumber}`), ["image-removed:2"]);

  const first = base.images[0];
  assert.ok(first !== undefined);
  const swapped = { ...base, images: [{ ...first, path: "/media/other" }, ...base.images.slice(1)] };
  assert.deepEqual(diffMourningConfig(base, swapped).map((entry) => `${entry.kind}:${entry.imageNumber}`), ["image-changed:1"]);
});

test("mourning: ช่องภาพที่ยังไม่ได้วางไฟล์ถูกข้ามเงียบ ๆ (ไม่บล็อกการบันทึก)", () => {
  const outcome = parseMourningConfig(
    {
      enabled: true,
      images: [
        { path: "", altTh: "", altEn: "" },
        { path: "/media/real", altTh: "ภาพจริง", altEn: "" },
      ],
    },
    th,
  );

  assert.equal(outcome.ok, true, "ช่องเปล่าต้องไม่ทำให้ parse ล้ม");
  assert.ok(outcome.ok);
  assert.equal(outcome.config.images.length, 1, "เหลือเฉพาะภาพที่มีไฟล์จริง");
  assert.equal(outcome.config.images[0]?.path, "/media/real");
});
