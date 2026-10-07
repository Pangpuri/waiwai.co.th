import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { cleanDecision, humanSize, portFromArgs, shouldForce } from "./dev-clean.ts";

/**
 * เทสต์ `npm run dev:clean` — เครื่องมือกู้ dev server ที่พัง
 *
 * ที่มา (เคสจริง 2026-10-07): `.next` (cache ของ dev/Turbopack อยู่ที่ `.next/dev`) เสียสถานะ
 * เมื่อมี build/start หรือ kill process ระหว่างที่ dev กำลังรัน ⇒ **ทุกหน้าตอบ 500** ด้วย
 * `SyntaxError: Unexpected non-whitespace character after JSON at position N` (ไม่มีเฟรมโค้ดเรา)
 * ⇒ เครื่องมือนี้ต้อง **fail-closed**: ไม่ลบอะไรถ้ายังมีเซิร์ฟเวอร์ถือพอร์ตอยู่
 */

test("dev-clean: ปฏิเสธการลบขณะมีเซิร์ฟเวอร์รัน (fail-closed) เว้นสั่ง --force", () => {
  assert.deepEqual(
    cleanDecision({ portBusy: true, force: false }),
    { ok: false, reason: "port-busy" },
    "พอร์ตไม่ว่าง = ห้ามลบ (การลบ .next ขณะเซิร์ฟเวอร์รันคือต้นเหตุของบั๊กนี้)",
  );
  assert.deepEqual(cleanDecision({ portBusy: true, force: true }), { ok: true }, "--force = ยอมให้ลบ");
  assert.deepEqual(cleanDecision({ portBusy: false, force: false }), { ok: true }, "พอร์ตว่าง = ลบได้");
});

test("dev-clean: อ่านพอร์ต/ธงจากอาร์กิวเมนต์อย่างปลอดภัย (ค่าที่ใช้ไม่ได้ = พอร์ตเริ่มต้น)", () => {
  assert.equal(portFromArgs([]), 3000, "ไม่ระบุ = 3000");
  assert.equal(portFromArgs(["--port=3001"]), 3001);
  for (const bad of ["--port=", "--port=abc", "--port=0", "--port=-5", "--port=70000", "--port=3.5", "--port= 3001"]) {
    assert.equal(portFromArgs([bad]), 3000, `${bad} ต้องถอยไปพอร์ตเริ่มต้น (ห้าม throw)`);
  }
  assert.equal(shouldForce([]), false);
  assert.equal(shouldForce(["--force"]), true);
});

test("dev-clean: ขนาดไฟล์ที่รายงานอ่านรู้เรื่อง", () => {
  assert.equal(humanSize(0), "0 B");
  assert.equal(humanSize(-1), "0 B", "ค่าติดลบต้องไม่พัง");
  assert.equal(humanSize(512), "512 B");
  assert.equal(humanSize(1024), "1.0 KB");
  assert.equal(humanSize(2048), "2.0 KB");
  assert.equal(humanSize(3 * 1024 * 1024), "3.0 MB");
  assert.equal(humanSize(1024 * 1024 * 1024), "1.0 GB");
});

test("dev-clean: ตรวจพอร์ตด้วย connect (ห้าม bind) + ลบเฉพาะ .next", () => {
  const source = readFileSync("scripts/dev-clean.ts", "utf8");

  /* ⚠️ บทเรียนจริง: การตรวจด้วย "ลอง bind" ใช้ไม่ได้บน Windows (bind 127.0.0.1 สำเร็จได้ทั้งที่ 0.0.0.0 ถูกใช้อยู่) */
  assert.ok(source.includes("connect({ port, host })"), "ต้องตรวจพอร์ตด้วยการต่อเข้าไปจริง");
  assert.ok(!source.includes("createServer"), "ห้ามตรวจด้วยการลอง bind (บน Windows รายงาน 'ว่าง' ทั้งที่ถูกใช้อยู่)");
  assert.ok(!source.includes("EADDRINUSE"), "ห้ามพึ่ง EADDRINUSE");
  assert.ok(source.includes("setTimeout"), "ต้องมีเพดานเวลา ไม่งั้นค้างเมื่อพอร์ตเงียบ");

  /* ขอบเขตการลบ: ต้องเจาะจงที่ .next เท่านั้น */
  assert.ok(source.includes('path.join(ROOT, ".next")'), "พาธที่ลบต้องประกอบจากรากโปรเจกต์ + .next");
  assert.ok(source.includes("rmSync(CACHE_DIR"), "ต้องลบผ่านตัวแปร CACHE_DIR เท่านั้น");

  /* ต่อสายกับ npm script จริง */
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };
  assert.equal(
    pkg.scripts?.["dev:clean"],
    "node --import ./scripts/alias-hook.mjs scripts/dev-clean.ts",
    "package.json ต้องมีสคริปต์ dev:clean ชี้ไฟล์นี้",
  );
});
