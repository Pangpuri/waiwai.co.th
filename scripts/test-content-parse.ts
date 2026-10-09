import assert from "node:assert/strict";
import { test } from "node:test";

import { HOME_SEED } from "@/lib/content/home-seed";
import { HOME_PAGE_SPEC } from "@/lib/content/model";
import { parsePageContent } from "@/lib/content/parse";
import { errorsOf, validateContent } from "@/lib/content/validate";

/** เทสต์ของตัวตรวจข้อมูลที่ส่งมาจากฟอร์ม (pure) — "parse every external input" */

function fromSeed(): unknown {
  return JSON.parse(JSON.stringify(HOME_SEED));
}

test("parse: JSON ที่ส่งกลับไปกลับมาได้ครบ (seed → JSON → parse)", () => {
  const outcome = parsePageContent(HOME_PAGE_SPEC, fromSeed());
  assert.equal(outcome.ok, true);
  assert.ok(outcome.ok);

  const issues = errorsOf(validateContent(HOME_PAGE_SPEC, outcome.content));
  assert.equal(issues.length, 0, `เนื้อหาที่ parse แล้วต้องผ่าน validator (พบ ${issues.length} error)`);

  /* ค่าที่ควรเท่าเดิมทั้งหมด (ถ้า parse ทำข้อมูลหาย จะเจอที่นี่) */
  assert.deepEqual(outcome.content, HOME_SEED);
});

test("parse: ข้อมูลที่ไม่ใช่ออบเจ็กต์ / ไม่มี sections → ปฏิเสธพร้อมเหตุผล", () => {
  for (const bad of [null, undefined, 42, "ข้อความ", [], {}]) {
    const outcome = parsePageContent(HOME_PAGE_SPEC, bad);
    assert.equal(outcome.ok, false, `ต้องปฏิเสธ: ${JSON.stringify(bad)}`);
    assert.ok(!outcome.ok);
    assert.ok(outcome.problems.length > 0);
  }
});

test("parse: ชนิดข้อมูลผิด → รายงานปัญหา ไม่โยน error", () => {
  const broken = {
    sections: {
      hero: { fields: { title: { th: 123, en: "ok" } } },
      /* ⚠️ รอบที่ 251: กลุ่มตัวอย่างต้องเป็นของ section ที่มีกลุ่มนั้นจริง (products/categories) */
      products: { items: { categories: "ไม่ใช่ array" } },
    },
  };

  const outcome = parsePageContent(HOME_PAGE_SPEC, broken);
  assert.equal(outcome.ok, false);
  assert.ok(!outcome.ok);
  assert.ok(outcome.problems.some((problem) => problem.includes("hero.fields.title.th")));
  assert.ok(outcome.problems.some((problem) => problem.includes("products.categories")));
});

test("parse: section/รายการที่หายไปถือเป็นค่าว่าง แล้วให้ validator เป็นคนบอกว่าจำเป็น", () => {
  const outcome = parsePageContent(HOME_PAGE_SPEC, { sections: {} });
  assert.equal(outcome.ok, true);
  assert.ok(outcome.ok);

  assert.equal(outcome.content.sections.hero?.fields.title?.th, "");
  assert.deepEqual(outcome.content.sections.products?.items.categories, []);

  const issues = errorsOf(validateContent(HOME_PAGE_SPEC, outcome.content));
  assert.ok(issues.length > 0, "validator ต้องบอกว่าฟิลด์ที่จำเป็นว่าง (ไทยห้ามว่าง)");
});

test("parse: รายการเกินจำนวน → ยังคืนข้อมูลที่ตัดแล้ว (ไม่ทิ้งทั้งก้อน)", () => {
  const group = HOME_PAGE_SPEC.sections.find((section) => section.key === "whereToBuy")?.items.find((item) => item.key === "marketplaces");
  assert.ok(group?.maxItems, "กลุ่ม marketplaces ต้องมี maxItems");

  const many = Array.from({ length: group.maxItems + 1 }, (_unused, index) => ({
    order: index + 1,
    fields: { name: { th: `ร้าน ${index + 1}`, en: "" } },
  }));

  const outcome = parsePageContent(HOME_PAGE_SPEC, { sections: { whereToBuy: { items: { marketplaces: many } } } });
  assert.ok(!outcome.ok, "ต้องรายงานว่าเกิน");
  assert.ok(outcome.problems.some((problem) => problem.includes("เกินจำนวนที่อนุญาต")));
});

test("parse: ภาพที่ไม่มีพาธ = ไม่มีค่า · มีพาธ = ได้ค่า พร้อม alt", () => {
  const outcome = parsePageContent(HOME_PAGE_SPEC, {
    sections: {
      hero: {
        items: {
          card: [{ order: 1, fields: { title: { th: "หัวข้อ", en: "" } }, media: { image: { path: "", altTh: "ไม่ใช้", altEn: "" } } }],
        },
      },
      recipes: {
        items: {
          recipes: [
            {
              order: 1,
              fields: { name: { th: "ผัดไทย", en: "Pad Thai" } },
              media: { image: { path: "/products/pad-thai.jpg", altTh: "ผัดไทย", altEn: "Pad Thai", hasWatermark: true } },
            },
          ],
        },
      },
    },
  });

  assert.equal(outcome.ok, true);
  assert.ok(outcome.ok);

  assert.equal(outcome.content.sections.hero?.items.card?.[0]?.media.image, undefined, "พาธว่าง = ไม่มีภาพ");
  const recipeImage = outcome.content.sections.recipes?.items.recipes?.[0]?.media.image;
  assert.ok(recipeImage);
  assert.equal(recipeImage.path, "/products/pad-thai.jpg");
  assert.equal(recipeImage.hasWatermark, true);
});

test("parse: ไม่มี order → ใช้ลำดับในอาร์เรย์ และคีย์ที่ไม่รู้จักถูกเมิน", () => {
  const outcome = parsePageContent(HOME_PAGE_SPEC, {
    sections: {
      hero: {
        fields: { title: { th: "ก", en: "", อะไรก็ได้: "เมิน" } },
        อะไรก็ได้: true,
      },
      /* รอบที่ 251: ใช้กลุ่มที่มีจริง (products/categories) — เดิมใช้ hero/slides ที่ถูกถอดออก */
      products: {
        items: { categories: [{ fields: { name: { th: "กลาง", en: "" } } }, { fields: { name: { th: "ขวา", en: "" } } }] },
      },
    },
  });

  assert.equal(outcome.ok, true);
  assert.ok(outcome.ok);
  assert.deepEqual(
    outcome.content.sections.products?.items.categories?.map((item) => item.order),
    [1, 2],
  );
});
