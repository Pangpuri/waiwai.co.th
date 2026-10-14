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
