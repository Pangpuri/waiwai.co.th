import assert from "node:assert/strict";
import { test } from "node:test";

import type { Metadata } from "next";

import { EMPTY_PAGE_SEO, hasSeoOverride, validatePageSeo, type PageSeo } from "@/lib/pages/model";
import { applySeoToMetadata, pickSeoText, resolveSeo } from "@/lib/seo/page-seo";

/** เทสต์ SEO ต่อหน้า (W2) — ตรรกะล้วน ไม่ต้องมีฐานข้อมูล */

const seo = (patch: Partial<PageSeo> = {}): PageSeo => ({ ...EMPTY_PAGE_SEO, ...patch });

const DEFAULTS: Metadata = {
  title: { absolute: "หัวข้อเดิม" },
  description: "คำอธิบายเดิม",
  alternates: { canonical: "/th/products" },
  openGraph: { title: "หัวข้อเดิม", description: "คำอธิบายเดิม", siteName: "ไวไว" },
};

test("hasSeoOverride: ว่างทั้งหมด = ไม่มีอะไรให้ใช้", () => {
  assert.equal(hasSeoOverride(EMPTY_PAGE_SEO), false);
  assert.equal(hasSeoOverride(seo({ titleTh: "ใหม่" })), true);
  assert.equal(hasSeoOverride(seo({ ogImagePath: "/media/x" })), true);
  assert.equal(hasSeoOverride(seo({ noindex: true })), true);
});

test("★ ไม่ตั้งค่า = คืน metadata เดิมทั้งก้อน (เว็บไม่เปลี่ยน)", () => {
  const result = applySeoToMetadata(DEFAULTS, EMPTY_PAGE_SEO, "th");
  assert.equal(result, DEFAULTS, "ต้องเป็นออบเจ็กต์เดิม (ไม่สร้างใหม่)");
});

test("ตั้งค่าแล้ว = ทับหัวข้อ/คำอธิบาย ทั้งใน metadata และ Open Graph", () => {
  const result = applySeoToMetadata(DEFAULTS, seo({ titleTh: "หัวข้อใหม่", descriptionTh: "คำอธิบายใหม่" }), "th");

  assert.deepEqual(result.title, { absolute: "หัวข้อใหม่" });
  assert.equal(result.description, "คำอธิบายใหม่");
  assert.equal(result.openGraph?.title, "หัวข้อใหม่");
  assert.equal(result.openGraph?.description, "คำอธิบายใหม่");
  /* ค่าอื่นของ Open Graph ต้องคงอยู่ */
  assert.equal(result.openGraph?.siteName, "ไวไว");
  /* canonical ต้องไม่ถูกแตะ */
  assert.deepEqual(result.alternates, DEFAULTS.alternates);
});

test("ภาษาอังกฤษว่าง = ใช้ของไทย · มีค่าอังกฤษ = ใช้ค่าอังกฤษ", () => {
  assert.equal(pickSeoText("ไทย", "", "en"), "ไทย");
  assert.equal(pickSeoText("ไทย", "English", "en"), "English");
  const en = applySeoToMetadata(DEFAULTS, seo({ titleTh: "ไทย", titleEn: "English" }), "en");
  assert.deepEqual(en.title, { absolute: "English" });
  const th = applySeoToMetadata(DEFAULTS, seo({ titleTh: "ไทย", titleEn: "English" }), "th");
  assert.deepEqual(th.title, { absolute: "ไทย" });
});

test("รูป OG + noindex: ใส่เมื่อตั้งค่าเท่านั้น", () => {
  const withImage = applySeoToMetadata(DEFAULTS, seo({ ogImagePath: "/media/og1" }), "th");
  assert.deepEqual(withImage.openGraph?.images, ["/media/og1"]);
  assert.equal(withImage.robots, undefined, "ไม่ตั้ง noindex = ไม่แตะ robots");

  const noindex = applySeoToMetadata(DEFAULTS, seo({ noindex: true }), "th");
  assert.deepEqual(noindex.robots, { index: false, follow: false });
});

test("resolveSeo: ตัดช่องว่างหัวท้าย และว่าง = null", () => {
  const resolved = resolveSeo(seo({ titleTh: "  หัวข้อ  ", ogImagePath: "  " }), "th");
  assert.equal(resolved.title, "หัวข้อ");
  assert.equal(resolved.ogImagePath, null);
  assert.equal(resolved.description, null);
});

test("validatePageSeo: ยาวเกินเพดาน · OG ต้องเป็นพาธในเว็บ (มติ D9)", () => {
  assert.deepEqual(validatePageSeo(EMPTY_PAGE_SEO), []);
  assert.ok(validatePageSeo(seo({ titleTh: "ก".repeat(71) })).some((issue) => issue.code === "too-long"));
  assert.ok(validatePageSeo(seo({ descriptionTh: "ก".repeat(171) })).some((issue) => issue.code === "too-long"));
  assert.ok(validatePageSeo(seo({ ogImagePath: "https://example.test/a.png" })).some((issue) => issue.code === "media-path-is-url"));
  assert.ok(validatePageSeo(seo({ ogImagePath: "//cdn.test/a.png" })).some((issue) => issue.code === "media-path-is-url"));
  assert.ok(validatePageSeo(seo({ ogImagePath: "media/a.png" })).some((issue) => issue.code === "bad-path"));
  assert.deepEqual(validatePageSeo(seo({ ogImagePath: "/media/a.png" })), []);
});
