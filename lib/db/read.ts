import type { QueryResult, QueryResultRow } from "pg";

import { getFormPool, getReadPool } from "@/db/pool";

/**
 * "ประตูอ่าน" ของชั้นข้อมูล (รอบที่ 169 · least privilege)
 *
 * ทำไมต้องมี
 * - หน้าเว็บสาธารณะควรอ่านผ่าน role ที่ **เขียนไม่ได้** (`waiwai_public_ro`) ⇒ ถ้ามีช่องโหว่ที่ทำให้
 *   เส้นทางสาธารณะสั่งเขียนได้ Postgres จะปฏิเสธด้วย `insufficient_privilege` (fail-closed)
 *   ไม่ใช่เขียนทับข้อมูลจริง
 * - ฟอร์มสาธารณะ (ทางเขียนเดียวที่คนนอกแตะได้) ใช้ role สิทธิ์แคบกว่านั้น (`waiwai_public_form`)
 *   ⇒ INSERT ได้แค่ `form_submission`/`form_attachment`
 *
 * กติกา
 * 1. ฟังก์ชันที่ใช้ `readQuery()` ต้องเป็น **SELECT ล้วน** — ห้าม insert/update/delete ในฟังก์ชันเดียวกัน
 *    (มีเทสต์สแกนกันถอยหลังที่ `scripts/test-db-readonly.ts`)
 * 2. งานเขียน + transaction ใช้ `getPool()` (หลังบ้าน) เท่านั้น
 * 3. ไม่ตั้ง `PUBLIC_DATABASE_URL`/`FORM_DATABASE_URL` = ถอยไปใช้ pool หลังบ้าน (พฤติกรรมเดิม)
 *    ⇒ ยังไม่มี isolation จนกว่าจะตั้ง; ดู `isReadOnlyConfigured()` + `npm run db:roles`
 */

/** อ่านข้อมูลผ่าน pool "อ่านอย่างเดียว" (หน้าเว็บสาธารณะ) */
export async function readQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getReadPool().query<T>(text, params);
}

/** อ่าน/เขียนเฉพาะตารางฟอร์ม ผ่าน pool สิทธิ์แคบ (ฟอร์มสาธารณะ) */
export async function formQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getFormPool().query<T>(text, params);
}
