import type { PoolClient } from "pg";

import { getPool, withTransaction } from "@/db/pool";
import { readQuery } from "@/lib/db/read";
import { recordAudit } from "@/lib/audit/log";
import { countRawBlocks, migrateDocumentValue, storedVersionSummary } from "@/lib/blocks/migrate";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { HISTORY_PANEL_LIMIT, MAX_PAGE_REVISIONS } from "@/lib/blocks/revision-plan";
import type { BlockDocument } from "@/lib/blocks/types";

/**
 * ที่เก็บ "เอกสารบล็อก" (draft / published) + ประวัติย้อนกลับ — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * กติกา
 * - ทุกอย่างอยู่ใน DB ไม่มีไฟล์บนดิสก์ ⇒ ย้ายโฮสต์/Docker ได้ (มติ D9)
 * - 「เผยแพร่」 = คัดลอก draft → published **และ** บันทึกประวัติในทรานแซกชันเดียว
 *   (ถ้าขั้นใดพัง ต้องไม่เหลือสภาพ "เผยแพร่ครึ่งทาง")
 * - เอกสารถูกเก็บเป็น `jsonb` ทั้งก้อน — ตรวจรูปทรงด้วย `parseBlockDocument()` ตอนอ่านเสมอ
 *   (ข้อมูลใน DB อาจมาจากเวอร์ชันก่อนของโค้ด → ห้ามเชื่อ)
 */

export type DocumentStatus = "draft" | "published";

export type LoadedDocumentRow = {
  /** ค่าดิบจาก jsonb — ต้องผ่าน `parseBlockDocument()` ก่อนใช้เสมอ */
  readonly raw: unknown;
  readonly updatedAt: string;
  readonly updatedBy: string | null;
  readonly publishedAt: string | null;
};

export type RevisionSummary = {
  readonly revision: number;
  readonly note: string | null;
  readonly createdAt: string;
  readonly createdBy: string | null;
  readonly blockCount: number;
};

type RawDocumentRow = {
  document: unknown;
  updated_at: Date;
  updated_by: string | null;
  published_at: Date | null;
};

/** อ่านเอกสารตามสถานะ — คืน null เมื่อยังไม่มีแถว */
export async function loadDocumentRow(page: string, status: DocumentStatus): Promise<LoadedDocumentRow | null> {
  const result = await readQuery<RawDocumentRow>(
    `select document, updated_at, updated_by, published_at from page_document where page = $1 and status = $2`,
    [page, status],
  );

  const row = result.rows[0];
  if (row === undefined) return null;

  return {
    raw: row.document,
    updatedAt: row.updated_at.toISOString(),
    updatedBy: row.updated_by,
    publishedAt: row.published_at === null ? null : row.published_at.toISOString(),
  };
}

/** บันทึกฉบับร่าง (ไม่มีประวัติ — ประวัติเกิดตอนเผยแพร่) */
export async function saveDraft(page: string, document: BlockDocument, actor: string): Promise<void> {
  await getPool().query(
    `insert into page_document (page, status, document, updated_at, updated_by)
       values ($1, 'draft', $2::jsonb, now(), $3)
     on conflict (page, status) do update set
       document = excluded.document,
       updated_at = now(),
       updated_by = excluded.updated_by`,
    [page, JSON.stringify(document), actor],
  );
}

/**
 * บันทึกฉบับร่างแบบ JSON อะไรก็ได้ (ไม่ใช่เอกสารบล็อก)
 * ใช้กับ `page = "mourning"` (ประกาศไว้อาลัย) — ได้ตาราง/ประวัติ/การเผยแพร่ชุดเดิมโดยไม่ต้องเพิ่มตารางใหม่
 */
export async function saveJsonDraft(page: string, value: unknown, actor: string): Promise<void> {
  await getPool().query(
    `insert into page_document (page, status, document, updated_at, updated_by)
       values ($1, 'draft', $2::jsonb, now(), $3)
     on conflict (page, status) do update set
       document = excluded.document,
       updated_at = now(),
       updated_by = excluded.updated_by`,
    [page, JSON.stringify(value), actor],
  );
}

/**
 * เผยแพร่: คัดลอกฉบับร่างเป็นฉบับที่ใช้จริง + เก็บประวัติ
 * ต้องมีฉบับร่างอยู่ก่อน (ถ้าไม่มี → โยน error ให้หน้าจอบอกผู้ใช้ ไม่ใช่เผยแพร่หน้าเปล่า)
 */
export async function publishDraft(page: string, actor: string, note: string | null): Promise<{ readonly revision: number }> {
  const result = await publishDraftInTransaction(page, actor, note);

  /*
    รอบที่ 249 (เคสจริงจากเจ้าของ: "ประวัติการเผยแพร่ค่อย ๆ ยืดมาเต็ม ควรมีลอจิกลบ"):
    ตัดรุ่นที่เกินเพดานของหน้านี้ออกเมื่อเผยแพร่
    · ทำ **นอก transaction** + กลืน error ⇒ งานเสริมต้องไม่ทำให้การเผยแพร่ล้ม
    · เก็บบางรุ่นไว้เสมอ (`MAX_PAGE_REVISIONS` ≥ 1) ⇒ กู้คืนรุ่นล่าสุดได้ตลอด
  */
  await prunePageRevisions(page).catch(() => 0);

  /* ร่องรอยการเผยแพร่ (X2.2) — เขียนนอก transaction · ล้มเหลวก็ไม่ทำให้การเผยแพร่พัง */
  await recordAudit({ action: "publish", actorEmail: actor, target: page, detail: note });
  return result;
}

/**
 * ลบ "ประวัติการเผยแพร่" ที่เกินเพดานของหน้านี้ (เก็บรุ่นล่าสุดไว้ `keep` รุ่น)
 *
 * ⚠️ ประตูความปลอดภัยอยู่ที่ SQL: เลือก "รุ่นที่ต้องเก็บ" ด้วย `order by revision desc limit $2` แล้วลบที่เหลือ
 * ⇒ ต่อให้ส่ง `keep` เพี้ยนมาจากข้างนอก (0/ติดลบ/ไม่ใช่จำนวนเต็ม) มันจะถอยไปใช้เพดานนโยบาย = **ลบน้อยลง** เสมอ
 *
 * @returns จำนวนรุ่นที่ลบจริง (0 = ไม่มีอะไรต้องลบ)
 */
export async function prunePageRevisions(page: string, keep: number = MAX_PAGE_REVISIONS): Promise<number> {
  const safeKeep = Number.isInteger(keep) && keep >= 1 ? keep : MAX_PAGE_REVISIONS;
  const result = await getPool().query(
    `delete from page_document_revision
      where page = $1
        and revision not in (
          select revision from page_document_revision where page = $1 order by revision desc limit $2
        )`,
    [page, safeKeep],
  );
  return result.rowCount ?? 0;
}

async function publishDraftInTransaction(page: string, actor: string, note: string | null): Promise<{ readonly revision: number }> {
  return withTransaction(async (client) => {
    const draft = await client.query<{ document: unknown }>(
      `select document from page_document where page = $1 and status = 'draft'`,
      [page],
    );
    const draftRow = draft.rows[0];
    if (draftRow === undefined) {
      throw new Error("ไม่มีฉบับร่างให้เผยแพร่");
    }

    const revision = await writePublishedRevision(client, page, draftRow.document, actor, note);

    /* เผยแพร่แล้ว = ล้างกำหนดเวลาเดิมทิ้ง (ไม่ค้างเป็นกำหนดเก่าให้ยิงซ้ำ) — X2.7 */
    await clearScheduleInTransaction(client, page);

    return { revision };
  });
}

/**
 * หัวใจของการเผยแพร่ (ใช้ร่วมกันทั้ง "กดเผยแพร่เอง" และ "เผยแพร่ตามกำหนด" — X2.7)
 *
 * ทำไมแยกออกมาเป็นฟังก์ชันเดียว
 * - เส้นทางการเขียนต้องมี **ที่เดียว** ⇒ พฤติกรรม (คัดลอกเอกสาร + เพิ่มประวัติ + เลขรุ่นเดินหน้า) ไม่หลุดจากกัน
 * - การเผยแพร่ตามกำหนดต้อง "ยึดกำหนดเวลา" (claim) กับ "เขียนฉบับเผยแพร่" อยู่ใน **ทรานแซกชันเดียวกัน**
 *   ⇒ สองตัวรันพร้อมกัน (ล็อกอิน + cron) เผยแพร่หน้าละครั้งเดียว และถ้าเขียนไม่สำเร็จกำหนดเวลายังอยู่ให้ลองใหม่
 *
 * ⚠️ รับ client เข้ามา (ไม่เปิด transaction เอง) เพื่อให้ผู้เรียกคุมขอบเขตทรานแซกชันได้
 */
async function writePublishedRevision(
  client: PoolClient,
  page: string,
  document: unknown,
  actor: string,
  note: string | null,
): Promise<number> {
  await client.query(
    `insert into page_document (page, status, document, updated_at, updated_by, published_at)
       values ($1, 'published', $2::jsonb, now(), $3, now())
     on conflict (page, status) do update set
       document = excluded.document,
       updated_at = now(),
       updated_by = excluded.updated_by,
       published_at = now()`,
    [page, JSON.stringify(document), actor],
  );

  const revisionResult = await client.query<{ next: number }>(
    `select coalesce(max(revision), 0) + 1 as next from page_document_revision where page = $1`,
    [page],
  );
  const revision = revisionResult.rows[0]?.next ?? 1;

  await client.query(
    `insert into page_document_revision (page, revision, document, note, created_by)
       values ($1, $2, $3::jsonb, $4, $5)`,
    [page, revision, JSON.stringify(document), note, actor],
  );

  return revision;
}

/** ล้างกำหนดเวลาเผยแพร่ของฉบับร่าง (ใช้ในทรานแซกชันเดียวกับการเผยแพร่) */
async function clearScheduleInTransaction(client: PoolClient, page: string): Promise<void> {
  await client.query(
    `update page_document set publish_at = null, scheduled_by = null where page = $1 and status = 'draft'`,
    [page],
  );
}

/** ประวัติการเผยแพร่ (ใหม่สุดก่อน) — แสดงไม่เกิน `HISTORY_PANEL_LIMIT` รุ่น (รอบที่ 249) */
export async function listRevisions(page: string, limit = HISTORY_PANEL_LIMIT): Promise<readonly RevisionSummary[]> {
  const result = await getPool().query<{
    revision: number;
    note: string | null;
    created_at: Date;
    created_by: string | null;
    document: unknown;
  }>(
    `select revision, note, created_at, created_by, document
       from page_document_revision
      where page = $1
      order by revision desc
      limit $2`,
    [page, limit],
  );

  return result.rows.map((row) => ({
    revision: row.revision,
    note: row.note,
    createdAt: row.created_at.toISOString(),
    createdBy: row.created_by,
    /* นับรวมบล็อกที่ซ้อนในคอลัมน์ด้วย (X1.1) — เดิมนับแค่ระดับหน้า ทำให้ตัวเลขต่ำกว่าความจริง */
    blockCount: countRawBlocks(row.document),
  }));
}

/** อ่านเอกสารของรุ่นหนึ่งในประวัติ (ใช้ตอนกู้คืน/ดูก่อนย้อน) */
export async function loadRevision(page: string, revision: number): Promise<unknown | null> {
  const result = await getPool().query<{ document: unknown }>(
    `select document from page_document_revision where page = $1 and revision = $2`,
    [page, revision],
  );
  return result.rows[0]?.document ?? null;
}

/**
 * กู้คืนรุ่นเก่า → เขียนทับ **ฉบับร่าง** (ไม่แตะฉบับที่เผยแพร่อยู่)
 * เจ้าของต้องกด "เผยแพร่" อีกครั้ง → ปลอดภัยกว่าการย้อนทับหน้าเว็บที่คนกำลังดูอยู่
 */
export async function restoreRevisionToDraft(page: string, revision: number, actor: string): Promise<void> {
  const document = await loadRevision(page, revision);
  if (document === null) {
    throw new Error(`ไม่พบประวัติรุ่นที่ ${revision}`);
  }

  await getPool().query(
    `insert into page_document (page, status, document, updated_at, updated_by)
       values ($1, 'draft', $2::jsonb, now(), $3)
     on conflict (page, status) do update set
       document = excluded.document,
       updated_at = now(),
       updated_by = excluded.updated_by`,
    [page, JSON.stringify(document), actor],
  );
}

/* ── "ใช้เนื้อหานี้กับหน้าเว็บจริง" (เซสชั่น S1) ───────────────────────────────── */

/**
 * หน้านี้ตั้งใจให้หน้าเว็บสาธารณะใช้ **เอกสารฉบับที่เผยแพร่** แทนเลย์เอาต์ที่ออกแบบไว้หรือยัง
 * เก็บที่แถว `published` เท่านั้น · ค่าเริ่มต้น false = หน้าเว็บใช้ของเดิม (ไม่มีการเปลี่ยนแปลงโดยไม่ตั้งใจ)
 */
export async function isPageLive(page: string): Promise<boolean> {
  const { rows } = await readQuery<{ readonly is_live: boolean }>(
    'select is_live from page_document where page = $1 and status = $2',
    [page, 'published'],
  );
  return rows[0]?.is_live === true;
}

/** เปิด/ปิดการใช้เอกสารนี้กับหน้าเว็บจริง */
export async function setPageLive(page: string, live: boolean, actor: string): Promise<void> {
  await getPool().query(
    'update page_document set is_live = $1, updated_by = $2, updated_at = now() where page = $3 and status = $4',
    [live, actor, page, 'published'],
  );
}

/* ── ตั้งเวลาเผยแพร่ (X2.7 · รอบที่ 100) ─────────────────────────────────────── */

/**
 * กำหนดเวลาเผยแพร่ของ **ฉบับร่าง** ของหน้านี้ (null = ยังไม่ได้ตั้ง)
 * เก็บที่แถว draft เพราะ "สิ่งที่รอเผยแพร่" คือฉบับร่างเสมอ (มติเดียวกับ migration 0014)
 */
export type PublishSchedule = {
  /** เวลาที่จะเผยแพร่ (ISO/UTC) */
  readonly at: string;
  /** ใครตั้งไว้ (null = ไม่รู้ เช่นข้อมูลจากรุ่นก่อน) */
  readonly by: string | null;
};

/** อ่านกำหนดเวลาของหน้านี้ — ยังไม่ตั้ง/ยังไม่มีฉบับร่าง = null */
export async function readPublishSchedule(page: string): Promise<PublishSchedule | null> {
  const { rows } = await getPool().query<{ publish_at: Date | null; scheduled_by: string | null }>(
    `select publish_at, scheduled_by from page_document where page = $1 and status = 'draft'`,
    [page],
  );

  const row = rows[0];
  if (row === undefined || row.publish_at === null) return null;
  return { at: row.publish_at.toISOString(), by: row.scheduled_by };
}

/**
 * ตั้ง/ยกเลิกกำหนดเวลาเผยแพร่ (`atIso = null` = ยกเลิก)
 * - **ไม่แตะ `updated_at`/`updated_by`** เพราะการตั้งเวลาไม่ใช่ "การแก้เนื้อหา"
 *   (หน้าจอตัวสร้างใช้ `updated_at` ของฉบับร่างบอกว่า "บันทึกล่าสุดเมื่อไร")
 * - ยังไม่มีฉบับร่าง = โยน error ⇒ Server Action รายงานผู้ใช้ ไม่ใช่เงียบ
 */
export async function setPublishSchedule(page: string, atIso: string | null, actor: string): Promise<void> {
  const result = await getPool().query(
    `update page_document set publish_at = $2::timestamptz, scheduled_by = $3 where page = $1 and status = 'draft'`,
    [page, atIso, atIso === null ? null : actor],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error("ไม่มีฉบับร่างให้ตั้งกำหนดเวลาเผยแพร่");
  }
}

export type DueSchedule = {
  readonly page: string;
  readonly at: string;
  readonly by: string | null;
};

/** หน้าที่ "ครบกำหนด" แล้ว (ใหม่สุดก่อน) — เพดานกันรอบเดียวเผยแพร่ทีละมากจนล้นเซิร์ฟเวอร์ */
const MAX_DUE_PER_RUN = 50;

export async function listDueSchedules(nowIso: string): Promise<readonly DueSchedule[]> {
  const { rows } = await getPool().query<{ page: string; publish_at: Date; scheduled_by: string | null }>(
    `select page, publish_at, scheduled_by
       from page_document
      where status = 'draft' and publish_at is not null and publish_at <= $1::timestamptz
      order by publish_at asc
      limit $2`,
    [nowIso, MAX_DUE_PER_RUN],
  );

  return rows.map((row) => ({ page: row.page, at: row.publish_at.toISOString(), by: row.scheduled_by }));
}

/** กำหนดเวลาทั้งหมดที่ยังรออยู่ (ใช้แสดงบนหน้าภาพรวมหลังบ้าน — ไม่จำกัดแค่ที่ครบกำหนด) */
export async function listPublishSchedules(limit = 20): Promise<readonly DueSchedule[]> {
  const { rows } = await getPool().query<{ page: string; publish_at: Date; scheduled_by: string | null }>(
    `select page, publish_at, scheduled_by
       from page_document
      where status = 'draft' and publish_at is not null
      order by publish_at asc
      limit $1`,
    [Math.max(1, Math.min(Math.trunc(limit), 100))],
  );

  return rows.map((row) => ({ page: row.page, at: row.publish_at.toISOString(), by: row.scheduled_by }));
}

/**
 * เผยแพร่หน้าที่ "ครบกำหนด" แล้ว — **claim (ยึดกำหนดเวลา) + เขียนฉบับเผยแพร่ ในทรานแซกชันเดียว**
 *
 * คืน `null` = ไม่ได้ทำอะไร (มีตัวอื่นยึดกำหนดเวลาไปก่อน หรือกำหนดถูกยกเลิกไปแล้ว)
 * ⇒ เรียกซ้ำ/รันพร้อมกันได้อย่างปลอดภัย (idempotent)
 *
 * ⚠️ ถ้าเขียนไม่สำเร็จ ทรานแซกชัน rollback ⇒ **กำหนดเวลายังอยู่** ให้รอบถัดไปลองใหม่ (ไม่หายเงียบ)
 * ⚠️ actor = คนที่ตั้งกำหนดเวลา (ร่องรอยในประวัติ/audit) · ไม่รู้ = `fallbackActor`
 */
export async function publishDuePage(
  page: string,
  nowIso: string,
  fallbackActor: string,
  note: string | null,
): Promise<{ readonly revision: number; readonly by: string | null } | null> {
  return withTransaction(async (client) => {
    /*
      ⚠️ ต้องอ่านค่าดิบ "ก่อน" ล้าง — Postgres `returning` คืนค่า **หลัง** update
      ⇒ ใช้ CTE `for update` ยึดแถว + คืนค่าเดิมของแถวนั้น แล้วล้างในคำสั่งเดียว (ยัง atomic)
      (เคสจริงที่เจอตอนยิง CLI: ใช้ `... returning scheduled_by` ตรง ๆ แล้วได้ null
       ทำให้ประวัติ/audit ไม่รู้ว่าใครเป็นคนตั้งกำหนด)
    */
    const { rows } = await client.query<{ scheduled_by: string | null; document: unknown }>(
      `with due as (
         select page, scheduled_by, document
           from page_document
          where page = $1 and status = 'draft' and publish_at is not null and publish_at <= $2::timestamptz
          for update
       )
       update page_document as target
          set publish_at = null, scheduled_by = null
         from due
        where target.page = due.page and target.status = 'draft'
       returning due.scheduled_by, due.document`,
      [page, nowIso],
    );

    const claim = rows[0];
    if (claim === undefined) return null;

    const revision = await writePublishedRevision(client, page, claim.document, claim.scheduled_by ?? fallbackActor, note);
    return { revision, by: claim.scheduled_by };
  });
}

/* ── ตัวย้ายเวอร์ชันของข้อมูลที่เก็บไว้ (X1.1) ────────────────────────────── */

/** เขียนทับเอกสารทั้งก้อนของสถานะหนึ่ง (ใช้โดยตัวย้ายเวอร์ชันเท่านั้น — ทางปกติคือ saveDraft/publishDraft) */
export async function replaceDocumentRaw(
  page: string,
  status: DocumentStatus,
  document: BlockDocument,
  actor: string,
): Promise<void> {
  await getPool().query(
    `update page_document
        set document = $1::jsonb, updated_at = now(), updated_by = $2
      where page = $3 and status = $4`,
    [JSON.stringify(document), actor, page, status],
  );
}

export type StoredMigrationResult = {
  /** จำนวนบล็อกรุ่นเก่าที่ถูกย้ายในฉบับร่าง */
  readonly draft: number;
  /** จำนวนบล็อกรุ่นเก่าที่ถูกย้ายในฉบับเผยแพร่ */
  readonly published: number;
};

/**
 * ย้ายเอกสารที่เก็บไว้ (ฉบับร่าง + ฉบับเผยแพร่) ให้เป็นรุ่นรูปทรงปัจจุบัน
 *
 * ทำไมต้องมีปุ่มนี้ทั้งที่ตัวอ่าน (`parseBlockDocument`) ย้ายให้อยู่แล้ว
 * - ตัวอ่านย้าย "ในความจำ" ทุกครั้งที่อ่าน ⇒ ข้อมูลในฐานข้อมูลยังเป็นรุ่นเก่าค้างอยู่
 *   (สำรองข้อมูล/ส่งออก/เครื่องมืออื่นที่อ่าน JSONB ตรง ๆ จะเห็นรูปทรงเก่า)
 * - ปุ่มนี้ทำให้ข้อมูลสะอาดจบในที่เดียว และตัวย้ายเป็นฟังก์ชันบริสุทธิ์ที่มีเทสต์คุม
 *
 * ความปลอดภัย
 * - **ไม่แตะประวัติ (revision)** — ประวัติคือภาพในอดีต ต้องคงไว้ตามจริง
 * - เอกสารที่ย้ายแล้วยัง parse ไม่ผ่าน = **ไม่เขียนทับ** (คืน 0) เพื่อไม่ให้ข้อมูลเสียหายหนักกว่าเดิม
 * - ย้ายซ้ำ = ไม่ทำอะไร (นับเฉพาะบล็อกรุ่นเก่า)
 */
export async function migrateStoredDocuments(page: string, actor: string): Promise<StoredMigrationResult> {
  const counts: { draft: number; published: number } = { draft: 0, published: 0 };

  for (const status of ["draft", "published"] as const) {
    const row = await loadDocumentRow(page, status);
    if (row === null) continue;

    const summary = storedVersionSummary(row.raw);
    if (summary.legacy === 0) continue;

    const parsed = parseBlockDocument(page, migrateDocumentValue(row.raw));
    if (!parsed.ok) continue;

    await replaceDocumentRaw(page, status, parsed.document, actor);
    counts[status] = summary.legacy;
  }

  if (counts.draft + counts.published > 0) {
    await recordAudit({
      action: "migrate-blocks",
      actorEmail: actor,
      target: page,
      detail: `draft=${counts.draft} published=${counts.published}`,
    });
  }

  return { draft: counts.draft, published: counts.published };
}

/** สรุปรุ่นของข้อมูลที่เก็บไว้ของหน้านี้ (ใช้เตือนในหน้าจอหลังบ้าน) */
export async function readStoredVersions(
  page: string,
): Promise<{ readonly draft: ReturnType<typeof storedVersionSummary> | null; readonly published: ReturnType<typeof storedVersionSummary> | null }> {
  const [draftRow, publishedRow] = await Promise.all([loadDocumentRow(page, "draft"), loadDocumentRow(page, "published")]);
  return {
    draft: draftRow === null ? null : storedVersionSummary(draftRow.raw),
    published: publishedRow === null ? null : storedVersionSummary(publishedRow.raw),
  };
}
