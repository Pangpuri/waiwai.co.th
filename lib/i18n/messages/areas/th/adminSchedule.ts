/**
 * พื้นที่พจนานุกรม: หลังบ้าน — ตั้งเวลาเผยแพร่ (X2.7 ส่วนที่ 1)
 *
 * แยกเป็นพื้นที่ของตัวเอง (ไม่ต่อท้าย admin.ts ที่ใกล้เพดาน 32 KB) ตามกติกาด่าน check:i18n:
 * "แยกพื้นที่ย่อย อย่าขยายเพดาน"
 */
export const adminSchedule = {
  /* ── แผงตั้งเวลาในตัวสร้างหน้าเว็บ ─────────────────────────────────────── */
  scheduleTitle: "ตั้งเวลาเผยแพร่",
  scheduleHint:
    "กำหนดเวลาจะเผยแพร่ “ชุดที่ตั้งไว้” — ระบบจะบันทึกให้ก่อน แล้วรอถึงเวลาจึงขึ้นเว็บให้เอง",
  scheduleNone: "ยังไม่ได้ตั้งกำหนดเวลา",
  scheduleAt: "จะเผยแพร่ {time} (UTC)",
  scheduleBy: "ตั้งไว้โดย {email}",
  scheduleInputLabel: "วันและเวลา (เขตเวลาของเครื่องคุณ)",
  scheduleSet: "ตั้งกำหนดเวลา",
  scheduling: "กำลังบันทึก…",
  scheduleClear: "ยกเลิกกำหนด",
  scheduleSaved: "ตั้งกำหนดเวลาเผยแพร่แล้ว — ระบบจะเผยแพร่ให้เมื่อถึงเวลา",
  scheduleCleared: "ยกเลิกกำหนดเวลาเผยแพร่แล้ว",

  /* เหตุผลที่ตั้งไม่ได้ (map จากรหัสใน lib/blocks/schedule.ts) */
  scheduleProblemMissingTime: "เลือกวันและเวลาก่อนกดตั้งกำหนด",
  scheduleProblemInvalid: "วันและเวลาที่เลือกอ่านไม่ได้",
  scheduleProblemPast: "เวลาที่เลือกผ่านมาแล้ว — เลือกเวลาในอนาคต",
  scheduleProblemTooFar: "ตั้งล่วงหน้าได้ไม่เกิน 1 ปี",
  scheduleProblemPage: "ไม่รู้ว่าจะตั้งกำหนดให้หน้าไหน",
  scheduleProblemContent: "ยังตั้งกำหนดไม่ได้ — ต้องแก้ข้อผิดพลาดของเนื้อหาก่อน",
  scheduleProblemServer: "บันทึกกำหนดเวลาไม่สำเร็จ — ลองอีกครั้ง",

  /* ── การ์ดบนหน้าภาพรวมหลังบ้าน ───────────────────────────────────────── */
  scheduleCardTitle: "งานที่ตั้งเวลาไว้",
  scheduleCardHint:
    "หน้าที่ตั้งเวลาไว้จะถูกเผยแพร่เมื่อถึงกำหนด (ตรวจตอนล็อกอินหลังบ้าน · ปุ่มด้านล่าง · หรือ cron `npm run db:publish-scheduled`)",
  scheduleCardNone: "ยังไม่มีหน้าใดตั้งกำหนดเวลาไว้",
  scheduleCardDue: "ครบกำหนดแล้ว {count} หน้า",
  scheduleCardNext: "กำหนดถัดไป {time} (UTC)",
  scheduleCardRow: "{page} · {time} (UTC)",
  schedulePublishNow: "เผยแพร่ที่ครบกำหนดเดี๋ยวนี้",
  schedulePublishNowHint: "ใช้เมื่อมีงานครบกำหนดแล้วแต่ยังไม่ถูกเผยแพร่ (เช่น ยังไม่ได้ตั้ง cron บนเซิร์ฟเวอร์)",

  /* ── ร่องรอยใน audit log ─────────────────────────────────────────────── */
  auditPublishScheduled: "เผยแพร่ตามกำหนดเวลา",
};
