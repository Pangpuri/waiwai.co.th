import { Client, type QueryResultRow } from "pg";

import { FORBIDDEN_FOR_PUBLIC_READ } from "./db-roles.ts";

/**
 * "ตัวพิสูจน์สิทธิ์ของ role ปลายทาง" (รอบที่ 286 · ปิดหนี้ D-283-2)
 *
 * ## ปัญหาที่ปิด
 * `check:target` รุ่นก่อนตรวจแค่ว่า **มี role ชื่อนั้นอยู่ใน `pg_roles`** ⇒ บอกไม่ได้ว่า role นั้น
 * *อ่านตารางที่หน้าเว็บใช้จริงได้ครบไหม* และ *อ่านตารางอ่อนไหวไม่ได้จริงไหม*
 * ⇒ เคสที่จะหลุด: สร้าง role แล้ว แต่ `grant` ไม่ครบ (เช่น ตารางที่เพิ่มใหม่ยังไม่ได้ให้สิทธิ์ — เคสจริงรอบที่ 280)
 *    อาการบนเว็บคือ **หน้าที่อ่านตารางนั้นเงียบ ๆ กลายเป็นว่าง** (กับดักรอบ 121/137/265)
 *
 * ## กติกาของไฟล์นี้ (สำคัญ)
 * 1. **อ่านเท่านั้น** — ไม่มี `insert`/`update`/`delete`/`grant`/`alter` ในไฟล์นี้เด็ดขาด
 *    · การตรวจ "เขียนไม่ได้" ใช้ **catalog** (`has_table_privilege`) ไม่ใช่ลองเขียนจริง
 *      → ไม่แตะข้อมูลแม้แต่ไบต์เดียว และไม่ทิ้งร่องรอยในตาราง
 * 2. **ไม่เชื่อชื่อตารางจากภายนอก** — ชื่อต้องผ่าน `isProbeTableName()` ก่อน แล้วค่อยใส่ในเครื่องหมายคำพูด
 * 3. **ล้มแล้วต้องไม่โยน error ออกไป** — คืนผลเป็นรายการความล้มเหลวให้ผู้เรียกรายงาน (ด่านต้องไม่พังเพราะปลายทางล่ม)
 *
 * ⚠️ รหัสผ่านของ role **ห้ามอยู่ในโค้ด** — รับเป็น URL ผ่าน env/flag ของผู้เรียกเท่านั้น
 */

/** ชื่อตารางที่ยอมให้ใส่ในคำสั่งได้ — รูปแบบเดียวกับที่ Postgres สร้างให้ตารางปกติ */
export function isProbeTableName(value: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(value);
}

export type RoleProbeOutcome = {
  readonly ok: boolean;
  /** ชื่อ role ที่ต่อได้จริง (`current_user` — ยืนยันว่าไม่ได้ต่อด้วยบัญชีเจ้าของโดยบังเอิญ) */
  readonly role: string;
  /** จำนวนตารางที่อ่านผ่าน */
  readonly readable: number;
  readonly failures: readonly string[];
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * ต่อฐานข้อมูลด้วย URL ของ role แล้วพิสูจน์สิทธิ์
 *
 * @param kind `read` = role ของหน้าเว็บ (ต้อง SELECT ได้ + เขียนไม่ได้) ·
 *             `form` = role ของฟอร์ม (ต้อง SELECT/INSERT ตารางฟอร์มได้ แต่เขียนตารางเนื้อหาไม่ได้)
 */
export async function probeRole(
  url: string,
  tables: readonly string[],
  kind: "read" | "form",
): Promise<RoleProbeOutcome> {
  const failures: string[] = [];
  const client = new Client({ connectionString: url });

  try {
    await client.connect();
  } catch (error) {
    return { ok: false, role: "", readable: 0, failures: [`ต่อฐานข้อมูลด้วย role ไม่ได้: ${messageOf(error)}`] };
  }

  try {
    const who = await client.query<{ role: string }>("select current_user as role");
    const role = who.rows[0]?.role ?? "";
    if (role === "") failures.push("ถามชื่อ role ปัจจุบันไม่ได้ (current_user ว่าง)");

    let readable = 0;
    for (const table of tables) {
      if (!isProbeTableName(table)) {
        failures.push(`ชื่อตารางไม่ถูกต้อง (ไม่ยอมรัน): ${table}`);
        continue;
      }
      try {
        /* `count(*)` = พิสูจน์ว่า "อ่านได้จริง" (ไม่ใช่แค่มีสิทธิ์ใน catalog) · ตารางเล็ก/กลางเท่านั้น */
        await client.query(`select count(*)::int as n from "${table}"`);
        readable += 1;
      } catch (error) {
        failures.push(`อ่านตาราง ${table} ไม่ได้: ${messageOf(error)}`);
      }
    }

    /* ตารางอ่อนไหว: ต้อง **อ่านไม่ได้** (42501 = insufficient_privilege) */
    for (const table of FORBIDDEN_FOR_PUBLIC_READ) {
      if (!isProbeTableName(table)) continue;
      try {
        await client.query(`select count(*)::int as n from "${table}"`);
        failures.push(`อ่านตารางที่ต้องห้ามได้ (${table}) — สิทธิ์หลุด`);
      } catch {
        /* ล้ม = ถูกต้อง (ไม่ต้องแยกชนิด error: อ่านไม่ได้ก็พอ) */
      }
    }

    /* เขียนไม่ได้ / เขียนได้ — ตรวจจาก catalog (ไม่เขียนจริง · กติกาข้อ 1) */
    const probe = async (table: string, privilege: "INSERT" | "UPDATE"): Promise<boolean | null> => {
      if (!isProbeTableName(table)) return null;
      try {
        const result = await client.query<{ can: boolean } & QueryResultRow>(
          "select has_table_privilege(current_user, $1, $2) as can",
          [table, privilege],
        );
        return result.rows[0]?.can === true;
      } catch (error) {
        failures.push(`ถามสิทธิ์ ${privilege} ของ ${table} ไม่ได้: ${messageOf(error)}`);
        return null;
      }
    };

    if (kind === "read") {
      /*
        role อ่านต้อง **เขียนตารางใด ๆ ที่ตัวเองอ่าน ไม่ได้เลย**
        (ตรวจครบทุกตารางในรายการ — เป็นการถาม catalog ไม่กี่ครั้ง ถูกกว่ารอเจอบน production)
      */
      for (const table of tables) {
        if ((await probe(table, "INSERT")) === true) {
          failures.push(`role อ่านมีสิทธิ์ INSERT ตาราง ${table} (ต้องไม่มี)`);
        }
      }
    } else {
      const canWriteForm = await probe(tables[0] ?? "form_submission", "INSERT");
      if (canWriteForm === false) failures.push("role ฟอร์ม INSERT ตารางฟอร์มไม่ได้");
      /* ตารางเนื้อหา (ไม่ใช่ของฟอร์ม) ต้องเขียนไม่ได้ */
      if ((await probe("page_document", "INSERT")) === true) {
        failures.push("role ฟอร์ม INSERT ตาราง page_document ได้ (ต้องเขียนได้แค่ตารางฟอร์ม)");
      }
    }

    return { ok: failures.length === 0, role, readable, failures };
  } catch (error) {
    failures.push(`ตรวจสิทธิ์ไม่สำเร็จ: ${messageOf(error)}`);
    return { ok: false, role: "", readable: 0, failures };
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** role ของ **หน้าเว็บสาธารณะ** — SELECT ได้ครบ · เขียนไม่ได้ · อ่านตารางอ่อนไหวไม่ได้ */
export function probeReadRole(url: string, tables: readonly string[]): Promise<RoleProbeOutcome> {
  return probeRole(url, tables, "read");
}

/** role ของ **ฟอร์มสาธารณะ** — SELECT/INSERT เฉพาะตารางฟอร์ม */
export function probeFormRole(url: string, tables: readonly string[]): Promise<RoleProbeOutcome> {
  return probeRole(url, tables, "form");
}
