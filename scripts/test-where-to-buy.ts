import assert from "node:assert/strict";
import { test } from "node:test";

import { buildHeaderCta } from "@/features/shell/nav";
import { WHERE_TO_BUY_ANCHOR } from "@/lib/blocks/marketplace-links";

import { codeOf } from "./source-scan.ts";

/**
 * เทสต์รอบที่ 244 — 🐞 เคสจริงจากเจ้าของ: *"พอย้ายบล็อคสั่งซื้อสินค้าออนไลน์ ปุ่มสั่งซื้อสินค้าที่หน้าบ้านใช้ไม่ได้จริง
 * แถมสไตล์กรอบของบล็อคสั่งซื้อสินค้าออนไลน์ที่เป็นสีเหลืองหายไปด้วย"*
 *
 * ## ต้นเหตุ (ทั้งสองอาการมาจากสาเหตุเดียว)
 * ดีไซน์เดิม (`features/home/ui/where-to-buy.tsx`) ทำ 2 อย่าง:
 *   1. `<section id="where-to-buy">` = **ปลายทางของปุ่ม "สั่งซื้อสินค้าออนไลน์" บนหัวเว็บ** (`HEADER_CTA`)
 *   2. การ์ด `bg-brand-yellow` + `text-accent-on-yellow` = **กรอบเหลืองของแบรนด์**
 * พอหน้าแรกหันมาระบายด้วย **บล็อก** (รอบที่ 241) ตัวเรนเดอร์บล็อก `marketplaceLinks` ไม่ได้ทำสองอย่างนี้
 * ⇒ ปุ่มบนหัวเว็บกดแล้วไม่ไปไหน · กรอบเหลืองหาย
 *
 * ## เทสต์นี้ล็อก "สัญญา" ทั้งสองข้อ
 * - anchor มาจาก **ค่าคงที่ตัวเดียว** (`WHERE_TO_BUY_ANCHOR`) ทั้งฝั่งปุ่ม (nav) และฝั่งปลายทาง (บล็อก/เลย์เอาต์โค้ด)
 * - บล็อกต้องวาดกรอบเหลือง + สีข้อความที่อ่านออกบนพื้นเหลือง (token เท่านั้น)
 */

test("where-to-buy: ปุ่มบนหัวเว็บชี้มาที่ anchor เดียวกับที่บล็อกปล่อยออกมา (แหล่งความจริงเดียว)", () => {
  /* ค่าคงที่ต้องตรงกับที่ใช้จริงใน URL (มีเทสต์กันแก้ชื่อพลาด) */
  assert.equal(WHERE_TO_BUY_ANCHOR, "where-to-buy");

  /* ฝั่งปุ่ม: href ที่ผู้ใช้เห็นจริงต้องลงท้ายด้วย anchor นี้ (ทั้ง /th และ /en) */
  for (const locale of ["th", "en"] as const) {
    const cta = buildHeaderCta(locale);
    assert.ok(
      cta.href.endsWith(`#${WHERE_TO_BUY_ANCHOR}`),
      `${locale}: ปุ่ม "สั่งซื้อสินค้าออนไลน์" ต้องชี้ไปที่ #${WHERE_TO_BUY_ANCHOR} (ได้ ${cta.href})`,
    );
  }

  /* ฝั่งปลายทาง: ตัวเรนเดอร์บล็อกต้องปล่อย id นี้ออกมา (ไม่งั้นปุ่มจะพาไปที่ว่าง — เคสจริงที่เจ้าของเจอ) */
  const renderer = codeOf("features/blocks/block-renderer.tsx");
  assert.ok(renderer.includes("id={WHERE_TO_BUY_ANCHOR}"), "บล็อก 'ที่ซื้อสินค้า' ต้องมี id={WHERE_TO_BUY_ANCHOR}");

  /* เลย์เอาต์โค้ดเดิม (หน้าที่ยังไม่ใช้บล็อก) ต้องใช้ค่าคงที่ตัวเดียวกัน ไม่พิมพ์ชื่อเอง */
  const legacy = codeOf("features/home/ui/where-to-buy.tsx");
  assert.ok(legacy.includes("id={WHERE_TO_BUY_ANCHOR}"), "เลย์เอาต์โค้ดต้องใช้ค่าคงที่เดียวกัน");
  assert.equal(legacy.includes('id="where-to-buy"'), false, "ห้ามพิมพ์ชื่อ anchor ซ้ำเอง");

  /* ฝั่งปุ่มก็ห้ามพิมพ์ชื่อ anchor เอง */
  const nav = codeOf("features/shell/nav.ts");
  assert.ok(nav.includes("anchor: WHERE_TO_BUY_ANCHOR"), "HEADER_CTA ต้องอ่านค่าคงที่");
  assert.equal(nav.includes('anchor: "where-to-buy"'), false, "ห้ามพิมพ์ชื่อ anchor ซ้ำเองใน nav");
});

test("where-to-buy: บล็อกต้องมีกรอบเหลืองของแบรนด์ + สีข้อความที่อ่านออกบนพื้นเหลือง", () => {
  const renderer = codeOf("features/blocks/block-renderer.tsx");
  const start = renderer.indexOf('case "marketplaceLinks"');
  const end = renderer.indexOf('case "newsShowcase"');
  assert.ok(start > 0 && end > start, "ต้องพบเคส marketplaceLinks ในตัวเรนเดอร์");
  const block = renderer.slice(start, end);

  /* กรอบเหลือง (โทเคนเท่านั้น — ห้ามสีดิบ/hex) */
  assert.ok(block.includes("bg-brand-yellow"), "ต้องมีพื้นเหลืองของแบรนด์ (bg-brand-yellow)");
  assert.ok(block.includes("text-accent-on-yellow"), "ข้อความบนพื้นเหลืองต้องใช้ text-accent-on-yellow (คอนทราสต์ผ่าน)");
  /* ⚠️ บนพื้นเหลืองห้ามใช้ text-fg — **ยกเว้น** ในปุ่มร้านที่เป็นพื้นขาว (bg-surface) */
  const fgOnYellow = block
    .split("\n")
    .filter((line) => line.includes("text-fg"))
    .filter((line) => !line.includes("bg-surface"));
  assert.deepEqual(fgOnYellow, [], "ข้อความบนกรอบเหลืองต้องใช้ text-accent-on-yellow (ยกเว้นปุ่มพื้นขาว bg-surface)");
  /* ปุ่มร้าน: พื้นขาว + ตัวอักษรปกติ */
  assert.ok(block.includes("bg-surface text-fg"), "ปุ่มร้านต้องเป็นพื้นขาว (bg-surface) + text-fg");
  /* anchor ต้องอยู่ในกรอบเหลือง (ไม่ลอยนอกการ์ด) */
  assert.ok(
    block.indexOf("id={WHERE_TO_BUY_ANCHOR}") < block.indexOf("bg-brand-yellow"),
    "anchor ต้องอยู่บนกรอบเหลือง (คลิกแล้วเลื่อนมาที่การ์ด ไม่ใช่ที่ว่างเหนือการ์ด)",
  );
  /* เลื่อนมาแล้วต้องไม่ถูกหัวเว็บบัง */
  assert.ok(block.includes("scroll-mt-40"), "ต้องมี scroll-mt กันหัวเว็บทับ (เหมือนดีไซน์เดิม)");
});

test("where-to-buy: ชื่อร้าน/ลิงก์มาจากแหล่งความจริงเดียว + ไม่มีข้อมูล = ไม่เรนเดอร์", () => {
  const marketplace = codeOf("lib/blocks/marketplace-links.ts");
  /* ลิงก์ร้านต้องมาจาก SITE (ไม่คีย์ซ้ำในคอมโพเนนต์) */
  assert.ok(marketplace.includes("SITE"), "ต้องอ่านลิงก์ร้านจาก SITE");
  const renderer = codeOf("features/blocks/block-renderer.tsx");
  assert.ok(renderer.includes("marketplaceLinksView(language)"), "ตัวเรนเดอร์ต้องใช้วิวจากชั้นข้อมูล");
  assert.ok(renderer.includes("if (market.isEmpty) return null"), "ไม่มีข้อมูลร้าน = ไม่เรนเดอร์บล็อก");
});
