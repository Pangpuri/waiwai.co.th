import { HOME_PAGE_SPEC } from "@/lib/content/model";
import type { FieldSpec, ItemContent, LocalizedValue, PageContent } from "@/lib/content/types";

/**
 * **ตัวสร้าง fixture สำหรับเทสต์ของชั้นเนื้อหา (EAV)** — รอบที่ 277 (ปิดหนี้ D-273-1)
 *
 * เหตุผล: seed จริง (`HOME_SEED`) **ไม่มีการ์ดเมนู/ข่าวที่แต่งขึ้นอีกแล้ว** (หน้าแรกอ่านของจริงจาก
 * ฐานข้อมูล) ⇒ เทสต์ที่เป็น "เครื่องจักร" ของชั้นเนื้อหา (ฉบับร่าง · คีย์แถว · validator) ไม่มีรายการ
 * ให้ทดสอบ — ไฟล์นี้สร้างรายการทดสอบให้ **เฉพาะในเทสต์** โดยดึงช่องจาก `HOME_PAGE_SPEC`
 * (ไม่พิมพ์คีย์ซ้ำ ⇒ สคีมาเปลี่ยนแล้วเทสต์ตามได้เอง)
 *
 * ⚠️ ใช้ในเทสต์เท่านั้น — ห้ามนำข้อความในนี้ไปเขียนลงฐานข้อมูลจริงหรือขึ้นเว็บ
 */

/** ค่าทดสอบต่อชนิดของช่อง (placeholder = ตั้งใจ เพื่อให้ validator เตือน "placeholder" ตามที่เทสต์คาด) */
export function fixtureValueOf(field: FieldSpec): LocalizedValue {
  if (field.kind === "date") return { th: "2026-08-19", en: "2026-08-19" };
  if (field.kind === "url") return { th: "/products", en: "/products" };
  return { th: "ข้อมูลทดสอบ", en: "Test data" };
}

/** รายการทดสอบ 2 รายการของกลุ่มหนึ่ง (ดึงช่องจากสคีมาจริง) */
export function fixtureItemsOf(sectionKey: string, groupKey: string, count = 2): readonly ItemContent[] {
  const group = HOME_PAGE_SPEC.sections
    .find((section) => section.key === sectionKey)
    ?.items.find((candidate) => candidate.key === groupKey);
  if (group === undefined) return [];

  return Array.from({ length: count }, (_, index) => ({
    order: index + 1,
    /*
      ⚠️ ช่องชนิด `media` ต้องอยู่ที่ `media` ไม่ใช่ `fields` (ค่าทดสอบเป็นข้อความ ⇒ ไปใส่ผิดที่
      จะทำให้ "ไป-กลับ" ของฉบับร่างไม่เท่าเดิม) · ปล่อย media ว่างไว้ = ค่าที่ถูกต้องของเทสต์นี้
    */
    fields: Object.fromEntries(
      group.fields
        .filter((field) => field.kind !== "media")
        .map((field) => [field.key, fixtureValueOf(field)] as const),
    ),
    media: {},
  }));
}

type MutableSections = Record<string, { fields: Record<string, unknown>; items: Record<string, ItemContent[]> }>;

/**
 * seed + รายการทดสอบของกลุ่มที่เทสต์ต้องใช้ (เมนูอาหาร · ข่าว)
 * คืน `PageContent` ที่เทสต์เอาไปแก้ได้ (เทสต์จะ structuredClone ต่ออีกชั้น)
 */
export function withContentFixture(seed: PageContent): PageContent {
  const copy = structuredClone(seed) as unknown as { page: string; sections: MutableSections };
  for (const [sectionKey, groupKey] of [
    ["recipes", "recipes"],
    ["news", "news"],
  ] as const) {
    const section = copy.sections[sectionKey];
    if (section !== undefined) section.items[groupKey] = [...fixtureItemsOf(sectionKey, groupKey)];
  }
  return copy as unknown as PageContent;
}
