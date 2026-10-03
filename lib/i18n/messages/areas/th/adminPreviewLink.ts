/**
 * พื้นที่พจนานุกรม: หลังบ้าน — ลิงก์พรีวิวชั่วคราว (X2.6)
 *
 * แยกไฟล์ตามกติกาด่าน check:i18n ("พื้นที่หลังบ้านชนเพดาน ⇒ แยกพื้นที่ย่อย")
 * ⚠️ ห้ามพิมพ์ตัวเลขชั่วโมง/เพดาน/วันในไฟล์นี้ — มาจาก `lib/preview-link/plan.ts` แล้วเติมด้วย {…}
 */
export const adminPreviewLink = {
  previewLinkTitle: "ลิงก์พรีวิวชั่วคราว",
  previewLinkHint: "สร้างลิงก์ให้ผู้จัดการ/การตลาดดูฉบับร่างได้ โดยไม่ต้องมีบัญชีหลังบ้าน",
  previewLinkTtlNote:
    "ลิงก์มีอายุ {hours} · ระบบเก็บเฉพาะรหัสลับ ⇒ แสดงลิงก์เดิมซ้ำไม่ได้ (คัดลอกเก็บไว้ทันทีหลังสร้าง)",
  previewLinkCreate: "สร้างลิงก์ใหม่",
  previewLinkCreateAction: "สร้างลิงก์",
  previewLinkCreated: "สร้างลิงก์แล้ว — คัดลอกเก็บไว้ตอนนี้ (จะแสดงอีกไม่ได้)",
  previewLinkCreatedLabel: "ลิงก์พรีวิว",
  previewLinkLocaleLabel: "ภาษา/ที่อยู่ของลิงก์",
  previewLinkLocaleTh: "ไทย (/th)",
  previewLinkLocaleEn: "อังกฤษ (/en)",
  previewLinkPageLabel: "หน้า",
  previewLinkPageHome: "หน้าแรก",
  previewLinkListTitle: "ลิงก์ที่สร้างไว้",
  previewLinkEmpty: "ยังไม่มีลิงก์ที่สร้างไว้",
  previewLinkColPage: "หน้า",
  previewLinkColCreated: "สร้างเมื่อ",
  previewLinkColCreatedBy: "สร้างโดย",
  previewLinkColExpires: "หมดอายุ",
  previewLinkColStatus: "สถานะ",
  previewLinkColUsed: "การใช้งาน",
  previewLinkColActions: "จัดการ",
  previewLinkStatusActive: "ใช้ได้",
  previewLinkStatusExpired: "หมดอายุ",
  previewLinkStatusRevoked: "ยกเลิกแล้ว",
  previewLinkHoursLeft: "อีก {hours} ชม.",
  previewLinkUsedCount: "เปิด {count} ครั้ง",
  previewLinkNeverUsed: "ยังไม่ถูกเปิด",
  previewLinkRevoke: "ยกเลิก",
  previewLinkRevoked: "ยกเลิกแล้ว",
  previewLinkNotFound: "ไม่พบลิงก์นี้ (อาจถูกลบไปแล้ว)",
  previewLinkTooMany: "ลิงก์ที่ยังใช้ได้ครบเพดานแล้ว ({max}) — ยกเลิกลิงก์เก่าก่อนสร้างใหม่",
  previewLinkDbMissing: "ยังไม่ได้ตั้งค่าฐานข้อมูล — สร้างลิงก์ไม่ได้",
  previewLinkRevokeWarning: "ยกเลิกแล้วลิงก์นี้ใช้ไม่ได้ทันที (ผู้จัดการที่ถืออยู่จะเปิดไม่ได้)",
  previewLinkNoStoreWarning: "หน้านี้เป็นเครื่องมือของเจ้าหน้าที่ — ห้ามแชร์ลิงก์นี้เอง",
  auditPreviewLinkCreate: "สร้างลิงก์พรีวิว",
  auditPreviewLinkRevoke: "ยกเลิกลิงก์พรีวิว",
  auditPreviewLinkPurge: "เก็บกวาดลิงก์พรีวิว",
};
