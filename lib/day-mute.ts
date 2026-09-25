/**
 * "ปิดไว้ถึงสิ้นวัน" — ตรรกะกลางของประกาศที่ผู้ใช้กดปิดแล้วไม่ควรกวนซ้ำภายในวันเดียวกัน
 *
 * ใช้ร่วมกัน 2 ที่ (รอบที่ 21):
 *   - ประกาศไว้อาลัย (`lib/mourning-notice.ts`)
 *   - การ์ดประกาศบน hero หน้าแรก (`lib/hero-card.ts`)
 *
 * ทั้งคู่ใช้กลไกเดียวกัน: เก็บ "วันที่ที่กดปิด" (เวลาท้องถิ่นของเครื่องผู้ใช้) แล้วสคริปต์ก่อน paint
 * เทียบกับวันที่ของวันนี้ → ตรงกัน = ไม่แสดง · ขึ้นวันใหม่ = กลับมาแสดงเองโดยไม่มีใครต้องล้างค่า
 *
 * แยกออกมาเพราะเป็นตรรกะที่ "เขียนซ้ำแล้วพลาดง่าย" (เช่นเผลอใช้ UTC) และมีเทสต์รันสคริปต์จริงคอยคุม
 */

/**
 * วันที่ในรูปแบบ `YYYY-MM-DD` ตาม **เวลาท้องถิ่น** ของเครื่องผู้ใช้
 *
 * จงใจไม่ใช้ `toISOString()` เพราะค่านั้นเป็น UTC — ผู้ใช้ในไทย (UTC+7) ที่เปิดเว็บช่วงเช้าตรู่
 * จะได้ "เมื่อวาน" แล้วประกาศจะเด้งทั้งวันที่ตั้งใจปิดไว้
 */
export function dayStamp(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** ผู้ใช้ขอปิดไว้ "ถึงสิ้นวันนี้" และวันนี้คือวันเดียวกับที่ปิดไว้หรือไม่ */
export function isMutedToday(stored: unknown, today: string): boolean {
  return typeof stored === "string" && stored === today;
}

type InitScriptOptions = {
  readonly storageKey: string;
  readonly attribute: string;
  readonly shownValue: string;
};

/**
 * สร้างสคริปต์ก่อน paint สำหรับประกาศหนึ่งชิ้น
 *
 * กติกา: **แสดงเป็นค่าเริ่มต้น** เว้นแต่ผู้ใช้เคยกดปิดไว้ "ในวันเดียวกัน"
 * - เทียบวันที่แบบเวลาท้องถิ่น (สร้างสตริงเองให้ตรงกับ `dayStamp`)
 * - ถ้าอ่าน storage ไม่ได้ (โหมดส่วนตัว/ถูกบล็อก) → **ยังคงแสดง** เพราะยังรัน JS อยู่
 *   จึงกดปิดได้ปกติ และการ "พลาดประกาศ" เสียหายกว่าการเห็นซ้ำหนึ่งครั้ง
 *   (ต่างจากกรณีไม่มี JavaScript เลย ซึ่งสคริปต์ไม่ทำงานและประกาศไม่ขึ้น — เลี่ยง modal ที่ปิดไม่ได้)
 */
export function buildDayMuteInitScript({
  storageKey,
  attribute,
  shownValue,
}: InitScriptOptions): string {
  return `(function(){try{var d=new Date(),today=d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);if(localStorage.getItem(${JSON.stringify(
    storageKey,
  )})===today)return;}catch(_){}document.documentElement.setAttribute(${JSON.stringify(
    attribute,
  )},${JSON.stringify(shownValue)});})();`;
}
