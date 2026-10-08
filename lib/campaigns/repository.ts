/**
 * "แคมเปญ" — ชั้นฐานข้อมูล (รอบที่ 190 · โมดูล "สไลด์ & แคมเปญ")
 *
 * - **หน้าเว็บอ่านผ่านประตูอ่านอย่างเดียว** และ **กรองสถานะ/ช่วงเวลาที่ SQL** ด้วย `now()`
 *   ⇒ ไม่มีตัวจับเวลาในแอป · หน้าเว็บไม่มีทางโชว์แคมเปญร่าง/หมดอายุ
 * - **สไลด์ที่ผูก:** อ่านจาก `campaign_slide` · **ไม่มีแถวผูกเลย = แสดงทุกสไลด์**
 * - หลังบ้านใช้ `getPool()` และเห็นทุกแคมเปญ (ร่าง/หมดเวลา/ปิดไว้) เพื่อจัดการได้
 * - ไม่มี DB/ตารางหาย/อ่านพัง = คืนค่าว่าง (หน้าเว็บไม่พัง)
 */

import { getPool, isDatabaseConfigured } from "@/db/pool";
import { readQuery } from "@/lib/db/read";
import {
  clampAnchor,
  type Campaign,
  type CampaignExtraPage,
  type CampaignInput,
  type CampaignPlacement,
  type CampaignStatus,
  type CampaignText,
} from "@/lib/campaigns/model";

/**
 * เงื่อนไขกลางของ "แคมเปญที่หน้าเว็บควรเห็น" — **แยกเป็นชิ้น** เพื่อสร้างได้ทั้งแบบมี/ไม่มีชื่อตารางนำหน้า
 * (ห้ามพิมพ์ซ้ำ: ถ้าแก้กติกาที่นี่ ทั้งหน้าเว็บและหน้าที่ join จะเปลี่ยนพร้อมกัน)
 */
export function publicCampaignConditions(prefix = ""): readonly string[] {
  return [
    `${prefix}deleted_at is null`,
    `${prefix}is_active`,
    `${prefix}status = 'published'`,
    `(${prefix}starts_at is null or ${prefix}starts_at <= now())`,
    `(${prefix}ends_at is null or ${prefix}ends_at > now())`,
  ];
}

export const PUBLIC_CAMPAIGN_CONDITION = publicCampaignConditions().join(" and ");

type CampaignRow = {
  readonly id: string;
  readonly name: string;
  readonly title_th: string;
  readonly title_en: string;
  readonly body_th: string;
  readonly body_en: string;
  readonly cta_label_th: string;
  readonly cta_label_en: string;
  readonly cta_href: string;
  readonly image_path: string;
  readonly image_alt_th: string;
  readonly image_alt_en: string;
  readonly anchor_x: number;
  readonly anchor_y: number;
  readonly starts_at: Date | string | null;
  readonly ends_at: Date | string | null;
  readonly is_active: boolean;
  readonly status: string;
  readonly sort_order: number;
};

const CAMPAIGN_COLUMNS: readonly string[] = [
  "id", "name", "title_th", "title_en", "body_th", "body_en",
  "cta_label_th", "cta_label_en", "cta_href",
  "image_path", "image_alt_th", "image_alt_en",
  "anchor_x", "anchor_y", "starts_at", "ends_at", "is_active", "status", "sort_order",
];

const COLUMNS = CAMPAIGN_COLUMNS.join(", ");

/**
 * ชื่อคอลัมน์แบบระบุตาราง (`c.id, c.name, …`)
 * ⚠️ จำเป็นเมื่อ **join**: `campaign_placement` มี `anchor_x`/`anchor_y` เหมือนกัน
 *    ⇒ เขียนชื่อลอย ๆ จะได้ `column reference "anchor_x" is ambiguous` (บทเรียนรอบที่ 103)
 */
function columnsOf(prefix: string): string {
  return CAMPAIGN_COLUMNS.map((column) => `${prefix}${column}`).join(", ");
}

/**
 * เงื่อนไขกลางแบบระบุตาราง (`c.deleted_at is null and …`) — ใช้ตอน join กับ `campaign_placement`
 * ⚠️ บทเรียนรอบที่ 198: เคย "เติม prefix ทุกท่อน" ด้วยการ split ⇒ ได้ `c.(starts_at is null …)` = **SQL พัง**
 *    แล้วถูก `try/catch` กลืนเป็น `[]` (หน้าเว็บเงียบ ๆ ไม่มีการ์ด) ⇒ สร้างจากชิ้นเดียวกันแทน + มีเทสต์กัน
 */
export function prefixedPublicCampaignCondition(prefix: string): string {
  return publicCampaignConditions(prefix).join(" and ");
}

function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function toCampaign(row: CampaignRow, slideIds: readonly string[]): Campaign {
  const text = (th: string, en: string): CampaignText => ({ th, en });
  return {
    id: row.id,
    name: row.name,
    title: text(row.title_th, row.title_en),
    body: text(row.body_th, row.body_en),
    ctaLabel: text(row.cta_label_th, row.cta_label_en),
    ctaHref: row.cta_href,
    imagePath: row.image_path,
    imageAltTh: row.image_alt_th,
    imageAltEn: row.image_alt_en,
    anchorX: row.anchor_x,
    anchorY: row.anchor_y,
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    isActive: row.is_active,
    status: row.status === "published" ? "published" : "draft",
    sortOrder: row.sort_order,
    slideIds,
  };
}

/** อ่านสไลด์ที่ผูกกับแคมเปญชุดหนึ่ง (คืนเป็น map: campaignId → slideIds) */
async function linksFor(ids: readonly string[], useReadGate: boolean): Promise<Record<string, string[]>> {
  if (ids.length === 0) return {};
  const grouped: Record<string, string[]> = {};
  if (useReadGate) {
    const result = await readQuery<{ campaign_id: string; slide_id: string }>(
      "select campaign_id, slide_id from campaign_slide where campaign_id = any($1::text[]) order by campaign_id asc, sort_order asc",
      [ids],
    );
    for (const row of result.rows) (grouped[row.campaign_id] ??= []).push(row.slide_id);
  } else {
    const result = await getPool().query<{ campaign_id: string; slide_id: string }>(
      "select campaign_id, slide_id from campaign_slide where campaign_id = any($1::text[]) order by campaign_id asc, sort_order asc",
      [ids],
    );
    for (const row of result.rows) (grouped[row.campaign_id] ??= []).push(row.slide_id);
  }
  return grouped;
}

/**
 * แคมเปญที่ควรแสดงบนหน้าเว็บ **ตอนนี้** (เรียงตาม sort_order)
 * · `slideIds` ว่าง = แสดงทุกสไลด์
 */
export async function listLiveCampaigns(): Promise<readonly Campaign[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await readQuery<CampaignRow>(
      `select ${COLUMNS} from campaign where ${PUBLIC_CAMPAIGN_CONDITION} order by sort_order asc, id asc`,
    );
    const links = await linksFor(result.rows.map((row) => row.id), true);
    return result.rows.map((row) => toCampaign(row, links[row.id] ?? []));
  } catch {
    /* ฐานข้อมูลล่ม/ตารางหาย = หน้าเว็บไม่พัง (แสดงโดยไม่มีการ์ดแคมเปญ) */
    return [];
  }
}

/** แคมเปญทั้งหมดสำหรับหลังบ้าน (รวมร่าง/หมดเวลา/ปิดไว้) */
export async function listCampaignsForAdmin(): Promise<readonly Campaign[]> {
  if (!isDatabaseConfigured()) return [];
  const result = await getPool().query<CampaignRow>(
    `select ${COLUMNS} from campaign where deleted_at is null order by sort_order asc, id asc`,
  );
  const links = await linksFor(result.rows.map((row) => row.id), false);
  return result.rows.map((row) => toCampaign(row, links[row.id] ?? []));
}

/** นับจำนวนแคมเปญที่ยังใช้งาน (กันเกินเพดาน) */
export async function countCampaigns(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const result = await getPool().query<{ total: string }>("select count(*)::text as total from campaign where deleted_at is null");
  return Number(result.rows[0]?.total ?? "0");
}

/** สร้างแคมเปญใหม่ (ฉบับร่าง · ยังไม่ผูกสไลด์ = ทุกสไลด์) */
export async function createCampaign(actor: string): Promise<string | null> {
  const id = `c${Date.now().toString(36)}`;
  const result = await getPool().query(
    `insert into campaign (id, status, updated_by)
     values ($1, 'draft', $2)
     on conflict (id) do nothing`,
    [id, actor],
  );
  return (result.rowCount ?? 0) > 0 ? id : null;
}

/**
 * บันทึกแคมเปญ (ข้อความ/ปุ่ม/จุดยึด/ช่วงเวลา/เปิด-ปิด) + **แทนที่รายการสไลด์ที่ผูก**
 * ⚠️ ประตู: ทำได้เฉพาะแถวที่ยังไม่ถังขยะ · ไม่แตะ `status` (มี action เผยแพร่/ถอนแยก)
 */
export async function updateCampaign(id: string, input: CampaignInput, actor: string): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await client.query(
      `update campaign
          set name = $2, title_th = $3, title_en = $4, body_th = $5, body_en = $6,
              cta_label_th = $7, cta_label_en = $8, cta_href = $9,
              image_path = $10, image_alt_th = $11, image_alt_en = $12,
              anchor_x = $13, anchor_y = $14, starts_at = $15, ends_at = $16, is_active = $17,
              updated_at = now(), updated_by = $18
        where id = $1 and deleted_at is null`,
      [
        id,
        input.name,
        input.title.th,
        input.title.en,
        input.body.th,
        input.body.en,
        input.ctaLabel.th,
        input.ctaLabel.en,
        input.ctaHref,
        input.imagePath,
        input.imageAltTh,
        input.imageAltEn,
        input.anchorX,
        input.anchorY,
        input.startsAt,
        input.endsAt,
        input.isActive,
        actor,
      ],
    );
    if ((result.rowCount ?? 0) === 0) {
      await client.query("rollback");
      return false;
    }

    /* แทนที่รายการสไลด์: เพิ่มที่เลือก + ลบที่ไม่เลือกแล้ว (ทำในทรานแซกชันเดียว) */
    await client.query("delete from campaign_slide where campaign_id = $1 and not (slide_id = any($2::text[]))", [
      id,
      input.slideIds,
    ]);
    if (input.slideIds.length > 0) {
      await client.query(
        `insert into campaign_slide (campaign_id, slide_id, sort_order)
         select $1, slide_id, (row_number() over (order by slide_id)) * 10
           from unnest($2::text[]) as slide_id
         on conflict (campaign_id, slide_id) do nothing`,
        [id, input.slideIds],
      );
    }
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/** ตั้งสถานะเผยแพร่/ถอน (ประตู: ต้องไม่ใช่แถวในถังขยะ) */
export async function setCampaignStatus(id: string, status: CampaignStatus, actor: string): Promise<boolean> {
  const result = await getPool().query(
    `update campaign set status = $2, updated_at = now(), updated_by = $3
      where id = $1 and deleted_at is null`,
    [id, status, actor],
  );
  return (result.rowCount ?? 0) > 0;
}

/** ลบแคมเปญ = ย้ายเข้าถังขยะ (คู่ `deleted_at`/`deleted_by`) */
/* ── ตำแหน่งการ์ดต่อหน้า (รอบที่ 198 · migration 0034) ─────────────────────────── */

export type PlacedCampaign = { readonly campaign: Campaign; readonly anchorX: number; readonly anchorY: number };

/** ตำแหน่งการ์ดของแต่ละแคมเปญบนหน้านั้น (หลังบ้าน) — คีย์ = campaignId */
export async function listCampaignPlacements(
  page: CampaignExtraPage,
): Promise<Record<string, CampaignPlacement>> {
  if (!isDatabaseConfigured()) return {};
  const result = await getPool().query<{
    readonly campaign_id: string;
    readonly anchor_x: number;
    readonly anchor_y: number;
    readonly is_enabled: boolean;
  }>(
    `select campaign_id, anchor_x, anchor_y, is_enabled
       from campaign_placement
      where page = $1`,
    [page],
  );
  return Object.fromEntries(
    result.rows.map((row) => [
      row.campaign_id,
      { anchorX: row.anchor_x, anchorY: row.anchor_y, isEnabled: row.is_enabled },
    ]),
  );
}

/**
 * บันทึกตำแหน่งการ์ดบนหน้านั้น (upsert) · ปิดสวิตช์ = **ลบแถวทิ้ง** (ไม่เก็บของที่ไม่ใช้)
 * จุดยึดถูกบีบให้อยู่ใน 0–100 ด้วยค่ากลาง (`clampAnchor`) — ตรงกับที่ DB บังคับด้วย check
 */
export async function saveCampaignPlacement(
  campaignId: string,
  page: CampaignExtraPage,
  placement: { readonly anchorX: number; readonly anchorY: number; readonly isEnabled: boolean },
  actor: string,
): Promise<boolean> {
  if (!placement.isEnabled) {
    await getPool().query("delete from campaign_placement where campaign_id = $1 and page = $2", [campaignId, page]);
    return true;
  }
  const x = clampAnchor(placement.anchorX);
  const y = clampAnchor(placement.anchorY);
  const result = await getPool().query(
    `insert into campaign_placement (campaign_id, page, anchor_x, anchor_y, is_enabled, updated_by)
     values ($1, $2, $3, $4, true, $5)
     on conflict (campaign_id, page) do update
       set anchor_x = excluded.anchor_x,
           anchor_y = excluded.anchor_y,
           is_enabled = true,
           updated_at = now(),
           updated_by = excluded.updated_by`,
    [campaignId, page, x, y, actor],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * แคมเปญที่ขึ้น **บนหน้านั้น** (หน้าเว็บสาธารณะ) — อ่านผ่านประตูอ่านอย่างเดียว
 * ไม่มี DB/ตารางหาย/อ่านไม่สำเร็จ = คืน `[]` (หน้าเว็บไม่พัง — เหมือน `listLiveCampaigns()`)
 */
export async function listLiveCampaignsOnPage(page: CampaignExtraPage): Promise<readonly PlacedCampaign[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await readQuery<CampaignRow & { readonly placement_anchor_x: number; readonly placement_anchor_y: number }>(
      `select ${columnsOf("c.")}, p.anchor_x as placement_anchor_x, p.anchor_y as placement_anchor_y
         from campaign_placement p
         join campaign c on c.id = p.campaign_id
        where p.page = $1 and p.is_enabled and ${prefixedPublicCampaignCondition("c.")}
        order by c.sort_order asc, c.id asc`,
      [page],
    );
    return result.rows.map((row) => ({
      campaign: toCampaign(row, []),
      anchorX: row.placement_anchor_x,
      anchorY: row.placement_anchor_y,
    }));
  } catch {
    return [];
  }
}

/**
 * แคมเปญที่อยู่ในถัง (ใหม่สุดก่อน) — จอหลังบ้าน (รอบที่ 198)
 *
 * ⚠️ ทำไมจำเป็น: `removeCampaignAction` ย้ายเข้าถังได้ แต่ **ไม่มีทางดู/กู้คืนจากจอเลย**
 *    ⇒ เจ้าของกดลบการ์ดทดสอบแล้วกู้คืนไม่ได้ (ต้องเข้า SQL) — 9 ใบตกค้างในถังตอนพบปัญหา
 */
export async function listTrashedCampaigns(): Promise<readonly Campaign[]> {
  if (!isDatabaseConfigured()) return [];
  const result = await getPool().query<CampaignRow>(
    `select ${COLUMNS} from campaign where deleted_at is not null order by deleted_at desc, id asc`,
  );
  /* หลังบ้านใช้ pool สิทธิ์เต็ม (ไม่ผ่านประตูอ่านสาธารณะ) — เหมือน `listCampaignsForAdmin` */
  const links = await linksFor(result.rows.map((row) => row.id), false);
  return result.rows.map((row) => toCampaign(row, links[row.id] ?? []));
}

/**
 * ลบถาวร — ทำได้เฉพาะแถวที่ **อยู่ในถังเท่านั้น** (ประตู fail-closed อยู่ที่ SQL)
 * ⚠️ รอบที่ 202 (เจ้าของทัก): ก่อนหน้านี้ถังขยะแคมเปญมีแต่ "กู้คืน" ไม่มีทางลบถาวรจากจอเลย
 * ลูกที่ผูกอยู่ (`campaign_slide`, `campaign_placement`) ถูกลบตามด้วย `on delete cascade`
 */
export async function deleteCampaignForever(id: string): Promise<boolean> {
  const result = await getPool().query("delete from campaign where id = $1 and deleted_at is not null", [id]);
  return (result.rowCount ?? 0) > 0;
}

/** ลบถาวร **ทั้งถัง** (ใช้เก็บกวาดการ์ดทดสอบ) — คืนจำนวนที่ลบจริง */
export async function purgeCampaignTrash(): Promise<number> {
  const result = await getPool().query("delete from campaign where deleted_at is not null");
  return result.rowCount ?? 0;
}

/** กู้คืนจากถัง — ทำได้เฉพาะแถวที่อยู่ในถัง (ประตูอยู่ที่ SQL · fail-closed) */
export async function restoreCampaign(id: string): Promise<boolean> {
  const result = await getPool().query(
    `update campaign set deleted_at = null, deleted_by = null, updated_at = now()
      where id = $1 and deleted_at is not null`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function trashCampaign(id: string, actor: string): Promise<boolean> {
  const result = await getPool().query(
    `update campaign set deleted_at = now(), deleted_by = $2, updated_at = now(), updated_by = $2
      where id = $1 and deleted_at is null`,
    [id, actor],
  );
  return (result.rowCount ?? 0) > 0;
}
