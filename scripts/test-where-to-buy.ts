import assert from "node:assert/strict";
import { test } from "node:test";

import { buildHeaderCta } from "@/features/shell/nav";
import { WHERE_TO_BUY_ANCHOR, defaultMarketplaceItems, marketplaceLinksView } from "@/lib/blocks/marketplace-links";
import { createBlock, type MarketplaceLinksBlock } from "@/lib/blocks/types";
import { SITE } from "@/lib/site";
import { th } from "@/lib/i18n/messages/th";

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

test("where-to-buy: รายการในบล็อกเป็นแหล่งแรก · ว่าง/ไม่ครบ = ถอยไปค่าเริ่มต้นจาก SITE", () => {
  const base = createBlock("marketplaceLinks", "m1");
  assert.equal(base.type, "marketplaceLinks");
  if (base.type !== "marketplaceLinks") return;

  /* ไม่มีรายการในบล็อก = ใช้ SITE + ป้ายจากพจนานุกรม (พฤติกรรมเดิม) */
  const fallback = marketplaceLinksView(base, "th");
  assert.equal(fallback.items.length, SITE.marketplaces.length);
  assert.equal(fallback.items[0]?.href, SITE.marketplaces[0]?.href);
  assert.equal(fallback.items[0]?.label, th.whereToBuy.marketplaces.shopee);
  assert.equal(fallback.retailNote, th.whereToBuy.retailNote);
  assert.equal(fallback.eyebrow, "");

  /* ชุดเริ่มต้นที่ใช้เติมลงบล็อก = ชุดเดียวกับ fallback (ชื่อ/ลิงก์มาจากแหล่งเดียว) */
  const defaults = defaultMarketplaceItems();
  assert.equal(defaults.length, SITE.marketplaces.length);
  assert.equal(defaults[0]?.href, SITE.marketplaces[0]?.href);
  assert.equal(defaults[0]?.label.th, th.whereToBuy.marketplaces.shopee);
  assert.equal(defaults[0]?.label.en, "Shopee");

  /* มีรายการในบล็อก = ใช้รายการนั้น (ชื่อ/ลิงก์/eyebrow/retailNote) */
  const custom: MarketplaceLinksBlock = {
    ...base,
    eyebrow: { th: "ช่องทางอย่างเป็นทางการ", en: "" },
    retailNote: { th: "", en: "" },
    items: [{ id: "shop-1", label: { th: "ร้านทดสอบ", en: "Test shop" }, href: "https://example.test/shop" }],
  };
  const view = marketplaceLinksView(custom, "th");
  assert.deepEqual(view.items, [{ id: "shop-1", label: "ร้านทดสอบ", href: "https://example.test/shop" }]);
  assert.equal(view.eyebrow, "ช่องทางอย่างเป็นทางการ");
  assert.equal(view.retailNote, th.whereToBuy.retailNote, "retailNote ว่าง = ค่าเริ่มต้น");
  assert.equal(view.isEmpty, false);

  /* รายการที่ไม่มีลิงก์ถูกข้าม → ถอยไปค่าเริ่มต้น (ไม่เรนเดอร์ปุ่มที่พาไปที่ว่าง) */
  const incomplete = marketplaceLinksView(
    { ...custom, items: [{ id: "shop-2", label: { th: "ยังไม่มีลิงก์", en: "" }, href: "" }] },
    "th",
  );
  assert.equal(incomplete.items[0]?.id, SITE.marketplaces[0]?.id);
});

test("where-to-buy: ชื่อร้าน/ลิงก์มาจากแหล่งความจริงเดียว + ไม่มีข้อมูล = ไม่เรนเดอร์", () => {
  const marketplace = codeOf("lib/blocks/marketplace-links.ts");
  /* ลิงก์ร้านต้องมาจาก SITE (fallback) + รายการที่แก้ในบล็อก (แหล่งแรก) */
  assert.ok(marketplace.includes("SITE"), "ต้องอ่านลิงก์ร้านเริ่มต้นจาก SITE");
  assert.ok(marketplace.includes("block.items"), "ต้องอ่านรายการที่แก้ในบล็อก");
  const renderer = codeOf("features/blocks/block-renderer.tsx");
  assert.ok(renderer.includes("marketplaceLinksView(block, language)"), "ตัวเรนเดอร์ต้องใช้วิวจากชั้นข้อมูล");
  assert.ok(renderer.includes("if (market.isEmpty) return null"), "ไม่มีข้อมูลร้าน = ไม่เรนเดอร์บล็อก");

  /* แผงแก้ต้องมีปุ่มเพิ่ม/ลบ + ช่องชื่อ/ลิงก์ (ย้ายมาจากหน้าจอเนื้อหาเดิม) */
  const builder = codeOf("features/admin/ui/block-builder.tsx");
  for (const needle of ["addMarketplaceLink", "removeMarketplaceLink", "setMarketplaceLinkLabel", "setMarketplaceLinkHref", "seedMarketplaceItems", "blockMarketplaceLinks", "blockUseDefaultMarketplaceLinks"]) {
    assert.ok(builder.includes(needle), `แผงบล็อกต้องมี: ${needle}`);
  }
});
