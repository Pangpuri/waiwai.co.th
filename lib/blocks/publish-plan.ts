/**
 * ตรรกะของ **"ตัวเผยแพร่หน้าที่พร้อมขึ้นเว็บ" (CLI)** — รอบที่ 287 (2026-10-15)
 *
 * ## ทำไมต้องมีตัวนี้ ทั้งที่ในหลังบ้านมีปุ่ม "เผยแพร่" อยู่แล้ว
 * เจ้าของถามว่า *"หน้าบริษัทกับหน้าใบรับรองมาตรฐานใน vercel ยังไม่เปลี่ยน"*
 * ⇒ สาเหตุจริง: หน้าเว็บเรนเดอร์จาก DB **เฉพาะเมื่อมี "ฉบับเผยแพร่" + `is_live`** (มติ 240/253)
 *    แต่บนคลาวด์ (เดโม) หน้า `about` มีแค่ **ฉบับร่าง** และ `certifications`/`executives`
 *    **ไม่มีเอกสารเลย** (สร้างไว้แต่ในเครื่อง) · การกดเผยแพร่เป็น Server Action จึงไม่มี CLI มาก่อน
 * ⇒ สคริปต์นี้ทำ **เส้นทางเดียวกับปุ่มเป๊ะ** (`publishDraft` + `setPageLive`) เพื่อให้เจ้าของ
 *    สั่งงานนี้ได้จากเครื่องเดียวกับที่ดูข้อมูล — โดยยังมี audit log และประวัติรุ่นครบเหมือนเดิม
 *
 * ## กติกาที่บังคับอยู่ในไฟล์นี้ (ตรรกะล้วน ⇒ เทสต์ได้ด้วย `node --test`)
 * 1. **ไม่ทับงานคน**: สร้างจากเทมเพลต **เฉพาะเมื่อไม่มีฉบับร่างอยู่เลย** (ต่างจากปุ่มในหลังบ้าน
 *    ที่ยอมให้ทับได้ถ้าติ๊กยืนยัน — CLI ไม่มีคนดูอยู่หน้างอ จึงเลือกข้างที่ปลอดภัยไว้ก่อน)
 * 2. **ไม่มีฉบับร่าง + ไม่ได้สั่ง `--from-template`** ⇒ **หยุดพร้อมบอกทางแก้** (ไม่เดาเนื้อหาให้)
 * 3. **ไม่มีเทมเพลต** (เช่น `about` ที่เนื้อหามาจากตัวนำเข้า) ⇒ CLI สร้างให้ไม่ได้ ต้องใช้หลังบ้าน
 * 4. ค่าคงที่ชื่อผู้กระทำ/หมายเหตุ อยู่ที่นี่ที่เดียว (ผู้เรียกกับเทสต์ต้องตรงกัน)
 */

import { isBlockBuilderPage } from "@/lib/blocks/templates";

/** ชื่อผู้กระทำเมื่อ CLI ไม่ได้ระบุ `--actor=` (ไม่ใช่บุคคล — เหมือน `scheduled` ของตัวเผยแพร่ตามกำหนด) */
export const PUBLISH_CLI_ACTOR = "cli-publish";

/** หมายเหตุในประวัติการเผยแพร่ — บอกว่ามาจากคำสั่ง ไม่ใช่การกดในหลังบ้าน (ไม่ผูกภาษา) */
export const PUBLISH_CLI_NOTE = "cli-publish";

/** รหัสหน้าที่ CLI ยอมรับ — กันการพิมพ์พลาด/ค่าที่ไม่ใช่รหัสหน้า */
const PAGE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export type PublishBlockedReason = "no-draft" | "no-template";

export type PublishPlanInput = {
  readonly page: string;
  /** มีฉบับร่างในฐานข้อมูลแล้วหรือยัง */
  readonly hasDraft: boolean;
  /** หน้านี้มีเทมเพลตตั้งต้นให้สร้างได้ไหม (`hasBlockTemplate`) */
  readonly hasTemplate: boolean;
  /** ผู้ใช้สั่ง `--from-template` (ยอมให้สร้างฉบับร่างจากเทมเพลตเมื่อยังไม่มี) */
  readonly fromTemplate: boolean;
};

export type PublishPlan =
  | { readonly kind: "publish"; readonly source: "draft" | "template"; readonly page: string }
  | { readonly kind: "blocked"; readonly reason: PublishBlockedReason; readonly page: string };

/**
 * ตัดสินใจว่าจะทำอะไรกับหน้านี้ — **บริสุทธิ์** (ไม่แตะ DB) ⇒ เทสต์เคสทั้งหมดได้
 *
 * ⚠️ "มีฉบับร่างอยู่แล้ว" ชนะทุกกรณี (ฉบับร่างคือสิ่งที่คนแก้ไว้ — CLI ห้ามทับ)
 */
export function planPagePublish(input: PublishPlanInput): PublishPlan {
  if (input.hasDraft) return { kind: "publish", source: "draft", page: input.page };
  if (input.fromTemplate && input.hasTemplate) return { kind: "publish", source: "template", page: input.page };
  return { kind: "blocked", reason: input.hasTemplate ? "no-draft" : "no-template", page: input.page };
}

export type ParsedPages = {
  /** รหัสหน้าที่ใช้ได้ (เรียงตามที่ผู้ใช้พิมพ์ · ไม่ซ้ำ) */
  readonly pages: readonly string[];
  /** ค่าที่ไม่ใช่รหัสหน้า หรือไม่ใช่หน้าที่ตัวสร้างรู้จัก */
  readonly invalid: readonly string[];
};

/**
 * แปลง `--pages=a,b,c` ⇒ รหัสที่ใช้ได้ + รายการที่ไม่รู้จัก
 * (ผู้เรียกต้อง **ตกเมื่อมีค่าที่ไม่รู้จัก** — ห้ามเผยแพร่บางหน้าแบบเงียบ ๆ)
 */
export function parsePageList(value: string): ParsedPages {
  const pages: string[] = [];
  const invalid: string[] = [];

  for (const raw of value.split(",")) {
    const page = raw.trim();
    if (page === "") continue;
    if (pages.includes(page)) continue;
    if (!PAGE_ID_PATTERN.test(page) || !isBlockBuilderPage(page)) {
      invalid.push(page);
      continue;
    }
    pages.push(page);
  }

  return { pages, invalid };
}

/** ข้อความบอกทางแก้เมื่อ CLI ทำต่อไม่ได้ (ภาษาอังกฤษคงที่ — ข้อความผู้ใช้อยู่ในพจนานุกรม/เอกสาร) */
export function blockedHint(reason: PublishBlockedReason): string {
  return reason === "no-draft"
    ? "ไม่มีฉบับร่าง — ใส่ --from-template เพื่อสร้างจากเทมเพลต หรือกด “เริ่มจากเทมเพลต” ในหลังบ้าน"
    : "หน้านี้ไม่มีเทมเพลตตั้งต้น (เนื้อหามาจากตัวนำเข้า) — ต้องสร้างฉบับร่างในหลังบ้านก่อน";
}
