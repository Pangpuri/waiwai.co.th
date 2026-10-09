import assert from "node:assert/strict";
import { test } from "node:test";

import { isSamePageSection, splitSectionHref } from "@/features/shell/section-href";
import { buildHeaderCta } from "@/features/shell/nav";
import { WHERE_TO_BUY_ANCHOR } from "@/lib/blocks/marketplace-links";

import { codeOf, rawOf } from "./source-scan.ts";

/**
 * เทสต์รอบที่ 248 — 🐞 **ปุ่ม "สั่งซื้อสินค้าออนไลน์" ไม่วิ่งไปหาบล็อกสั่งซื้อสินค้า**
 *
 * ## ต้นเหตุ (เคสจริงจากเจ้าของ)
 * ปุ่มบนหัวเว็บชี้ `/th#where-to-buy` แต่เรนเดอร์ด้วย `<Link>` ของ Next (นำทางฝั่งไคลเอนต์)
 * ⇒ เมื่อปลายทางเป็น **หน้าเดิม** Next ไม่ทำอะไร (และถ้า URL มี `#where-to-buy` อยู่แล้วจากการกดครั้งก่อน
 * กดซ้ำจะไม่มีการนำทางเลย) ⇒ ผู้ใช้เห็นว่า "กดแล้วไม่ไปไหน"
 *
 * ## แก้
 * `SectionAnchor` — ถ้าลิงก์ชี้ส่วนของ **หน้าเดียวกัน** ใช้ `<a>` + `scrollIntoView()` เอง (เลื่อนแน่นอนทุกครั้ง)
 * ถ้าเป็นคนละหน้า ปล่อยให้ `<Link>` นำทางตามปกติ · ไม่มี JS ก็ยังใช้ได้ (เป็น `<a href="#...">` ธรรมดา)
 *
 * ## สัญญาที่ล็อก
 * 1. แยก path/hash ถูกต้อง (ไม่สับสนลิงก์คนละหน้า กับลิงก์ในหน้า)
 * 2. ปุ่ม CTA (เดสก์ท็อป + มือถือ) ต้องไม่ใช้ `<Link>` ตรง ๆ อีก
 * 3. ปลายทาง (`#where-to-buy`) ต้องมีจริงในบล็อก (สัญญาร่วมกับรอบที่ 244)
 * 4. เคารพ `prefers-reduced-motion` และไม่กลืนคลิกเมื่อหาปลายทางไม่เจอ
 */

test("section-href: แยก path/hash ถูกต้อง (รวมกรณีขอบ)", () => {
  assert.deepEqual(splitSectionHref("/th#where-to-buy"), { path: "/th", hash: "where-to-buy" });
  assert.deepEqual(splitSectionHref("/en#where-to-buy"), { path: "/en", hash: "where-to-buy" });
  assert.deepEqual(splitSectionHref("#where-to-buy"), { path: "", hash: "where-to-buy" });
  /* ไม่มี hash = ลิงก์ไปหน้า (ไม่ใช่ส่วน) */
  assert.deepEqual(splitSectionHref("/th/news"), { path: "/th/news", hash: null });
  /* `#` เปล่า = ไม่มีปลายทาง (ห้ามทำให้เป็นลิงก์ในหน้า) */
  assert.deepEqual(splitSectionHref("/th#"), { path: "/th", hash: null });
  assert.deepEqual(splitSectionHref("#"), { path: "", hash: null });
  /* hash ที่มีอักขระพิเศษยังคงอยู่ครบ (ตัดแค่ `#` ตัวแรก) */
  assert.deepEqual(splitSectionHref("/th#a-b_c"), { path: "/th", hash: "a-b_c" });
});

test("section-href: รู้ว่าลิงก์ไป 'ส่วนของหน้าเดียวกัน' เมื่อไหร่", () => {
  /* หน้าเดียวกัน = จัดการเองด้วย scrollIntoView */
  assert.equal(isSamePageSection("/th#where-to-buy", "/th"), true);
  assert.equal(isSamePageSection("#where-to-buy", "/th"), true);
  /* คนละหน้า = ปล่อยให้ Link นำทาง */
  assert.equal(isSamePageSection("/th#where-to-buy", "/en"), false);
  assert.equal(isSamePageSection("/en#where-to-buy", "/th"), false);
  /* ไม่มี hash = ไม่เกี่ยวกับการเลื่อนในหน้า */
  assert.equal(isSamePageSection("/th", "/th"), false);
  assert.equal(isSamePageSection("/th#", "/th"), false);
});

test("section-anchor: ปุ่มบนหัวเว็บ (เดสก์ท็อป + มือถือ) ต้องไม่ใช้ <Link> ตรง ๆ อีก", () => {
  const header = codeOf("features/shell/ui/site-header.tsx");
  const mobile = codeOf("features/shell/ui/mobile-nav.tsx");

  for (const [name, source] of [
    ["site-header", header],
    ["mobile-nav", mobile],
  ] as const) {
    assert.ok(source.includes("SectionAnchor"), `${name}: ต้องใช้ SectionAnchor กับปุ่มที่อาจชี้ส่วนในหน้า`);
    /* ปุ่มต้องไม่ถูกเรนเดอร์ด้วย <Link> อีก (นี่คือต้นเหตุของบั๊ก) */
    assert.equal(
      /<Link[^>]*href=\{button\.href\}/.test(source),
      false,
      `${name}: ปุ่ม (button.href) ต้องไม่ใช้ <Link> ตรง ๆ`,
    );
  }
  /* เดสก์ท็อปมีปุ่ม 2 ชุด (ซ้าย/ขวาของเมนู) ⇒ ต้องใช้ทั้งคู่ */
  assert.equal((header.match(/<SectionAnchor/g) ?? []).length, 2, "ปุ่มซ้าย+ขวาต้องใช้ SectionAnchor ทั้งคู่");
});

test("section-anchor: จัดการเองครบ (เลื่อน · เก็บ URL · reduced-motion · ไม่กลืนคลิกเมื่อไม่มีปลายทาง)", () => {
  const anchor = codeOf("features/shell/ui/section-anchor.tsx");

  assert.ok(anchor.includes("scrollIntoView("), "ต้องเลื่อนเองด้วย scrollIntoView (ไม่พึ่งการนำทางของ Next)");
  assert.ok(anchor.includes('prefers-reduced-motion: reduce'), "ต้องเคารพ reduced-motion");
  assert.ok(anchor.includes("replaceState"), "ต้องเก็บ hash ใน URL โดยไม่กระโดดซ้ำ");
  /* ไม่มีปลายทาง ⇒ ต้องไม่ preventDefault (ปล่อยให้เบราว์เซอร์ทำตาม href) */
  const guardStart = anchor.indexOf("if (target === null) {");
  assert.ok(guardStart > 0, "ต้องมีด่านตรวจว่าหาปลายทางเจอไหม");
  const guardBody = anchor.slice(guardStart, anchor.indexOf("}", guardStart) + 1);
  assert.equal(guardBody.includes("preventDefault"), false, "หาปลายทางไม่เจอ = ห้ามกลืนคลิก");
  assert.ok(guardBody.includes("return"), "หาปลายทางไม่เจอ = ออกทันที (ไม่ทำต่อ)");
  /* ลิงก์คนละหน้ายังใช้ Link (เร็วกว่า + มี prefetch) */
  assert.ok(anchor.includes("<Link"), "ลิงก์คนละหน้าต้องยังใช้ Link");
  /* เอกสารในไฟล์ต้องบอกเหตุผล (กันคนแก้กลับไปใช้ Link)
     ⚠️ ข้อความนี้อยู่ใน **คอมเมนต์** ⇒ ต้องอ่านแบบดิบ (บทเรียนรอบ 243: codeOf ตัดคอมเมนต์ทิ้ง) */
  assert.ok(
    rawOf("features/shell/ui/section-anchor.tsx").includes("ไม่วิ่งไปหาบล็อกสั่งซื้อสินค้า"),
    "ต้องบันทึกเคสจริงไว้ในโค้ด",
  );
});

test("section-anchor: ปลายทางของปุ่ม CTA ต้องมีจริงในบล็อก (สัญญาร่วมรอบที่ 244)", () => {
  for (const locale of ["th", "en"] as const) {
    const cta = buildHeaderCta(locale);
    assert.ok(cta.href.endsWith(`#${WHERE_TO_BUY_ANCHOR}`), `${locale}: ปุ่มต้องชี้ไป #${WHERE_TO_BUY_ANCHOR}`);
  }
  const renderer = codeOf("features/blocks/block-renderer.tsx");
  assert.ok(renderer.includes("id={WHERE_TO_BUY_ANCHOR}"), "บล็อก 'ที่ซื้อสินค้า' ต้องปล่อย id นี้");
  /* scroll-margin-top มีผลกับ scrollIntoView() ที่ SectionAnchor ใช้ */
  assert.ok(renderer.includes("scroll-mt-40"), "ปลายทางต้องมี scroll-mt เพื่อไม่ให้หัวเว็บบัง");
});
