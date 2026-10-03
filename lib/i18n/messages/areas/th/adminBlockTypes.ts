/**
 * พื้นที่พจนานุกรม: ป้ายในแผงแก้ของ "บล็อกใหม่" 4 ชนิด (รอบที่ 86)
 *
 * แยกไฟล์ตามกติกา check:i18n — พื้นที่ `admin` ชนเพดาน 32KB แล้ว ⇒ **อย่าขยายเพดาน ให้แยกพื้นที่ย่อย**
 * ⚠️ ข้อความที่ผู้เข้าชมเห็น (หัวเรื่อง/คำบรรยาย/หัวตาราง/เซลล์) ไม่ใช้พจนานุกรม —
 *    เป็นเนื้อหาที่การตลาดแก้จากหลังบ้าน เก็บใน JSONB (มติ D3)
 */
export const adminBlockTypes = {
  /* ตาราง */
  blockTableColumns: "คอลัมน์ ({n}/{max})",
  blockAddColumn: "เพิ่มคอลัมน์",
  blockRemoveColumn: "ลบคอลัมน์",
  blockFirstColumnHeader: "คอลัมน์แรกเป็นหัวแถว",
  blockTableRows: "แถวข้อมูล ({n}/{max})",
  blockAddRow: "เพิ่มแถว",
  blockRemoveRow: "ลบแถว",
  /* แกลเลอรี */
  blockGalleryItems: "ภาพ ({n}/{max})",
  blockAddImage: "เพิ่มภาพ",
  blockRemoveImage: "ลบภาพ",
  blockItemNumber: "ภาพที่ {n}",
  blockGalleryColumns: "จำนวนคอลัมน์",
  /* ฟอร์ม */
  blockFormKind: "ชนิดฟอร์ม",
  blockFormContact: "แบบฟอร์มติดต่อ",
  blockFormNewsletter: "รับข่าวสาร",
  blockFormCareers: "สมัครงาน",
  blockFormHint: "ฟอร์มนี้ใช้ระบบจริงของเว็บ — เก็บลงฐานข้อมูล · มีกับดักบอต · ขอยินยอมตาม PDPA แล้ว",
  /* แผนที่ */
  blockMapLink: "ลิงก์เปิดแผนที่ (https://…)",
  blockMapLinkText: "ข้อความบนปุ่ม (ไม่บังคับ)",
  /* กระดานรับสมัครงาน (รอบที่ 88) */
  blockJobItems: "ตำแหน่ง ({n}/{max})",
  blockAddJob: "เพิ่มตำแหน่ง",
  blockRemoveJob: "ลบตำแหน่ง",
  blockJobNumber: "ตำแหน่งที่ {n}",
  blockJobTitle: "ชื่อตำแหน่ง",
  blockJobDepartment: "ฝ่าย (ใช้จัดกลุ่ม)",
  blockJobOpenings: "จำนวนอัตรา (0 = ไม่ระบุ)",
  blockJobQualifications: "คุณสมบัติ",
  blockJobExperience: "ประสบการณ์ (ไม่บังคับ)",
  blockJobGrouping: "จัดกลุ่มตามฝ่าย",
  /* รายชื่อคณะผู้บริหาร (รอบที่ 88) */
  blockRosterMembers: "รายชื่อ ({n}/{max})",
  blockAddMember: "เพิ่มรายชื่อ",
  blockRemoveMember: "ลบรายชื่อ",
  blockMemberNumber: "คนที่ {n}",
  blockMemberName: "ชื่อ–นามสกุล",
  blockMemberRole: "ตำแหน่ง",
  blockRosterColumns: "จำนวนคอลัมน์",
  blockMemberPhotoHint: "ภาพรายบุคคล (ไม่บังคับ)",
};
