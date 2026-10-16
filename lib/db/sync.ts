/**
 * ตัวสร้าง SQL สำหรับ "ดันข้อมูลขึ้นปลายทาง" (รอบที่ 298) — **ตรรกะล้วน ไม่มี I/O**
 *
 * ที่มา: `npm run db:push` (pg_dump/pg_restore) ใช้กับ Neon ไม่ได้แล้ว เพราะไคลเอนต์ในกล่องเป็น
 * Postgres **17** แต่ปลายทางอัปเกรดเป็น **18.6** ⇒ `pg_dump` ปฏิเสธ ("server version mismatch")
 * ⇒ ใช้การคัดลอกแถวผ่านไดรเวอร์ `pg` (ไม่ผูกกับเวอร์ชันไคลเอนต์) เฉพาะตารางที่ต่างกัน
 *
 * หลักการที่ล็อกไว้ในไฟล์นี้
 * - **upsert เท่านั้น — ห้ามมี `delete`** (เครื่องมือที่เขียนขึ้นคลาวด์ต้องไม่ลบข้อมูลเงียบ ๆ)
 * - ชนกันด้วย **คีย์จริงระดับธุรกิจ** (เช่น ประวัติหน้า = `page`+`revision`) ไม่ใช่ `id`
 *   เพราะ `id` ถูกออกคนละชุดในแต่ละสภาพแวดล้อม — ถ้าลอก `id` ข้ามเครื่องจะชนกันมั่ว
 * - ตารางที่ **ไฟล์แนบอ้างถึง** (เช่น `form_attachment.submission_id`) ต้องคง `id` เดิม
 *   ⇒ ใส่ `overriding system value` เมื่อคอลัมน์เป็น identity แบบ ALWAYS
 */

export type UpsertColumn = {
  readonly name: string;
  /** `generated always as identity` — ต้องมี `overriding system value` ถ้าจะระบุค่าเอง */
  readonly identityAlways: boolean;
};

/**
 * ต้องดัน sequence ของ id ต่อไหม
 *
 * เงื่อนไข: ใช้ id เป็นคีย์ชน **และ** id เป็น identity จริง (numeric)
 * ⚠️ เจอจริงรอบ 298: `hero_slide.id` เป็น **ข้อความ** (event/flavours) ⇒ `setval(pg_get_serial_sequence(...),`
 *    จะพังด้วย "COALESCE types text and integer cannot be matched" ถ้าไม่กันไว้
 */
export function needsSequenceSync(plan: UpsertPlan, columns: readonly UpsertColumn[]): boolean {
  return plan.conflictOn.includes("id") && columns.some((column) => column.name === "id" && column.identityAlways);
}

export type UpsertPlan = {
  readonly table: string;
  readonly conflictOn: readonly string[];
};

/** ตารางเนื้อหาที่เครื่องมือนี้ดันขึ้นปลายทางได้ (เรียงตามการพึ่งพา) */
export const SYNC_TABLES: readonly UpsertPlan[] = [
  { table: "page_document", conflictOn: ["page", "status"] },
  { table: "page_document_revision", conflictOn: ["page", "revision"] },
  { table: "hero_slide", conflictOn: ["id"] },
  /* หน้าแรกแบบฟิลด์: คีย์ของแถวคือ (page, section, item_key, field) — ตรงกับกติกาใน AGENTS */
  { table: "content_field", conflictOn: ["page", "section", "item_key", "field"] },
  { table: "form_submission", conflictOn: ["id"] },
  { table: "form_attachment", conflictOn: ["id"] },
];

/**
 * ตารางที่ยอมให้ **ลบแถวที่ปลายทางมีเกิน** เมื่อสั่ง `--prune` เท่านั้น
 * (มติเจ้าของ 2026-10-16: "ลบให้ตรงกับเครื่องเลย")
 *
 * ทำไมต้องมีรายการนี้แยก: การลบบนคลาวด์ต้องเป็น "การตัดสินใจที่ประกาศไว้ล่วงหน้า"
 * ไม่ใช่ผลข้างเคียงของคำสั่งทั่วไป ⇒ ตารางที่ไม่อยู่ในรายการนี้จะถูกรายงานแต่ **ห้ามลบ**
 */
export const SYNC_PRUNE_TABLES: readonly string[] = ["hero_slide", "content_field"];

/** คำสั่งลบแถวเดียวด้วยคีย์ (ใช้เฉพาะเมื่อผู้ใช้สั่ง `--prune` และตารางอยู่ในรายการที่อนุญาต) */
export function buildDeleteSql(plan: UpsertPlan): string {
  const where = plan.conflictOn.map((key, index) => `${quote(key)} = $${String(index + 1)}`).join(" and ");
  return `delete from ${quote(plan.table)} where ${where}`;
}

const quote = (name: string): string => `"${name.replace(/"/g, '""')}"`;

/** คอลัมน์ที่จะคัดลอกจริง (ตัด `id` ออกเมื่อไม่ได้ใช้ `id` เป็นคีย์ชน — ให้ปลายทางออกรหัสเอง) */
export function copyColumnsOf(plan: UpsertPlan, columns: readonly UpsertColumn[]): readonly UpsertColumn[] {
  if (plan.conflictOn.includes("id")) return columns;
  return columns.filter((column) => !(column.name === "id" && column.identityAlways));
}

/** ต้องใส่ `overriding system value` ไหม (identity ALWAYS + ต้องการคงค่า `id` เดิม) */
export function needsOverriding(plan: UpsertPlan, columns: readonly UpsertColumn[]): boolean {
  return plan.conflictOn.includes("id") && columns.some((column) => column.name === "id" && column.identityAlways);
}

/** คีย์ของแถว (ใช้เทียบว่าปลายทางมีแถวนี้แล้วหรือยัง) */
export function rowKeyOf(plan: UpsertPlan, row: Readonly<Record<string, unknown>>): string {
  return plan.conflictOn.map((key) => String(row[key])).join("\u0001");
}

/** สร้างคำสั่ง upsert (ค่าทุกตัวอย่างเป็น parameter `$1..$n` — ไม่ต่อสตริงค่าเข้าไป) */
export function buildUpsertSql(plan: UpsertPlan, columns: readonly UpsertColumn[]): string {
  const copied = copyColumnsOf(plan, columns);
  if (copied.length === 0) throw new Error(`ไม่มีคอลัมน์ให้คัดลอก: ${plan.table}`);

  const columnList = copied.map((column) => quote(column.name)).join(", ");
  const placeholders = copied.map((_, index) => `$${String(index + 1)}`).join(", ");
  const updates = copied
    .filter((column) => !plan.conflictOn.includes(column.name))
    .map((column) => `${quote(column.name)} = excluded.${quote(column.name)}`)
    .join(", ");

  /* ไม่มีคอลัมน์ให้อัปเดต (ตารางที่มีแต่คีย์) ⇒ คงค่าเดิมไว้ = ป้องกัน error จาก `do update set` ว่าง */
  const fallbackKey = plan.conflictOn[0] ?? "id";
  const updateClause = updates === "" ? `${quote(fallbackKey)} = excluded.${quote(fallbackKey)}` : updates;

  return (
    `insert into ${quote(plan.table)} (${columnList})${needsOverriding(plan, columns) ? " overriding system value" : ""}` +
    ` values (${placeholders}) on conflict (${plan.conflictOn.map(quote).join(", ")}) do update set ${updateClause}`
  );
}

/**
 * ชื่อตารางที่เครื่องมือนี้ **ห้ามแตะ** — ข้อมูลของแต่ละสภาพแวดล้อม/ส่วนบุคคล และตารางเนื้อหา
 * ที่มีเครื่องมือเฉพาะของตัวเอง (นำเข้า/หลังบ้าน) การดันด้วยเครื่องมือนี้จะทำให้ id ไม่ตรงกัน
 * (เช่น `media` ภาพชุดเดียวกันแต่คนละ id — ตัวชี้ใน `product_category` จะพัง)
 */
export const SYNC_FORBIDDEN_TABLES: readonly string[] = [
  "audit_log",
  "admin_session",
  "login_attempt",
  "preview_link",
  "media",
  "product",
  "product_category",
  "news",
  "recipe",
  "job_posting",
];
