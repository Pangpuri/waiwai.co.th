/**
 * พื้นที่พจนานุกรม: หลังบ้าน — บันทึกอัตโนมัติ + เทียบรุ่นก่อนกู้คืน (X1.5)
 *
 * แยกออกจาก admin.ts เพราะไฟล์นั้นใกล้เพดาน 32 KB (กติกาด่าน check:i18n: "แยกพื้นที่ย่อย อย่าขยายเพดาน")
 */
export const adminDraft = {
  sectionManagedElsewhere: "ส่วนนี้หน้าเว็บแสดงจากระบบอื่น (เจ้าของค่าจริง: {screen}) — ค่าที่กรอกในหน้านี้ยังไม่ถูกนำไปแสดง · ไม่ต้องแก้ซ้ำสองที่",
  draftAutosaveOn: "บันทึกอัตโนมัติ: เปิด",
  draftAutosaveOff: "บันทึกอัตโนมัติ: ปิด",
  draftAutosaveHint: "ระบบจะบันทึกให้เองหลังหยุดแก้ {seconds} วินาที — ไม่ต้องกดบันทึกเอง",
  draftAutosaveSaving: "กำลังบันทึกอัตโนมัติ…",
  draftAutosaveSaved: "บันทึกอัตโนมัติแล้ว {time}",
  draftAutosaveFailed: "บันทึกอัตโนมัติไม่สำเร็จ — งานบนจอยังอยู่ · ลองแก้อีกครั้งหรือกด \"เผยแพร่\" เพื่อบันทึกและขึ้นเว็บ",
  draftAutosaveBlocked: "ยังบันทึกอัตโนมัติไม่ได้ — ต้องแก้ข้อผิดพลาดก่อน",
  draftUnsavedCount: "มีการแก้ไข {count} จุด — ยังไม่บันทึก",
  draftAllSaved: "ทุกอย่างถูกบันทึกแล้ว",
  draftLastSaved: "บันทึกล่าสุด {time}",
  draftWarnLeave: "มีการแก้ไข {count} จุดที่ยังไม่บันทึก — ออกจากหน้านี้เลยหรือไม่",
  draftCompareOpen: "เทียบกับชุดที่กำลังแก้",
  draftCompareTitle: "เทียบรุ่นที่ {revision} กับชุดที่กำลังแก้บนหน้าจอ",
  draftCompareSummary: "เพิ่ม {added} · ลบ {removed} · แก้ {changed} · ย้าย {moved}",
  draftCompareOrderChanged: "ลำดับบล็อกเปลี่ยน",
  draftCompareIdentical: "ไม่มีความต่างจากชุดที่กำลังแก้ปัจจุบัน",
  draftCompareRestore: "กู้คืนรุ่นนี้มาแก้",
  draftCompareClose: "ปิดการเทียบ",
  draftCompareTruncated: "แสดงบางส่วน — มีความต่างมากกว่านี้",
  draftCompareProblemRead: "อ่านรุ่นนี้ไม่ได้ — ไม่แนะนำให้กู้คืน",
  draftCompareProblemDraft: "อ่านชุดที่กำลังแก้ไม่ได้ — เทียบไม่ได้",
  draftCompareFieldTruncated: "และอื่น ๆ อีก",
  draftKindAdded: "เพิ่มบล็อก",
  draftKindRemoved: "ลบบล็อก",
  draftKindChanged: "แก้บล็อก",
  draftKindMoved: "ย้ายบล็อก",
  draftInColumn: "คอลัมน์ที่ {n}",
  /* ความต่างระดับหน้า (X1.8): เลย์เอาต์ไม่ผูกกับบล็อกใด ๆ จึงมีป้ายของตัวเอง */
  draftDiffLayout: "เลย์เอาต์ของหน้า",
  draftRestoredApplied: "กู้คืนแล้ว — ชุดที่แก้บนหน้าจอถูกแทนด้วยรุ่นที่กู้คืน (ยังไม่ขึ้นเว็บ)",
};
