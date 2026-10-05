import assert from "node:assert/strict";
import { test } from "node:test";

import { formatBytes, isAttachmentAllowed, readAttachmentInfo, safeAttachmentName } from "@/lib/forms/attachment";
import { CSV_BOM, toCsv } from "@/lib/forms/csv";
import {
  MAX_SUBMISSIONS_PER_WINDOW,
  SUBMISSION_WINDOW_MS,
  evaluateSubmissionRate,
  validateSubmission,
} from "@/lib/forms/model";

/** เทสต์ฟอร์มหน้าเว็บ (X1.9) — ตรรกะล้วน ไม่ต้องมี DB */

const contactFields = {
  email: "somchai@example.test",
  name: "สมชาย",
  phone: "021234567",
  topic: "product",
  subject: "สอบถามสินค้า",
  message: "สนใจสินค้ารุ่นใหม่ครับ",
  consent: "1",
};

test("validateSubmission: ฟอร์มติดต่อที่กรอกครบ = ผ่าน และได้ค่าที่ตัดช่องว่างแล้ว", () => {
  const result = validateSubmission("contact", { ...contactFields, name: "  สมชาย  " });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.form, "contact");
    assert.equal(result.value.name, "สมชาย");
    assert.equal(result.value.consent, true);
  }
});

test("validateSubmission: ฟอร์มติดต่อต้องมีชื่อ/หัวข้อ/เรื่อง/รายละเอียด (รายละเอียดสั้นเกิน = ไม่รับ)", () => {
  const missing = validateSubmission("contact", { ...contactFields, name: "", subject: "" });
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.deepEqual(
      missing.issues.map((issue) => issue.field).sort(),
      ["name", "subject"],
    );
  }

  const short = validateSubmission("contact", { ...contactFields, message: "สั้น" });
  assert.equal(short.ok, false);
  if (!short.ok) assert.ok(short.issues.some((issue) => issue.code === "too-short"));
});

test("validateSubmission: อีเมลผิดรูป = ไม่รับ · รับข่าวสารใช้แค่ email + ยินยอม", () => {
  const bad = validateSubmission("newsletter", { email: "ไม่ใช่อีเมล", consent: "1" });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.ok(bad.issues.some((issue) => issue.field === "email"));

  const ok = validateSubmission("newsletter", { email: "a@b.test", consent: "on" });
  assert.equal(ok.ok, true);
});

test("★ PDPA: ไม่ยินยอม = ไม่รับทุกฟอร์ม", () => {
  const result = validateSubmission("contact", { ...contactFields, consent: "" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.issues.some((issue) => issue.code === "consent-required"));
});

test("★ กับดักบอต: ช่อง website ที่มนุษย์มองไม่เห็น ถ้ากรอก ⇒ ผ่านแต่ติดธงสแปม", () => {
  /*
    ทำไม "ผ่าน" ไม่ใช่ "ไม่รับ"
    เพราะฝั่งเซิร์ฟเวอร์ต้องตอบบอตว่า "สำเร็จ" (ไม่บอกว่าโดนจับได้ ไม่งั้นบอตจะปรับตัว)
    แต่แถวที่บันทึกจะถูกทำเครื่องหมายเป็นสแปม (status = spam) — พิสูจน์ในขั้นตอนยิงจริง
  */
  const result = validateSubmission("contact", { ...contactFields, website: "https://spam.test" });
  assert.equal(result.ok, true, "ต้องผ่านเพื่อตอบบอตว่า 'สำเร็จ'");
  if (result.ok) assert.equal(result.spam, true, "แต่ต้องติดธงสแปม ⇒ บันทึกแยกได้");

  const clean = validateSubmission("contact", contactFields);
  assert.equal(clean.ok, true);
  if (clean.ok) {
    assert.equal(clean.spam, false);
    assert.equal(Object.keys(clean.value.payload).length, 0, "ไม่เก็บ honeypot ลง payload");
  }
});

test("validateSubmission: ฟอร์มสมัครงานต้องการชื่อ/อีเมล/ตำแหน่ง และเก็บช่องเพิ่มเติมลง payload", () => {
  const result = validateSubmission("careers", {
    email: "a@b.test",
    name: "สมหญิง",
    topic: "qc",
    consent: "1",
    experience: "5 ปี",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.payload["experience"], "5 ปี");
    assert.equal(result.value.topic, "qc");
  }
});

test("validateSubmission: ฟอร์มที่ไม่รู้จัก = ไม่รับ", () => {
  const result = validateSubmission("unknown-form", contactFields);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.issues[0]?.code, "unknown-form");
});

test("evaluateSubmissionRate: เกินเพดานในหน้าต่างเวลา = บล็อก และหมดเวลาแล้วปลดล็อก", () => {
  const now = 1_800_000_000_000;
  const recent = Array.from({ length: MAX_SUBMISSIONS_PER_WINDOW }, (_unused, index) => now - index * 1000);

  const blocked = evaluateSubmissionRate(recent, now);
  assert.equal(blocked.blocked, true);
  assert.ok(blocked.retryAfterMs > 0);

  assert.equal(evaluateSubmissionRate(recent, now + SUBMISSION_WINDOW_MS + 1).blocked, false);
  assert.equal(evaluateSubmissionRate([now], now).blocked, false);
  assert.equal(evaluateSubmissionRate([], now).blocked, false);
});

test("toCsv: ห่อช่องที่มีจุลภาค/อัญประกาศ/ขึ้นบรรทัดใหม่ + BOM + CRLF", () => {
  const rows = [{ a: 'ชื่อ, มีจุลภาค', b: 'พูดว่า "สวัสดี"', c: "บรรทัด\nสอง" }];
  const csv = toCsv(rows, [
    { header: "คอลัมน์ ก", value: (row) => row.a },
    { header: "b", value: (row) => row.b },
    { header: "c", value: (row) => row.c },
  ]);

  assert.ok(csv.startsWith(CSV_BOM), "ต้องมี BOM เพื่อให้ Excel อ่านภาษาไทยถูก");
  assert.ok(csv.includes('"ชื่อ, มีจุลภาค"'));
  assert.ok(csv.includes('"พูดว่า ""สวัสดี"""'));
  assert.ok(csv.includes('"บรรทัด\nสอง"'));
  assert.ok(csv.includes("\r\n"));
  assert.equal(csv.endsWith("\r\n"), true);
});

test("★ toCsv: กัน CSV injection (ช่องที่ขึ้นต้นด้วย = + - @)", () => {
  const csv = toCsv([{ v: "=cmd|'/c calc'!A0" }, { v: "+1234" }, { v: "-1+1" }, { v: "@SUM(A1)" }], [
    { header: "v", value: (row) => row.v },
  ]);

  assert.ok(csv.includes("'=cmd"), "ต้องเติม ' นำหน้าเพื่อไม่ให้ Excel รันเป็นสูตร");
  assert.ok(csv.includes("'+1234"));
  assert.ok(csv.includes("'-1+1"));
  assert.ok(csv.includes("'@SUM(A1)"));
});

/* ── ไฟล์แนบเรซูเม่ (X1.9 ส่วนที่ 2) ───────────────────────────────────────── */

test("readAttachmentInfo: รู้จัก PDF จากไบต์จริง (ไม่ใช่นามสกุล)", () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xe2, 0xe3]);
  const info = readAttachmentInfo(pdf);
  assert.equal(info?.mime, "application/pdf");
  assert.equal(info?.extension, "pdf");
});

test("readAttachmentInfo: รู้จัก Word รุ่นเก่า (OLE2) และรุ่นใหม่ (.docx = ZIP ที่มี word/)", () => {
  const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00]);
  assert.equal(readAttachmentInfo(ole)?.extension, "doc");

  const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
  const docxWithWord = new Uint8Array([...docx, ...[...("word/document.xml" as string)].map((char) => char.charCodeAt(0))]);
  assert.equal(readAttachmentInfo(docxWithWord)?.extension, "docx");

  /* ZIP ที่ไม่มีโฟลเดอร์ word/ (เช่น .zip, .xlsx) = ไม่รับ */
  assert.equal(readAttachmentInfo(docx), null);
});

test("readAttachmentInfo: ข้อความล้วนผ่าน · ไฟล์ไบนารีแปลก ๆ ไม่ผ่าน", () => {
  const text = new Uint8Array(Buffer.from("ประวัติส่วนตัว Somchai", "utf8"));
  assert.equal(readAttachmentInfo(text)?.extension, "txt", "ภาษาไทยเป็นหลายไบต์แต่ไม่มีอักขระศูนย์");

  const binary = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]);
  assert.equal(readAttachmentInfo(binary), null);
  assert.equal(readAttachmentInfo(new Uint8Array([])), null);
});

test("isAttachmentAllowed: ยอมรับเฉพาะ 4 ชนิดที่ประกาศ", () => {
  assert.equal(isAttachmentAllowed("application/pdf"), true);
  assert.equal(isAttachmentAllowed("text/plain"), true);
  assert.equal(isAttachmentAllowed("application/x-msdownload"), false);
  assert.equal(isAttachmentAllowed("image/png"), false);
});

test("safeAttachmentName: ชื่อไทยล้วน/เครื่องหมายประหลาด → ชื่อ ASCII ปลอดภัย", () => {
  assert.equal(safeAttachmentName("Somchai Resume.PDF", "pdf"), "Somchai-Resume.pdf");
  assert.equal(safeAttachmentName("ประวัติ.docx", "docx"), "attachment.docx");
  /* เอาเฉพาะส่วนท้ายสุดของเส้นทาง (ชื่อไฟล์จริง) — ปลอดภัยกว่าเดิม */
  assert.equal(safeAttachmentName("../../etc/passwd", "txt"), "passwd.txt");
  assert.equal(safeAttachmentName("folder/resume final.pdf", "pdf"), "resume-final.pdf");
  assert.equal(safeAttachmentName("a".repeat(200) + ".pdf", "pdf").length <= 64, true);
  assert.ok(!safeAttachmentName('bad"name\r\n.pdf', "pdf").includes('"'), "ต้องไม่มีอักขระที่ทำ header เพี้ยน");
});

test("formatBytes: อ่านง่าย (B/KB/MB)", () => {
  assert.equal(formatBytes(500), "500 B");
  assert.equal(formatBytes(2048), "2 KB");
  assert.equal(formatBytes(3 * 1024 * 1024), "3.0 MB");
});

/* ── ฟอร์ม + Server Action: ห้ามใส่ encType/method เอง (แก้รอบที่ 107) ────────────
   React 19 เตือนว่า "React provides those automatically. They will get overridden."
   ⇒ ต้องพิสูจน์ 2 ด้าน: (1) React เตือนจริงถ้าใส่เอง (2) ไม่ใส่แล้วไม่เตือน
   และ (3) ทั้งโปรเจกต์ไม่มีที่ไหนใส่ `encType`/`method` บนฟอร์มที่ action เป็นฟังก์ชัน
   ⚠️ React เตือนครั้งเดียวต่อโปรเซส (didWarn…) ⇒ ต้องเก็บ warning ของ "เคสผิด" ก่อน แล้วเช็คว่าเคสถูกไม่เพิ่ม warning
   ⚠️ ค่าที่ React ใส่ให้เอง (method/encType/action) มาจาก metadata ของ Server Action ของ Next
      ไม่ใช่จาก attribute ของเรา — ดูซอร์สจริง: react-server-dom-turbopack → { method: "POST", encType: "multipart/form-data" }
   --------------------------------------------------------------------------- */

test("ฟอร์ม: React 19 เตือนถ้าใส่ encType เอง — และไม่เตือนเมื่อไม่ใส่ (ล็อกกันใส่กลับ)", async () => {
  const { createElement } = await import("react");
  const { renderToString } = await import("react-dom/server");

  const collected: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    collected.push(args.map((value) => String(value)).join(" "));
  };

  const action = (): void => {};
  let withEncType = "";
  let without = "";

  try {
    withEncType = renderToString(
      createElement("form", { action, encType: "multipart/form-data" }, createElement("input", { name: "x" })),
    );
    const warningCountAfterBadCase = collected.filter((line) => line.includes("Cannot specify a encType")).length;
    assert.equal(warningCountAfterBadCase, 1, "React ต้องเตือนเมื่อเราส่ง encType มาคู่กับ action ที่เป็นฟังก์ชัน");

    collected.length = 0;
    without = renderToString(createElement("form", { action }, createElement("input", { name: "x" })));
    assert.deepEqual(
      collected.filter((line) => line.includes("Cannot specify a encType")),
      [],
      "ห้ามมี warning เมื่อไม่ส่ง encType/method เอง",
    );
  } finally {
    console.error = originalError;
  }

  /*
    หลักฐานว่า `encType` ที่เราใส่ "ถูกทิ้งจริง" (ไม่ใช่แค่ถูกทับ)
    - ใน React เปล่า (ไม่มี metadata ของ Server Action) React ใส่ `action="javascript:throw …"` ให้ และ **ไม่ออก encType เลย**
    - ในแอปจริง Next/RSC จะเติม `action="" method="POST" encType="multipart/form-data"` จาก metadata ของ Server Action
      (ยืนยันจากซอร์ส `react-server-dom-turbopack` + HTML ที่เรนเดอร์จริงของ `/th/careers`)
    ⇒ ของที่เราส่งไปหายทั้งสองกรณี — ใส่ไว้จึงไร้ประโยชน์และมีแต่ warning
  */
  assert.ok(withEncType.includes("<form"), "เคสผิดยังเรนเดอร์เป็นฟอร์ม");
  assert.ok(
    !withEncType.includes('encType="multipart/form-data"'),
    "encType ที่เราส่งไปต้องถูกทิ้ง (React ใช้ค่าของตัวเอง) — ยืนยันว่าการใส่ไว้ไม่มีผล",
  );
  /* เคสถูก: ปล่อยให้ React/Next จัดการ attribute ให้หมด */
  assert.ok(without.includes("<form"), "เคสถูกต้องเรนเดอร์เป็นฟอร์มปกติ");
});

test("ฟอร์ม: ทั้งโปรเจกต์ห้ามใส่ encType/method บน <form> ที่ action เป็นฟังก์ชัน/ตัวแปร", async () => {
  const { readFileSync, readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");

  const root = process.cwd();
  const offenders: string[] = [];

  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!name.endsWith(".tsx")) continue;
      const source = readFileSync(full, "utf8");
      /* จับเฉพาะแท็ก <form …> ที่มี encType/method และ action ที่ไม่ใช่สตริง (เช่น action={formAction}) */
      for (const match of source.matchAll(/<form\b[^>]*>/g)) {
        const tag = match[0];
        if (!/action=\{/.test(tag)) continue;
        if (/\bencType=|\bmethod=/.test(tag)) offenders.push(`${full.replace(root, "")}: ${tag.slice(0, 120)}`);
      }
    }
  };

  for (const dir of ["app", "features", "lib"]) walk(join(root, dir));
  assert.deepEqual(offenders, [], "ห้ามใส่ encType/method บนฟอร์มที่ action เป็นฟังก์ชัน (React จัดการให้เอง)");
});
