import { BLOCK_SCHEMA_VERSION, DEFAULT_BLOCK_STYLE, type BlockCard } from "@/lib/blocks/types";

/**
 * เครื่องมือกลางสำหรับสร้าง **เทมเพลตบล็อกตั้งต้น** ของแต่ละหน้า (S2)
 *
 * ทำไมต้องมีไฟล์นี้
 * - เทมเพลตของแต่ละหน้าต้องมีรูปทรงเดียวกัน (สไตล์ · id ของบล็อก · วิธีจับคู่การ์ด TH/EN)
 *   ⇒ ถ้าต่างคนต่างเขียน เดี๋ยวรุ่นข้อมูลจะเพี้ยนคนละแบบ และเทสต์จะจับได้ช้า
 * - เดิม helper เหล่านี้อยู่ใน `home-template.ts` ไฟล์เดียว ⇒ พอเพิ่มหน้าใหม่ต้องคัดลอก
 */

/** สไตล์ของบล็อก = ค่าเริ่มต้นของโปรเจกต์ + ส่วนที่ override (ห้ามใส่ hex/ฟอนต์เอง — มติ D10) */
export function templateStyle(overrides: Partial<typeof DEFAULT_BLOCK_STYLE> = {}): typeof DEFAULT_BLOCK_STYLE {
  return { ...DEFAULT_BLOCK_STYLE, ...overrides };
}

/** id ของบล็อกในเทมเพลต — เรียงตามลำดับ (ต้องไม่ซ้ำในเอกสารเดียว) */
export function templateBlockId(index: number): string {
  return `block-${String(index + 1)}`;
}

export type DictCard = { readonly name?: string; readonly title?: string; readonly description?: string; readonly body?: string };

function cardText(item: DictCard | undefined): { readonly title: string; readonly body: string } {
  if (item === undefined) return { title: "", body: "" };
  return {
    title: item.name ?? item.title ?? "",
    body: item.description ?? item.body ?? "",
  };
}

/**
 * การ์ด TH/EN จับคู่ด้วย **คีย์เดียวกัน** (ไม่ใช่ลำดับ)
 * ⇒ ถ้าคำแปลอังกฤษหาย การ์ดไทยยังอยู่ครบ (เหมือนเทมเพลตหน้าแรก)
 */
export function templateCards(
  thMap: Readonly<Record<string, DictCard>>,
  enMap: Readonly<Record<string, DictCard>>,
  limit?: number,
): readonly BlockCard[] {
  const entries = Object.entries(thMap);
  const capped = limit === undefined ? entries : entries.slice(0, limit);

  return capped.map(([key, item]) => {
    const th = cardText(item);
    const en = cardText(enMap[key]);
    return {
      title: { th: th.title, en: en.title },
      body: { th: th.body, en: en.body },
      href: "",
      image: null,
    };
  });
}

/** การ์ดคู่ label/value (ใช้กับการ์ดตัวเลข/ข้อเท็จจริง) */
export function templateValueCards(
  pairs: readonly { readonly label: string; readonly value: string }[],
  enPairs: readonly { readonly label: string; readonly value: string }[],
): readonly BlockCard[] {
  return pairs.map((pair, index) => ({
    title: { th: pair.value, en: enPairs[index]?.value ?? "" },
    body: { th: pair.label, en: enPairs[index]?.label ?? "" },
    href: "",
    image: null,
  }));
}

/** เวอร์ชันรูปทรงที่เทมเพลตทุกตัวใช้ (ที่เดียว) */
export const TEMPLATE_BLOCK_VERSION = BLOCK_SCHEMA_VERSION;

/** การ์ดจากแผนที่ "ข้อความล้วน" (`Record<string, string>`) — เช่น รายชื่อฝ่ายที่เปิดรับ */
export function templateTextCards(
  thMap: Readonly<Record<string, string>>,
  enMap: Readonly<Record<string, string>>,
  limit?: number,
): readonly BlockCard[] {
  const entries = Object.entries(thMap);
  const capped = limit === undefined ? entries : entries.slice(0, limit);

  return capped.map(([key, label]) => ({
    title: { th: label, en: enMap[key] ?? "" },
    body: { th: "", en: "" },
    href: "",
    image: null,
  }));
}
