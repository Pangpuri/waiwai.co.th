import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_PROBE_URL,
  evaluateProbeResponse,
  formatProbeLine,
  parseProbeArgs,
  shouldRetryAfter5xx,
  summarizeProbeResults,
  targetsForOptions,
} from "@/lib/probe/runner";
import type { ProbeTarget } from "@/lib/probe/targets";
import { MAINTENANCE_PROBE_TARGETS, PROBE_TARGETS, probeProblems, selectProbeTargets } from "@/lib/probe/targets";
import { PROBE_FLOW_IDS, PROBE_FLOWS, isLocalProbeUrl, selectProbeFlows } from "@/lib/probe/flow-plan";
import { formFieldsOf, formWithField, formWithFileInput, formsOf, hasServerActionFields } from "@/lib/probe/forms";
import { codeOf } from "./source-scan.ts";

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
  const source = codeOf("scripts/probe-routes.ts");
  const runner = codeOf("lib/probe/runner.ts");
  const session = codeOf("scripts/probe-session.ts");

  assert.ok(source.includes("releaseProbeSession("), "ต้องเพิกถอนเซสชันที่มินต์ไว้เมื่อจบ");
  assert.ok(session.includes("revokeAdminSessions("), "ตัวเพิกถอนต้องเรียกเส้นทางจริงของโปรเจกต์");
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

/* ── รอบที่ 293: อ่านฟอร์มให้ครบ (บทเรียน select ตกหล่น) · flow หลายขั้น · ยิงซ้ำเมื่อ 5xx ── */

test("probe: อ่านช่องฟอร์มแบบที่เบราว์เซอร์ส่งจริง — select/textarea/$ACTION_REF ต้องไม่ตกหล่น", () => {
  const html = `
    <form action="" method="POST">
      <input type="hidden" name="$ACTION_REF_1"/>
      <input type="hidden" name="$ACTION_1:0" value="{&quot;id&quot;:&quot;x&quot;}"/>
      <input type="hidden" name="$ACTION_KEY" value="k1"/>
      <select name="page"><option value="home" selected="">โฮม</option><option value="about">บริษัท</option></select>
      <select name="mode"><option value="draft">ร่าง</option></select>
      <textarea name="note">ข้อความ &amp; อื่น ๆ</textarea>
      <input type="file" name="file"/>
      <input type="text" name="q" value="บะหมี่"/>
      <button type="submit" name="go" value="1">ส่ง</button>
    </form>
    <form action="/admin/inbox" method="get"><input type="text" name="status"/></form>`;

  const forms = formsOf(html);
  assert.equal(forms.length, 2, "ต้องเจอทั้งสองฟอร์ม");
  const fields = formFieldsOf(forms[0] ?? "");
  const asRecord = Object.fromEntries(fields);

  assert.equal(asRecord["page"], "home", "select: ต้องเอาตัวที่ selected (เคสจริงที่เคยตกหล่น)");
  assert.equal(asRecord["mode"], "draft", "select ที่ไม่มี selected: เอาตัวแรก");
  assert.equal(asRecord["note"], "ข้อความ & อื่น ๆ", "textarea + unescape");
  assert.equal(asRecord["q"], "บะหมี่");
  assert.equal(asRecord["$ACTION_REF_1"], "", "$ACTION_REF ไม่มีค่า ⇒ ส่งเป็นค่าว่าง");
  assert.equal(asRecord["$ACTION_1:0"], '{"id":"x"}', "unescape &quot; ให้เป็น JSON ที่ใช้ได้");
  assert.equal(asRecord["file"], undefined, "ไฟล์ไม่เก็บใน fields (ผู้เรียกเติมเอง)");
  assert.equal(asRecord["go"], undefined, "ปุ่ม submit ไม่ถูกส่ง");

  assert.ok(hasServerActionFields(forms[0] ?? ""), "ฟอร์ม Server Action ต้องตรวจจับได้");
  assert.ok(!hasServerActionFields(forms[1] ?? ""), "ฟอร์มตัวกรอง GET ต้องไม่ถูกนับเป็น Server Action");
  assert.equal(formWithFileInput(forms), forms[0], "หาฟอร์มที่มีช่องไฟล์ได้");
  assert.equal(formWithField(forms, "page"), forms[0], "หาฟอร์มที่มีช่องตามชื่อได้");
  assert.equal(formWithField(forms, "nope"), undefined);
});

test("probe: flow หลายขั้น — มีครบ 4 flow · เลือกได้ · และ **ปฏิเสธเซิร์ฟเวอร์ไกล** โดยค่าเริ่มต้น", () => {
  assert.deepEqual([...PROBE_FLOW_IDS], ["rate-limit", "session-revoke", "upload-guard", "preview-link", "sql-injection", "contact-form"]);
  assert.equal(PROBE_FLOWS.length, 6);
  assert.equal(selectProbeFlows().length, 6);
  assert.equal(selectProbeFlows("upload").length, 1);
  assert.equal(selectProbeFlows("ไม่มีทางเจอ").length, 0);
  /* flow ที่ต้องใช้เซสชัน (ยกเว้น rate limit ที่ยิงสาธารณะได้) */
  assert.equal(PROBE_FLOWS.filter((flow) => flow.needsSession).length, 4);

  for (const local of ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost", "http://[::1]:3000"]) {
    assert.equal(isLocalProbeUrl(local), true, `${local} ต้องถือว่าในเครื่อง`);
  }
  for (const remote of ["https://waiwai-co-th-demo.vercel.app", "http://192.168.1.9:3000", "https://www.waiwai.com", "ไม่ใช่ url"]) {
    assert.equal(isLocalProbeUrl(remote), false, `${remote} ต้องถือว่าไกล (flow ต้องไม่รันโดยไม่ยืนยัน)`);
  }
});

test("probe: ยิงซ้ำเมื่อเจอ 5xx (dev warm-up) — แต่ 5xx ที่คาดไว้ต้องไม่ยิงซ้ำ และต้องรายงานว่าได้ยิงซ้ำ", () => {
  const normal = target({ url: "/a", expect: [200] });
  assert.equal(shouldRetryAfter5xx(normal, 500), true, "500 ที่ไม่ได้คาด = ยิงซ้ำได้ (dev warm-up)");
  assert.equal(shouldRetryAfter5xx(normal, 404), false);
  assert.equal(shouldRetryAfter5xx(target({ expect: [503] }), 503), false, "503 ของโหมดปิดปรับปรุง = คาดไว้ ไม่ยิงซ้ำ");

  const passed = evaluateProbeResponse(normal, { status: 200, body: "ok", ms: 5, retriedAfter5xx: true });
  assert.equal(passed.problems.length, 0);
  assert.equal(passed.retriedAfter5xx, true);
  assert.ok(formatProbeLine(passed).includes("ยิงซ้ำหลัง 5xx"), "ต้องบอกผู้อ่านว่าได้ยิงซ้ำ ไม่ใช่ผ่านเงียบ ๆ");

  const stillBroken = evaluateProbeResponse(normal, { status: 500, body: "", ms: 9, retriedAfter5xx: true });
  assert.ok(
    stillBroken.problems.some((problem) => problem.includes("พังจริง")),
    "ยิงซ้ำแล้วยัง 5xx ต้องบอกว่าเป็นของจริง ไม่ใช่ warm-up",
  );
});

test("probe: flow ต้องมีวินัยความปลอดภัย — เก็บกวาดเสมอ · ไม่พิมพ์คุกกี้ · ไม่แตะข้อมูลจริงของเจ้าของ", () => {
  const flows = codeOf("scripts/probe-flows.ts");
  const cli = codeOf("scripts/probe-routes.ts");

  assert.ok(flows.includes("finally {"), "ทุก flow ต้องเก็บกวาดใน finally");
  assert.ok(flows.includes("isLocalProbeUrl"), "ต้องมีประตูกันรันกับเซิร์ฟเวอร์ไกล");
  assert.ok(flows.includes("releaseProbeSession"), "ต้องเพิกถอนเซสชันที่มินต์ไว้");
  assert.ok(flows.includes("storeImageFile"), "ตรวจเหตุผลระดับฟังก์ชัน (ไม่เดาจากข้อความบนจอ)");
  assert.ok(!/(console\.log|stdout\.write)\([^)]*\bcookie\b/.test(flows), "ห้ามพิมพ์ค่าคุกกี้");
  assert.ok(cli.includes("options.flows"), "CLI ต้องมีทางเรียกโหมด flow");
  assert.ok(flows.includes("probe-%"), "ของที่สร้างต้องใช้ชื่อที่ระบุได้ (probe-…) เพื่อลบได้ตรง");

  /* flow ต้องไม่แตะเนื้อหาจริง: อนุญาตให้ลบเฉพาะแถวที่ตัวเองสร้าง */
  assert.ok(
    !/delete\s+from\s+(product|recipe|news|job_posting|page_document)/i.test(flows),
    "flow ห้ามลบเนื้อหาจริง (สินค้า/เมนู/ข่าว/งาน/เอกสารหน้า)",
  );
});

test("หลังบ้าน: 404 ต้องเป็นหน้าของเรา (ทั้ง URL ที่ไม่รู้จักและหน้าที่เรียก notFound) — กันถอยกลับไปใช้ของ Next", () => {
  const read = (relative: string): string => codeOf(relative);

  const notFound = read("app/admin/not-found.tsx");
  assert.ok(notFound.includes("pageNotFoundTitle") && notFound.includes("pageNotFoundBody"), "หน้า 404 ต้องใช้ข้อความจากพจนานุกรม");
  assert.ok(notFound.includes('href="/admin"'), "ต้องมีทางกลับหน้าภาพรวม");
  /* `codeOf()` ตัดคอมเมนต์ให้แล้ว ⇒ ถ้ายังเจออักษรไทย = เป็นข้อความที่ผู้ใช้เห็นจริง (ผิดกติกา i18n) */
  assert.ok(
    !/[\u0E00-\u0E7F]/.test(notFound),
    "ห้ามมีข้อความไทยใน .tsx — ข้อความต้องมาจากพจนานุกรม",
  );

  const catchAll = read("app/admin/[...rest]/page.tsx");
  assert.ok(catchAll.includes("requireAdminUser("), "URL ที่ไม่รู้จักต้องตรวจสิทธิ์ก่อน (ยังไม่ล็อกอิน = เด้งไปล็อกอิน)");
  assert.ok(catchAll.includes("notFound()"), "แล้วจึงสั่ง 404 ให้ตัวจับของหลังบ้านทำงาน");

  /* เส้นทางในทะเบียน probe ต้องคุมพฤติกรรมนี้ไว้ (ทั้งมี/ไม่มีเซสชัน) */
  assert.ok(PROBE_TARGETS.some((entry) => entry.url === "/admin/nope-nope" && entry.admin === true && entry.expect.includes(404)));
  assert.ok(PROBE_TARGETS.some((entry) => entry.url === "/admin/nope-nope" && entry.expect.includes(307)));
});

test("probe: flow SQL injection ต้อง 'อ่านอย่างเดียว' — payload และตัว flow ห้ามมีคำสั่งที่เขียน/ทำลายข้อมูล", () => {
  const flows = codeOf("scripts/probe-flows.ts");

  const payloadBlock = /const SQL_INJECTION_PAYLOADS[\s\S]*?\];/.exec(flows)?.[0] ?? "";
  assert.ok(payloadBlock.includes("' or 1=1--"), "ต้องพบชุด payload (กันเทสต์ผ่านเพราะอ่านไม่เจอ)");

  /* ตัว flow เอง (ตั้งแต่ชื่อฟังก์ชันถึงตัวคั่นถัดไป) — payload + โค้ดในฟังก์ชันต้องไม่เขียน/ทำลายข้อมูล */
  const flowStart = flows.indexOf("async function runSqlInjectionFlow");
  const flowBlock = flowStart === -1 ? "" : flows.slice(flowStart, flows.indexOf("/* ── จุดเข้าใช้ ─", flowStart));
  assert.ok(flowBlock.includes("searchMedia"), "ต้องยิงผ่านชั้นข้อมูลจริง (ไม่ใช่ SQL ที่เขียนเอง)");

  const destructive = [/\bdrop\s+table\b/i, /\bdelete\s+from\b/i, /\binsert\s+into\b/i, /\bupdate\s+\w+\s+set\b/i, /\btruncate\b/i, /\balter\s+table\b/i];

  /*
    ⚠️ กัน "เทสต์หลอกตัวเอง" (เจอจริงรอบ 296): รูปแบบเคยถูกเขียนจน `\b` กลายเป็นอักขระ backspace
    ⇒ ไม่จับอะไรเลย ⇒ เทสต์ผ่านทั้งที่ไม่ได้ตรวจอะไร · ต้องพิสูจน์ว่ารูปแบบ **จับตัวอย่างจริงได้**
  */
  const badSamples = ["drop table media", "delete from form_submission", "insert into admin_user", "update admin_user set x", "truncate news", "alter table news"];
  for (const sample of badSamples) {
    assert.ok(destructive.some((pattern) => pattern.test(sample)), `รูปแบบต้องจับ "${sample}" ได้ (กัน regex ที่เขียนผิดจนไม่จับอะไรเลย)`);
  }

  for (const pattern of destructive) {
    assert.ok(!pattern.test(payloadBlock), `payload ห้ามมีคำสั่งที่เขียน/ทำลายข้อมูล (พบ ${String(pattern)})`);
    assert.ok(!pattern.test(flowBlock), `ตัว flow ต้องอ่านอย่างเดียว (พบ ${String(pattern)})`);
  }

  assert.ok(flows.includes("sql-injection"), "flow ต้องถูกลงทะเบียนในแผน");
  /* เกณฑ์ตัดสิน: เทียบจำนวนแถวจริงกับ "คำที่ไม่ตรง" และต้องไม่คืนทั้งคลัง (ไม่ใช่แค่ดูสถานะ HTTP) */
  assert.ok(flows.includes("baselineMedia") && flows.includes("allMedia.length"), "ต้องเทียบจำนวนแถวจริง");
  assert.ok(flows.includes("SQL_ERROR_SIGNS"), "ต้องตรวจสัญญาณ error ของ Postgres ในคำตอบด้วย");
});
