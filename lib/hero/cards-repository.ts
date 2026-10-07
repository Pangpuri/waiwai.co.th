/**
 * "การ์ดบนสไลด์" — ชั้นฐานข้อมูล (รอบที่ 188 · โมดูล "สไลด์ & แคมเปญ")
 *
 * - **หน้าเว็บอ่านผ่านประตูอ่านอย่างเดียว** และ **กรองช่วงเวลาแคมเปญที่ SQL** ด้วย `now()` ของฐานข้อมูล
 *   ⇒ ไม่ต้องมีตัวจับเวลาในแอป · หน้าเว็บไม่มีทางโชว์แคมเปญที่หมดอายุ/ยังไม่เริ่ม
 * - ไม่มี DB/ตารางหาย/อ่านพัง = คืนค่าว่าง (หน้าเว็บไม่พัง — ถอยไปแสดงโดยไม่มีการ์ด)
 * - หลังบ้านใช้ `getPool()` และเห็นทุกการ์ด (รวมที่ยังไม่เริ่ม/หมดอายุ) เพื่อจัดการได้
 */

import { getPool, isDatabaseConfigured } from "@/db/pool";
import { readQuery } from "@/lib/db/read";
import {
  type HeroCard,
  type HeroCardInput,
  type HeroCardPosition,
  type HeroCardText,
} from "@/lib/hero/cards";

/** เงื่อนไขกลางของ "การ์ดที่หน้าเว็บควรเห็น" — ที่เดียว (ห้ามพิมพ์ซ้ำ) */
export const PUBLIC_HERO_CARD_CONDITION =
  "deleted_at is null and is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())";

type HeroCardRow = {
  readonly id: string;
  readonly slide_id: string;
  readonly sort_order: number;
  readonly title_th: string;
  readonly title_en: string;
  readonly body_th: string;
  readonly body_en: string;
  readonly cta_label_th: string;
  readonly cta_label_en: string;
  readonly cta_href: string;
  readonly position: string;
  readonly starts_at: Date | string | null;
  readonly ends_at: Date | string | null;
  readonly is_active: boolean;
};

const SELECT_COLUMNS = `id, slide_id, sort_order, title_th, title_en, body_th, body_en,
       cta_label_th, cta_label_en, cta_href, position, starts_at, ends_at, is_active`;

function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function toCard(row: HeroCardRow): HeroCard {
  const position: HeroCardPosition = row.position === "center" || row.position === "right" ? row.position : "left";
  return {
    id: row.id,
    slideId: row.slide_id,
    sortOrder: row.sort_order,
    title: { th: row.title_th, en: row.title_en },
    body: { th: row.body_th, en: row.body_en },
    ctaLabel: { th: row.cta_label_th, en: row.cta_label_en },
    ctaHref: row.cta_href,
    position,
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    isActive: row.is_active,
  };
}

/**
 * การ์ดที่ควรแสดงบนหน้าเว็บ **ตอนนี้** — จัดกลุ่มตามสไลด์
 * คืน `Map` แบบธรรมดา (Object) ให้ส่งข้าม RSC ได้
 */
export async function listLiveHeroCards(): Promise<Readonly<Record<string, readonly HeroCard[]>>> {
  if (!isDatabaseConfigured()) return {};
  try {
    const result = await readQuery<HeroCardRow>(
      `select ${SELECT_COLUMNS} from hero_slide_card
        where ${PUBLIC_HERO_CARD_CONDITION}
        order by slide_id asc, sort_order asc, id asc`,
    );
    const grouped: Record<string, HeroCard[]> = {};
    for (const row of result.rows) {
      const card = toCard(row);
      (grouped[card.slideId] ??= []).push(card);
    }
    return grouped;
  } catch {
    /* ฐานข้อมูลล่ม/ตารางหาย = หน้าเว็บไม่พัง (แสดงโดยไม่มีการ์ด) */
    return {};
  }
}

/** การ์ดทั้งหมดของทุกสไลด์ (หลังบ้าน) — เห็นแม้ยังไม่เริ่ม/หมดอายุ/ปิดไว้ */
export async function listHeroCardsForAdmin(): Promise<readonly HeroCard[]> {
  if (!isDatabaseConfigured()) return [];
  const result = await getPool().query<HeroCardRow>(
    `select ${SELECT_COLUMNS} from hero_slide_card where deleted_at is null order by slide_id asc, sort_order asc, id asc`,
  );
  return result.rows.map(toCard);
}

/** เพิ่มการ์ดใหม่ให้สไลด์ (เริ่มด้วยข้อความว่าง — แอดมินกรอกเอง) */
export async function createHeroCard(slideId: string, actor: string): Promise<string | null> {
  const id = `card-${Date.now().toString(36)}`;
  const result = await getPool().query(
    `insert into hero_slide_card (id, slide_id, sort_order, updated_by)
     values ($1, $2, (select coalesce(max(sort_order), 0) + 10 from hero_slide_card where slide_id = $2), $3)
     on conflict (id) do nothing`,
    [id, slideId, actor],
  );
  return (result.rowCount ?? 0) > 0 ? id : null;
}

/** บันทึกการ์ด (ข้อความ/ลิงก์/ตำแหน่ง/ช่วงเวลา/เปิด-ปิด) — ประตู: ต้องเป็นแถวที่ยังไม่ถังขยะ */
export async function updateHeroCard(id: string, input: HeroCardInput, actor: string): Promise<boolean> {
  const result = await getPool().query(
    `update hero_slide_card
        set title_th = $2, title_en = $3, body_th = $4, body_en = $5,
            cta_label_th = $6, cta_label_en = $7, cta_href = $8, position = $9,
            starts_at = $10, ends_at = $11, is_active = $12,
            updated_at = now(), updated_by = $13
      where id = $1 and deleted_at is null`,
    [
      id,
      input.title.th,
      input.title.en,
      input.body.th,
      input.body.en,
      input.ctaLabel.th,
      input.ctaLabel.en,
      input.ctaHref,
      input.position,
      input.startsAt,
      input.endsAt,
      input.isActive,
      actor,
    ],
  );
  return (result.rowCount ?? 0) > 0;
}

/** ลบการ์ด = ย้ายเข้าถังขยะ (คู่ `deleted_at`/`deleted_by`) */
export async function trashHeroCard(id: string, actor: string): Promise<boolean> {
  const result = await getPool().query(
    `update hero_slide_card set deleted_at = now(), deleted_by = $2, updated_at = now(), updated_by = $2
      where id = $1 and deleted_at is null`,
    [id, actor],
  );
  return (result.rowCount ?? 0) > 0;
}

/** ข้อความเปล่า (ใช้ตอนสร้างการ์ดใหม่/แสดงตัวอย่าง) */
export const EMPTY_HERO_CARD_TEXT: HeroCardText = { th: "", en: "" };
