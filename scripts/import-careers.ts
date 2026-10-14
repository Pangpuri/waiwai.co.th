/**
 * นำ "ประกาศรับสมัครงาน" ที่มีอยู่หน้าบ้านเข้า **ฐานข้อมูล** — รอบที่ 265 (มติเจ้าของ D26)
 *
 * ```bash
 * npm run careers:import              # นำเข้า (รันซ้ำไม่ทับงานที่แก้จากหลังบ้าน)
 * npm run careers:import -- --dry-run # ดูว่าจะเขียนอะไร (ไม่แตะฐานข้อมูล)
 * npm run careers:import -- --force   # เขียนทับทุกช่อง (ใช้เมื่อต้นฉบับเป็นตัวจริง)
 * ```
 *
 * ที่มา: เดิมข้อมูล 20 ตำแหน่งอยู่ 2 ที่ในโค้ด
 *   · `features/careers/jobs.ts` → รหัส · ฝ่าย · จำนวนอัตรา
 *   · พจนานุกรม `careersPage.jobs` (TH/EN) → ชื่อ · เพศ · อายุ · คุณสมบัติ · ประสบการณ์
 * หลังรอบนี้ **ตาราง `job_posting` คือแหล่งความจริงเดียว** · สคริปต์นี้เป็น **ประตูเดียว** ที่ดึงของเดิมเข้า
 * (มติ D26 ข้อ 3: นำเข้าครั้งเดียว — ไม่มีตารางค่าเริ่มต้น/ไม่มีปุ่มคืนค่า เพราะประกาศเปลี่ยนบ่อย)
 *
 * ⚠️ `gender` เก็บเป็น **คีย์** ('male'/'female'/'any') — ข้อความยังอยู่ในพจนานุกรม `careersPage.genders`
 * ⚠️ ค่าเริ่มต้น = `published` (ประกาศที่นำเข้าคือประกาศที่เว็บเดิมโชว์อยู่จริง) · ลำดับ = (index+1)×10
 * ⚠️ ต้องมี `DATABASE_URL` · อ่านพจนานุกรมในเครื่องเท่านั้น (ไม่ต่ออินเทอร์เน็ต)
 */
import { JOBS } from "@/features/careers/jobs";
import { isDatabaseConfigured } from "@/db/pool";
import { JOB_SORT_STEP, isJobGenderValue } from "@/lib/careers/model";
import { listJobPostingsForAdmin, upsertJobPosting, type JobWriteInput } from "@/lib/careers/repository";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const ACTOR = "careers-import";

/** ประกาศชุดปัจจุบันจากโค้ด + พจนานุกรม ⇒ แถวฐานข้อมูล (TH บังคับ · EN ว่างได้) */
function postingsFromCode(): readonly JobWriteInput[] {
  return JOBS.map((job, index) => {
    const copy = th.careersPage.jobs[job.id];
    const copyEn = en.careersPage.jobs[job.id];
    /* พจนานุกรมเก็บ gender เป็นคีย์อยู่แล้ว — ตรวจก่อนเขียน (ค่าที่ไม่รู้จักต้องไม่ลงฐานข้อมูล) */
    const gender = isJobGenderValue(copy.gender) ? copy.gender : "";
    return {
      id: job.id,
      titleTh: copy.title,
      titleEn: copyEn.title,
      departmentTh: th.careersPage.departments[job.department],
      departmentEn: en.careersPage.departments[job.department],
      openings: job.openings,
      gender,
      ageTh: copy.age,
      ageEn: copyEn.age,
      qualificationsTh: copy.qualifications,
      qualificationsEn: copyEn.qualifications,
      experienceTh: copy.experience ?? "",
      experienceEn: copyEn.experience ?? "",
      sortOrder: (index + 1) * JOB_SORT_STEP,
      status: "published",
    };
  });
}

async function main(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.error("✗ ต้องมี DATABASE_URL (ดู .env.local)");
    process.exit(1);
  }

  const inputs = postingsFromCode();
  const existing = await listJobPostingsForAdmin();
  const existingIds = new Set(existing.map((row) => row.id));

  console.log(
    `ประกาศในโค้ด ${String(inputs.length)} · ในฐานข้อมูล ${String(existing.length)} · โหมด ${force ? "force (ทับทุกช่อง)" : "protect-edited (ไม่ทับงานคน)"}${dryRun ? " · dry-run" : ""}`,
  );

  const openings = inputs.reduce((sum, input) => sum + input.openings, 0);
  const departments = new Set(inputs.map((input) => input.departmentTh.trim()).filter((name) => name !== ""));
  console.log(`   อัตรารวม ${String(openings)} · ฝ่าย ${String(departments.size)} · มีอยู่แล้ว ${String(inputs.filter((input) => existingIds.has(input.id)).length)}`);

  if (dryRun) {
    for (const input of inputs) {
      console.log(
        `   ${input.id.padEnd(26)} ${input.titleTh.padEnd(34)} ${input.departmentTh.padEnd(20)} ${String(input.openings).padStart(2)} อัตรา${existingIds.has(input.id) ? "  (มีอยู่แล้ว)" : "  (ใหม่)"}`,
      );
    }
    console.log("(dry-run) ไม่เขียนอะไรลงฐานข้อมูล");
    return;
  }

  let created = 0;
  let updated = 0;
  let protectedEdit = 0;
  for (const input of inputs) {
    const result = await upsertJobPosting(input, ACTOR, force ? "replace" : "protect-edited");
    if (result.created) created += 1;
    else if (result.protectedEdit) protectedEdit += 1;
    else updated += 1;
  }

  console.log(`✓ นำเข้าประกาศ ${String(inputs.length)} รายการ — ใหม่ ${String(created)} · อัปเดต ${String(updated)} · คงงานที่คนแก้ไว้ ${String(protectedEdit)}`);
  if (protectedEdit > 0) console.log("ℹ️ รายการที่คงไว้ = มีคนแก้จากหลังบ้านแล้ว (ถ้าต้องการทับจริงใช้ `--force`)");
  console.log("ℹ️ ตรวจต่อ: เปิด /admin/careers หรือ `/th/careers`");
}

await main();
