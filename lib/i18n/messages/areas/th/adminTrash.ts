/**
 * พื้นที่พจนานุกรม: หลังบ้าน — ถังขยะ (X2.4)
 *
 * แยกไฟล์ตามกติกาด่าน check:i18n ("พื้นที่หลังบ้านชนเพดาน ⇒ แยกพื้นที่ย่อย อย่าขยายเพดาน")
 * ⚠️ ห้ามพิมพ์ตัวเลขระยะเก็บในไฟล์นี้ — ตัวเลขมาจาก `lib/retention/plan.ts` แล้วเติมด้วย `{days}`
 */
export const adminTrash = {
  trashTitle: "ถังขยะ",
  trashHint: "ของที่ลบจากคลังภาพหรือพรีเซ็ตจะมาอยู่ที่นี่ก่อน — ยังกู้คืนได้จนพ้นระยะเก็บ",
  trashRetentionNote: "เก็บไว้ {days} หลังจากนั้นระบบจะลบถาวรอัตโนมัติ (หรือกดลบถาวรเองได้เลย)",
  trashDbMissing: "ยังไม่ได้ตั้งค่าฐานข้อมูล — เปิดถังขยะไม่ได้จนกว่าจะตั้งค่าเสร็จ",
  trashEmpty: "ถังขยะว่าง — ไม่มีอะไรให้กู้คืน",
  trashStats: "ในถัง: ภาพ {media} · พรีเซ็ต {preset}",
  trashColItem: "รายการ",
  trashColKind: "ชนิด",
  trashColDeletedAt: "วันที่ย้ายเข้า",
  trashColDeletedBy: "ทำโดย",
  trashColExpiry: "เหลือเวลา",
  trashColActions: "จัดการ",
  trashKindMedia: "ภาพ",
  trashKindPreset: "พรีเซ็ตบล็อก",
  trashDaysLeft: "อีก {days} วัน",
  trashDueNow: "จะถูกลบในรอบถัดไป",
  trashRestore: "กู้คืน",
  trashRestoreDone: "กู้คืนแล้ว — กลับไปใช้งานได้ตามเดิม",
  trashDeleteForever: "ลบถาวร",
  trashDeleteForeverDone: "ลบถาวรแล้ว",
  trashDeleteForeverWarning: "ลบถาวรกู้คืนไม่ได้ — ไฟล์จะหายจากฐานข้อมูลทันที",
  trashEmptyAction: "ลบถาวรทั้งหมด",
  trashEmptyDone: "ลบถาวรทั้งหมดแล้ว {count} รายการ",
  trashNotFound: "ไม่พบรายการนี้ (อาจถูกลบไปแล้ว)",
  trashNoPreview: "ภาพในถังจะไม่แสดงบนหน้าเว็บ — กดกู้คืนก่อนถ้าต้องการใช้ซ้ำ",
  trashPurgeNow: "ลบถาวรของที่พ้นกำหนดเดี๋ยวนี้",
  trashPurgeHint: "ใช้เมื่อไม่อยากรอรอบอัตโนมัติ (ปกติระบบลบให้ตอนมีคนเข้าหลังบ้าน หรือตาม cron)",
  trashBackToMedia: "ไปที่คลังภาพ",
  trashListLabel: "รายการของในถังขยะ",
  trashConfirmEmpty: "ยืนยัน: ฉันเข้าใจว่าลบถาวรแล้วกู้คืนไม่ได้",
  /** ป้ายในหน้าภาพรวม (การ์ดถังขยะ + ร่องรอยการใช้งาน) */
  trashCardTitle: "ถังขยะ",
  trashCardHint: "ของที่ลบไว้จะกู้คืนได้จนพ้นระยะเก็บ",
  trashCardCount: "ในถัง {count} รายการ",
  trashCardEmpty: "ถังขยะว่าง",
  trashCardDbMissing: "ยังไม่ได้ตั้งค่าฐานข้อมูล",
  auditTrashMove: "ย้ายเข้าถังขยะ",
  auditTrashRestore: "กู้คืนจากถังขยะ",
  auditTrashDelete: "ลบถาวรจากถังขยะ",
  auditTrashPurge: "ลบถาวรตามระยะเก็บ",
};
