import type { ItemContent, ItemSpec, LocalizedValue, PageContent, PageSpec } from "@/lib/content/types";

/**
 * "ฉบับร่าง" ที่หน้าจอแก้ไขได้ (mutable) — ตรรกะล้วน ทดสอบได้โดยไม่ต้องมี React
 *
 * ทำไมต้องมีชั้นนี้
 * - ชนิดข้อมูลจริง (`PageContent`) เป็น readonly โดยตั้งใจ (กันการแก้พลาดในโค้ดหน้าเว็บ)
 *   แต่หน้าจอแก้ไขต้องแก้ได้ → แปลงเป็นฉบับร่างที่เขียนได้ แล้วแปลงกลับตอนบันทึก
 * - การ "เพิ่ม/ลบรายการ" ต้อง **จัดลำดับใหม่ 1..n เสมอ** เพราะคีย์ในฐานข้อมูลคือ `<กลุ่ม>-<ลำดับ>`
 *   (ถ้าลำดับมีช่องว่าง จะเกิดคีย์แปลก ๆ และ validator จะเตือน `bad-order`)
 * - ตรรกะอยู่ในไฟล์นี้ที่เดียว → เทสต์ได้ครบโดยไม่ต้องเปิดเบราว์เซอร์
 */

export type DraftText = { th: string; en: string };
export type DraftMedia = { path: string; altTh: string; altEn: string; hasWatermark: boolean };
export type DraftItem = { order: number; fields: Record<string, DraftText>; media: Record<string, DraftMedia> };
export type DraftSection = { fields: Record<string, DraftText>; items: Record<string, DraftItem[]> };
export type Draft = { page: string; sections: Record<string, DraftSection> };

export type Language = "th" | "en";

const EMPTY_TEXT: DraftText = { th: "", en: "" };

function cloneSection(section: DraftSection): DraftSection {
  const fields: Record<string, DraftText> = {};
  for (const [key, value] of Object.entries(section.fields)) fields[key] = { ...value };

  const items: Record<string, DraftItem[]> = {};
  for (const [key, list] of Object.entries(section.items)) {
    items[key] = list.map((item) => {
      const itemFields: Record<string, DraftText> = {};
      for (const [fieldKey, value] of Object.entries(item.fields)) itemFields[fieldKey] = { ...value };
      const itemMedia: Record<string, DraftMedia> = {};
      for (const [fieldKey, value] of Object.entries(item.media)) itemMedia[fieldKey] = { ...value };
      return { order: item.order, fields: itemFields, media: itemMedia };
    });
  }

  return { fields, items };
}

function cloneDraft(draft: Draft): Draft {
  const sections: Record<string, DraftSection> = {};
  for (const [key, section] of Object.entries(draft.sections)) sections[key] = cloneSection(section);
  return { page: draft.page, sections };
}

/**
 * สร้างฉบับร่างจากเนื้อหาที่อ่านจาก DB — **เติมโครงให้ครบตาม spec เสมอ**
 * (section/ฟิลด์/กลุ่มที่ยังไม่มีข้อมูลใน DB จะได้ช่องว่างให้กรอก ไม่ใช่หายไปจากหน้าจอ)
 */
export function toDraft(spec: PageSpec, content: PageContent): Draft {
  const sections: Record<string, DraftSection> = {};

  for (const sectionSpec of spec.sections) {
    const existing = content.sections[sectionSpec.key];

    const fields: Record<string, DraftText> = {};
    for (const field of sectionSpec.fields) {
      if (field.kind === "media") continue;
      const value = existing?.fields[field.key];
      fields[field.key] = value === undefined ? { ...EMPTY_TEXT } : { th: value.th, en: value.en };
    }

    const items: Record<string, DraftItem[]> = {};
    for (const group of sectionSpec.items) {
      const list = existing?.items[group.key] ?? [];
      items[group.key] = list.map((item) => {
        const itemFields: Record<string, DraftText> = {};
        const itemMedia: Record<string, DraftMedia> = {};

        for (const field of group.fields) {
          if (field.kind === "media") {
            const media = item.media[field.key];
            if (media !== undefined) itemMedia[field.key] = { ...media };
          } else {
            const value = item.fields[field.key];
            itemFields[field.key] = value === undefined ? { ...EMPTY_TEXT } : { th: value.th, en: value.en };
          }
        }

        return { order: item.order, fields: itemFields, media: itemMedia };
      });
    }

    sections[sectionSpec.key] = { fields, items };
  }

  return { page: spec.page, sections };
}

/** แปลงฉบับร่างกลับเป็นชนิดข้อมูลจริง (ส่งเข้า validator / บันทึกลง DB / ทำ JSON) */
export function toContent(draft: Draft): PageContent {
  const sections: Record<string, { fields: Record<string, LocalizedValue>; items: Record<string, ItemContent[]> }> = {};

  for (const [sectionKey, section] of Object.entries(draft.sections)) {
    const items: Record<string, ItemContent[]> = {};
    for (const [groupKey, list] of Object.entries(section.items)) {
      items[groupKey] = list.map((item) => ({
        order: item.order,
        fields: item.fields,
        media: item.media,
      }));
    }
    sections[sectionKey] = { fields: section.fields, items };
  }

  return { page: draft.page, sections };
}

export function setSectionText(draft: Draft, sectionKey: string, fieldKey: string, language: Language, value: string): Draft {
  const next = cloneDraft(draft);
  const target = next.sections[sectionKey]?.fields[fieldKey];
  if (target === undefined) return draft;
  target[language] = value;
  return next;
}

export function setItemText(
  draft: Draft,
  sectionKey: string,
  groupKey: string,
  index: number,
  fieldKey: string,
  language: Language,
  value: string,
): Draft {
  const next = cloneDraft(draft);
  const target = next.sections[sectionKey]?.items[groupKey]?.[index]?.fields[fieldKey];
  if (target === undefined) return draft;
  target[language] = value;
  return next;
}

export function setItemMedia(
  draft: Draft,
  sectionKey: string,
  groupKey: string,
  index: number,
  fieldKey: string,
  patch: Partial<DraftMedia>,
): Draft {
  const next = cloneDraft(draft);
  const item = next.sections[sectionKey]?.items[groupKey]?.[index];
  if (item === undefined) return draft;

  const current = item.media[fieldKey] ?? { path: "", altTh: "", altEn: "", hasWatermark: false };
  item.media[fieldKey] = { ...current, ...patch };
  return next;
}

/** เพิ่มรายการใหม่ (ช่องข้อความว่างทุกช่อง) · ไม่ทำอะไรถ้าเต็มแล้ว */
export function canAddItem(draft: Draft, sectionKey: string, group: ItemSpec): boolean {
  const list = draft.sections[sectionKey]?.items[group.key] ?? [];
  return list.length < group.maxItems;
}

export function addItem(draft: Draft, sectionKey: string, group: ItemSpec): Draft {
  if (!canAddItem(draft, sectionKey, group)) return draft;

  const next = cloneDraft(draft);
  const list = next.sections[sectionKey]?.items[group.key];
  if (list === undefined) return draft;

  const fields: Record<string, DraftText> = {};
  for (const field of group.fields) {
    if (field.kind !== "media") fields[field.key] = { ...EMPTY_TEXT };
  }

  list.push({ order: list.length + 1, fields, media: {} });
  return next;
}

/** ลบรายการ แล้ว **จัดลำดับใหม่ 1..n** (คีย์ใน DB คือ `<กลุ่ม>-<ลำดับ>` จึงห้ามมีช่องว่าง) */
export function removeItem(draft: Draft, sectionKey: string, groupKey: string, index: number): Draft {
  const next = cloneDraft(draft);
  const list = next.sections[sectionKey]?.items[groupKey];
  if (list === undefined || index < 0 || index >= list.length) return draft;

  list.splice(index, 1);
  list.forEach((item, position) => {
    item.order = position + 1;
  });
  return next;
}
