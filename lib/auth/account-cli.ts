/**
 * ตัวช่วยของ CLI จัดการบัญชีหลังบ้าน (`npm run admin:passwd` · รอบที่ 295) — **ตรรกะล้วน ไม่มี I/O**
 *
 * เป้าหมายของ CLI นี้ (มติเจ้าของ 2026-10-16): ตอนขึ้นเซิร์ฟเวอร์จริงจะ **ออกรหัสให้ "ตัวบุคคล"**
 * ที่ได้รับมอบหมาย (เช่นตามรหัสพนักงาน) — คนละทางกับ `admin:create` ที่เขียนได้แค่ **บัญชี env ใบเดียว**
 * (รันซ้ำ = ทับคนเดิม) ⇒ บัญชีรายคนต้องอยู่ในตาราง `admin_user` เพื่อให้ได้:
 * - **audit log บอกได้ว่าใครทำอะไร** (บัญชี env ทุกคนใช้ใบเดียวกัน ⇒ แยกคนไม่ได้)
 * - **ตัด/เพิกถอนสิทธิ์รายคน** ได้จาก `/admin/users`
 * - ไม่ชนเพดาน "ล็อกอินผิด 5 ครั้ง = ล็อก 15 นาที" ซึ่งคิด **ต่ออีเมล** (ถ้าทุกคนใช้ใบเดียว
 *   ใครพิมพ์ผิด 5 ครั้ง = ล็อกทั้งบริษัท)
 *
 * ⚠️ ข้อจำกัดจริงที่ต้องรู้ก่อนออกแบบรหัส: บัญชีในตารางบังคับ **รหัสผ่าน ≥ 12 ตัวอักษร**
 *    (`MIN_ADMIN_PASSWORD_LENGTH`) ⇒ "รหัสพนักงานล้วน" (เช่น `004400`) **ใช้ไม่ได้** กับบัญชีรายคน
 *    ต้องมีคำต่อท้าย/ความยาวถึงเกณฑ์ (เช่น `004400-waiwai`) — หรือเจ้าของต้องอนุมัติให้ลดเกณฑ์
 */

import { isValidEmail } from "@/lib/validate";
import {
  ADMIN_ROLES,
  MIN_ADMIN_PASSWORD_LENGTH,
  isAdminRole,
  isUsableAdminPassword,
  type AdminRole,
} from "@/lib/auth/types";


export type AccountCliOptions = {
  /** `--list` = ดูบัญชีทั้งหมด (ไม่ต้องมีอีเมล) */
  readonly list: boolean;
  readonly email: string;
  /** รหัสที่ผู้ใช้กำหนดเอง (null = สุ่มให้) */
  readonly password: string | null;
  readonly name: string;
  readonly role: AdminRole;
  readonly base: string;
  readonly json: boolean;
};

export const ACCOUNT_CLI_USAGE = `วิธีใช้:
  npm run admin:passwd -- --email=someone@waiwai.co.th [options]
  npm run admin:passwd -- --list

  --email=...      อีเมลของ "ตัวบุคคล" ที่รับมอบหมาย (จำเป็น ยกเว้น --list)
  --list           แสดงบัญชีทั้งหมด (อีเมล · บทบาท · สถานะ · เข้าใช้ล่าสุด) แล้วจบ — ไม่ต้องมีอีเมล
  --password=...   รหัสที่กำหนดเอง (ไม่ใส่ = สุ่มให้แบบอ่านออกเสียงได้)
                   ⚠️ บัญชีในตารางต้องยาว ≥ ${MIN_ADMIN_PASSWORD_LENGTH} ตัวอักษร
  --name="..."     ชื่อที่แสดงในหลังบ้าน (ไม่ใส่ = ใช้อีเมล)
  --role=...       ${ADMIN_ROLES.join(" | ")} (ค่าเริ่มต้น: editor — ให้สิทธิ์เท่าที่ต้องใช้)
  --base=...       ที่อยู่เว็บ ใช้ประกอบลิงก์ล็อกอินให้ส่งต่อได้
  --json           พิมพ์ผลเป็น JSON (สำหรับสคริปต์อื่นมาต่อ)

  พฤติกรรม: อีเมลนี้มีบัญชีอยู่แล้ว = ตั้งรหัสใหม่ + ตัดเซสชันเดิมทั้งหมด (มาตรฐานความปลอดภัย)
            ยังไม่มี = สร้างบัญชีใหม่ให้ · ทุกครั้งมี audit log`;

function readArg(args: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = args.find((arg) => arg.startsWith(prefix));
  return found === undefined ? undefined : found.slice(prefix.length);
}

/** อ่าน argv (ค่าที่ไม่รู้จัก = โยน error ภาษาไทย ไม่เงียบ) */
export function parseAccountCliArgs(argv: readonly string[]): AccountCliOptions {
  const list = argv.includes("--list");
  const json = argv.includes("--json");
  const email = (readArg(argv, "email") ?? "").trim();
  const password = readArg(argv, "password") ?? null;
  const name = (readArg(argv, "name") ?? "").trim();
  const roleRaw = (readArg(argv, "role") ?? "editor").trim();
  const base = (readArg(argv, "base") ?? "").trim();

  const known = ["--list", "--json"];
  for (const arg of argv) {
    if (arg.trim() === "" || known.includes(arg)) continue;
    if (/^--(email|password|name|role|base)=/.test(arg)) continue;
    throw new Error(`ไม่รู้จักตัวเลือก: ${arg}`);
  }

  if (!list && email === "") throw new Error("ต้องระบุ --email=... (หรือใช้ --list เพื่อดูรายชื่อบัญชี)");
  if (email !== "" && !isValidEmail(email)) throw new Error(`อีเมลไม่ถูกต้อง: ${email}`);
  if (!isAdminRole(roleRaw)) throw new Error(`บทบาทไม่ถูกต้อง: ${roleRaw} (ต้องเป็น ${ADMIN_ROLES.join(" | ")})`);
  if (password !== null && password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(
      `รหัสผ่านสั้นเกินไป (${password.length} ตัวอักษร) — บัญชีในตารางต้องยาว ≥ ${MIN_ADMIN_PASSWORD_LENGTH} ` +
        `ตัวอย่างที่ใช้ได้: ${password}-waiwai (ถ้าต้องใช้รหัสสั้นจริง ๆ ต้องให้เจ้าของอนุมัติลดเกณฑ์)`,
    );
  }

  return { list, email, password, name, role: roleRaw, base, json };
}

/**
 * สิ่งที่ CLI จะทำกับอีเมลนั้น
 *
 * ⚠️ ตั้งชื่อฟิลด์ว่า `kind` (ไม่ใช่ `action`) โดยตั้งใจ — ด่าน `test-audit-labels` สแกนซอร์สหา `action: "…"`
 *    เพื่อกัน "เขียนรหัสเหตุการณ์ audit ที่ไม่มีใน type" ⇒ ฟิลด์ชื่อ `action` ของ CLI จะทำให้ด่านเข้าใจผิด
 */
export type AccountPlan =
  | { readonly kind: "list"; readonly reason: string }
  | { readonly kind: "create"; readonly reason: string }
  | { readonly kind: "reset"; readonly reason: string; readonly existingId: string; readonly existingRole: AdminRole };

/**
 * ตัดสินว่าจะ "สร้าง" หรือ "ตั้งรหัสใหม่" จากสถานะจริงในฐานข้อมูล (ตรรกะล้วน ⇒ ทดสอบได้)
 * `existing` = บัญชีที่พบ (ถ้ามี) — ผู้เรียกดึงมาจาก `listAdminUsers()` แล้วจับคู่อีเมล
 */
export function planAccountAction(
  options: AccountCliOptions,
  existing: { readonly id: string; readonly role: AdminRole } | null,
): AccountPlan {
  if (options.list) return { kind: "list", reason: "สั่ง --list" };
  if (existing === null) return { kind: "create", reason: "ยังไม่มีบัญชีนี้ในตาราง → สร้างใหม่" };
  return {
    kind: "reset",
    reason: `มีบัญชีอยู่แล้ว (บทบาท ${existing.role}) → ตั้งรหัสใหม่ + ตัดเซสชันเดิมทั้งหมด`,
    existingId: existing.id,
    existingRole: existing.role,
  };
}

/** คำเตือนเมื่อรหัสที่กำหนดเองอ่อน (ไม่ปฏิเสธ — เจ้าของเป็นผู้ตัดสิน แต่ต้องรู้ความเสี่ยง) */
export function accountPasswordHint(password: string): string | null {
  if (!isUsableAdminPassword(password)) return `สั้นกว่า ${MIN_ADMIN_PASSWORD_LENGTH} ตัวอักษร — บัญชีในตารางจะปฏิเสธ`;
  if (/^[0-9]+$/.test(password)) return "เป็นตัวเลขล้วน — เดาง่ายมาก";
  if (/^(.)\1+$/.test(password)) return "เป็นตัวอักษรตัวเดียวซ้ำ — เดาง่ายมาก";
  if (/^[a-z]+$/.test(password) || /^[A-Za-z]+$/.test(password)) return "เป็นตัวอักษรล้วน — ควรมีตัวเลข/สัญลักษณ์ด้วย";
  return null;
}
