/**
 * `npm run admin:create -- --email=you@waiwai.co.th [--password=...] [--write-env]`
 *
 * สร้างข้อมูลล็อกอินให้ผู้ดูแลหลังบ้าน 1 คน แล้ว **พิมพ์ลิงก์ + รหัสผ่าน** ให้ครั้งเดียว
 *
 * สิ่งที่สคริปต์ทำ
 *   1. สุ่มรหัสผ่านที่อ่าน/บอกทางโทรศัพท์ได้ (หรือใช้ `--password=` ถ้าเจ้าของกำหนดเอง)
 *   2. hash ด้วย scrypt (ไม่เก็บรหัสผ่านจริงที่ไหนเลย)
 *   3. พิมพ์บล็อก `.env.local` — หรือเขียนลงไฟล์ให้เลยด้วย `--write-env` (แนะนำ: ไม่ต้องคัดลอกค่าเอง)
 *
 * ⚠️ `--write-env` จะ **ไม่ลบคีย์อื่น** ในไฟล์ และ **ไม่เปลี่ยน `SESSION_SECRET` เดิม** ถ้ามีอยู่แล้ว
 * ⚠️ ไฟล์ `.env.local` ถูก `.gitignore` ไว้แล้ว — ห้าม commit · ห้ามส่งค่าจริงในแชท/เอกสาร
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { ADMIN_LOGIN_PATH, buildEnvSnippet, buildLoginUrl, generatePassword } from "@/lib/auth/credentials";
import { LOCAL_ENV_FILE, mergeEnvText, readEnvValue } from "@/lib/auth/env-file";
import { PASSWORD_HASH_PARAMS, hashPassword } from "@/lib/auth/password";
import { MIN_SECRET_LENGTH, generateSecret, isSecretUsable } from "@/lib/auth/session";
import { ADMIN_ROLES, isAdminRole } from "@/lib/auth/types";
import { isValidEmail } from "@/lib/validate";

const USAGE = `วิธีใช้:
  npm run admin:create -- --email=you@waiwai.co.th [options]

  --email=...      (จำเป็น) อีเมลที่ใช้ล็อกอิน
  --password=...   กำหนดรหัสผ่านเอง (ไม่ใส่ = สุ่มให้แบบอ่านออกเสียงได้)
                   ⚠️ รหัสสั้น/เดาง่าย = หลังบ้านถูกเดารหัสได้ง่าย (ยังไม่มี rate limit ในเฟสนี้)
  --write-env      เขียนค่าลง ${LOCAL_ENV_FILE} ให้เลย (ไม่ต้องคัดลอกเอง) — แนะนำ
  --env-file=...   ไฟล์ปลายทางเมื่อใช้ --write-env (ค่าเริ่มต้น ${LOCAL_ENV_FILE})
  --name="..."     ชื่อที่แสดงในหลังบ้าน (ไม่ใส่ = ใช้อีเมล)
  --role=...       ${ADMIN_ROLES.join(" | ")} (ค่าเริ่มต้น: admin)
  --base=...       ที่อยู่ของเว็บ ใช้ประกอบลิงก์ให้คัดลอกส่งได้ (ไม่ใส่ = พิมพ์เป็น path)`;

function readArg(args: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = args.find((arg) => arg.startsWith(prefix));
  return found === undefined ? undefined : found.slice(prefix.length);
}

/** เตือน (ไม่ปฏิเสธ) เมื่อรหัสที่เจ้าของเลือกอ่อน — เจ้าของเป็นผู้ตัดสิน แต่ต้องรู้ความเสี่ยง */
function weaknessOf(password: string): string | null {
  if (password.length < 12) {
    return `สั้นกว่า 12 ตัวอักษร (${password.length}) — เดาได้ง่ายมากถ้าเปิดสู่อินเทอร์เน็ต`;
  }
  if (/^[0-9]+$/.test(password)) return "เป็นตัวเลขล้วน — เดาง่าย";
  if (/^(.)\1+$/.test(password)) return "เป็นตัวอักษรซ้ำกันทั้งหมด — เดาง่าย";
  return null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }

  const email = readArg(args, "email")?.trim() ?? "";
  if (email === "" || !isValidEmail(email)) {
    process.stderr.write(`✗ ต้องระบุ --email ที่ถูกรูปแบบ\n\n${USAGE}\n\n`);
    process.exit(1);
  }

  const rawRole = readArg(args, "role")?.trim() ?? "admin";
  if (!isAdminRole(rawRole)) {
    process.stderr.write(`✗ --role ต้องเป็นหนึ่งใน: ${ADMIN_ROLES.join(" | ")}\n\n`);
    process.exit(1);
  }

  const name = readArg(args, "name")?.trim() ?? "";
  const base = readArg(args, "base")?.trim() ?? "";
  const writeEnv = args.includes("--write-env");
  const envFileName = readArg(args, "env-file")?.trim() ?? LOCAL_ENV_FILE;
  const envPath = resolve(process.cwd(), envFileName);

  const chosenPassword = readArg(args, "password") ?? "";
  const passwordWasChosen = chosenPassword !== "";
  const password = passwordWasChosen ? chosenPassword : generatePassword();
  const passwordHash = await hashPassword(password);

  const envExists = existsSync(envPath);
  const envText = envExists ? readFileSync(envPath, "utf8") : "";

  /* ใช้ SESSION_SECRET เดิมถ้ามีอยู่แล้ว (อย่าเปลี่ยนทับ เพราะจะทำให้เซสชันที่เปิดอยู่ทั้งหมดหลุด) */
  const secretFromFile = readEnvValue(envText, "SESSION_SECRET");
  const secretFromEnv = process.env.SESSION_SECRET;
  const reusableSecret = isSecretUsable(secretFromFile) ? secretFromFile : secretFromEnv;
  const secret = isSecretUsable(reusableSecret) ? (reusableSecret as string) : generateSecret();
  const secretIsNew = !isSecretUsable(reusableSecret);

  const entries = [
    { key: "ADMIN_EMAIL", value: email },
    ...(name === "" ? [] : [{ key: "ADMIN_NAME", value: name }]),
    { key: "ADMIN_ROLE", value: rawRole },
    { key: "ADMIN_PASSWORD_HASH", value: passwordHash },
    { key: "SESSION_SECRET", value: secret },
  ];

  const lines: string[] = [
    "",
    "  ✓ สร้างข้อมูลล็อกอินแล้ว (โหมด env — ยังไม่ใช้ฐานข้อมูล)",
    "",
    `  ลิงก์หลังบ้าน : ${buildLoginUrl(base, email)}`,
    `  อีเมล         : ${email}`,
    `  บทบาท         : ${rawRole}`,
  ];

  if (passwordWasChosen) {
    lines.push(`  รหัสผ่าน      : (ใช้ค่าที่คุณกำหนด)`);
  } else {
    lines.push(`  รหัสผ่าน      : ${password}`, "", "  ⚠️ รหัสผ่านนี้แสดงครั้งเดียว — คัดลอกเก็บก่อนปิดหน้าต่างนี้");
  }

  const weakness = passwordWasChosen ? weaknessOf(password) : null;
  if (weakness !== null) {
    lines.push(
      "",
      `  ⚠️ คำเตือนเรื่องรหัสผ่าน: ${weakness}`,
      "     ระบบนี้ยังไม่มี rate limit — ถ้าจะเปิดสู่อินเทอร์เน็ตควรใช้รหัสที่ยาวกว่านี้ หรือปิดหนี้ข้อนั้นก่อน (เฟส B3)",
    );
  }

  if (writeEnv) {
    writeFileSync(envPath, mergeEnvText(envText, entries), "utf8");
    lines.push(
      "",
      `  ✓ เขียนลง ${envFileName} แล้ว ${envExists ? "(อัปเดตเฉพาะคีย์ที่เกี่ยวข้อง — คีย์อื่นไม่ถูกแตะ)" : "(สร้างไฟล์ใหม่)"}`,
      `    คีย์ที่ตั้งไว้: ${entries.map((entry) => entry.key).join(" · ")}`,
      "    ⚠️ ไฟล์นี้ถูก .gitignore ไว้ — ห้าม commit",
    );
  } else {
    lines.push(
      "",
      "  ── วางบล็อกนี้ใน .env.local (หรือใช้ --write-env ให้เขียนให้เลย) ──",
      "",
      buildEnvSnippet({ email, passwordHash, secret, name }),
    );
  }

  lines.push(
    "",
    secretIsNew
      ? `  (สร้าง SESSION_SECRET ใหม่ · ยาว ${MIN_SECRET_LENGTH}+ ตัวอักษรตามที่ระบบต้องการ)`
      : "  (ใช้ SESSION_SECRET เดิมที่มีอยู่ — เซสชันที่เปิดอยู่ไม่หลุด)",
    "",
    `  hash ใช้ scrypt N=${PASSWORD_HASH_PARAMS.N} r=${PASSWORD_HASH_PARAMS.r} p=${PASSWORD_HASH_PARAMS.p} (ไม่มีรหัสผ่านจริงถูกเก็บ)`,
    `  หน้าล็อกอิน: ${ADMIN_LOGIN_PATH}`,
    "",
    "  หมายเหตุ: เมื่อมี DATABASE_URL ให้ย้ายบัญชีนี้เข้าตาราง admin_user (เฟส B1b) — ตัวสคริปต์จะเพิ่มโหมด --db ทีหลัง",
    "",
  );

  process.stdout.write(lines.join("\n"));
}

await main();
