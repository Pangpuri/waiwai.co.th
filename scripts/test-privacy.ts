import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { privacyPage as en } from "@/lib/i18n/messages/areas/en/privacy";
import { privacyPage as th } from "@/lib/i18n/messages/areas/th/privacy";
import { SITE } from "@/lib/site";

/**
 * ด่านของหน้า /privacy — กัน "ป้ายร่าง" และข้อมูลผู้ควบคุมหลุดกลับไป
 *
 * ที่มา (2026-10-22): เจ้าของสั่งให้นำถ้อยคำจากนโยบายเดิมของบริษัทมาปรับใช้
 * + ใช้ระยะเก็บจริง + เติมข้อมูลบริษัท + ทำฉบับ EN และ **เอาป้ายร่างออก**
 * ⇒ ต้องมีด่านกันไม่ให้กลับไปเป็นหน้า "ร่าง" ที่ไม่มีข้อมูลผู้ควบคุมอีก
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8").replace(/\r\n/g, "\n");
}

test("privacy: ไม่มีป้ายร่าง และมีวันที่มีผล/เวอร์ชันแล้ว", () => {
  const page = sourceOf("app/[lang]/privacy/page.tsx");
  assert.ok(!page.includes("SampleNotice"), "หน้า /privacy ต้องไม่เรนเดอร์ป้ายตัวอย่าง/ร่างอีก");
  assert.ok(!page.includes("draftNotice"), "ห้ามอ้างคีย์ draftNotice ที่ถูกถอดแล้ว");
  assert.ok(!("draftNotice" in th), "TH: ห้ามมีคีย์ draftNotice");
  assert.ok(!("draftNotice" in en), "EN: ห้ามมีคีย์ draftNotice");
  assert.ok(!th.updatedBody.includes("ร่าง"), "TH: สถานะต้องไม่ใช่ร่าง");
  assert.ok(!en.updatedBody.toLowerCase().includes("draft"), "EN: status must not be draft");
  assert.ok(th.updatedBody.includes("มีผลตั้งแต่วันที่"), "TH: ต้องระบุวันที่มีผล");
  assert.ok(en.updatedBody.includes("Effective"), "EN: ต้องระบุวันที่มีผล");
});

test("privacy: มีข้อมูลผู้ควบคุมจริง (ชื่อนิติบุคคล/ที่อยู่/โทร/ผู้ติดต่อ)", () => {
  assert.ok(SITE.legalName.includes("บริษัท"), "ชื่อนิติบุคคลต้องเป็นชื่อเต็ม ไม่ใช่ชื่อแบรนด์อย่างเดียว");
  assert.ok(SITE.legalNameEn.trim() !== "", "ต้องมีชื่อนิติบุคคลภาษาอังกฤษ");
  assert.ok(SITE.contact.address.trim() !== "", "ต้องมีที่อยู่ผู้ควบคุม");
  assert.ok(SITE.contact.addressEn.trim() !== "", "ต้องมีที่อยู่ภาษาอังกฤษ");
  assert.ok(SITE.contact.phone.trim() !== "", "ต้องมีเบอร์โทรผู้ควบคุม");
  assert.ok(th.controllerDpoValue.trim() !== "" && en.controllerDpoValue.trim() !== "", "ต้องมีผู้ติดต่อเรื่องข้อมูลส่วนบุคคล");
});

test("privacy: ระยะเก็บมาจากค่ากลาง + เปิดเผยผู้ให้บริการ/YouTube ตามจริง", () => {
  const page = sourceOf("app/[lang]/privacy/page.tsx");
  assert.ok(page.includes("RETENTION_CLASSES"), "ตารางระยะเก็บต้องมาจาก lib/retention/plan.ts");
  assert.ok(page.includes("retentionDaysFor"), "ต้องใช้ค่าเดียวกับตัวลบข้อมูล");
  for (const [locale, dict] of [
    ["th", th],
    ["en", en],
  ] as const) {
    assert.ok(dict.retentionIntro.includes(locale === "th" ? "ตัวลบข้อมูล" : "deletion job"), `${locale}: ต้องบอกว่าระยะเก็บตรงกับตัวลบจริง`);
    assert.ok(dict.sharingBody.includes("Vercel"), `${locale}: ต้องระบุผู้ให้บริการโฮสต์`);
    assert.ok(dict.sharingBody.includes("Neon"), `${locale}: ต้องระบุผู้ให้บริการฐานข้อมูล`);
    assert.ok(dict.sharingBody.includes("YouTube"), `${locale}: ต้องบอกเรื่อง YouTube`);
  }
});
