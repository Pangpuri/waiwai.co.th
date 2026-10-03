/**
 * สถานะของหน้าจอสร้างหน้าเว็บ — แยกจากไฟล์ Server Action
 * (ไฟล์ `"use server"` ส่งออกได้เฉพาะ async function)
 */

import type { DocumentDiff } from "@/lib/blocks/diff";
import type { BlockDocument } from "@/lib/blocks/types";

export type BuilderIssue = {
  readonly code: string;
  readonly path: string;
  readonly detail: string | null;
};

export type BuilderState = {
  readonly status: "idle" | "draft-saved" | "published" | "restored" | "migrated" | "compared" | "invalid" | "failed";
  readonly errors: readonly BuilderIssue[];
  readonly warnings: readonly BuilderIssue[];
  readonly problems: readonly string[];
  /** เลขรุ่นที่เพิ่งเผยแพร่ (แสดงข้อความ "เผยแพร่แล้ว — รุ่นที่ N") */
  readonly revision: number | null;
  /**
   * ผลการสั่ง "สร้างเว็บใหม่" หลังเผยแพร่ (เซสชั่น S1) — ไม่ใส่ = ยังไม่เกี่ยว
   * `isr` = หน้าเว็บถูกสั่งให้สร้างใหม่ทันที (X1.7) · `manual` = ไม่ได้ตั้ง env และโฮสต์ไม่มี ISR ⇒ หน้าจอต้องบอกผู้ใช้ตรง ๆ
   */
  readonly rebuild?: "hook-triggered" | "command-ok" | "manual" | "failed" | "isr";
  /** รายละเอียดเมื่อ rebuild ไม่สำเร็จ (ไม่มี URL/โทเคน) */
  readonly rebuildDetail?: string | null;
  /** ผลการย้ายรุ่นข้อมูลที่เก็บไว้ (X1.1) — จำนวนบล็อกรุ่นเก่าที่ถูกย้ายในแต่ละฉบับ */
  readonly migrated?: { readonly draft: number; readonly published: number } | null;
  /**
   * ผลการ "เทียบรุ่นก่อนกู้คืน" (X1.5) — ความต่างระหว่างฉบับบนหน้าจอกับรุ่นในประวัติ
   * `diff = null` แปลว่าอ่านรุ่นนั้นไม่ได้ (ดู `problem`)
   */
  readonly compare?: { readonly revision: number; readonly diff: DocumentDiff | null; readonly problem: string | null } | null;
  /**
   * เอกสารของรุ่นที่เพิ่งกู้คืน (X1.5) — หน้าจอใช้แทนฉบับร่างบนจอทันที
   * ⚠️ จำเป็นเพราะหน้าจอเก็บ `document` ไว้ใน state ฝั่ง client ⇒ ถ้าไม่ส่งกลับมา ผู้ใช้จะยังเห็นของเก่า
   *    และ **บันทึกอัตโนมัติจะเขียนของเก่าทับรุ่นที่เพิ่งกู้คืน** (บั๊กที่ตั้งใจกันไว้)
   */
  readonly restoredDocument?: BlockDocument | null;
};

export const INITIAL_BUILDER_STATE: BuilderState = {
  status: "idle",
  errors: [],
  warnings: [],
  problems: [],
  revision: null,
};
