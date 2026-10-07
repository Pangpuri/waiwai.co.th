import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addHeroSlide,
  heroSlidesOf,
  moveHeroSlide,
  newHeroSlideId,
  removeHeroSlide,
  setHeroSlideFocus,
  setHeroSlideImage,
  setHeroSlideZoom,
} from "@/lib/blocks/edit";
import { HERO_FOCUS_PRESETS, HERO_SLIDE_SECONDS, HERO_ZOOM_PRESETS, heroFocusPresetId } from "@/lib/blocks/hero-slides";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { BLOCK_SCHEMA_VERSION, MAX_HERO_SLIDES, createBlock, type BlockDocument } from "@/lib/blocks/types";

/**
 * รอบที่ 183 · เฟส 2 ส่วน (ก) — "สไลด์หลายภาพ" ของบล็อกแบนเนอร์เปิดหน้า: ชั้นข้อมูล + ตัวช่วยแก้ไข
 *
 * ฟีดแบ็กเจ้าของ: *"จัดการส่วนสไลด์ ใส่ภาพ เพิ่มภาพ ครอบภาพให้เหมาะสม จัดตำแหน่งภาพสไลด์ได้"*
 * ⚠️ รอบนี้ **ยังไม่แตะหน้าจอ/การแสดงผล** (เฟส (ข) และ (ค)) — ที่นี่พิสูจน์ว่าข้อมูลและตรรกะถูกต้อง
 * ⚠️ เอกสารเดิม (ไม่มี `slides`) ต้องทำงานเหมือนเดิมเป๊ะ — เป็นข้อกำหนดหลักของรอบนี้
 */

function heroDocument(): BlockDocument {
  return { page: "home", blocks: [createBlock("hero", "hero-1")] };
}

/** เอกสารดิบแบบที่เก็บในฐานข้อมูล (ใช้ทดสอบตัวอ่านค่า) — สร้างจาก createBlock เพื่อให้ style ถูกต้อง */
function rawDocument(overrides: Readonly<Record<string, unknown>>): unknown {
  return {
    page: "home",
    blocks: [{ ...createBlock("hero", "hero-1"), ...overrides }],
  };
}

/** ดึงบล็อก hero ออกจากเอกสาร (ไม่ได้ = ให้เทสต์พังทันที) — คืนชนิดที่แคบแล้วเพื่อเข้าถึง `slides` ได้ */
function heroOf(document: BlockDocument | null): Extract<BlockDocument["blocks"][number], { type: "hero" }> {
  const block = document?.blocks[0] ?? null;
  if (block === null || block.type !== "hero") throw new Error("ต้องได้บล็อก hero");
  return block;
}

test("hero slides: เพิ่ม/ลบ/สลับลำดับ + เพดานจำนวน", () => {
  let document = heroDocument();
  assert.deepEqual(heroSlidesOf(document, "hero-1"), [], "เริ่มต้นไม่มีสไลด์ (ใช้ภาพเดี่ยวเหมือนเดิม)");

  document = addHeroSlide(document, "hero-1");
  document = addHeroSlide(document, "hero-1");
  const slides = heroSlidesOf(document, "hero-1") ?? [];
  assert.equal(slides.length, 2);
  assert.equal(slides[0]?.id, "slide-1");
  assert.equal(slides[1]?.id, "slide-2");
  assert.equal(slides[0]?.focusX, 50, "ค่าเริ่มต้น = จุดกลางภาพ");
  assert.equal(slides[0]?.focusY, 50);
  assert.equal(slides[0]?.zoom, 1, "ค่าเริ่มต้น = ไม่ซูม");
  assert.equal(slides[0]?.image, null, "ยังไม่เลือกภาพ (validator จะเตือน)");

  /* เติมจนสุดเพดาน แล้วเพิ่มอีกต้องไม่เกิน */
  for (let i = 0; i < MAX_HERO_SLIDES + 3; i += 1) document = addHeroSlide(document, "hero-1");
  assert.equal((heroSlidesOf(document, "hero-1") ?? []).length, MAX_HERO_SLIDES, `ต้องไม่เกิน ${MAX_HERO_SLIDES} ใบ`);

  /* สลับลำดับ */
  const before = heroSlidesOf(document, "hero-1") ?? [];
  const first = before[0];
  assert.ok(first !== undefined);
  const movedDown = heroSlidesOf(moveHeroSlide(document, "hero-1", first.id, 1), "hero-1") ?? [];
  assert.equal(movedDown[1]?.id, first.id, "ย้ายลงหนึ่งช่อง");
  assert.equal(movedDown.length, before.length, "จำนวนไม่เปลี่ยน");
  const movedUp = heroSlidesOf(moveHeroSlide(moveHeroSlide(document, "hero-1", first.id, 1), "hero-1", first.id, -1), "hero-1") ?? [];
  assert.deepEqual(movedUp.map((slide) => slide.id), before.map((slide) => slide.id), "ขึ้นแล้วลง = กลับที่เดิม");

  /* หลุดขอบ = ไม่ทำอะไร */
  assert.deepEqual(moveHeroSlide(document, "hero-1", first.id, -1), document, "ใบแรกย้ายขึ้นไม่ได้");
  const last = before[before.length - 1];
  assert.ok(last !== undefined);
  assert.deepEqual(moveHeroSlide(document, "hero-1", last.id, 1), document, "ใบสุดท้ายย้ายลงไม่ได้");

  /* ลบ */
  const afterRemove = heroSlidesOf(removeHeroSlide(document, "hero-1", first.id), "hero-1") ?? [];
  assert.equal(afterRemove.length, before.length - 1);
  assert.ok(!afterRemove.some((slide) => slide.id === first.id));
  assert.deepEqual(removeHeroSlide(document, "hero-1", "ไม่มีอยู่จริง"), document, "ลบ id ที่ไม่มี = ไม่ทำอะไร");
});

test("hero slides: รหัสสไลด์ใหม่ไม่ซ้ำแม้ลบไปแล้ว (กันกุญแจ React ชน)", () => {
  assert.equal(newHeroSlideId([]), "slide-1");
  assert.equal(newHeroSlideId([{ id: "slide-1", image: null, focusX: 50, focusY: 50, zoom: 1 }]), "slide-2");

  /* ลบใบกลางออกแล้วเพิ่มใหม่ ต้องไม่ได้รหัสซ้ำกับใบที่เหลือ */
  let document = heroDocument();
  for (let i = 0; i < 3; i += 1) document = addHeroSlide(document, "hero-1");
  const ids = (heroSlidesOf(document, "hero-1") ?? []).map((slide) => slide.id);
  const middle = ids[1];
  assert.ok(middle !== undefined);
  document = removeHeroSlide(document, "hero-1", middle);
  document = addHeroSlide(document, "hero-1");
  const next = (heroSlidesOf(document, "hero-1") ?? []).map((slide) => slide.id);
  assert.equal(new Set(next).size, next.length, "รหัสต้องไม่ซ้ำกันหลังลบ+เพิ่ม");
  assert.ok(!next.includes(middle) || next.filter((id) => id === middle).length === 1);
});

test("hero slides: ตั้งภาพ/โฟกัส/ซูม + บีบค่าที่หลุดช่วง", () => {
  let document: BlockDocument = { page: "home", blocks: [createBlock("hero", "hero-1"), createBlock("heading", "head-1")] };
  document = addHeroSlide(document, "hero-1");
  const slideId = (heroSlidesOf(document, "hero-1") ?? [])[0]?.id ?? "";

  document = setHeroSlideImage(document, "hero-1", slideId, { path: "/media/abc123", altTh: "ภาพทดสอบ" });
  document = setHeroSlideFocus(document, "hero-1", slideId, -20, 250);
  document = setHeroSlideZoom(document, "hero-1", slideId, 9);

  const slide = (heroSlidesOf(document, "hero-1") ?? [])[0];
  assert.equal(slide?.image?.path, "/media/abc123");
  assert.equal(slide?.image?.altTh, "ภาพทดสอบ");
  assert.equal(slide?.focusX, 0, "ค่าติดลบถูกบีบเป็น 0");
  assert.equal(slide?.focusY, 100, "ค่าเกินถูกบีบเป็น 100");
  assert.equal(slide?.zoom, 2, "ซูมเกินเพดานถูกบีบเป็น 2");

  /* ตั้งภาพทับ = คง alt เดิมไว้เมื่อไม่ได้ส่งมา */
  const reimaged = heroSlidesOf(setHeroSlideImage(document, "hero-1", slideId, { path: "/media/xyz" }), "hero-1")?.[0];
  assert.equal(reimaged?.image?.path, "/media/xyz");
  assert.equal(reimaged?.image?.altTh, "ภาพทดสอบ", "alt เดิมยังอยู่");

  /* ล้างภาพ */
  const cleared = heroSlidesOf(setHeroSlideImage(document, "hero-1", slideId, { path: "   " }), "hero-1")?.[0];
  assert.equal(cleared?.image, null);

  /* บล็อกอื่นไม่ถูกแตะ · เรียกกับ id ที่ไม่ใช่ hero = ไม่ทำอะไร */
  assert.equal(document.blocks[1]?.type, "heading");
  assert.deepEqual(addHeroSlide(document, "head-1"), document);
  assert.deepEqual(addHeroSlide(document, "ไม่มีบล็อกนี้"), document);
  assert.equal(heroSlidesOf(document, "head-1"), null, "บล็อกที่ไม่ใช่ hero = null");
});

test("hero slides: จุดโฟกัส 9 จุด + ระดับซูม + เวลาต่อภาพ มีค่าครบและสมเหตุสมผล", () => {
  assert.equal(HERO_FOCUS_PRESETS.length, 9, "ต้องมี 9 จุด (3×3)");
  assert.equal(new Set(HERO_FOCUS_PRESETS.map((preset) => preset.id)).size, 9, "id ต้องไม่ซ้ำ");
  assert.equal(new Set(HERO_FOCUS_PRESETS.map((preset) => `${preset.x},${preset.y}`)).size, 9, "พิกัดต้องไม่ซ้ำ");
  for (const preset of HERO_FOCUS_PRESETS) {
    assert.ok(preset.x >= 0 && preset.x <= 100, `${preset.id}: x ต้อง 0–100`);
    assert.ok(preset.y >= 0 && preset.y <= 100, `${preset.id}: y ต้อง 0–100`);
  }
  assert.equal(heroFocusPresetId(50, 50), "center");
  assert.equal(heroFocusPresetId(0, 100), "bottom-left");
  assert.equal(heroFocusPresetId(37, 50), null, "ค่าที่ไม่อยู่ในพรีเซ็ต = null (หน้าจอโชว์ 'กำหนดเอง')");

  assert.ok(HERO_ZOOM_PRESETS.includes(1), "ต้องมีระดับ 1× (ไม่ซูม)");
  assert.ok(HERO_ZOOM_PRESETS.every((zoom) => zoom >= 1 && zoom <= 2), "ทุกระดับต้องอยู่ในช่วง 1–2");
  assert.ok(HERO_SLIDE_SECONDS > 0, "เวลาต่อภาพต้องมากกว่า 0");
});

test("hero slides: ตัวอ่านค่าบีบค่าเพี้ยน + ตัดสไลด์เกินเพดาน", () => {
  const parsed = parseBlockDocument(
    "home",
    rawDocument({
      slides: [
        { id: "slide-1", image: null, focusX: 500, focusY: -20, zoom: 9 },
        {
          id: "slide-2",
          image: { path: "/media/x", altTh: "ก", altEn: "", hasWatermark: false },
          focusX: "กลาง",
          focusY: null,
          zoom: 1.4,
        },
      ],
    }),
  );
  assert.equal(parsed.ok, true);
  const slides = parsed.ok ? (heroOf(parsed.document).slides ?? []) : [];
  assert.equal(slides.length, 2);
  assert.equal(slides[0]?.focusX, 100, "เกินเพดาน → 100");
  assert.equal(slides[0]?.focusY, 0, "ติดลบ → 0");
  assert.equal(slides[0]?.zoom, 2, "ซูมเกิน → 2");
  assert.equal(slides[1]?.focusX, 50, "ไม่ใช่ตัวเลข → ค่ากลาง");
  assert.equal(slides[1]?.zoom, 1.4, "ค่าที่ถูกต้องคงไว้");
  assert.equal(slides[1]?.image?.path, "/media/x");

  /* เกินเพดาน: ตัดส่วนเกินทิ้ง (เอกสารยังใช้ได้) */
  const many = Array.from({ length: MAX_HERO_SLIDES + 2 }, (_, index) => ({
    id: `slide-${index + 1}`,
    image: null,
    focusX: 50,
    focusY: 50,
    zoom: 1,
  }));
  const overflow = parseBlockDocument("home", rawDocument({ slides: many }));
  /*
    ⚠️ เกินเพดาน = **รายงานเป็นปัญหา** (เอกสารถูกปฏิเสธ) — ตามแบบเดียวกับ `readCards`/`readGalleryItems`
    หน้าจอไม่ทางสร้างเกินอยู่แล้ว (ปุ่มเพิ่มถูกปิดที่เพดาน) ⇒ เคสนี้เกิดได้เฉพาะข้อมูลที่ถูกแก้ด้วยมือ
  */
  assert.equal(overflow.ok, false, "เกินเพดานต้องถูกรายงาน (ไม่ตัดทิ้งเงียบ ๆ)");
  assert.ok(
    !overflow.ok && overflow.problems.some((problem) => problem.includes("slides") && problem.includes("เกิน")),
    "ข้อความต้องบอกว่าสไลด์เกินเพดาน",
  );

  /* ไม่ใช่อาร์เรย์ = รายงานปัญหา (เหมือนฟิลด์รายการอื่น ๆ ในไฟล์นี้) */
  const bad = parseBlockDocument("home", rawDocument({ slides: "ไม่ใช่อาร์เรย์" }));
  assert.equal(bad.ok, false, "ค่าเพี้ยนต้องถูกรายงาน");
  assert.ok(!bad.ok && bad.problems.some((problem) => problem.includes("slides")));
});

test("hero slides: เอกสารเดิม (ไม่มี slides) ยังใช้ได้เหมือนเดิมเป๊ะ", () => {
  const legacy = parseBlockDocument("home", {
    page: "home",
    blocks: [
      {
        id: "hero-1",
        version: BLOCK_SCHEMA_VERSION,
        type: "hero",
        style: { tone: "brand", width: "wide", align: "center", spacing: "md" },
        title: { th: "หัวข้อเดิม", en: "" },
        subtitle: { th: "", en: "" },
        note: { th: "", en: "" },
        image: { path: "/media/legacy", altTh: "ภาพเดิม", altEn: "", hasWatermark: false },
        ctaLabel: { th: "", en: "" },
        ctaHref: "",
      },
    ],
  });
  assert.equal(legacy.ok, true, legacy.ok ? "" : legacy.problems.join(" | "));
  const block = legacy.ok ? heroOf(legacy.document) : null;
  assert.ok(block !== null);
  assert.deepEqual(block.slides ?? [], [], "เอกสารเดิมได้สไลด์ว่าง (ไม่กระทบการแสดงผลเดิม)");
  assert.equal(block.image?.path, "/media/legacy", "ภาพเดี่ยวยังอยู่ครบ");

  /* createBlock("hero") ต้องไม่ใส่ slides (เอกสารใหม่ยังใช้ภาพเดี่ยวได้เหมือนเดิม) */
  const fresh = createBlock("hero", "hero-1");
  assert.ok(fresh.type === "hero");
  assert.equal(fresh.slides, undefined);
});
