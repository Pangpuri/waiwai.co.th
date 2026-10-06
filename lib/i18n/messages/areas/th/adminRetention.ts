/**
 * พื้นที่พจนานุกรม: หลังบ้าน — การ์ด "ระยะเก็บข้อมูลส่วนบุคคล" (X2b)
 *
 * แยกออกจาก admin.ts เพราะไฟล์นั้นใกล้เพดาน 32 KB (กติกาด่าน check:i18n: "แยกพื้นที่ย่อย อย่าขยายเพดาน")
 */
export const adminRetention = {
  retentionTitle: "ระยะเก็บข้อมูลส่วนบุคคล",
  retentionHint:
    "ระบบลบข้อมูลที่หมดอายุให้เองอัตโนมัติ (ทำไม่ถี่กว่า 24 ชม. และทำงานเมื่อมีผู้ดูแลเข้าหลังบ้าน) — ถ้าต้องการให้ตรงเวลาเสมอ ให้ตั้ง cron รัน `npm run db:purge` บนเซิร์ฟเวอร์",
  retentionColData: "ประเภทข้อมูล",
  retentionColKeep: "เก็บนาน",
  retentionColCutoff: "ตัดข้อมูลก่อน",
  retentionColDue: "หมดอายุแล้ว",
  retentionNeverRun: "ยังไม่เคยลบอัตโนมัติ — จะทำเมื่อเข้าหลังบ้านครั้งถัดไป",
  retentionLastRun: "ลบรอบล่าสุด {time}",
  retentionNextRun: "รอบถัดไปราว {time}",
  retentionDueNow: "ถึงรอบลบแล้ว",
  retentionDueTotal: "มี {count} แถวที่หมดอายุ",
  retentionNothingDue: "ยังไม่มีข้อมูลที่หมดอายุ",
  retentionPurgeNow: "ลบข้อมูลที่หมดอายุตอนนี้",
  retentionPurgeWarning: "ลบถาวรและกู้คืนไม่ได้ — ไฟล์เรซูเม่ของใบสมัครที่หมดอายุถูกลบไปด้วย",
  retentionDbMissing: "ยังไม่ได้ตั้งค่าฐานข้อมูล — ต้องมี DATABASE_URL ก่อนจึงจะลบตามระยะเก็บได้",
  retentionLabelContact: "ข้อความจากฟอร์มติดต่อ",
  retentionLabelNewsletter: "อีเมลรับข่าวสาร",
  retentionLabelCareers: "ใบสมัครงาน + เรซูเม่",
  retentionLabelBlockRevision: "ประวัติเนื้อหาหน้าเว็บ (เก็บบล็อกรุ่นล่าสุด)",
  retentionLabelContentRevision: "ประวัติเนื้อหาแบบฟิลด์ (เก็บรุ่นล่าสุด)",
  retentionLabelEntityRevision: "ประวัติรุ่นของสินค้า/เมนูอาหาร/ข่าว",
  retentionLabelLoginAttempt: "ร่องรอยการพยายามล็อกอิน",
  retentionLabelAuditLog: "บันทึกการแก้ไขเนื้อหา",
  retentionLabelAdminSession: "เซสชันการเข้าใช้หลังบ้าน",
  auditRetentionPurge: "ลบข้อมูลตามระยะเก็บ",
};
