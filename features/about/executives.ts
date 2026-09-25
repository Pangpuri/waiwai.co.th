/**
 * ข้อมูลหน้า `/about/executives` (คณะผู้บริหาร) — pure module
 *
 * ภาพชุดนี้เป็นภาพจริงที่ผู้ใช้ให้มา (คัดจากเว็บเดิม) เก็บใน `public/executives/`
 * เป็น **ผังคณะผู้บริหารทั้ง 7 ท่าน** — ชื่อและตำแหน่งถูกพิมพ์อยู่ในตัวภาพ
 *
 * ⚠️ ยังไม่มีข้อมูลรายบุคคลเป็นข้อความ (ชื่อ/ตำแหน่ง) จากฝ่ายที่เกี่ยวข้อง
 *    จึงยังไม่ถอดชื่อออกมาเป็นข้อความบนหน้าเว็บ เพราะเสี่ยงพิมพ์ชื่อผิด
 *    → ถ้าต้องการให้เป็นข้อความจริง (ค้นหาได้/คัดลอกได้/โปรแกรมอ่านหน้าจออ่านได้)
 *      ต้องขอรายชื่อ + ตำแหน่งที่ยืนยันแล้ว แล้วทำเป็นการ์ดรายบุคคล (ดู PRODUCT_ROADMAP.md § 9)
 */

export type ExecutiveImage = {
  /** path ใต้ public/ */
  readonly src: string;
  readonly width: number;
  readonly height: number;
};

/** ผังคณะผู้บริหาร (ภาพกว้าง — สัดส่วนประมาณ 1.41:1) */
export const MANAGEMENT_TEAM_IMAGE: ExecutiveImage = {
  src: "/executives/management-team.jpg",
  width: 3508,
  height: 2481,
};
