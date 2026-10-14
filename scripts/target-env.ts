import { directEndpointOf, hostOf, validateRemoteTarget } from "@/lib/db/target";

/**
 * ตัวช่วยกลางของสคริปต์ที่ต้อง **ยิงไปฐานข้อมูลปลายทาง (คลาวด์)** — รอบที่ 282
 *
 * ## ปัญหาที่ปิด
 * คำสั่งอย่าง `npm run db:migrate` / `npm run db:roles` อ่าน `DATABASE_URL` จาก env เสมอ
 * และในเครื่อง `DATABASE_URL` = **Postgres ใน Docker** (localhost:55432)
 * ⇒ การรัน migration ที่ปลายทางจึงต้อง "ตัดต่อ URL" เองทุกครั้ง เช่น
 *
 * ```bash
 * NEON=$(sed -n 's/^TARGET_DATABASE_URL=//p' .env.local); DATABASE_URL="$NEON" npm run db:migrate
 * ```
 *
 * ท่านี้ **พลาดง่ายและเงียบได้** (เคสจริงรอบที่ 137: คลาวด์ล้าหลังอยู่ที่ 0019 แต่ในเครื่อง 0020
 * ⇒ หน้าเว็บจริงถอยไปใช้ข้อมูลตัวอย่างโดยไม่มีใครรู้) และรอบที่ 115 ก็เจอว่า URL ของ **pooler**
 * ใช้กับแอป/migration ไม่ได้ (`search_path` ว่าง)
 *
 * ⇒ เพิ่มธง `--target` ให้ **เลือกปลายทางจาก `TARGET_DATABASE_URL` เอง** พร้อมแปลงเป็น
 *   endpoint ตรง (ตัด `-pooler`) และผ่านด่านเดิมของ `validateRemoteTarget` (ห้ามชี้เครื่องตัวเอง/ห้ามซ้ำกับ dev)
 *
 * ตรรกะล้วน (ไม่แตะ env เอง) — ผู้เรียกเป็นคนตัดสินใจติดตั้งค่า ⇒ ทดสอบได้ด้วย `node --test`
 */

export type TargetSelection =
  | {
      readonly ok: true;
      /** URL ที่ใช้ได้จริง (แปลง pooler → endpoint ตรงแล้ว) */
      readonly url: string;
      readonly host: string;
      /** true = ค่าตั้งต้นเป็น pooler แล้วถูกแปลง (ต้องบอกผู้ใช้) */
      readonly convertedFromPooler: boolean;
    }
  | { readonly ok: false; readonly message: string };

/**
 * เลือก URL ปลายทางจาก env
 * ⚠️ **ไม่แก้ env ให้** — คืนค่าให้ผู้เรียกไปตั้ง (`process.env.DATABASE_URL = …`)
 */
export function selectTargetUrl(env: Readonly<Record<string, string | undefined>>): TargetSelection {
  const raw = (env["TARGET_DATABASE_URL"] ?? "").trim();
  const issues = validateRemoteTarget(raw, env["DATABASE_URL"]);
  if (issues.length > 0) {
    return { ok: false, message: issues.map((issue) => issue.message).join("\n") };
  }

  const url = directEndpointOf(raw);
  return {
    ok: true,
    url,
    host: hostOf(url) ?? raw,
    convertedFromPooler: url !== raw,
  };
}

/** ข้อความบรรทัดเดียวที่พิมพ์บอกผู้ใช้ก่อนทำงาน (ต้องเห็นได้ว่า "กำลังยิงไปที่ไหน") */
export function targetBanner(selection: Extract<TargetSelection, { ok: true }>): string {
  const suffix = selection.convertedFromPooler ? " (แปลงจาก pooler เป็น endpoint ตรงแล้ว)" : "";
  return `ℹ️  ปลายทาง: ${selection.host}${suffix}`;
}

/**
 * ฐานข้อมูล **ในเครื่อง** — ใช้พิมพ์บอกเมื่อไม่ได้สั่ง `--target`
 *
 * ⚠️ ทำไมต้องพิมพ์ทุกครั้ง: เคสจริง 2026-10-14 (รอบที่ 284) — เจ้าของสั่ง
 * `npm run db:migrate --target` แล้ว **เข้าใจว่างานเสร็จ** เพราะสคริปต์ขึ้น "ไม่มีอะไรต้องรัน"
 * แต่ของจริงคือ **npm กลืนธง `--target`** (ต้องมี `--` คั่น) ⇒ มันรันกับ Docker ในเครื่อง
 * (ที่ครบอยู่แล้ว) แล้วเงียบ ๆ ⇒ ถ้าเครื่องมือ **บอกปลายทางทุกครั้ง** อาการนี้จะเห็นทันที
 */
export function localBanner(url: string | undefined): string {
  const host = url === undefined ? "" : (hostOf(url) ?? "");
  return `ℹ️  ฐานข้อมูล: ในเครื่องนี้${host === "" ? "" : ` (${host})`} — ไม่ได้สั่ง --target`;
}

/**
 * ผู้ใช้ "สั่งใช้ปลายทาง" ไหม — และสั่งด้วยรูปแบบไหน
 *
 * ## กับดักจริงที่ต้องรองรับ (รอบที่ 284)
 * `npm run <script> --target` **ไม่ส่ง `--target` ถึงสคริปต์** — npm ตีความเป็น config ของตัวเอง
 * แล้วตั้ง env `npm_config_target=true` ให้ (วัดจริง: `argv = []` แต่มี `npm_config_target`)
 * ⇒ ตัวตรวจต้องอ่านทั้งสองทาง ไม่งั้น "คำสั่งที่พิมพ์ผิดนิดเดียว" จะกลายเป็นงานที่ **เงียบและผิดปลายทาง**
 *
 * รูปแบบที่ถูกคือ `npm run <script> -- --target` (`argv = ["--target"]`)
 */
export function targetRequested(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): { readonly requested: boolean; readonly viaNpmConfig: boolean } {
  const inArgv = argv.includes("--target");
  const npmValue = (env["npm_config_target"] ?? "").trim().toLowerCase();
  const viaNpmConfig = !inArgv && npmValue !== "" && npmValue !== "false";
  return { requested: inArgv || viaNpmConfig, viaNpmConfig };
}

/** คำเตือนเมื่อธงถูก npm กลืน (ผู้ใช้พิมพ์ตก `--`) — ยังทำงานให้ตามเจตนา แต่ต้องบอกให้แก้ */
export const NPM_SWALLOWED_TARGET_WARNING =
  "⚠️ npm กลืนธง --target (ต้องมี `--` คั่น) — รอบนี้ใช้ปลายทางให้ตามเจตนาแล้ว · ครั้งหน้าพิมพ์ `npm run … -- --target`";

/** ช่องทางพิมพ์ผลของ CLI (ฉีดเข้ามาได้ ⇒ ทดสอบได้โดยไม่ต้องดัก console) */
export type TargetRunWriters = {
  readonly log: (line: string) => void;
  readonly error: (line: string) => void;
};

/**
 * "เตรียมรันกับปลายทาง" สำหรับสคริปต์ที่ **เขียนข้อมูล** — เรียกครั้งเดียวตอนต้น `main()`
 *
 * ทำ 4 อย่างให้ครบในที่เดียว (รอบที่ 285 · ปิดหนี้ D-284-1)
 * 1. ตรวจเจตนาผู้ใช้ (`-- --target` หรือ `--target` ที่ npm กลืน → `targetRequested()`)
 * 2. ไม่สั่ง = พิมพ์บอกว่าใช้ **ฐานข้อมูลในเครื่อง** (กันเข้าใจผิด — บทเรียนรอบ 284)
 * 3. สั่ง = เลือกปลายทางผ่านด่านทั้งหมด (`selectTargetUrl()`) แล้ว **ตั้ง `env.DATABASE_URL`**
 * 4. คืน `argv` ที่ **ตัด `--target` ออกแล้ว** ⇒ parser ของสคริปต์เดิมไม่ต้องรู้จักธงนี้เลย
 *
 * ⚠️ ผู้เรียกต้องใช้ `argv` ที่คืนมา (ไม่ใช่ `process.argv.slice(2)` ดิบ) ไม่งั้นสคริปต์ที่ตรวจ
 *    "ตัวเลือกไม่รู้จัก" จะพังเมื่อผู้ใช้พิมพ์ `--target`
 * ⚠️ ฟังก์ชันนี้ **แก้ `env` ที่ส่งเข้ามา** (เจตนา — `process.env` คือสิ่งที่ `getPool()` อ่าน)
 */
export function prepareTargetRun(
  argv: readonly string[],
  env: Record<string, string | undefined>,
  writers: TargetRunWriters,
): { readonly ok: true; readonly argv: readonly string[] } | { readonly ok: false } {
  const wantsTarget = targetRequested(argv, env);

  if (!wantsTarget.requested) {
    writers.log(localBanner(env["DATABASE_URL"]));
    return { ok: true, argv };
  }

  const selection = selectTargetUrl(env);
  if (!selection.ok) {
    writers.error(`✗ ${selection.message}`);
    return { ok: false };
  }

  env["DATABASE_URL"] = selection.url;

  /*
    ⚠️ **สำคัญ (บั๊กจริงรอบที่ 285):** ประตูอ่านของแอป (`readQuery()`) ใช้ `PUBLIC_DATABASE_URL`
    ถ้าตั้งไว้ (ซึ่งใน `.env.local` ชี้ **ฐานข้อมูลในเครื่อง**) ⇒ สคริปต์จะ "อ่านที่หนึ่ง เขียนอีกที่หนึ่ง"
    เคสจริง: `npm run about:import -- --target` อ่านฉบับร่าง **ของในเครื่อง** เจอว่า "คนแก้ไว้"
    แล้ว **ปฏิเสธไม่เขียน** ทั้งที่ปลายทางยังไม่มีงานนั้นเลย
    ⇒ ล้างค่าชั่วคราวในโปรเซสนี้ (ไม่แก้ไฟล์ .env.local) ⇒ ประตูอ่านถอยไปใช้ `DATABASE_URL` = ปลายทาง
  */
  const clearedRoleUrls: string[] = [];
  for (const key of ["PUBLIC_DATABASE_URL", "FORM_DATABASE_URL"]) {
    if ((env[key] ?? "").trim() !== "") clearedRoleUrls.push(key);
    delete env[key];
  }

  writers.log(targetBanner(selection));
  if (wantsTarget.viaNpmConfig) writers.log(NPM_SWALLOWED_TARGET_WARNING);
  if (clearedRoleUrls.length > 0) {
    writers.log(
      `ℹ️  ล้าง ${clearedRoleUrls.join(" · ")} เฉพาะโปรเซสนี้ — อ่าน/เขียนใช้ปลายทางเดียวกัน (ไฟล์ .env.local ไม่ถูกแก้)`,
    );
  }

  return { ok: true, argv: argv.filter((arg) => arg !== "--target") };
}
