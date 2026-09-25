import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ข้อมูลรับสมัครงาน — pure module (ไม่มี JSX, ไม่มีข้อความที่แสดงบนหน้า)
 *
 * ที่มา: ไฟล์ `Work with Wai Wai.txt` ของบริษัท (ผู้ใช้ให้มา 2026-09-25)
 * ชื่อตำแหน่ง/ฝ่าย/เพศ/อายุ/คุณสมบัติ/ประสบการณ์ อยู่ในพจนานุกรม (`careersPage`)
 * ที่นี่เก็บเฉพาะ id · ฝ่ายที่สังกัด · จำนวนอัตรา → ตรรกะกรอง/นับ จึงทดสอบได้
 *
 * ⚠️ ข้อมูลนี้เป็นประกาศรับสมัครของบริษัท ของจริง (ไม่ใช่ mockup) แต่ **เปลี่ยนบ่อย**
 *    ถ้าฝ่ายบุคคลอัปเดตประกาศ ต้องแก้ไฟล์นี้ + พจนานุกรม แล้วรัน `npm test` (มีเทสต์นับอัตรารวม)
 *    ข้อควรพิจารณาก่อนขึ้นจริง: ช่อง "เพศ" และ "อายุ" เป็นข้อมูลอ่อนไหวทางกฎหมาย — ดู PRODUCT_ROADMAP.md § 9
 *
 * เรียงตามลำดับ (ลำดับ 1-20) ในไฟล์ต้นฉบับ ไม่ได้เรียงใหม่ เพื่อให้เทียบกับประกาศเดิมได้
 */

export type JobId = keyof Messages["careersPage"]["jobs"];
export type DepartmentId = keyof Messages["careersPage"]["departments"];

export type Job = {
  readonly id: JobId;
  readonly department: DepartmentId;
  /** จำนวนอัตราที่เปิดรับ */
  readonly openings: number;
};

export const JOBS: readonly Job[] = [
  { id: "driverUpcountry", department: "salesUpcountry", openings: 2 },
  { id: "salesUpcountry", department: "salesUpcountry", openings: 1 },
  { id: "driverBangkok", department: "salesBangkok", openings: 1 },
  { id: "securityGuard", department: "productionPlanning", openings: 3 },
  { id: "airconTechnician", department: "executiveOffice", openings: 1 },
  { id: "marketingManager", department: "marketingActivities", openings: 2 },
  { id: "productManager", department: "productManagement", openings: 3 },
  { id: "asstManagerKeyAccount", department: "keyAccount", openings: 1 },
  { id: "departmentHeadPc", department: "pcSalesPromotion", openings: 4 },
  { id: "asstDepartmentHeadKeyAccount", department: "keyAccount", openings: 1 },
  { id: "unitHeadPc", department: "pcSalesPromotion", openings: 6 },
  { id: "driverSpecialEvents", department: "specialEvents", openings: 1 },
  { id: "specialEventsStaff", department: "specialEvents", openings: 2 },
  { id: "pcStaff", department: "stSalesPromotion", openings: 3 },
  { id: "electricianM1M3", department: "engineering2", openings: 2 },
  { id: "machineTechnicianM1", department: "engineering2", openings: 6 },
  { id: "machineTechnicianM3", department: "engineering2", openings: 3 },
  { id: "boilerShiftHead", department: "engineering2", openings: 1 },
  { id: "boilerElectrician", department: "engineering2", openings: 1 },
  { id: "boilerStaff", department: "engineering2", openings: 15 },
];

/** ฝ่ายที่มีตำแหน่งเปิดรับ — เรียงตามลำดับที่พบครั้งแรกในไฟล์ต้นฉบับ */
export function departmentsInUse(jobs: readonly Job[] = JOBS): readonly DepartmentId[] {
  const seen: DepartmentId[] = [];

  for (const job of jobs) {
    if (!seen.includes(job.department)) seen.push(job.department);
  }

  return seen;
}

/** จำนวนตำแหน่ง (แถว) ที่เปิดรับ */
export function countPositions(jobs: readonly Job[] = JOBS): number {
  return jobs.length;
}

/** จำนวนอัตรารวมทุกตำแหน่ง */
export function totalOpenings(jobs: readonly Job[] = JOBS): number {
  return jobs.reduce((sum, job) => sum + job.openings, 0);
}

/** กรองตามฝ่าย — `"all"` คืนทุกตำแหน่ง */
export function jobsInDepartment(
  department: DepartmentId | "all",
  jobs: readonly Job[] = JOBS,
): readonly Job[] {
  return department === "all" ? jobs : jobs.filter((job) => job.department === department);
}
