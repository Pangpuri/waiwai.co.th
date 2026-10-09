/**
 * กติกาการเปิดสวิตช์ "ใช้กับหน้าเว็บจริง" — รอบที่ 238 (🐞 เคสจริงจากเจ้าของ)
 *
 * **อาการที่เจ้าของเจอ (2026-10-09):** ในตัวสร้างเห็นพรีวิวสด (ฉบับร่าง) มีสินค้า/เมนู/ข่าวครบ
 * แต่พอเปิดสวิตช์ "ใช้กับหน้าเว็บจริง" → **หน้าเว็บจริงกลายเป็นบล็อกเก่าที่ไม่มีภาพ/ข้อมูลจริง**
 * (มีแต่การ์ดเปล่า ๆ) จนต้องปิดสวิตช์กลับ
 *
 * **ต้นเหตุ (พิสูจน์จาก DB + ยิงหน้าเว็บจริง):** สวิตช์นี้ไม่ได้ให้เว็บอ่าน "ฉบับร่างที่กำลังแก้"
 * แต่ให้อ่าน **ฉบับที่เผยแพร่** (`page_document.status = 'published'`)
 *   ⇒ ถ้าฉบับที่เผยแพร่ยังไม่ถูกอัปเดต (หรือเป็นเทมเพลตเก่าที่มีข้อมูลทดสอบ) → เปิดสวิตช์แล้วเว็บ
 *      แสดงของเก่าทันที **ทั้งที่หน้าจอเขียนว่า "หน้าเว็บสาธารณะกำลังแสดงเนื้อหาชุดนี้"** = จอโกหก
 *
 * **กติกาใหม่ (fail-closed):** เปิดได้ **ต่อเมื่อฉบับที่เผยแพร่ตรงกับฉบับร่างเป๊ะ**
 * - ไม่มีฉบับเผยแพร่ → ไม่ให้เปิด (ไม่มีอะไรจะขึ้นเว็บ) ⇒ บอกให้กด "เผยแพร่" ก่อน
 * - มีแต่ไม่ตรงกับฉบับร่าง → ไม่ให้เปิด ⇒ บอกว่ามีอะไรค้างเผยแพร่ (จำนวนบล็อก/จุดที่ต่าง)
 * - **ปิดสวิตช์ = ทำได้เสมอ** (กลับไปใช้เลย์เอาต์เดิมของหน้า — เป็นทางหนีที่ปลอดภัย)
 *
 * ตรรกะล้วน ไม่พึ่ง React/DB ⇒ ทดสอบได้ด้วย `node --test`
 */

/** สถานะ "ฉบับที่เผยแพร่ เทียบกับ ฉบับร่าง" — ใช้ทั้งที่ action (ตัดสิน) และที่หน้าจอ (อธิบาย) */
export type LiveSyncState =
  /** ยังไม่มีฉบับที่เผยแพร่ของหน้านี้ */
  | "missing"
  /** มีฉบับเผยแพร่ แต่ไม่ตรงกับฉบับร่างที่กำลังแก้ (มีงานค้างเผยแพร่) */
  | "stale"
  /** ตรงกัน ⇒ เปิดสวิตช์ได้ (สิ่งที่เห็น = สิ่งที่ขึ้นเว็บ) */
  | "in-sync";

export type LiveEnableInput = {
  /** มีฉบับที่เผยแพร่และอ่านได้หรือไม่ */
  readonly hasPublished: boolean;
  /** ฉบับที่เผยแพร่ตรงกับฉบับร่างหรือไม่ (`documentsEqual`) — ไม่มีฉบับเผยแพร่ ⇒ false */
  readonly inSync: boolean;
};

export type LiveBlockedReason = "no-published" | "draft-not-published";

/** สถานะปัจจุบัน (ค่ากลางเดียวที่ทั้ง action และหน้าจอใช้ — ไม่ให้ตีความคนละแบบ) */
export function liveSyncStateOf(input: LiveEnableInput): LiveSyncState {
  if (!input.hasPublished) return "missing";
  return input.inSync ? "in-sync" : "stale";
}

/** เหตุผลที่ยังเปิดไม่ได้ (คืน `null` = เปิดได้) */
export function liveBlockedReasonOf(state: LiveSyncState): LiveBlockedReason | null {
  switch (state) {
    case "missing":
      return "no-published";
    case "stale":
      return "draft-not-published";
    case "in-sync":
      return null;
  }
}

export type LiveEnableDecision =
  | { readonly allowed: true; readonly state: "in-sync" }
  | { readonly allowed: false; readonly state: Exclude<LiveSyncState, "in-sync">; readonly reason: LiveBlockedReason };

/** ตัดสินว่าอนุญาตให้ **เปิด** สวิตช์ได้ไหม (การปิดสวิตช์ไม่ต้องถามฟังก์ชันนี้) */
export function decideLiveEnable(input: LiveEnableInput): LiveEnableDecision {
  const state = liveSyncStateOf(input);
  const reason = liveBlockedReasonOf(state);
  if (reason === null) return { allowed: true, state: "in-sync" };
  /* state ตอนนี้เป็น "missing" หรือ "stale" แน่นอน (reason !== null) — เขียนให้ type รู้ด้วยการแยกสาขา */
  return state === "missing" ? { allowed: false, state: "missing", reason } : { allowed: false, state: "stale", reason };
}

/**
 * ป้าย/คำอธิบายสั้น ๆ บนหน้าจอ — คืน **รหัส** ไม่ใช่ข้อความ (ข้อความมาจากพจนานุกรมเสมอ ตามกติกา i18n)
 * `null` = ไม่ต้องเตือนอะไร (ตรงกันแล้ว)
 */
export function liveSyncWarnCode(state: LiveSyncState): LiveBlockedReason | null {
  return liveBlockedReasonOf(state);
}

/** เปิดอยู่ไหม + สถานะตรงกันหรือยัง — รวมเป็นก้อนเดียวให้หน้าจอส่งต่อ (อ่านง่าย ไม่ต้องส่ง 3 prop) */
export type LivePanelInfo = {
  readonly isLive: boolean;
  readonly state: LiveSyncState;
  /** จำนวนบล็อกของฉบับที่เผยแพร่ (null = ยังไม่มี) — ใช้อธิบาย "เว็บกำลังแสดง N บล็อก" */
  readonly publishedBlocks: number | null;
};

export function livePanelInfoOf(input: LiveEnableInput & { readonly isLive: boolean; readonly publishedBlocks: number | null }): LivePanelInfo {
  return { isLive: input.isLive, state: liveSyncStateOf(input), publishedBlocks: input.publishedBlocks };
}
