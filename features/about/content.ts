import { isDisplayableYear } from "@/lib/format";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ข้อมูลเชิงโครงสร้างของหน้า /about — pure module (ไม่แตะ DOM/DB/Next.js)
 *
 * หลักการเดียวกับ features/home/content.ts: ที่นี่เก็บเฉพาะ "รหัส/ปี/ลิงก์"
 * ส่วนข้อความที่ต้องแปลอยู่ในพจนานุกรม การผูกกันทำผ่าน id ที่มี type มาจาก
 * พจนานุกรม → พิมพ์ id ผิดคือ compile error ไม่ใช่หน้าจอว่าง
 *
 * ที่มา: เอกสารข้อมูลของบริษัท (คัดจาก waiwai.co.th) — ปีและตัวเลขทั้งหมด
 * ต้องยืนยันกับฝ่ายการตลาดก่อนขึ้นจริง (ดู PRODUCT_ROADMAP.md § 9)
 */

/* ── ข้อเท็จจริงสั้น ๆ ใต้หัวเรื่อง (hero) ───────────────────── */

export type FactId = keyof Messages["about"]["facts"];

export type AboutFact = {
  readonly id: FactId;
  /** ถ้ามีปี ให้แสดงด้วย formatYear (ไทย = พ.ศ. · อังกฤษ = ค.ศ.) ไม่ hardcode สองชุด */
  readonly year?: number;
};

export const ABOUT_FACTS: readonly AboutFact[] = [
  { id: "founded", year: 1972 },
  { id: "area" },
  { id: "sites" },
];

/* ── timeline ─────────────────────────────────────────────── */

export type TimelineId = keyof Messages["about"]["story"]["timeline"];

export type TimelineEntry = {
  readonly id: TimelineId;
  /** ปี ค.ศ. ในข้อมูลต้นทาง — ตอนแสดงผลแปลงตามภาษาด้วย formatYear (ไทย = พ.ศ.) */
  readonly year: number;
};

/**
 * ปีทั้งหมดยืนยันได้จากรางวัล/เกียรติบัตรที่บริษัทระบุไว้ (ไม่ใช่ปีที่แต่งขึ้น)
 * ลำดับต้องเรียงจากอดีตไปปัจจุบันเสมอ
 */
export const TIMELINE_ENTRIES: readonly TimelineEntry[] = [
  { id: "founded", year: 1972 },
  { id: "primeMinisterExport", year: 1999 },
  { id: "badAward", year: 2001 },
  { id: "bronzeAward", year: 2005 },
];

/** เรียงจากอดีตไปปัจจุบัน — คืน array ใหม่ ไม่แก้ของเดิม (ผู้เรียกอาจส่งค่าที่เป็น readonly) */
export function sortTimelineByYear(entries: readonly TimelineEntry[]): TimelineEntry[] {
  // sort ของ V8 เป็น stable แล้ว ปีที่เท่ากันจึงคงลำดับเดิมไว้
  return [...entries].sort((a, b) => a.year - b.year);
}

/**
 * รายการที่จะแสดงจริง: ตัดปีที่แสดงไม่ได้ออก (กันค่าเพี้ยนจากแหล่งข้อมูลภายนอก)
 * แล้วเรียงจากอดีตไปปัจจุบัน
 */
export function visibleTimeline(entries: readonly TimelineEntry[]): TimelineEntry[] {
  return sortTimelineByYear(entries.filter((entry) => isDisplayableYear(entry.year)));
}

/* ── พื้นที่และที่ตั้ง ───────────────────────────────────────── */

export type FacilityStatId = keyof Messages["about"]["facilities"]["stats"];

/** ลำดับการแสดง "การแบ่งพื้นที่" — ต้องตรงกับที่บริษัทระบุ */
export const FACILITY_STATS: readonly FacilityStatId[] = ["factory", "dormitory", "treatment"];

export type SiteId = keyof Messages["about"]["facilities"]["sites"];

export const SITES: readonly SiteId[] = ["omYai", "raiKhing"];

/* ── วิสัยทัศน์ / นโยบาย + พันธกิจ ──────────────────────────── */

export type DirectionId = Extract<keyof Messages["about"]["direction"], "vision" | "policy">;

/** สองการ์ดบน — พันธกิจแยกเป็นรายการด้านล่างเพราะมี 11 ข้อ */
export const DIRECTION_ORDER: readonly DirectionId[] = ["vision", "policy"];

export type MissionItemId = keyof Messages["about"]["direction"]["mission"]["items"];

/** ลำดับพันธกิจตามเอกสารของบริษัท (1–11) */
export const MISSION_ITEM_IDS: readonly MissionItemId[] = [
  "quality",
  "market",
  "delivery",
  "people",
  "research",
  "morale",
  "society",
  "cost",
  "safety",
  "risk",
  "qcc",
];

/* ── รางวัล / ใบรับรองมาตรฐาน ───────────────────────────────── */

export type AwardItemId = keyof Messages["about"]["awards"]["items"];

export const AWARD_ITEM_IDS: readonly AwardItemId[] = [
  "primeMinisterExport",
  "bestOf97",
  "egv",
  "science",
  "bad",
  "bronze",
];

export type CertificateId = keyof Messages["about"]["awards"]["certificates"];

export const CERTIFICATE_IDS: readonly CertificateId[] = ["gmp", "codexHaccp", "iso9001"];

/* ── ลิงก์ไปหน้าข้อมูลองค์กรอื่น ─────────────────────────────── */

export type ExploreLinkId = Extract<
  keyof Messages["about"]["explore"],
  "executives" | "certifications" | "sustainability"
>;

export type ExploreLink = {
  readonly id: ExploreLinkId;
  /** path ปลายทาง (ยังไม่รวม prefix ภาษา) */
  readonly path: string;
};

export const EXPLORE_LINKS: readonly ExploreLink[] = [
  { id: "executives", path: "/about/executives" },
  { id: "certifications", path: "/about/certifications" },
  { id: "sustainability", path: "/sustainability" },
];
