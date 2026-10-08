import { getPool, isDatabaseConfigured, withTransaction } from "@/db/pool";
import { assemblePageContent, planOrphanKeys, type ContentRow } from "@/lib/content/rows";
import { SEED_ACTOR, buildUpsertStatements, countRows, type SqlParam } from "@/lib/content/sql";
import { HOME_PAGE_SPEC } from "@/lib/content/model";
import type { PageContent, PageSpec } from "@/lib/content/types";

/**
 * ชั้นเข้าถึงข้อมูลเนื้อหา (repository) — **ฝั่งเซิร์ฟเวอร์เท่านั้น ต้องมี DB**
 *
 * ทุกคำสั่งเป็น parameter ล้วน (สร้างจาก `lib/content/sql.ts` ที่มีเทสต์ยืนยันแล้ว)
 * การบันทึกเป็น 3 จังหวะใน transaction เดียว: upsert → ลบแถวที่ไม่มีในเนื้อหาใหม่ → (อนาคต) บันทึก audit log
 */

export type LoadedPage = {
  readonly content: PageContent;
  readonly unknownKeys: readonly string[];
  /** true = ยังไม่มีข้อมูลใน DB (ผู้ใช้ควรกด "นำเข้าข้อมูลตั้งต้น") */
  readonly isEmpty: boolean;
};

export { isDatabaseConfigured };

const READ_COLUMNS = `section, item_key, item_order, field, kind, th, en, media_path, media_alt_th, media_alt_en, media_has_watermark`;

type RawRow = {
  section: string;
  item_key: string;
  item_order: number | null;
  field: string;
  kind: string;
  th: string | null;
  en: string | null;
  media_path: string | null;
  media_alt_th: string | null;
  media_alt_en: string | null;
  media_has_watermark: boolean | null;
};

function toContentRow(row: RawRow): ContentRow {
  return {
    section: row.section,
    itemKey: row.item_key,
    itemOrder: row.item_order,
    field: row.field,
    kind: row.kind,
    th: row.th,
    en: row.en,
    mediaPath: row.media_path,
    mediaAltTh: row.media_alt_th,
    mediaAltEn: row.media_alt_en,
    mediaHasWatermark: row.media_has_watermark,
  };
}

/** อ่านเนื้อหาทั้งหน้าจาก DB แล้วประกอบกลับเป็นโครงที่หน้าเว็บ/ฟอร์มใช้ */
export async function loadPageContent(spec: PageSpec): Promise<LoadedPage> {
  const result = await getPool().query<RawRow>(
    `select ${READ_COLUMNS} from content_field where page = $1 order by section, item_order nulls first, item_key, field`,
    [spec.page],
  );

  const assembled = assemblePageContent(spec, result.rows.map(toContentRow));

  return {
    content: assembled.content,
    unknownKeys: assembled.unknownKeys,
    isEmpty: result.rows.length === 0,
  };
}

/**
 * อ่านเนื้อหาหน้าแรกแบบ **ไม่พัง** (รอบที่ 200)
 * ไม่มี `DATABASE_URL` / ยังไม่ migrate / อ่านไม่สำเร็จ = คืน `null` ⇒ ผู้เรียกถอยไปใช้ค่าเริ่มต้น
 * (หน้าเว็บต้องไม่ขึ้น 500 เพราะหลังบ้าน/ฐานข้อมูล — กติกาเดิมของโปรเจกต์)
 */
export async function loadHomeContentSafely(): Promise<PageContent | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    return (await loadPageContent(HOME_PAGE_SPEC)).content;
  } catch {
    return null;
  }
}

async function existingKeys(page: string): Promise<readonly string[]> {
  const result = await getPool().query<{ key: string }>(
    `select section || '|' || item_key || '|' || field as key from content_field where page = $1`,
    [page],
  );
  return result.rows.map((row) => row.key);
}

/**
 * บันทึกเนื้อหาทั้งหน้า (upsert + ลบแถวที่หายไป)
 * `actor` = อีเมล/id ของผู้ดูแลที่ล็อกอิน (เก็บลงคอลัมน์ `updated_by` เพื่อตรวจย้อนหลังได้)
 */
export async function savePageContent(
  spec: PageSpec,
  content: PageContent,
  actor: string,
): Promise<{ readonly written: number; readonly deleted: number }> {
  const statements = buildUpsertStatements(spec, content, actor);
  const orphans = planOrphanKeys(spec, content, await existingKeys(spec.page));

  return withTransaction(async (client) => {
    for (const statement of statements) {
      await client.query(statement.text, [...(statement.values as readonly SqlParam[])]);
    }

    if (orphans.length > 0) {
      /* ลบด้วยคีย์ที่ประกอบจากค่าจริง (parameter) — ใช้ unnest เพื่อไม่ต้องต่อสตริงยาว ๆ */
      await client.query(
        `delete from content_field
          where page = $1
            and (section, item_key, field) in (
              select * from unnest($2::text[], $3::text[], $4::text[])
            )`,
        [
          spec.page,
          orphans.map((key) => key.split("|")[0] ?? ""),
          orphans.map((key) => key.split("|")[1] ?? ""),
          orphans.map((key) => key.split("|")[2] ?? ""),
        ],
      );
    }

    return { written: countRows(statements), deleted: orphans.length };
  });
}

/** นำเข้าเนื้อหาตั้งต้น (จากพจนานุกรมเดิม) — ใช้ครั้งแรกก่อนแก้ผ่านหน้าจอ */
export async function importPageSeed(
  spec: PageSpec,
  seed: PageContent,
  actor: string = SEED_ACTOR,
): Promise<{ readonly written: number; readonly deleted: number }> {
  return savePageContent(spec, seed, actor);
}

/** จำนวนแถวของหน้าหนึ่ง (ใช้ตรวจสุขภาพ DB / รายงาน) */
export async function countPageRows(page: string): Promise<number> {
  const result = await getPool().query<{ total: string }>(
    `select count(*)::text as total from content_field where page = $1`,
    [page],
  );
  return Number.parseInt(result.rows[0]?.total ?? "0", 10);
}
