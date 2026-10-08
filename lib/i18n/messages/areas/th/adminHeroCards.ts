/**
 * พื้นที่พจนานุกรม: หลังบ้าน — สไลด์ + แคมเปญ (รอบที่ 188 · ทบทวนรอบที่ 194)
 *
 * แยกจากพื้นที่ `adminHero` ตามกติกาด่าน check:i18n ("พื้นที่ชนเพดาน ⇒ แยกพื้นที่ย่อย อย่าขยายเพดาน")
 * ⚠️ ข้อความการ์ด (หัวข้อ/เนื้อหา) เป็นช่องให้แอดมินกรอกเอง — เราไม่แปลเนื้อหาให้
 * ⚠️ รอบที่ 194 ถอดคีย์ของการ์ดผูกสไลด์ 1:1 ออกแล้ว (7 คีย์ที่ไม่มีที่ใช้) — ที่เหลือคือคำของ "แคมเปญ"
 */
export const adminHeroCards = {
  heroCardTitle: "หัวข้อ",
  heroCardBody: "ข้อความ",
  heroCardCtaLabel: "ข้อความบนปุ่ม",
  heroCardCtaHref: "ลิงก์ปุ่ม (ว่างได้)",
  heroCardPosition: "ตำแหน่งบนภาพ",
  heroCardPositionLeft: "ซ้าย",
  heroCardPositionCenter: "กลาง",
  heroCardPositionRight: "ขวา",
  heroCardStarts: "เริ่มแสดง",
  heroCardEnds: "หยุดแสดง",
  heroCardWindowHint: "เว้นว่าง = ไม่จำกัดเวลา · ระบบใช้เวลาของเซิร์ฟเวอร์ในการขึ้น/ลง",
  heroCardStateAlways: "แสดงตลอด",
  heroCardStateScheduled: "รอเริ่ม",
  heroCardStateLive: "กำลังแสดง",
  heroCardStateExpired: "หมดเวลา",
  heroCardSave: "บันทึกการ์ด",
  heroCardRemove: "ลบการ์ด",
  heroCardTitleRequired: "หัวข้อภาษาไทยบังคับ (การ์ดที่ไม่มีข้อความจะไม่ถูกบันทึก)",
  feedbackSlideAdded: "เพิ่มสไลด์สำเร็จ",
  feedbackSlideRemoved: "ย้ายสไลด์เข้าถังขยะสำเร็จ",
  feedbackSlideMoved: "เลื่อนลำดับสไลด์สำเร็จ",
  feedbackSlideReordered: "บันทึกลำดับสไลด์ใหม่สำเร็จ",
  feedbackSlideSaved: "บันทึกสไลด์สำเร็จ",
  feedbackEffectSaved: "บันทึกเอฟเฟคและความเร็วสำเร็จ",
  feedbackSlideRestored: "กู้คืนสไลด์สำเร็จ",
  feedbackSlidePurged: "ลบสไลด์ถาวรแล้ว",
  feedbackErrorInvalid: "บันทึกไม่สำเร็จ — ข้อมูลไม่ครบหรือไม่ถูกต้อง (ดูรายการช่องที่ต้องแก้ด้านล่าง)",
  feedbackErrorSaveFailed: "บันทึกไม่สำเร็จ — ระบบฐานข้อมูลขัดข้อง กรุณาลองใหม่",
  /* รอบที่ 195: บอกตรงช่องที่ทำให้ไม่ผ่าน (เดิมบอกกว้าง ๆ ⇒ เจ้าของเห็นว่า "ใส่ครบแล้วแต่ไม่ผ่าน") */
};
