import assert from "node:assert/strict";
import { test } from "node:test";

import { hostOf, isLocalHost, redactUrl, validateRemoteTarget } from "@/lib/db/target";

/**
 * เทสต์ "การ์ดกันพลาดก่อนดันข้อมูลขึ้นคลาวด์" (รอบที่ 114)
 *
 * งานจริงที่ต้องกัน
 * - การตลาดขอดูตัวอย่างหน้าเว็บ ⇒ ต้องดันข้อมูล (สินค้า 54 · เมนู 18 · ข่าว 151 · ภาพ 843) ขึ้นฐานข้อมูลคลาวด์
 * - ⚠️ ถ้าปลายทางถูกตั้งผิดเป็น **ฐานข้อมูลในเครื่อง** แล้วสคริปต์เขียนทับ → เสียข้อมูลที่นำเข้าทั้งหมด
 *   (และต้องโหลดใหม่หลายสิบนาที) ⇒ ต้อง "ปฏิเสธก่อนเริ่ม" ไม่ใช่เตือนแล้วไปต่อ
 * - ⚠️ ห้ามพิมพ์รหัสผ่านของฐานข้อมูลลง log/หน้าจอ
 */

const DEV_URL = "postgresql://waiwai:waiwai@localhost:55432/waiwai";
const NEON_URL =
  "postgresql://neondb_owner:secret-pass@ep-cool-lab-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

test("target: ไม่ตั้ง TARGET_DATABASE_URL = ปฏิเสธ พร้อมบอกวิธีตั้ง", () => {
  const issues = validateRemoteTarget(undefined, DEV_URL);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.code, "missing");
  assert.ok(issues[0]?.message.includes("TARGET_DATABASE_URL"));
});

test("target: ปลายทางซ้ำกับฐานข้อมูลพัฒนา = ปฏิเสธ (กันเขียนทับข้อมูลในเครื่อง)", () => {
  const issues = validateRemoteTarget(DEV_URL, DEV_URL);
  const codes = issues.map((issue) => issue.code);
  assert.ok(codes.includes("same-as-dev"), "ต้องจับได้ว่าเป็นค่าเดียวกับ DATABASE_URL");
});

test("target: localhost/เครือข่ายภายใน = ปฏิเสธ", () => {
  for (const url of [
    "postgresql://u:p@localhost:5432/waiwai",
    "postgresql://u:p@127.0.0.1/waiwai",
    "postgresql://u:p@192.168.1.50/waiwai",
    "postgresql://u:p@10.0.0.7/waiwai",
    "postgresql://u:p@172.17.0.2/waiwai",
  ]) {
    const codes = validateRemoteTarget(url, DEV_URL).map((issue) => issue.code);
    assert.ok(codes.includes("local-host"), `${url} ต้องถูกปฏิเสธ`);
  }
});

test("target: Neon (สิงคโปร์) ผ่านการตรวจ", () => {
  const issues = validateRemoteTarget(NEON_URL, DEV_URL);
  assert.deepEqual(
    issues.map((issue) => issue.code),
    [],
    "ปลายทางคลาวด์ที่ถูกต้องต้องไม่มีปัญหา",
  );
  assert.equal(hostOf(NEON_URL), "ep-cool-lab-123456.ap-southeast-1.aws.neon.tech");
});

test("target: รูปแบบ connection string ผิด = ปฏิเสธ (ไม่เดา)", () => {
  for (const url of ["mysql://u:p@host/db", "ep-cool.neon.tech", "  "]) {
    const codes = validateRemoteTarget(url, DEV_URL).map((issue) => issue.code);
    assert.ok(codes.length > 0, `${url} ต้องถูกปฏิเสธ`);
  }
});

test("target: ข้อความบนหน้าจอต้องไม่โชว์รหัสผ่าน", () => {
  const shown = redactUrl(NEON_URL);
  assert.ok(!shown.includes("secret-pass"), "ห้ามเห็นรหัสผ่าน");
  assert.ok(shown.includes("neondb_owner"), "ยังเห็นชื่อผู้ใช้ได้ (ใช้ตรวจว่าถูกโปรเจกต์)");
  assert.ok(shown.includes("aws.neon.tech"), "ยังเห็นโฮสต์ได้");
  assert.equal(redactUrl("ไม่ใช่-url"), "<อ่าน connection string ไม่ได้>");
});

test("target: ตัวช่วย hostOf/isLocalHost ทำงานตรงไปตรงมา", () => {
  assert.equal(hostOf("postgresql://u:p@db.example.com:5432/x"), "db.example.com");
  assert.equal(hostOf("ไม่ใช่-url"), null);
  assert.equal(isLocalHost("LOCALHOST"), true, "ต้องไม่สนตัวพิมพ์");
  assert.equal(isLocalHost("[::1]"), true);
  assert.equal(isLocalHost("db.example.com"), false);
  assert.equal(isLocalHost("10.5.5.5"), true);
  assert.equal(isLocalHost("172.32.0.1"), false, "172.32 อยู่นอกช่วงส่วนตัว");
});
