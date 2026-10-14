import assert from "node:assert/strict";
import { test } from "node:test";

import { codeOf } from "./source-scan.ts";
import { localBanner, prepareTargetRun, selectTargetUrl, targetBanner, targetRequested } from "./target-env.ts";

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
    assert.ok(source.includes("targetRequested(process.argv.slice(2), process.env)"), `${label}: ต้องตรวจเจตนาผู้ใช้`);
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
  assert.ok(migrate.includes("if (wantsTarget.requested) {"), "การเปลี่ยนปลายทางต้องอยู่ในเงื่อนไขของธงเท่านั้น");
});

/* ── กับดัก npm กลืนธง (เคสจริง 2026-10-14 · รอบที่ 284) ─────────────────────── */

test("--target: อ่านเจตนาผู้ใช้ได้ทั้ง `-- --target` และ `--target` ที่ npm กลืน", () => {
  /* รูปแบบที่ถูก */
  const argvForm = targetRequested(["--target"], {});
  assert.equal(argvForm.requested, true);
  assert.equal(argvForm.viaNpmConfig, false, "มาจาก argv = รูปแบบถูก ไม่ต้องเตือน");

  /*
    รูปแบบที่ผู้ใช้พิมพ์ตก `--` — npm ตีเป็น config ของตัวเองแล้วตั้ง `npm_config_target=true`
    (วัดจริง: argv ว่างเปล่า) ⇒ ต้องอ่านเจตนาให้ได้ ไม่งั้นงานจะวิ่งไปผิดฐานข้อมูลแบบเงียบ
  */
  const npmForm = targetRequested([], { npm_config_target: "true" });
  assert.equal(npmForm.requested, true, "ต้องถือว่าผู้ใช้สั่งปลายทาง");
  assert.equal(npmForm.viaNpmConfig, true, "ต้องรู้ว่ามาทาง npm ⇒ พิมพ์คำเตือนให้แก้");

  assert.equal(targetRequested([], {}).requested, false, "ไม่สั่ง = ไม่ใช้ปลายทาง");
  assert.equal(targetRequested([], { npm_config_target: "false" }).requested, false, "ค่า false = ไม่ใช้ปลายทาง");
  assert.equal(targetRequested(["--status"], {}).requested, false, "ธงอื่นต้องไม่ถูกตีเป็น --target");

  /* argv ชนะเสมอ (ไม่ต้องเตือนซ้ำเมื่อพิมพ์ถูก) */
  const both = targetRequested(["--target"], { npm_config_target: "true" });
  assert.equal(both.requested, true);
  assert.equal(both.viaNpmConfig, false);
});

test("--target: ไม่สั่งธงต้องบอกชัดว่าใช้ฐานข้อมูล 'ในเครื่อง' (กันเข้าใจว่ารันปลายทางแล้ว)", () => {
  const line = localBanner("postgres://waiwai@localhost:55432/waiwai");
  assert.ok(line.includes("ในเครื่อง"), line);
  assert.ok(line.includes("localhost"), line);
  assert.ok(line.includes("ไม่ได้สั่ง"), "ต้องบอกเหตุผลว่าทำไมถึงไม่ใช่ปลายทาง");

  for (const file of ["scripts/migrate.ts", "scripts/db-roles.ts"]) {
    const source = codeOf(file);
    assert.ok(source.includes("targetRequested(process.argv.slice(2), process.env)"), `${file}: ต้องใช้ตัวตรวจเจตนา`);
    assert.ok(source.includes("localBanner("), `${file}: ต้องบอกปลายทางเมื่อไม่ได้สั่งธง`);
    assert.ok(source.includes("NPM_SWALLOWED_TARGET_WARNING"), `${file}: ต้องเตือนเมื่อ npm กลืนธง`);
    assert.equal(
      /process\.argv\.includes\("--target"\)/.test(source),
      false,
      `${file}: ห้ามกลับไปเช็ค argv ตรง ๆ (จะพลาดรูปแบบที่ npm กลืน)`,
    );
  }

  /* เครื่องมือที่ยิงปลายทางเสมอ ต้องรับ `--target` ที่ผู้ใช้เผลอพิมพ์ได้ (ห้าม throw) */
  const check = codeOf("scripts/check-target.ts");
  assert.ok(check.includes('arg === "--target"'), "check:target ต้องรับธง --target ได้");
});

/* ── prepareTargetRun (รอบที่ 285 · หนี้ D-284-1) ─────────────────────────── */

test("prepareTargetRun: ไม่สั่งธง = ใช้ในเครื่อง · ไม่แก้ env · argv เดิม", () => {
  const env: Record<string, string | undefined> = { DATABASE_URL: LOCAL, TARGET_DATABASE_URL: NEON_DIRECT };
  const lines: string[] = [];
  const result = prepareTargetRun(["--dry-run"], env, { log: (line) => lines.push(line), error: (line) => lines.push(`E:${line}`) });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual([...result.argv], ["--dry-run"], "argv ต้องไม่ถูกแตะ");
  assert.equal(env["DATABASE_URL"], LOCAL, "ห้ามแก้ DATABASE_URL เมื่อไม่ได้สั่งปลายทาง");
  assert.ok(lines.some((line) => line.includes("ในเครื่อง")), "ต้องบอกว่าใช้ฐานข้อมูลในเครื่อง");
});

test("prepareTargetRun: สั่งธง = ตั้ง DATABASE_URL เป็นปลายทาง + ตัดธงออกจาก argv", () => {
  const env: Record<string, string | undefined> = { DATABASE_URL: LOCAL, TARGET_DATABASE_URL: NEON_POOLER };
  const lines: string[] = [];
  const result = prepareTargetRun(["--dry-run", "--target"], env, { log: (line) => lines.push(line), error: (line) => lines.push(`E:${line}`) });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual([...result.argv], ["--dry-run"], "ต้องตัด --target ออก (ไม่งั้น parser ของสคริปต์พัง)");
  assert.equal(env["DATABASE_URL"]?.includes("-pooler"), false, "ต้องตั้งเป็น endpoint ตรง");
  assert.ok(lines.some((line) => line.includes("ปลายทาง")), "ต้องบอกปลายทาง");

  /* รูปแบบที่ npm กลืน: ต้องทำงานให้เหมือนกัน + เตือน */
  const env2: Record<string, string | undefined> = {
    DATABASE_URL: LOCAL,
    TARGET_DATABASE_URL: NEON_DIRECT,
    npm_config_target: "true",
  };
  const lines2: string[] = [];
  const result2 = prepareTargetRun([], env2, { log: (line) => lines2.push(line), error: (line) => lines2.push(`E:${line}`) });
  assert.equal(result2.ok, true);
  assert.equal(env2["DATABASE_URL"], NEON_DIRECT, "ต้องตั้งปลายทางให้ด้วย");
  assert.ok(lines2.some((line) => line.includes("npm กลืน")), "ต้องเตือนเรื่อง `--`");
});

test("prepareTargetRun: ตั้งค่าไม่ได้ = ล้มเหลวพร้อมข้อความ (ไม่ทำงานต่อแบบเดาปลายทาง)", () => {
  const env: Record<string, string | undefined> = { DATABASE_URL: LOCAL, TARGET_DATABASE_URL: "" };
  const lines: string[] = [];
  const result = prepareTargetRun(["--target"], env, { log: (line) => lines.push(line), error: (line) => lines.push(`E:${line}`) });

  assert.equal(result.ok, false);
  assert.equal(env["DATABASE_URL"], LOCAL, "ห้ามแก้ env เมื่อเลือกปลายทางไม่ได้");
  assert.ok(lines.some((line) => line.startsWith("E:")), "ต้องรายงานที่ช่อง error");
});

test("สคริปต์นำเข้า/seed ทุกตัวรองรับ --target (ไม่มีตัวไหนลืม)", () => {
  const scripts = [
    "seed-home",
    "import-products",
    "import-product-details",
    "import-products-logos",
    "import-product-category-defaults",
    "import-recipes",
    "import-careers",
    "import-news",
    "import-contact",
    "import-about",
    "import-hero-slides",
    "import-about-media",
  ];

  for (const name of scripts) {
    const source = codeOf(`scripts/${name}.ts`);
    assert.ok(
      source.includes("prepareTargetRun(process.argv.slice(2), process.env,"),
      `scripts/${name}.ts: ต้องเรียก prepareTargetRun() ก่อนแตะ env/ฐานข้อมูล`,
    );
    assert.ok(source.includes("if (!target.ok) process.exit(1)"), `scripts/${name}.ts: ต้องหยุดเมื่อเลือกปลายทางไม่ได้`);
    /* กันถอยหลัง: ห้ามใช้ process.argv ดิบหลังจากนั้น (จะเห็น --target กลับเข้ามา) */
    assert.equal(
      /parseArgs\(process\.argv\.slice\(2\)\)/.test(source),
      false,
      `scripts/${name}.ts: ต้องส่ง target.argv ให้ parser ไม่ใช่ process.argv`,
    );
  }
});

test("prepareTargetRun: ล้าง PUBLIC_/FORM_DATABASE_URL ชั่วคราว (อ่าน/เขียนต้องอยู่ฐานข้อมูลเดียวกัน)", () => {
  /*
    บั๊กจริงรอบที่ 285: `about:import --target` อ่านฉบับร่างจาก **ในเครื่อง** (ผ่าน readQuery →
    PUBLIC_DATABASE_URL) แล้วปฏิเสธไม่เขียน ทั้งที่ปลายทางยังไม่มีงานนั้น
  */
  const env: Record<string, string | undefined> = {
    DATABASE_URL: LOCAL,
    PUBLIC_DATABASE_URL: "postgres://waiwai_public_ro@localhost:55432/waiwai",
    FORM_DATABASE_URL: "postgres://waiwai_public_form@localhost:55432/waiwai",
    TARGET_DATABASE_URL: NEON_DIRECT,
  };
  const lines: string[] = [];
  const result = prepareTargetRun(["--target"], env, { log: (line) => lines.push(line), error: (line) => lines.push(`E:${line}`) });

  assert.equal(result.ok, true);
  assert.equal(env["DATABASE_URL"], NEON_DIRECT, "เขียน = ปลายทาง");
  assert.equal(env["PUBLIC_DATABASE_URL"], undefined, "อ่านต้องไม่ชี้ในเครื่อง");
  assert.equal(env["FORM_DATABASE_URL"], undefined);
  assert.ok(lines.some((line) => line.includes("อ่าน/เขียน")), "ต้องบอกผู้ใช้ว่าล้างอะไรไป");

  /* ไม่สั่งธง = ห้ามแตะค่า role เด็ดขาด */
  const localEnv: Record<string, string | undefined> = {
    DATABASE_URL: LOCAL,
    PUBLIC_DATABASE_URL: "postgres://ro@localhost:55432/waiwai",
    TARGET_DATABASE_URL: NEON_DIRECT,
  };
  prepareTargetRun([], localEnv, { log: () => {}, error: () => {} });
  assert.equal(localEnv["PUBLIC_DATABASE_URL"], "postgres://ro@localhost:55432/waiwai", "ไม่ได้สั่งปลายทาง = ไม่แตะ");
});
