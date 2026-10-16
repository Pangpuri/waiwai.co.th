import { isDatabaseConfigured } from "@/db/pool";
import {
  ACCOUNT_CLI_USAGE,
  accountPasswordHint,
  parseAccountCliArgs,
  planAccountAction,
} from "@/lib/auth/account-cli";
import { buildLoginUrl, generatePassword } from "@/lib/auth/credentials";
import { createAdminUser, listAdminUsers, normalizeAdminEmail, resetAdminUserPassword } from "@/lib/auth/users-repository";
import { FAILURE_WINDOW_MS, MAX_FAILURES } from "@/lib/auth/rate-limit";
import { MIN_ADMIN_PASSWORD_LENGTH } from "@/lib/auth/types";

/**
 * `npm run admin:passwd -- --email=<คนที่รับมอบหมาย> [--password=...] [--role=editor] [--base=https://...]`
 * `npm run admin:passwd -- --list`
 *
 * **ออก/เปลี่ยนรหัสล็อกอินให้ "ตัวบุคคล"** (บัญชีในตาราง `admin_user`) — ต่างจาก `admin:create`
 * ที่เขียนได้แค่บัญชี env ใบเดียว (รันซ้ำ = ทับคนเดิม และทุกคนต้องใช้ใบเดียวกัน)
 *
 * ทำไมต้องเป็นบัญชีรายคน (มติเจ้าของ 2026-10-16: ตอนขึ้นเซิร์ฟเวอร์จริงจะออกรหัสตามตัวผู้รับมอบหมาย)
 * - **audit/กิจกรรมของฉัน** บอกได้ว่าใครทำอะไร (บัญชี env แยกคนไม่ได้)
 * - **ตัดสิทธิ์/เพิกถอนรายคน** ได้จาก `/admin/users` (ไม่ต้องเปลี่ยนรหัสให้ทั้งบริษัท)
 * - **ไม่ชนการล็อกอินผิดซ้ำ**: ล็อก 5 ครั้ง/15 นาที **คิดต่ออีเมล** ⇒ ถ้าทุกคนใช้บัญชีเดียว
 *   ใครพิมพ์ผิด 5 ครั้ง = ล็อกทั้งบริษัท
 *
 * ความปลอดภัย
 * - เก็บแค่ hash (scrypt ผ่าน `createAdminUser`/`resetAdminUserPassword` ของโปรเจกต์) · audit ทุกครั้ง
 * - **ตั้งรหัสใหม่ = ตัดเซสชันเดิมทั้งหมดของคนนั้น** (repository ทำให้อัตโนมัติ · รอบที่ 95)
 * - รหัสที่สุ่มแสดง **ครั้งเดียวที่จอ** ไม่เขียนลงไฟล์/ล็อก (ต่างจาก `admin:create --write-env`)
 * - ⚠️ ห้ามใช้กับเซิร์ฟเวอร์จริงโดยไม่ตั้งใจ: การเปลี่ยนรหัส = คนนั้นถูกตัดออกจนกว่าจะได้รหัสใหม่
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${ACCOUNT_CLI_USAGE}\n`);
    return;
  }

  let options;
  try {
    options = parseAccountCliArgs(argv);
  } catch (error) {
    process.stdout.write(`✗ ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
    return;
  }

  /* ไม่มีฐานข้อมูล = บัญชีรายคนมีไม่ได้ ⇒ บอกตรง ๆ (ไม่เงียบ ไม่ทำเป็นสำเร็จ) */
  if (!isDatabaseConfigured()) {
    process.stdout.write("✗ ต้องมี DATABASE_URL — บัญชีรายคนเก็บในตาราง `admin_user` (ถ้าต้องการบัญชีใบเดียวจาก env ให้ใช้ `npm run admin:create`)\n");
    process.exitCode = 1;
    return;
  }

  const accounts = await listAdminUsers();

  if (options.list) {
    if (options.json) {
      process.stdout.write(`${JSON.stringify({ accounts }, null, 2)}\n`);
      return;
    }

    if (accounts.length === 0) {
      process.stdout.write("ยังไม่มีบัญชีในตาราง `admin_user` — สร้างด้วย: npm run admin:passwd -- --email=someone@waiwai.co.th\n");
      return;
    }

    process.stdout.write(`บัญชีในตาราง admin_user: ${String(accounts.length)} ใบ\n`);
    for (const account of accounts) {
      const state = account.disabled ? "ปิดใช้งาน" : "ใช้งาน";
      const last = account.lastLoginAt === null ? "ยังไม่เคยเข้า" : `เข้าใช้ล่าสุด ${account.lastLoginAt}`;
      process.stdout.write(`  · ${account.email} · ${account.role} · ${state} · ${last}\n`);
    }
    return;
  }

  const email = normalizeAdminEmail(options.email);
  const found = accounts.find((account) => normalizeAdminEmail(account.email) === email) ?? null;
  const plan = planAccountAction(options, found === null ? null : { id: found.id, role: found.role });

  const password = options.password ?? generatePassword();
  const hint = accountPasswordHint(password);

  /* ── สร้างบัญชีใหม่ ─────────────────────────────────────────────────────── */
  if (plan.kind === "create") {
    const created = await createAdminUser({
      email,
      displayName: options.name === "" ? email : options.name,
      role: options.role,
      password,
      actor: "cli:admin-passwd",
    });

    if (!created.ok) {
      const reason: Record<typeof created.reason, string> = {
        "no-database": "ฐานข้อมูลไม่พร้อม",
        "bad-email": "อีเมลไม่ผ่านเกณฑ์",
        "bad-password": `รหัสผ่านสั้นกว่า ${String(MIN_ADMIN_PASSWORD_LENGTH)} ตัวอักษร`,
        duplicate: "อีเมลนี้มีบัญชีอยู่แล้ว (ลองรันใหม่เพื่อตั้งรหัส)",
        failed: "บันทึกไม่สำเร็จ",
      };
      process.stdout.write(`✗ สร้างบัญชีไม่สำเร็จ: ${reason[created.reason]}\n`);
      process.exitCode = 1;
      return;
    }

    if (options.json) {
      process.stdout.write(`${JSON.stringify({ kind: plan.kind, email: created.user.email, role: created.user.role, password }, null, 2)}\n`);
      return;
    }

    process.stdout.write(`✓ สร้างบัญชีใหม่ให้ ${created.user.email} (บทบาท ${created.user.role})\n`);
  } else if (plan.kind === "reset") {
    /* ── มีบัญชีแล้ว = ตั้งรหัสใหม่ + ตัดเซสชันเดิม (repository ทำให้) ───────── */
    const updated = await resetAdminUserPassword({ id: plan.existingId, password, actor: "cli:admin-passwd" });

    if (!updated.ok) {
      process.stdout.write(`✗ ตั้งรหัสใหม่ไม่สำเร็จ: ${updated.reason}\n`);
      process.exitCode = 1;
      return;
    }

    if (options.json) {
      process.stdout.write(`${JSON.stringify({ kind: plan.kind, email, role: plan.existingRole, password }, null, 2)}\n`);
      return;
    }

    process.stdout.write(`✓ ตั้งรหัสใหม่ให้ ${email} (บทบาทเดิม ${plan.existingRole})\n`);
    process.stdout.write("  ℹ️ เซสชันเดิมทั้งหมดของบัญชีนี้ถูกตัดแล้ว (มาตรฐานความปลอดภัย)\n");
  }

  process.stdout.write(`\nรหัสผ่าน (แสดงครั้งเดียว — ส่งให้เจ้าตัวทางช่องทางส่วนตัว): ${password}\n`);
  process.stdout.write(`ล็อกอิน: ${buildLoginUrl(options.base, email)}\n`);
  if (hint !== null) process.stdout.write(`⚠️ ${hint}\n`);
  process.stdout.write(
    `ℹ️ ล็อกอินผิด ${String(MAX_FAILURES)} ครั้งจะถูกล็อก ${String(FAILURE_WINDOW_MS / 60_000)} นาที (คิดต่ออีเมล — บัญชีรายคนจึงไม่กระทบกัน)\n`,
  );
  process.stdout.write("ℹ️ เปลี่ยน/ลืมรหัส: รันคำสั่งเดิมซ้ำ · ดูรายชื่อทั้งหมด: --list\n");
}

await main();
