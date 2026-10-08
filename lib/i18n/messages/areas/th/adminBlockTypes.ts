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
  blockShowcaseCtaHref: "ลิงก์ปุ่มท้ายส่วน (เว้นว่าง = ไม่มีปุ่ม) เช่น /products",
  blockRecipeLimit: "จำนวนเมนูที่แสดง",
  blockRecipeDates: "แสดงวันที่เผยแพร่",
  blockRecipeHint: "บล็อกนี้ดึงเมนูล่าสุดจากฐานข้อมูล (ภาพ · ชื่อ · วันที่) — ไม่ต้องคีย์เอง · การ์ดพาไปหน้าเมนูอาหาร",
  blockNewsLimit: "จำนวนข่าวที่แสดง",
  blockNewsDates: "แสดงวันที่",
  blockNewsExcerpts: "แสดงคำโปรย",
  blockNewsHint: "บล็อกนี้ดึงข่าว/กิจกรรมล่าสุดจากฐานข้อมูล (ภาพ · วันที่ · คำโปรย) — ไม่ต้องคีย์เอง · การ์ดพาไปหน้าข่าวชิ้นนั้น",
  blockShowcaseColumns: "จำนวนคอลัมน์",
  blockShowcaseCount: "แสดงจำนวนสินค้าบนการ์ดหมวด",
  blockShowcaseFeatured: "แสดงสินค้าแนะนำ",
  blockShowcaseFeaturedCount: "สินค้าแนะนำกี่ตัวต่อหมวด",
  blockShowcaseHint: "บล็อกนี้ดึงข้อมูลจริงจากฐานข้อมูล (ชื่อหมวด · คำอธิบาย · ภาพ · จำนวน · สินค้าแนะนำ) — ไม่ต้องคีย์เอง",
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
  /* เมนูอาหาร (รอบที่ 101) */
  blockRecipeItems: "เมนู ({n}/{max})",
  blockAddRecipe: "เพิ่มเมนู",
  blockRemoveRecipe: "ลบเมนูนี้",
  blockRecipeNumber: "เมนูที่ {n}",
  blockRecipeTitle: "ชื่อเมนู",
  blockRecipeBody: "คำโปรย (ไม่บังคับ)",
  blockRecipeIngredients: "ส่วนผสม (บรรทัดละอย่าง)",
  blockRecipeSteps: "วิธีทำ (บรรทัดละขั้นตอน)",
  blockRecipeColumns: "จำนวนคอลัมน์",
  blockRecipeImageLabel: "ภาพของเมนูนี้",
  blockRecipePickHint: "คลิกเมนูที่ต้องการแก้ (หรือคลิกการ์ดเมนูในพรีวิวได้เลย)",
  /* เลย์เอาต์ของหน้า (X1.8) */
  layoutLabel: "เลย์เอาต์ของหน้านี้",
  layoutHint:
    "เต็มความกว้าง = เรียงบล็อกลงมาปกติ · มีสารบัญด้านข้าง = สารบัญจากหัวข้อในหน้าให้อัตโนมัติ · หน้าแลนดิ้ง = บล็อกแรกเต็มตามที่ตั้งไว้ ที่เหลือกึ่งกลางแคบ",
  /* เลย์เอาต์แยกตามภาษา (รอบที่ 92) */
  layoutLabelEn: "เลย์เอาต์ของหน้าอังกฤษ (ไม่ระบุ = ใช้ค่าเดียวกับไทย)",
};
