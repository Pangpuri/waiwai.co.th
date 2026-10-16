import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  DEFAULT_PROBE_URL,
  formatProbeLine,
  parseProbeArgs,
  summarizeProbeResults,
  targetsForOptions,
} from "@/lib/probe/runner";
import type { ProbeTarget } from "@/lib/probe/targets";
import { MAINTENANCE_PROBE_TARGETS, PROBE_TARGETS, probeProblems, selectProbeTargets } from "@/lib/probe/targets";
import { REPO_ROOT, stripComments } from "@/scripts/source-scan";

/**
 * เทสต์ของเครื่องมือยิงเส้นทาง (`npm run probe:routes` · รอบที่ 292)
 *
 * จุดสำคัญ: **ตรรกะตัดสินต้องไม่ตัดสิน error จากข้อความในพจนานุกรม** (บทเรียนรอบ 117/291)
 * และทะเบียนต้องมีชุดกันถอยหลังของบั๊กที่เจอจริง (พารามิเตอร์ซ้ำ/NUL)
 */

const target = (overrides: Partial<ProbeTarget> = {}): ProbeTarget => ({
  url: "/x",
  expect: [200],
  group: "public",
  ...overrides,
});

test("probe: ตัวช่วยอ่าน argv — ค่าเริ่มต้น · ตัด slash ท้าย · โยน error เมื่อตัวเลือกไม่รู้จัก", () => {
  assert.deepEqual(parseProbeArgs([]).baseUrl, DEFAULT_PROBE_URL);
  assert.equal(parseProbeArgs(["--url=http://localhost:3001/"]).baseUrl, "http://localhost:3001");
  assert.equal(parseProbeArgs([], { PROBE_URL: "https://demo.example/" }).baseUrl, "https://demo.example");

  const options = parseProbeArgs(["--only=/admin/media", "--maintenance", "--json", "--no-session", "--keep-session", "--concurrency=8"]);
  assert.equal(options.only, "/admin/media");
  assert.equal(options.maintenance, true);
  assert.equal(options.json, true);
  assert.equal(options.useSession, false);
  assert.equal(options.keepSession, true);
  assert.equal(options.concurrency, 8);

  assert.throws(() => parseProbeArgs(["--nope"]), /ไม่รู้จักตัวเลือก/);
  assert.throws(() => parseProbeArgs(["--concurrency=0"]), /1–16/);
});

test("probe: ตัดสินผล — สถานะ · 5xx · สัญญาณ error จริง · ค่าที่หลุด · ข้อความที่ต้องมี", () => {
  const page = target({ expect: [200], must: ["บะหมี่"] });

  assert.deepEqual(probeProblems({ status: 200, body: "…บะหมี่…" }, page), [], "ผ่าน = ไม่มีปัญหา");
  assert.deepEqual(probeProblems({ status: 404, body: "บะหมี่" }, page)[0], "สถานะ 404 (คาด 200)");
  assert.ok(probeProblems({ status: 500, body: "" }, page).some((p) => p.includes("5xx")), "5xx ที่ไม่ได้คาด = พังจริง");
  /*
    ⚠️ 5xx ที่ "คาดไว้" ต้องไม่ถูกฟ้อง — โหมดปิดปรับปรุงตอบ **503 โดยเจตนา**
    (ตัวตรวจรุ่นแรกของรอบ 292 ฟ้องทั้งชุด ⇒ false positive)
  */
  assert.deepEqual(probeProblems({ status: 503, body: "ปิดปรับปรุง" }, target({ expect: [503] })), []);
  assert.ok(probeProblems({ status: 200, body: "x>undefined<" }, page).some((p) => p.includes("undefined")));
  assert.ok(probeProblems({ status: 200, body: "Application error: a server-side exception" }, page).length > 0);
  assert.ok(probeProblems({ status: 200, body: "ไม่มีคำนั้น" }, page).some((p) => p.includes("ขาดข้อความ")));

  /*
    ⚠️ บทเรียนสำคัญ: ข้อความจากพจนานุกรมถูก serialize ลง RSC payload ทุกหน้า
    ⇒ ต้อง **ไม่** ถือเป็นสัญญาณ error (ไม่งั้นรายงานปลอมทั้งเว็บ — เคยเกิดจริงรอบ 291)
  */
  assert.deepEqual(probeProblems({ status: 200, body: "…เกิดข้อผิดพลาดในระบบ…บะหมี่" }, page), []);
  assert.deepEqual(probeProblems({ status: 404, body: '<html id="__next_error__">' }, target({ expect: [404] })), []);
});

test("probe: ทะเบียนต้องมีชุดกันถอยหลังของบั๊กที่เจอจริง (พารามิเตอร์ซ้ำ/NUL) + รูปทรงข้อมูลถูกต้อง", () => {
  const urls = PROBE_TARGETS.map((entry) => `${entry.admin === true ? "admin" : "public"} ${entry.url}`);
  assert.equal(new Set(urls).size, urls.length, "ห้ามมีเส้นซ้ำ (คู่ url+admin ต้องไม่ซ้ำ)");

  for (const entry of [...PROBE_TARGETS, ...MAINTENANCE_PROBE_TARGETS]) {
    assert.ok(entry.url.startsWith("/"), `url ต้องขึ้นต้นด้วย / : ${entry.url}`);
    assert.ok(entry.expect.length > 0, `ต้องระบุสถานะที่คาดไว้: ${entry.url}`);
    for (const status of entry.expect) assert.ok(Number.isInteger(status), `สถานะต้องเป็นจำนวนเต็ม: ${entry.url}`);
  }

  /* ชุดกันถอยหลังรอบที่ 291 — ถ้าหายไป = ด่านนี้จับบั๊กกลับมาไม่ได้ */
  for (const url of [
    "/admin/media?q=%00",
    "/admin/products?q=a&q=b",
    "/admin/products?category=a&category=b",
    "/admin/news?q=a&q=b",
    "/admin/recipes?q=a&q=b",
    "/admin/careers?q=a&q=b",
    "/admin/inbox?erase=a&erase=b",
    "/admin/hero?saved=a&saved=b",
    "/admin/hero?error=a&error=b",
    "/admin/hero?fields=a&fields=b",
    "/admin/builder/chrome?part=a&part=b&mode=a&mode=b",
    "/th/preview/home?parts=a&parts=b",
  ]) {
    assert.ok(
      PROBE_TARGETS.some((entry) => entry.url === url),
      `ทะเบียนต้องมีเส้นกันถอยหลัง: ${url}`,
    );
  }

  assert.ok(PROBE_TARGETS.length > 100, "ทะเบียนต้องครอบคลุมจริง (กันเทสต์หลอก)");
  assert.ok(MAINTENANCE_PROBE_TARGETS.length >= 10, "ชุดโหมดปิดปรับปรุงต้องมีเส้นหลักครบ");
});

test("probe: เลือกเส้นตามตัวเลือก + สรุปผล (รวมกรณีไม่ได้ยิงด้วยเซสชัน)", () => {
  assert.equal(selectProbeTargets().length, PROBE_TARGETS.length);
  assert.equal(selectProbeTargets({ maintenance: true }).length, MAINTENANCE_PROBE_TARGETS.length);

  const only = selectProbeTargets({ only: "/admin/media" });
  assert.ok(only.length >= 2 && only.every((entry) => entry.url.includes("/admin/media")));
  assert.equal(selectProbeTargets({ only: "ไม่มีทางเจอ" }).length, 0);

  const viaOptions = targetsForOptions(parseProbeArgs(["--only=/healthz", "--maintenance"]));
  assert.ok(viaOptions.length >= 1);

  const results = [
    { target: target({ url: "/a" }), status: 200, ms: 1, problems: [] },
    { target: target({ url: "/b" }), status: 500, ms: 2, problems: ["HTTP 5xx = เซิร์ฟเวอร์พังจริง"] },
    { target: target({ url: "/c", admin: true, expect: [200] }), status: 307, ms: 3, problems: ["สถานะ 307 (คาด 200)"] },
  ];
  const summary = summarizeProbeResults(results);
  assert.equal(summary.total, 3);
  assert.equal(summary.passed, 1);
  assert.equal(summary.failed.length, 2);
  assert.equal(summary.skippedWithoutSession, 1, "เส้นหลังบ้านที่ได้ 307 = บอกว่ายิงโดยไม่มีเซสชัน");

  const [firstResult, , thirdResult] = results;
  assert.ok(firstResult !== undefined && thirdResult !== undefined, "ต้องมีผลลัพธ์ครบ 3 รายการ");
  assert.ok(formatProbeLine(firstResult).includes("✓"), "บรรทัดผลลัพธ์ต้องบอกผลชัด");
  assert.ok(formatProbeLine(thirdResult).includes("🔐"), "เส้นหลังบ้านต้องมีสัญลักษณ์กำกับ");
});

test("probe: สัญญาความปลอดภัยของสคริปต์ — เพิกถอนเซสชัน · ไม่พิมพ์คุกกี้ · ไม่เขียนข้อมูลเนื้อหา", () => {
  const source = stripComments(readFileSync(path.join(REPO_ROOT, "scripts/probe-routes.ts"), "utf8"));
  const runner = stripComments(readFileSync(path.join(REPO_ROOT, "lib/probe/runner.ts"), "utf8"));

  assert.ok(source.includes("revokeAdminSessions("), "ต้องเพิกถอนเซสชันที่มินต์ไว้เมื่อจบ");
  assert.ok(source.includes("options.useSession"), "ต้องเคารพธงปิดการใช้เซสชัน");
  assert.ok(runner.includes('"--no-session"'), "ต้องมีทางปิดการใช้เซสชัน (อ่านจาก argv)");
  assert.ok(source.includes("waiwai-probe-routes"), "ต้องติด user-agent ของตัวเอง (แยกแยะในตาราง admin_session)");

  /* ห้ามพิมพ์ค่าคุกกี้/รหัสลับออก stdout (คุกกี้ใช้ส่ง header เท่านั้น) */
  assert.ok(
    !/(console\.log|stdout\.write)\([^)]*\bcookie\b/.test(source),
    "ห้ามพิมพ์ค่าคุกกี้/เซสชันออก stdout",
  );

  /* ห้ามเขียนข้อมูล: การเขียนเดียวที่อนุญาตคือแถวเซสชันของตัวเอง (ผ่านฟังก์ชันใน lib/auth) */
  const forbidden = [/insert\s+into\s+(?!admin_session)/i, /update\s+(?!admin_session)/i, /delete\s+from/i];
  for (const pattern of forbidden) {
    assert.ok(!pattern.test(source), `สคริปต์ต้องไม่เขียนข้อมูลเอง (พบ ${String(pattern)})`);
  }
});
