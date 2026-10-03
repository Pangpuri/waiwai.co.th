import { PAGE_REVALIDATE_SECONDS } from "@/lib/cache/window";
import { LOCALES } from "@/lib/i18n/config";
import { resolveRebuildMode, type RebuildMode } from "@/lib/rebuild";

/**
 * "แผนทำให้หน้าเว็บสดใหม่" หลังแก้จากหลังบ้าน (X1.7 — ISR / on-demand revalidate)
 *
 * ทำไมแยกไฟล์นี้จาก `refresh.ts`
 * - **ไฟล์นี้บริสุทธิ์** (ไม่มี `next/cache`, ไม่มี env, ไม่มี I/O) ⇒ เทสต์ได้ด้วย `node --test` ตรง ๆ
 * - `refresh.ts` เป็น "ตัวลงมือ" ที่เรียก `revalidatePath()` (ใช้ได้เฉพาะใน Server Action/Route Handler)
 * ⇒ นโยบายกับผลข้างเคียงไม่ปนกัน และแก้แผนได้โดยไม่ต้องแตะโค้ดที่ผูกกับ Next
 *
 * บริบทเดิม (มติ D1): หน้าเว็บเป็น static ⇒ กดเผยแพร่แล้วต้อง **build ใหม่** ทั้งเว็บ
 * ⇒ X1.7 เปลี่ยนเป็น **ISR + on-demand revalidate**: กดเผยแพร่ = ทำเครื่องหมายว่าเพจเก่า
 *    แล้ว Next สร้างใหม่ให้เองเมื่อมีคนเปิดหน้าถัดไป (ไม่ต้องรอ build · ไม่มี downtime)
 * ⇒ ตัวสั่ง rebuild (hook/command) **ยังอยู่** แต่กลายเป็นทางเลือกสำหรับโฮสต์ที่ไม่มี ISR
 */

/* ค่าจำนวนวินาทีอยู่ใน `lib/cache/window.ts` (ไฟล์ที่ไม่มี dependency) — re-export ให้ผู้เรียกใช้ที่เดียวได้ */
export { PAGE_REVALIDATE_SECONDS };

/** สิ่งที่เพิ่งถูกแก้จากหลังบ้าน — ใช้บันทึกเหตุผลในแผน/ร่องรอย */
export const PUBLISH_KINDS = ["page", "chrome", "mourning", "settings", "pages"] as const;

export type PublishKind = (typeof PUBLISH_KINDS)[number];

export type RefreshPlan = {
  readonly kind: PublishKind;
  /**
   * true = ต้องสร้างใหม่ทั้งเว็บ (`revalidatePath("/", "layout")`)
   * เหตุผลที่ทุกกรณีเป็น true: **เปลือกเว็บ (หัวเว็บ/ท้ายเว็บ/ป้ายประกาศ/ตั้งค่าส่วนกลาง) อยู่ทุกหน้า**
   * ⇒ แก้ navbar/footer/ป้าย = ทุกหน้าต้องใหม่ และการเผยแพร่หน้าหนึ่งก็มีผลกับ sitemap/เมนูที่ใช้ร่วมกัน
   * (เว็บนี้มี ~32 หน้า · การสร้างใหม่คืออ่าน DB ไม่กี่ครั้ง — ถูกกว่าการมีสองเส้นทางให้เลือกผิด)
   */
  readonly revalidateAll: boolean;
  /** path ที่ต้องทำให้สดใหม่ (ใช้เมื่อ `revalidateAll` เป็น false — เก็บไว้ให้เห็นเจตนา/ต่อยอด) */
  readonly paths: readonly string[];
};

/** หน้าที่เป็น "รากของแต่ละภาษา" เช่น `/th` · `/en` */
export function localeRoots(): readonly string[] {
  return LOCALES.map((locale) => `/${locale}`);
}

/**
 * แผนทำให้สดใหม่ตามชนิดของสิ่งที่แก้
 * ทุกชนิดคืน `revalidateAll = true` (ดูเหตุผลใน type) แต่ลิสต์ path ยังบอกว่า "ผู้ใช้จะเห็นที่ไหน"
 */
export function refreshPlan(kind: PublishKind): RefreshPlan {
  return {
    kind,
    revalidateAll: true,
    paths: [...localeRoots(), "/", "/sitemap.xml"],
  };
}

/**
 * ต้องยิงคำสั่ง rebuild (hook/command) ต่อหรือไม่
 * - **ตั้ง env ไว้** = ผู้ดูแลตั้งใจใช้โฮสต์ที่ต้องสั่ง build เอง (หรือ deploy hook) ⇒ ยิงตามเดิม
 * - **ไม่ตั้ง = ไม่ต้องทำอะไร** เพราะ ISR ทำให้หน้าเว็บใหม่เองอยู่แล้ว (เดิมข้อความ "โหมดทำมือ" ทำให้เข้าใจผิดว่าต้อง build)
 */
export function shouldRunRebuild(env: Readonly<Record<string, string | undefined>>): boolean {
  return resolveRebuildMode(env).kind !== "manual";
}

/** วิธีที่ใช้ได้จริงตาม env (เปิดเผยไว้ให้หน้าจอ/เทสต์อธิบายได้) */
export function activeRefreshMode(env: Readonly<Record<string, string | undefined>>): RebuildMode {
  return resolveRebuildMode(env);
}
