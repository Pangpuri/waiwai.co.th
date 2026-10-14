import assert from "node:assert/strict";
import { test } from "node:test";

import { codeOf } from "./source-scan.ts";
import { selectTargetUrl, targetBanner } from "./target-env.ts";

/**
 * เทสต์ "ธง `--target`" ของสคริปต์ที่ต้องยิงฐานข้อมูลปลายทาง (รอบที่ 282)
 *
 * ที่มา: เจ้าของถามว่า *"แต่ที่ vercel มันต่อกับ neon อยู่นี่ครับ ต่อให้ใส่ key ที่ต่อจาก docker
 * ในเครื่องไปก็ไม่น่าขึ้นอยู่ดีหรือเปล่า"* ⇒ คำตอบคือถูก และช่องโหว่จริงคือ **คำสั่งที่ต้องรันกับปลายทาง**
 * เดิมต้องตัดต่อ URL เอง (`DATABASE_URL="$NEON" npm run db:migrate`) ซึ่งพลาดง่ายและเงียบ
 *
 * ⚠️ เทสต์ชุดนี้ **ไม่ต่อฐานข้อมูล** — ตรวจแค่การเลือก URL + ข้อความ + ว่าไฟล์คำสั่งใช้ตัวช่วยจริง
 */

const LOCAL = "postgres://waiwai@localhost:55432/waiwai";
const NEON_DIRECT = "postgres://neondb_owner:pw@ep-small-shadow-b3ooq1yz.c-4.ap-southeast-1.aws.neon.tech/neondb";
const NEON_POOLER = "postgres://neondb_owner:pw@ep-small-shadow-b3ooq1yz-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb";

test("--target: เลือกปลายทางจาก TARGET_DATABASE_URL และบอกโฮสต์ให้เห็น", () => {
  const selection = selectTargetUrl({ DATABASE_URL: LOCAL, TARGET_DATABASE_URL: NEON_DIRECT });
  assert.equal(selection.ok, true);
  if (!selection.ok) return;
  assert.equal(selection.host, "ep-small-shadow-b3ooq1yz.c-4.ap-southeast-1.aws.neon.tech");
  assert.equal(selection.convertedFromPooler, false, "URL ตรงอยู่แล้ว = ไม่ต้องแปลง");
  assert.ok(targetBanner(selection).includes(selection.host), "ต้องพิมพ์โฮสต์ให้ผู้ใช้เห็น");
});

test("--target: URL ของ pooler ถูกแปลงเป็น endpoint ตรง (บทเรียนรอบที่ 115: search_path ว่าง)", () => {
  const selection = selectTargetUrl({ DATABASE_URL: LOCAL, TARGET_DATABASE_URL: NEON_POOLER });
  assert.equal(selection.ok, true);
  if (!selection.ok) return;
  assert.equal(selection.host.includes("-pooler"), false, "ต้องไม่เหลือ -pooler");
  assert.equal(selection.convertedFromPooler, true);
  assert.ok(targetBanner(selection).includes("pooler"), "ต้องบอกผู้ใช้ว่าแปลงมาแล้ว");
});

test("--target: ปฏิเสธอย่างเปิดเผยเมื่อตั้งค่าไม่ได้ (ไม่เดาค่าให้)", () => {
  const missing = selectTargetUrl({ DATABASE_URL: LOCAL, TARGET_DATABASE_URL: "" });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.ok(missing.message.includes("TARGET_DATABASE_URL"), missing.message);

  const sameAsDev = selectTargetUrl({ DATABASE_URL: LOCAL, TARGET_DATABASE_URL: LOCAL });
  assert.equal(sameAsDev.ok, false, "ปลายทางซ้ำกับ dev ต้องถูกปฏิเสธ");

  const local = selectTargetUrl({ DATABASE_URL: "postgres://a@other-host:5432/x", TARGET_DATABASE_URL: LOCAL });
  assert.equal(local.ok, false, "ปลายทางชี้เครื่องตัวเองต้องถูกปฏิเสธ");

  const badScheme = selectTargetUrl({ DATABASE_URL: LOCAL, TARGET_DATABASE_URL: "mysql://x@host/db" });
  assert.equal(badScheme.ok, false, "scheme ที่ไม่ใช่ postgres ต้องถูกปฏิเสธ");
});

test("--target: คำสั่ง migration/role ใช้ตัวช่วยกลาง (ไม่ตัดต่อ URL เองแบบเดิม)", () => {
  for (const [file, label] of [
    ["scripts/migrate.ts", "db:migrate"],
    ["scripts/db-roles.ts", "db:roles"],
  ] as const) {
    const source = codeOf(file);
    assert.ok(source.includes('process.argv.includes("--target")'), `${label}: ต้องมีธง --target`);
    assert.ok(source.includes("selectTargetUrl(process.env)"), `${label}: ต้องใช้ตัวช่วยกลางเลือกปลายทาง`);
    assert.ok(
      source.includes('process.env["DATABASE_URL"] = selection.url'),
      `${label}: ต้องตั้ง DATABASE_URL เป็นปลายทางก่อนเชื่อมต่อ`,
    );
    assert.ok(source.includes("targetBanner(selection)"), `${label}: ต้องพิมพ์ปลายทางให้ผู้ใช้เห็น`);
    /* กันถอยหลัง: ห้ามกลับไปเขียนวิธีตัดต่อ URL เองในสคริปต์ */
    assert.equal(/sed -n .{0,20}TARGET_DATABASE_URL/.test(source), false, `${label}: ห้ามตัดต่อ URL เอง`);
  }
});

test("--target: ค่าเริ่มต้น (ไม่ใส่ธง) ยังใช้ DATABASE_URL ของเครื่องเหมือนเดิม", () => {
  /* ตัวช่วยไม่แตะ env เอง ⇒ การไม่ใส่ธงไม่มีทางเปลี่ยนปลายทางได้ */
  const source = codeOf("scripts/target-env.ts");
  assert.ok(!source.includes("process.env"), "ตัวช่วยต้องเป็นตรรกะล้วน (ผู้เรียกเป็นคนตั้งค่า)");
  const migrate = codeOf("scripts/migrate.ts");
  assert.ok(
    migrate.includes('if (process.argv.includes("--target"))'),
    "การเปลี่ยนปลายทางต้องอยู่ในเงื่อนไขของธงเท่านั้น",
  );
});
