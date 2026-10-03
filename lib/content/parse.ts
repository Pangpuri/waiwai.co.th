import type {
  FieldSpec,
  ItemContent,
  LocalizedValue,
  MediaValue,
  PageContent,
  PageSpec,
} from "@/lib/content/types";

/**
 * แปลง "สิ่งที่ฟอร์มส่งมา" (unknown) เป็นโครงเนื้อหาที่เชื่อถือได้
 *
 * กติกาโปรเจกต์: *parse every external input* — ข้อมูลจากเบราว์เซอร์เชื่อไม่ได้แม้จะมาจากหน้าจอของเราเอง
 * (ผู้ใช้แก้ DOM ได้ · โค้ดฝั่ง client พังได้ · และต้องกัน JSON ที่รูปทรงผิด)
 *
 * หลักการ
 * - **ไม่โยน exception** และไม่ทำให้หน้าจอพัง → คืน `problems` กลับไปให้แสดง
 * - ค่าที่หายไปถือเป็นค่าว่าง (`""`) แล้วปล่อยให้ `validateContent()` เป็นคนบอกว่า "จำเป็นต้องมี"
 *   → ไม่รายงานซ้ำซ้อน และข้อความ error มาจากที่เดียว
 * - รายงานปัญหาเฉพาะกรณี **ชนิดข้อมูลผิด** (เช่น `th` เป็นตัวเลข · `items` ไม่ใช่ array · เกินจำนวนที่อนุญาต)
 */

export type ParseOutcome =
  | { readonly ok: true; readonly content: PageContent }
  | { readonly ok: false; readonly problems: readonly string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(container: Record<string, unknown>, key: string, path: string, problems: string[]): string {
  const value = container[key];
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    problems.push(`${path}: ต้องเป็นข้อความ`);
    return "";
  }
  return value;
}

function readLocalized(container: Record<string, unknown> | undefined, key: string, path: string, problems: string[]): LocalizedValue {
  if (container === undefined) return { th: "", en: "" };
  const value = container[key];
  if (value === undefined || value === null) return { th: "", en: "" };
  if (!isRecord(value)) {
    problems.push(`${path}: ต้องเป็นออบเจ็กต์ {th, en}`);
    return { th: "", en: "" };
  }
  return {
    th: readText(value, "th", `${path}.th`, problems),
    en: readText(value, "en", `${path}.en`, problems),
  };
}

/** ภาพที่ไม่มีพาธ = ไม่มีค่า (ตรงกับพฤติกรรมของ seed และการอ่านจาก DB) */
function readMedia(container: Record<string, unknown> | undefined, key: string, path: string, problems: string[]): MediaValue | null {
  if (container === undefined) return null;
  const value = container[key];
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    problems.push(`${path}: ต้องเป็นออบเจ็กต์ของภาพ`);
    return null;
  }

  const mediaPath = readText(value, "path", `${path}.path`, problems);
  if (mediaPath === "") return null;

  const watermark = value["hasWatermark"];
  if (watermark !== undefined && watermark !== null && typeof watermark !== "boolean") {
    problems.push(`${path}.hasWatermark: ต้องเป็น true/false`);
  }

  return {
    path: mediaPath,
    altTh: readText(value, "altTh", `${path}.altTh`, problems),
    altEn: readText(value, "altEn", `${path}.altEn`, problems),
    hasWatermark: watermark === true,
  };
}

function readOrder(value: unknown, fallback: number, path: string, problems: string[]): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    problems.push(`${path}.order: ต้องเป็นตัวเลข`);
    return fallback;
  }
  return Math.trunc(value);
}

function readItems(
  raw: unknown,
  fields: readonly FieldSpec[],
  groupKey: string,
  sectionKey: string,
  maxItems: number | undefined,
  problems: string[],
): readonly ItemContent[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    problems.push(`${sectionKey}.${groupKey}: ต้องเป็นรายการ (array)`);
    return [];
  }

  const capped = maxItems === undefined ? raw : raw.slice(0, maxItems);
  if (maxItems !== undefined && raw.length > maxItems) {
    problems.push(`${sectionKey}.${groupKey}: เกินจำนวนที่อนุญาต (${raw.length} > ${maxItems}) — ตัดส่วนเกินทิ้ง`);
  }

  return capped.map((entry, index) => {
    const path = `${sectionKey}.${groupKey}[${index}]`;
    if (!isRecord(entry)) {
      problems.push(`${path}: ต้องเป็นออบเจ็กต์`);
      return { order: index + 1, fields: {}, media: {} };
    }

    const textContainer = isRecord(entry["fields"]) ? entry["fields"] : undefined;
    const mediaContainer = isRecord(entry["media"]) ? entry["media"] : undefined;
    if (entry["fields"] !== undefined && textContainer === undefined) {
      problems.push(`${path}.fields: ต้องเป็นออบเจ็กต์`);
    }
    if (entry["media"] !== undefined && mediaContainer === undefined) {
      problems.push(`${path}.media: ต้องเป็นออบเจ็กต์`);
    }

    const itemFields: Record<string, LocalizedValue> = {};
    const itemMedia: Record<string, MediaValue> = {};

    for (const field of fields) {
      if (field.kind === "media") {
        const media = readMedia(mediaContainer, field.key, `${path}.media.${field.key}`, problems);
        if (media !== null) itemMedia[field.key] = media;
      } else {
        itemFields[field.key] = readLocalized(textContainer, field.key, `${path}.fields.${field.key}`, problems);
      }
    }

    return {
      order: readOrder(entry["order"], index + 1, path, problems),
      fields: itemFields,
      media: itemMedia,
    };
  });
}

export function parsePageContent(spec: PageSpec, raw: unknown): ParseOutcome {
  const problems: string[] = [];

  if (!isRecord(raw)) {
    return { ok: false, problems: ["ข้อมูลที่ส่งมาไม่ใช่ออบเจ็กต์"] };
  }

  const rawSections = raw["sections"];
  if (!isRecord(rawSections)) {
    return { ok: false, problems: ["ไม่พบ sections ในข้อมูลที่ส่งมา"] };
  }

  const sections: Record<string, { fields: Record<string, LocalizedValue>; items: Record<string, readonly ItemContent[]> }> = {};

  for (const section of spec.sections) {
    const rawSection = rawSections[section.key];
    if (rawSection !== undefined && !isRecord(rawSection)) {
      problems.push(`${section.key}: ต้องเป็นออบเจ็กต์`);
    }
    const sectionRecord = isRecord(rawSection) ? rawSection : {};

    const rawFields = isRecord(sectionRecord["fields"]) ? sectionRecord["fields"] : {};
    if (sectionRecord["fields"] !== undefined && !isRecord(sectionRecord["fields"])) {
      problems.push(`${section.key}.fields: ต้องเป็นออบเจ็กต์`);
    }

    const fields: Record<string, LocalizedValue> = {};
    for (const field of section.fields) {
      if (field.kind === "media") continue;
      fields[field.key] = readLocalized(rawFields, field.key, `${section.key}.fields.${field.key}`, problems);
    }

    const rawItems = isRecord(sectionRecord["items"]) ? sectionRecord["items"] : {};
    if (sectionRecord["items"] !== undefined && !isRecord(sectionRecord["items"])) {
      problems.push(`${section.key}.items: ต้องเป็นออบเจ็กต์`);
    }

    const items: Record<string, readonly ItemContent[]> = {};
    for (const group of section.items) {
      items[group.key] = readItems(rawItems[group.key], group.fields, group.key, section.key, group.maxItems, problems);
    }

    sections[section.key] = { fields, items };
  }

  if (problems.length > 0) {
    return { ok: false, problems };
  }

  return { ok: true, content: { page: spec.page, sections } };
}
