import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { buildExecutivesTemplate } from "@/lib/blocks/executives-template";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { buildHomeTemplate } from "@/lib/blocks/home-template";
import { decideTemplateApply } from "@/lib/blocks/template-apply";
import { HOME_SECTIONS_OWNED_HERE, ownerOfSection } from "@/lib/content/home-section-owners";
import { HOME_SECTIONS } from "@/lib/content/model";
import { isProductDetailPageId } from "@/lib/blocks/product-detail";
import {
  BLOCK_COVERAGE_PART_IDS,
  BLOCK_TEMPLATE_PAGE_IDS,
  blockCoverageGaps,
  buildBlockTemplate,
  hasBlockTemplate,
} from "@/lib/blocks/templates";
import { countRawBlocks } from "@/lib/blocks/migrate";
import { documentErrorsOf, validateDocument } from "@/lib/blocks/validate";
import { JOBS } from "@/features/careers/jobs";
import { MAX_BLOCKS_TOTAL } from "@/lib/blocks/types";
import { PAGE_PATHS, PREVIEWABLE_PAGE_IDS, isPreviewablePage } from "@/lib/pages/paths";

/**
 * เทสต์ S2 — ตัวสร้างหน้าเว็บรองรับหลายหน้า (รอบที่ 82)
 *
 * จุดที่ต้องคุม
 * 1. เทมเพลตทุกตัว **ผ่าน parser + validator ของระบบเอง** (ไม่ใช่แค่ "หน้าตาดูดี")
 *    ⇒ ไม่งั้นปุ่ม "เริ่มจากเทมเพลต" จะสร้างฉบับร่างที่บันทึกไม่ได้/เผยแพร่ไม่ได้
 * 2. ทะเบียนเป็น **แหล่งความจริงเดียว**: ปุ่มในหลังบ้าน · รายการพรีวิว · ตัวเลือกลิงก์พรีวิว
 * 3. หน้าที่แปลงแล้ว **ต้องเรนเดอร์เอกสารที่เผยแพร่ได้จริง** และยังมีเลย์เอาต์เดิมเป็นทางถอย
 * 4. หน้าที่ไม่มีเทมเพลตต้องไม่ถูกเปิดพรีวิว/ไม่ถูกเขียนทับด้วยเทมเพลต
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/* ── 1) ทะเบียนเทมเพลต ─────────────────────────────────────────────────────── */

test("templates: ทะเบียนครบ 9 หน้าเมนู + 6 หน้ารายละเอียดหมวด และทุกตัวสร้างเอกสารที่ใช้ได้จริง", () => {
  assert.deepEqual(
    [...BLOCK_TEMPLATE_PAGE_IDS],
    [
      "home",
      "about",
      "careers",
      "contact",
      "products",
      "recipes",
      "news",
      "certifications",
      "executives",
      /* หน้ารายละเอียดหมวดสินค้า (S3 ส่วนที่ 2 · รอบที่ 102) — เรียงตามลำดับหมวดใน CATALOG_ITEMS */
      "product-instant-noodles",
      "product-dried-vermicelli",
      "product-serda",
      "product-quick-zabb",
      "product-noodie",
      "product-rod-ded",
    ],
  );

  for (const page of BLOCK_TEMPLATE_PAGE_IDS) {
    const template = buildBlockTemplate(page);
    assert.ok(template !== null, `${page}: ต้องสร้างเทมเพลตได้`);
    assert.equal(template.page, page, `${page}: ช่อง page ของเอกสารต้องตรงกับหน้าที่ขอ`);

    const parsed = parseBlockDocument(page, template);
    assert.ok(parsed.ok, `${page}: เทมเพลตต้องผ่าน parser (${parsed.ok ? "" : parsed.problems.join(", ")})`);
    if (!parsed.ok) continue;

    const errors = documentErrorsOf(validateDocument(parsed.document));
    assert.deepEqual(errors, [], `${page}: เทมเพลตต้องไม่มี error จาก validator`);

    assert.ok(parsed.document.blocks.length > 0, `${page}: เทมเพลตต้องมีบล็อกอย่างน้อย 1`);
    assert.ok(countRawBlocks(parsed.document) <= MAX_BLOCKS_TOTAL, `${page}: ต้องไม่เกินเพดานบล็อกรวม`);
  }
});

test("templates: หน้าที่อยู่นอกทะเบียนต้องไม่ถูกเขียนทับด้วยเทมเพลตของคนอื่น", () => {
  for (const page of ["sustainability", "where-to-buy", "cookie-policy", "terms", "privacy", ""]) {
    assert.equal(hasBlockTemplate(page), false, `"${page}": ไม่มีเทมเพลต`);
    assert.equal(buildBlockTemplate(page), null, `"${page}": ต้องไม่คืนเทมเพลต`);
    assert.deepEqual([...blockCoverageGaps(page)], [], `"${page}": ไม่มีข้อมูลครอบคลุม`);
  }

  /* ทุก id ในทะเบียนต้องเป็นเส้นทางที่มีจริงในเว็บ (ไม่งั้นปุ่มจะพาไป 404) */
  for (const page of BLOCK_TEMPLATE_PAGE_IDS) {
    assert.ok(PAGE_PATHS[page] !== undefined, `${page}: ต้องมี path ในเว็บ`);
  }
});

test("templates: ทุกหน้าต้องประกาศ 'ส่วนที่ไม่ครอบคลุม' ด้วยรหัสที่รู้จัก", () => {
  for (const page of BLOCK_TEMPLATE_PAGE_IDS) {
    const gaps = blockCoverageGaps(page);
    assert.ok(Array.isArray(gaps), `${page}: ต้องคืนรายการ`);
    for (const part of gaps) {
      assert.ok(BLOCK_COVERAGE_PART_IDS.includes(part), `${page}: รหัส "${part}" ต้องอยู่ในรายการกลาง`);
    }
    assert.equal(new Set(gaps).size, gaps.length, `${page}: ห้ามระบุซ้ำ`);
  }

  /*
    หน้าที่เนื้อหาส่วนหนึ่ง "ไม่ใช่บล็อก" ต้องถูกประกาศว่าขาด เพื่อให้หน้าจอเตือนก่อนเปิดสวิตช์
    (เปิดแล้วส่วนนั้นหายจากหน้าเว็บจริง) — ถ้าวันหนึ่งทำเป็นบล็อกได้ ค่อยถอดออกจากรายการนี้
  */
  assert.deepEqual([...blockCoverageGaps("contact")], [], "รอบที่ 87: ฟอร์ม + แผนที่เป็นบล็อกแล้ว ⇒ หน้าติดต่อครอบคลุมครบ");
  assert.deepEqual([...blockCoverageGaps("careers")], [], "รอบที่ 88: กระดานงาน + ฟอร์มเป็นบล็อกแล้ว ⇒ หน้าสมัครงานครอบคลุมครบ");
  assert.deepEqual([...blockCoverageGaps("certifications")], [], "รอบที่ 87: gallery มี lightbox ในตัว ⇒ ครอบคลุมครบ");
  /*
    executives: **ไม่มีช่องว่างแล้ว** — เจ้าของยืนยัน (2026-10-03) ว่าภาพผัง `public/executives/management-team.jpg`
    คือแหล่งข้อมูลที่ถูกต้อง (ชื่อ/ตำแหน่ง/ข้อความอยู่ในตัวภาพ) ⇒ ไม่ต้องมีบล็อก `rosterText`
    ⚠️ และ **ห้ามถอดชื่อจากภาพมาใส่เป็นข้อความเอง** (บทเรียนรอบที่ 22: ตัวอักษรในภาพอ่านเพี้ยนได้)
  */
  assert.deepEqual([...blockCoverageGaps("executives")], [], "executives ต้องไม่เหลือช่องว่าง");
  assert.ok(
    buildExecutivesTemplate().blocks.some((block) => block.type === "imageText"),
    "เทมเพลต executives ต้องมีภาพผังจริง (ภาพคือแหล่งข้อมูล)",
  );
  assert.ok(
    buildExecutivesTemplate().blocks.every((block) => block.type !== "rosterText"),
    "ห้ามใส่รายชื่อผู้บริหารที่ยังไม่ยืนยันเป็นข้อความ",
  );
  assert.ok(blockCoverageGaps("recipes").includes("sampleData"), "หน้าเมนูเป็นข้อมูลตัวอย่าง");
  assert.ok(blockCoverageGaps("news").includes("sampleData"), "หน้าข่าวเป็นข้อมูลตัวอย่าง");
  assert.deepEqual(
    [...blockCoverageGaps("home")],
    [],
    /* รอบที่ 229: "ที่ซื้อสินค้า" มีบล็อกของตัวเองแล้ว ⇒ ไม่เหลือช่องว่าง */
    "รอบ 210: หน้าแรกต้องเตือนว่ายังมีฟอร์ม + ส่วนข้อมูลจริงที่เทมเพลตยังไม่ครอบคลุม",
  );

  /* ทุกรหัสต้องมีคำแปลสองภาษา (belongs to admin area) และหน้าจอต้องมี case ครบ */
  for (const part of BLOCK_COVERAGE_PART_IDS) {
    for (const locale of ["th", "en"]) {
      /* คีย์เหล่านี้อยู่ในพื้นที่ย่อย adminTemplate (พื้นที่ admin ชนเพดาน 32KB ⇒ ห้ามขยาย) */
      const area = sourceOf(`lib/i18n/messages/areas/${locale}/adminTemplate.ts`);
      const key = `coverage${part.charAt(0).toUpperCase()}${part.slice(1)}:`;
      assert.ok(area.includes(key), `${locale}: ขาดคำแปลของ "${part}"`);
    }
  }

  const page = sourceOf("app/admin/builder/[page]/page.tsx");
  assert.ok(page.includes("coveragePartLabel"), "หน้าจอต้องแปลงรหัสส่วนเป็นข้อความ");

  /* พื้นที่ admin ต้องไม่กลับไปบวมเกินเพดานของด่าน check:i18n */
  const adminTh = sourceOf("lib/i18n/messages/areas/th/admin.ts");
  assert.ok(!adminTh.includes("coverageGallery:"), "คีย์ของเทมเพลตต้องอยู่พื้นที่ย่อย ไม่ใช่ admin หลัก");
  assert.ok(page.includes("blockCoverageGaps(page)"), "หน้าจอต้องอ่านส่วนที่ขาดจากทะเบียนกลาง");
  assert.ok(!page.includes("switch (part) {\n    default"), "ห้ามใช้ default (ต้อง exhaustive)");
});

test("templates: หน้าที่ปิดช่อง coverage ต้องมีบล็อกชนิดนั้นจริง (คำเตือนต้องไม่โกหก)", () => {
  const typesOf = (page: string): readonly string[] => {
    const template = buildBlockTemplate(page);
    assert.ok(template !== null, `${page}: ต้องมีเทมเพลต`);
    if (template === null) return [];
    return template.blocks.map((block) => block.type);
  };

  assert.ok(typesOf("contact").includes("form"), "contact: ต้องมีบล็อกฟอร์มติดต่อจริง");
  assert.ok(typesOf("contact").includes("map"), "contact: ต้องมีบล็อกแผนที่ (ภาพ)");
  assert.ok(typesOf("careers").includes("form"), "careers: ต้องมีบล็อกฟอร์มสมัครงาน");
  assert.ok(typesOf("careers").includes("jobBoard"), "careers: ต้องมีบล็อกกระดานรับสมัครงาน");
  assert.ok(typesOf("certifications").includes("gallery"), "certifications: ต้องมีบล็อกแกลเลอรี (มี lightbox)");

  /* ชนิดฟอร์มต้องตรงกับหน้าของเทมเพลต (กันต่อฟอร์มผิดหน้า) */
  const formKindOf = (page: string): string => {
    const template = buildBlockTemplate(page);
    assert.ok(template !== null, `${page}: ต้องมีเทมเพลต`);
    const block = template?.blocks.find((entry) => entry.type === "form");
    assert.ok(block !== undefined && block.type === "form", `${page}: ต้องมีบล็อกฟอร์ม`);
    return block.kind;
  };
  assert.equal(formKindOf("contact"), "contact");
  assert.equal(formKindOf("careers"), "careers");

  /* หน้าที่ปิดช่องแล้ว = ต้องไม่มีรายการขาดเหลือ */
  for (const page of ["contact", "certifications", "careers"]) {
    assert.deepEqual([...blockCoverageGaps(page)], [], `${page}: ปิดช่องครบแล้ว`);
  }

  /* กระดานงานต้องมี "ตำแหน่งจริง" ครบตามข้อมูลบริษัท (ไม่ใช่บล็อกเปล่า/ข้อมูลสมมติ) */
  const board = buildBlockTemplate("careers")?.blocks.find((entry) => entry.type === "jobBoard");
  assert.ok(board !== undefined && board.type === "jobBoard", "careers: ต้องมีบล็อกกระดานงาน");
  assert.equal(board.items.length, JOBS.length, "จำนวนตำแหน่งต้องเท่ากับข้อมูลจริง");
  assert.equal(new Set(board.items.map((item) => item.id)).size, board.items.length, "id ของตำแหน่งต้องไม่ซ้ำ");
  for (const item of board.items) {
    assert.ok(item.title.th.trim() !== "", "ทุกตำแหน่งต้องมีชื่อไทย");
    assert.ok(item.department.th.trim() !== "", "ทุกตำแหน่งต้องมีฝ่าย");
    assert.ok(item.openings >= 1, "ตำแหน่งจากข้อมูลจริงต้องมีอัตราอย่างน้อย 1");
  }
});

test("templates: คำเตือนเรื่องส่วนที่ขาดต้องแสดงทั้งตอนว่างและข้างสวิตช์ (คอมโพเนนต์กลางตัวเดียว)", () => {
  const builder = sourceOf("features/admin/ui/block-builder.tsx");
  assert.ok(builder.includes("readonly coverage?: TemplateCoverage"), "prop คำเตือนต้องไม่บังคับ (กัน build พัง)");
  assert.ok(builder.includes("<TemplateCoverageNote {...coverage} />"), "ต้องใช้คอมโพเนนต์กลาง ไม่เขียนกล่องซ้ำ");

  /* เคสจริงรอบที่ 83: เดิมแสดงเฉพาะใน BlockBuilder (หน้าที่มีฉบับร่างแล้ว) ⇒ หน้าที่ว่างไม่เห็นคำเตือน */
  const page = sourceOf("app/admin/builder/[page]/page.tsx");
  assert.ok(page.includes("const coverage = {"), "หน้าจอต้องคำนวณคำเตือนครั้งเดียว");
  assert.ok(page.includes("<TemplateCoverageNote {...coverage} />"), "สถานะว่างต้องแสดงคำเตือนด้วย");
  assert.ok(page.includes("coverage={coverage}"), "ส่งค่าที่คำนวณแล้วเข้า BlockBuilder (ไม่คำนวณซ้ำ)");
  assert.equal(page.split("<TemplateCoverageNote").length - 1, 1, "หน้าจอต้องมีกล่องคำเตือนเดียวในโค้ด");

  /* คำเตือนต้องอยู่ "ก่อน" ฟอร์มเผยแพร่ในโค้ด (ผู้ใช้เห็นก่อนกดขึ้นเว็บ)
     — เดิมเทียบกับฟอร์มสวิตช์ "ใช้กับหน้าเว็บจริง" · รอบที่ 240 ถอดสวิตช์นั้นออก เหลือปุ่มเผยแพร่ปุ่มเดียว */
  const coverageAt = builder.indexOf("coverage === undefined ? null :");
  const publishAt = builder.indexOf("action={publishActionState}");
  assert.ok(coverageAt > 0 && publishAt > coverageAt, "คำเตือนต้องวางก่อนฟอร์มเผยแพร่");
});

test("templates: บล็อกในเทมเพลตมี id ไม่ซ้ำ และทุก id ตรงรูปแบบของโปรเจกต์", () => {
  for (const page of BLOCK_TEMPLATE_PAGE_IDS) {
    const template = buildBlockTemplate(page);
    assert.ok(template !== null);
    if (template === null) continue;

    const ids = template.blocks.map((block) => block.id);
    assert.equal(new Set(ids).size, ids.length, `${page}: id ของบล็อกต้องไม่ซ้ำ`);
    for (const id of ids) assert.match(id, /^block-\d+$/, `${page}: id "${id}" ต้องเป็นรูปแบบ block-<เลข>`);
  }
});

/* ── 2) แหล่งความจริงเดียว ──────────────────────────────────────────────────── */

test("templates: รายการหน้าที่พรีวิวได้มาจากทะเบียนเทมเพลต (ไม่ใช่การพิมพ์ซ้ำ)", () => {
  assert.deepEqual([...PREVIEWABLE_PAGE_IDS], [...BLOCK_TEMPLATE_PAGE_IDS]);
  assert.equal(isPreviewablePage("about"), true);
  assert.equal(isPreviewablePage("products"), true, "มีเทมเพลตแล้ว = พรีวิวได้");
  assert.equal(isPreviewablePage("privacy"), false, "หน้าที่ไม่มีเทมเพลต (อยู่ในโค้ดล้วน) ต้องไม่เปิดพรีวิว");

  const paths = sourceOf("lib/pages/paths.ts");
  assert.ok(paths.includes("BLOCK_TEMPLATE_PAGE_IDS"), "paths ต้องอ่านจากทะเบียน ไม่ใช่พิมพ์รายการเอง");
  assert.ok(!paths.includes('["home"]'), "ห้ามเหลือรายการที่พิมพ์เองแบบเดิม");
});

test("templates: ปุ่มในหลังบ้านใช้ทะเบียน (ไม่ใช่ home อย่างเดียว)", () => {
  const actions = sourceOf("app/admin/builder/actions.ts");
  assert.ok(actions.includes("buildBlockTemplate(page)"), "action ต้องสร้างเทมเพลตตามหน้าจากทะเบียน");
  assert.ok(actions.includes("hasBlockTemplate(page)"), "ต้องกันหน้าที่ไม่มีเทมเพลต");
  assert.ok(!actions.includes("buildHomeTemplate"), "ห้ามผูกกับเทมเพลตหน้าแรกอย่างเดียวอีก");
  assert.ok(actions.includes("parseBlockDocument(page, template)"), "เทมเพลตต้องผ่าน parse ก่อนบันทึก");

  const page = sourceOf("app/admin/builder/[page]/page.tsx");
  assert.ok(page.includes("hasBlockTemplate(page)"), "หน้าจอต้องแสดงปุ่มเฉพาะหน้าที่มีเทมเพลต");
  assert.ok(page.includes("templateMissingBody"), "หน้าที่ไม่มีเทมเพลตต้องบอกผู้ใช้ตรง ๆ");
});

test("templates: ตัวเลือกลิงก์พรีวิวครอบทุกหน้าที่พรีวิวได้ (ไม่ใช่แค่หน้าแรก)", () => {
  const page = sourceOf("app/admin/preview-links/page.tsx");
  assert.ok(page.includes("PREVIEWABLE_PAGE_IDS.map"), "ตัวเลือกหน้าต้องมาจากรายการกลาง");
  assert.ok(page.includes("listPages("), "ชื่อหน้าต้องมาจากตาราง page (W1)");
  assert.ok(!page.includes("previewLinkPageHome"), "ห้ามเหลือตัวเลือกหน้าแรกแบบตายตัว");

  const manager = sourceOf("features/admin/ui/preview-link-manager.tsx");
  assert.ok(manager.includes("pages.map"), "ฟอร์มต้องเรนเดอร์ตัวเลือกจากรายการที่ส่งมา");
});

/* ── 3) หน้าสาธารณะที่แปลงแล้ว ─────────────────────────────────────────────── */

test("templates: ทุกหน้าที่มีเทมเพลตต้องเรนเดอร์เอกสารที่เผยแพร่ได้ และมีทางถอยเป็นเลย์เอาต์เดิม", () => {
  /*
    หน้าเมนู 9 หน้า → ไฟล์ route ของตัวเอง
    หน้ารายละเอียดหมวด 6 หน้า → ใช้ไฟล์ร่วมกัน (`app/[lang]/products/[slug]/page.tsx`)
      โดย id ของหน้าแตกต่างกัน (`product-<slug>`) ⇒ ตรวจแบบ "ไฟล์เดียวกัน + มี id ในโค้ด"
  */
  const menuRouteFiles: Readonly<Record<string, string>> = {
    home: "app/[lang]/page.tsx",
    about: "app/[lang]/about/page.tsx",
    careers: "app/[lang]/careers/page.tsx",
    contact: "app/[lang]/contact/page.tsx",
    products: "app/[lang]/products/page.tsx",
    recipes: "app/[lang]/recipes/page.tsx",
    news: "app/[lang]/news/page.tsx",
    certifications: "app/[lang]/about/certifications/page.tsx",
    executives: "app/[lang]/about/executives/page.tsx",
  };
  const productDetailRoute = "app/[lang]/products/[slug]/page.tsx";
  const productDetailSource = sourceOf(productDetailRoute);

  for (const page of BLOCK_TEMPLATE_PAGE_IDS) {
    assert.ok(PAGE_PATHS[page] !== undefined, `${page}: ต้องมี path ในเว็บ`);

    const detailPage = isProductDetailPageId(page);
    const source = detailPage ? productDetailSource : sourceOf(menuRouteFiles[page] ?? "");

    assert.ok(
      detailPage
        ? source.includes("loadLiveBlockDocument(productDetailPageId(")
        : source.includes(`loadLiveBlockDocument("${page}")`),
      `${page}: ต้องโหลดเอกสารที่เผยแพร่`,
    );
    assert.ok(source.includes("<BlockDocumentView"), `${page}: ต้องใช้ตัวเรนเดอร์ตัวเดียวกับหน้าแรก`);
    assert.ok(source.includes("return ("), `${page}: ต้องมีเลย์เอาต์เดิมเป็นทางถอย`);

    /*
      สถานะ "หน้านี้ขึ้นเว็บหรือยัง" ยังต้องอ่านจากฝั่งเซิร์ฟเวอร์ของหน้าจอสร้าง
      (รอบที่ 240: ไม่ได้อ่านเพื่อเปิด/ปิดสวิตช์แล้ว — ใช้เลือกข้อความผลลัพธ์หลังกดเผยแพร่ว่า
       "ขึ้นเว็บแล้ว" หรือ "บันทึกไว้ ยังไม่ขึ้นเว็บ" ⇒ ค่ามาจากนโยบายกลาง ไม่ใช่การเดาที่จอ)
    */
    const builder = sourceOf("app/admin/builder/[page]/page.tsx");
    assert.ok(builder.includes("publishGoesLive(page)"), "หน้าจอสร้างต้องอ่านนโยบายกลางว่าหน้านี้กดเผยแพร่แล้วขึ้นเว็บไหม");
  }

  /* ทะเบียนกับไฟล์ route ของหน้าเมนูต้องตรงกันเป๊ะ — ลืมเพิ่มหน้า = เทสต์แดงทันที */
  const menuPages = BLOCK_TEMPLATE_PAGE_IDS.filter((page) => !isProductDetailPageId(page));
  assert.equal(Object.keys(menuRouteFiles).length, menuPages.length, "หน้าเมนูต้องมีไฟล์ route ครบทุกหน้า");
  for (const page of menuPages) {
    assert.ok(menuRouteFiles[page] !== undefined, `${page}: ต้องประกาศไฟล์ route ในเทสต์นี้ด้วย`);
  }

  /* หน้ารายละเอียดหมวด: ทุก id ต้องมี path จริงตรงกับ slug ของตัวเอง */
  const detailPages = BLOCK_TEMPLATE_PAGE_IDS.filter(isProductDetailPageId);
  assert.ok(detailPages.length > 0, "ต้องมีหน้ารายละเอียดหมวดในทะเบียน");
  for (const page of detailPages) {
    assert.equal(PAGE_PATHS[page], `/products/${page.slice("product-".length)}`, `${page}: พาธต้องตรงกับ slug`);
  }
});

test("templates: พรีวิวโหมด 'หน้าเว็บจริง' ต้องชี้หน้าที่กำลังแก้ (ไม่ใช่หน้าแรกเสมอ)", () => {
  const builder = sourceOf("features/admin/ui/block-builder.tsx");
  assert.ok(builder.includes("previewLiveSrc"), "ต้องรับที่อยู่พรีวิวสดจากหน้าจอ");
  assert.ok(!builder.includes('previewMode === "live" ? previewLiveSrc :'), "ห้ามใช้ค่าที่ไม่มีการกัน undefined");

  /*
    prop นี้ต้อง **ไม่บังคับ** — บทเรียนเดิมของโปรเจกต์: prop บังคับเคยทำให้ `next build` พัง
    เพราะมีหน้าจอลืมส่งค่า (ดูคอมเมนต์ของ `isLive` ในไฟล์เดียวกัน) ⇒ ต้องมีค่าถอยเสมอ
  */
  assert.ok(builder.includes("readonly previewLiveSrc?: string"), "previewLiveSrc ต้องเป็น prop ไม่บังคับ");
  assert.ok(builder.includes('previewLiveSrc ?? "/th"'), "ต้องมีค่าถอยเป็นหน้าแรกเมื่อไม่ส่งมา");

  /*
    client component ห้ามดึงพจนานุกรม/ทะเบียนเทมเพลตเข้ามาคำนวณค่าถอย
    (จะทำให้ทั้งพจนานุกรมสองภาษาถูกส่งไปเบราว์เซอร์)
  */
  assert.ok(!builder.includes("@/lib/blocks/templates"), "client ห้าม import ทะเบียนเทมเพลต");
  assert.ok(!builder.includes("@/lib/pages/paths"), "client ห้าม import paths (ลากพจนานุกรมไปด้วย)");

  const page = sourceOf("app/admin/builder/[page]/page.tsx");
  assert.ok(page.includes("previewLiveSrc={localePath("), "หน้าจอต้องส่งที่อยู่จริงของหน้านั้น");
  assert.ok(page.includes("pathForPage("), "ที่อยู่ต้องมาจากแหล่งกลาง (PAGE_PATHS)");
});

/**
 * ★ รอบที่ 217 — "หน้าแรกห้ามมีบล็อกแบนเนอร์" (เจ้าของทัก: hero ซ้ำซ้อนกับสไลด์/แคมเปญ)
 * hero จริงมีแหล่งเดียวที่ `/admin/hero` ⇒ โหมดบล็อกต้องเรนเดอร์ hero จริงก่อน แล้วต่อด้วยบล็อก
 */
test("★ templates: หน้าแรกไม่มีบล็อก hero — โหมดบล็อกเรนเดอร์ hero จริงจาก /admin/hero (กันแก้สองที่)", () => {
  const doc = buildHomeTemplate();
  assert.deepEqual(
    doc.blocks.map((block) => block.type),
    ["productShowcase", "recipeShowcase", "newsShowcase", "form", "marketplaceLinks"],
    "เทมเพลตหน้าแรก = 4 บล็อก (หมวดสินค้า · เมนูล่าสุด · ข่าวล่าสุด · ที่ซื้อสินค้า)",
  );
  assert.ok(!doc.blocks.some((block) => block.type === "hero"), "ห้ามมีบล็อก hero ในเทมเพลตหน้าแรก");
  assert.ok(!JSON.stringify(doc).includes("ข้อมูลทดสอบ"), "ห้ามมีข้อมูลทดสอบ");

  /* หน้าอื่นยังใช้บล็อก hero ได้ปกติ (ไม่กระทบ) */
  for (const page of ["about", "contact", "careers"]) {
    const other = buildBlockTemplate(page as never);
    assert.ok(JSON.stringify(other).includes('"hero"'), `${page} ยังต้องมีบล็อก hero`);
  }

  /* โหมด "ใช้กับหน้าเว็บจริง": hero จริงต้องถูกเรนเดอร์ (ไม่ปล่อยให้หาย) */
  const page = readFileSync("app/[lang]/page.tsx", "utf8");
  const start = page.indexOf("if (liveDocument !== null) {");
  const blockPath = page.slice(start, page.indexOf("<BlockDocumentView", start));
  assert.ok(blockPath.includes("<Hero"), "โหมดบล็อกต้องเรนเดอร์ hero จริง");
  assert.ok(blockPath.includes("heroCard={heroCard}"), "hero ต้องใช้การ์ด PR จากที่เก็บจริง");
});

/** ★ รอบที่ 218 — แถบบอกโหมดพรีวิว (เจ้าของขอ "ก": กันเข้าใจผิดว่าพรีวิวไม่ตรงหน้าเว็บ) */
test("★ preview: ทุกโหมดพรีวิวมีป้ายบอกและมีคำแปลครบทั้งสองภาษา", () => {
  const route = readFileSync("app/[lang]/preview/[page]/page.tsx", "utf8");
  assert.ok(route.includes('data-preview-parts-bar=""'), "หน้าพรีวิวต้องมีแถบบอกโหมด");
  assert.ok(route.includes("messages.admin.previewPartsBarTitle"), "ต้องใช้คำแปลจากพจนานุกรม (ห้ามพิมพ์ไทยใน .tsx)");

  /* โหมดที่ระบบรู้จัก (ต้องตรงกับ PREVIEW_PARTS ของ lib/chrome/workspace-url.ts) */
  for (const part of ["content", "nav", "footer", "notice"]) {
    assert.ok(route.includes(`"${part}"`) || route.includes(`${part}:`), `แถบต้องรู้จักโหมด ${part}`);
    for (const lang of ["th", "en"]) {
      const dict = readFileSync(`lib/i18n/messages/areas/${lang}/adminTemplate.ts`, "utf8");
      const key = `previewParts${part[0]?.toUpperCase()}${part.slice(1)}`;
      assert.ok(dict.includes(key), `พจนานุกรม ${lang} ต้องมีคีย์ ${key}`);
    }
  }
  for (const lang of ["th", "en"]) {
    const dict = readFileSync(`lib/i18n/messages/areas/${lang}/adminTemplate.ts`, "utf8");
    assert.ok(dict.includes("previewPartsFull"), `${lang} ต้องมีป้ายโหมดทั้งหน้า`);
  }
});

/** ★ รอบที่ 224 (คิวข้อ 5) — จดหมายข่าวใช้ฟอร์มจริง + หน้าแรกไม่เหลือช่องว่าง */
test("★ templates: จดหมายข่าวใช้บล็อกฟอร์มจริง และหน้าแรกครอบคลุมครบ", () => {
  const doc = buildHomeTemplate();
  const form = doc.blocks.find((block) => block.type === "form");
  assert.equal(form?.type, "form");
  if (form?.type !== "form") return;
  assert.equal(form.kind, "newsletter", "ต้องใช้ฟอร์มจดหมายข่าวจริง (ไม่สร้างฟอร์มใหม่)");
  assert.ok(form.heading.th !== "" && form.heading.en !== "", "หัวข้อส่วนจดหมายข่าวต้องมาจากพจนานุกรม");
  assert.deepEqual([...blockCoverageGaps("home")], [], "รอบที่ 229: หน้าแรกมีบล็อกครบ (รวมที่ซื้อสินค้า)");
});

/** ★ รอบที่ 225 (เคลียร์หนี้ UX) — ปุ่มเทมเพลตต้องเห็นเสมอ + มีฉบับร่างต้องยืนยันก่อนทับ */
test("★ templates: ใช้เทมเพลตทับฉบับร่างต้องยืนยัน (fail-closed ทั้ง UI และเซิร์ฟเวอร์)", () => {
  /* ตรรกะจริง */
  assert.deepEqual(decideTemplateApply({ hasDraft: false, confirmValue: "" }), { allowed: true }, "ยังไม่มีฉบับร่าง = ไม่ต้องยืนยัน");
  assert.deepEqual(decideTemplateApply({ hasDraft: true, confirmValue: "" }), { allowed: false, reason: "needs-confirm" });
  assert.deepEqual(decideTemplateApply({ hasDraft: true, confirmValue: "nope" }), { allowed: false, reason: "needs-confirm" });
  assert.deepEqual(decideTemplateApply({ hasDraft: true, confirmValue: "overwrite" }), { allowed: true }, "ติ๊กถูก = ผ่าน");
  assert.deepEqual(decideTemplateApply({ hasDraft: true, confirmValue: " overwrite " }), { allowed: true }, "ตัดช่องว่างให้");

  /* ด่านบนเซิร์ฟเวอร์ (ห้ามเชื่อ UI อย่างเดียว) */
  const action = readFileSync("app/admin/builder/actions.ts", "utf8");
  assert.ok(action.includes("decideTemplateApply({"), "action ต้องเรียกตรรกะกลาง");
  assert.ok(action.includes('formData.get("confirm")'), "action ต้องอ่านค่ายีดยืนยันจากฟอร์ม");

  /* UI: แผงต้องแสดงเสมอ + มี checkbox ยืนยัน (required) เมื่อมีฉบับร่าง */
  const page = readFileSync("app/admin/builder/[page]/page.tsx", "utf8");
  assert.ok(page.includes("data-template-form="), "ต้องมีฟอร์มเทมเพลตในหน้าตัวสร้าง");
  assert.ok(page.includes('name="confirm"') && page.includes("required"), "ต้องมี checkbox ยืนยันแบบ required");
  assert.ok(page.includes("startFromTemplateReplace"), "มีฉบับร่างแล้วต้องบอกว่า 'ทับฉบับร่าง'");
  /* รอบที่ 227: กดใช้เทมเพลตโดยไม่ติ๊ก ⇒ ต้องมีข้อความบอก (ไม่เงียบ) */
  assert.ok(page.includes("data-template-notice="), "ต้องมีข้อความแจ้งเมื่อยังไม่ติ๊กยืนยัน");
  assert.ok(page.includes("startFromTemplateNeedsConfirm"), "ข้อความต้องมาจากพจนานุกรม");
  const actionRound227 = readFileSync("app/admin/builder/actions.ts", "utf8");
  assert.ok(actionRound227.includes('?template=confirm'), "action ต้องพากลับพร้อมสัญญาณแจ้งเตือน");
  assert.ok(!page.includes("{draftRow === null ? (\n        <section"), "แผงต้องไม่อยู่ในเงื่อนไข 'ไม่มีฉบับร่าง' อีกต่อไป");
});

/** ★ รอบที่ 226 (เคลียร์หนี้ "แก้ได้สองที่") — หน้าจอเนื้อหาหน้าแรกต้องบอกว่าส่วนไหนค่าจริงมาจากที่อื่น */
test("★ content: ทุกส่วนของหน้าแรกเป็นของหน้าจอนี้ หรือมีป้ายบอกเจ้าของที่ชัดเจน", () => {
  /* ของจริงที่หน้าเว็บอ่านค่า: whereToBuy (รอบ 209) — ที่เหลือมาจากระบบอื่น */
  assert.deepEqual([...HOME_SECTIONS_OWNED_HERE], [], "รอบที่ 229: ไม่มีส่วนไหนที่หน้าจอเนื้อหาเป็นเจ้าของแล้ว");
  assert.equal(ownerOfSection("whereToBuy")?.screen, "/admin/builder/home", "ที่ซื้อสินค้าย้ายเจ้าของมาที่ตัวสร้าง (รอบ 229)");
  for (const key of ["hero", "products", "recipes", "news", "newsletter", "seo"]) {
    const owner = ownerOfSection(key);
    assert.ok(owner !== null, `${key}: ต้องมีป้ายบอกว่าแก้ที่ไหน`);
    assert.ok((owner?.screen ?? "").startsWith("/"), `${key}: ต้องชี้หน้าจอจริง`);
  }
  /* ทุกส่วนในสเปกต้องถูกตัดสินใจแล้ว (ไม่ปล่อยให้ไม่มีเจ้าของและไม่ได้ต่อสาย) */
  for (const section of HOME_SECTIONS) {
    const decided = ownerOfSection(section.key) !== null || HOME_SECTIONS_OWNED_HERE.includes(section.key);
    assert.ok(decided, `ส่วน ${section.key}: ยังไม่ตัดสินใจว่าใครเป็นเจ้าของค่าจริง`);
  }

  /* หน้าจอต้องแสดงป้ายจริง (ไม่ใช่แค่มีตรรกะ) */
  const editor = readFileSync("features/admin/ui/home-editor.tsx", "utf8");
  assert.ok(editor.includes("data-section-managed="), "ต้องมีป้ายในหน้าจอ");
  assert.ok(editor.includes("ownerOfSection(section.key)"), "ต้องใช้ทะเบียนกลาง");
  assert.ok(editor.includes("strings.sectionManagedElsewhere"), "ข้อความต้องมาจากพจนานุกรม (ห้ามพิมพ์ไทยใน .tsx)");
});

/** ★ รอบที่ 230 (บั๊กจริงที่เจ้าของเจอ) — คลิกบล็อกในรายการแล้วต้องเลื่อนพรีวิวไปหา (คลิกซ้ำก็ต้องได้) */
test("★ builder: เลือกบล็อก ⇒ พรีวิวเลื่อนไปหาทุกครั้ง แม้คลิกบล็อกเดิมซ้ำ", () => {
  const frame = readFileSync("features/blocks/ui/preview-frame.tsx", "utf8");
  assert.ok(frame.includes("scrollIntoView"), "พรีวิวต้องเลื่อนไปหาบล็อกที่เลือก");
  assert.ok(frame.includes('data-block-id='), "ต้องหาบล็อกจากป้ายจริงของตัวเรนเดอร์");
  assert.ok(frame.includes("selectionNonce"), "ต้องมีตัวนับ ไม่งั้นคลิกซ้ำจะไม่ทำงาน");
  assert.ok(frame.includes("window.document.querySelector"), "ห้ามใช้ `document` (ชนชื่อ state เอกสารบล็อก)");

  const builder = readFileSync("features/admin/ui/block-builder.tsx", "utf8");
  assert.ok(builder.includes("selectTick"), "ฝั่งหลังบ้านต้องมีตัวนับการเลือก");
  assert.ok(builder.includes("const nextTick = selectTick + 1;"), "คลิกเลือกต้องเพิ่มตัวนับทุกครั้ง");
  assert.ok(builder.includes("previewWindow.postMessage("), "รอบที่ 232: ส่งข้อความเข้าพรีวิวทันที (ไม่รอ debounce)");
  assert.ok(builder.includes("[document, selectedId, selectTick]"), "ส่งข้อความเข้าพรีวิวเมื่อตัวนับเปลี่ยนด้วย");
});

/** ★ รอบที่ 231 — เลื่อนไปหาบล็อกด้วย "สัดส่วน" + ห้ามทำ deps ของ effect เปลี่ยนขนาด */
test("★ builder: เลื่อนไปหาบล็อกผ่านข้อความสัดส่วน และ effect มี deps คงที่", () => {
  const frame = readFileSync("features/blocks/ui/preview-frame.tsx", "utf8");
  assert.ok(frame.includes("PREVIEW_SCROLL_MESSAGE"), "พรีวิวต้องส่งข้อความขอให้เลื่อน");
  assert.ok(frame.includes("target.scrollIntoView("), "พรีวิวต้องเลื่อนไปหาบล็อกในเอกสารตัวเอง");
  assert.ok(
    !frame.includes("fraction: rect.top / total"),
    "รอบที่ 234: ห้ามส่งสัดส่วนกลับให้หลังบ้าน (พรีวิวไม่มีการเลื่อนภายใน ⇒ ค่าผิด ⇒ เด้งไปล่างสุด)",
  );
  const builder = readFileSync("features/admin/ui/block-builder.tsx", "utf8");
  assert.ok(builder.includes("function scrollToBlock(fraction: number)"), "ตรรกะเลื่อนต้องอยู่ใน effect");
  assert.ok(!builder.includes("scrollPreviewTo"), "ห้ามอ้าง useCallback ใน deps (React ฟ้อง 'deps เปลี่ยนขนาด')");
  assert.ok(builder.includes("scrollTargetFor("), "ต้องคำนวณตำแหน่งจากความสูงที่เรนเดอร์จริง (ทนต่อ scale)");
  assert.ok(builder.includes("scrollableAncestorOf("), "รอบที่ 232: ต้องหาคอนเทนเนอร์ที่เลื่อนได้จริงก่อน (ไม่ใช่ window อย่างเดียว)");
  assert.ok(builder.includes("function onMessage(event: MessageEvent) {"), "ห้ามทำข้อความจากพรีวิวเสียหาย (บทเรียนรอบ 232)");
});

/** ★ รอบที่ 233 — ห้ามเลือกบล็อกอัตโนมัติตอนเปิดหน้า (ทำให้พรีวิวเลื่อนผิดที่ตอนวัดตำแหน่งไม่ได้) */
test("★ builder: เปิดหน้าแล้วต้องไม่เลือกบล็อกอัตโนมัติ (เลื่อนเฉพาะตอนผู้ใช้คลิก)", () => {
  const builder = readFileSync("features/admin/ui/block-builder.tsx", "utf8");
  assert.ok(
    !builder.includes('useState<string>(initialDraft.blocks[0]?.id ?? "")'),
    "ห้ามเลือกบล็อกแรกอัตโนมัติ (เจ้าของเจอ: รีเฟรชแล้วเลื่อนไปล่างสุด)",
  );
  assert.ok(builder.includes('const [selectedId, setSelectedId] = useState<string>("");'), "ต้องเริ่มด้วยไม่เลือกอะไร");
});

/** ★ รอบที่ 236 — คลิกทั้งแถวในรายการบล็อกต้องเลือกได้ (ไม่ต้องเล็งที่ตัวหนังสือ) */
test("★ builder: แถวในรายการบล็อกคลิกได้ทั้งแถว (ปุ่มย่อยต้องไม่ทะลุไปเลือก)", () => {
  const list = readFileSync("features/admin/ui/block-layer-list.tsx", "utf8");
  assert.ok(list.includes("onClick={() => handlers.onSelect(block.id)}"), "แถวต้องคลิกเลือกได้");
  const rowClickCount = list.split("onClick={() => handlers.onSelect(block.id)}").length - 1;
  assert.ok(rowClickCount >= 1, "ต้องมีการคลิกเลือกบนแถว");
  /* อุปกรณ์ย่อยของแถวต้องกันการคลิกทะลุทั้งคู่: (1) กลุ่มปุ่ม ↑ ↓ ทำซ้ำ ลบ · (2) ช่อง "ย้ายไป"
     — ถ้าช่อง "ย้ายไป" ทะลุ จะเรียก onSelect ⇒ โพสต์เข้า iframe ⇒ จอเลื่อนตามทั้งที่แค่เลือกปลายทาง (รอบ 230–235) */
  const guardCount = list.split("onClick={(event) => event.stopPropagation()}").length - 1;
  assert.ok(
    guardCount >= 2,
    "ปุ่มย่อย + ช่อง \"ย้ายไป\" ต้องหยุดการคลิกไม่ให้ทะลุไปเลือกบล็อก",
  );
});
