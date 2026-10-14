import type { Messages } from "@/lib/i18n/messages/th";

/*
  ใช้ path alias (ไม่ใช่ `./jobs`) เพราะไฟล์นี้ถูกโหลดโดย `node --test` ด้วย
  Node ESM ไม่เติมนามสกุลให้ relative import (และ tsconfig ไม่ได้เปิด allowImportingTsExtensions)
  → เทสต์จะพังด้วย ERR_MODULE_NOT_FOUND ถ้าเขียน `./jobs`
  ตัว resolve alias ของโปรเจกต์ (`scripts/alias-resolver.mjs`) เติม `.ts` ให้เอง
*/
import {
  JOBS,
  departmentsInUse,
  jobsInDepartment,
  type Job,
} from "@/features/careers/jobs";
import {
  jobAge,
  jobDepartment,
  jobDepartments,
  jobExperience,
  jobQualifications,
  jobTitle,
  sortJobPostings,
  type Language as JobLanguage,
  type JobPosting,
} from "@/lib/careers/model";

/**
 * แปลงข้อมูลรับสมัคร (+ พจนานุกรม) เป็นข้อมูลธรรมดาที่ส่งข้ามไปฝั่ง client ได้
 *
 * ใช้แพตเทิร์นเดียวกับ `buildCertificationCards` ของหน้าใบรับรอง:
 * ตัวกรองฝ่ายต้องเป็น client component (เพื่อให้หน้าเว็บยัง prerender เป็น static)
 * แต่เราไม่ส่งพจนานุกรมทั้งก้อนไปฝั่ง client — ส่งเฉพาะข้อความที่ใช้จริง
 */

export type JobCard = {
  readonly id: string;
  /** ใช้เป็นคีย์กรอง — ฝ่ายในโค้ด = คีย์พจนานุกรม · ประกาศจากฐานข้อมูล = ชื่อฝ่าย (ข้อความอิสระ) */
  readonly departmentId: string;
  readonly departmentLabel: string;
  readonly title: string;
  readonly openings: number;
  readonly genderLabel: string;
  readonly ageLabel: string;
  readonly qualificationsLabel: string;
  readonly experienceLabel: string;
};

export type BoardFilter = {
  readonly id: string;
  readonly label: string;
  /** จำนวนตำแหน่งในฝ่ายนั้น */
  readonly count: number;
};

export type BoardLabels = {
  /** aria-label ของกลุ่มปุ่มกรอง */
  readonly filterGroup: string;
  /** หน่วยของจำนวนตำแหน่ง เช่น "ตำแหน่ง" */
  readonly positionUnit: string;
  /** หน่วยของอัตราที่เปิดรับ เช่น "อัตรา" */
  readonly openingsUnit: string;
  /** ข้อความเมื่อกรองแล้วไม่พบตำแหน่ง */
  readonly empty: string;
  readonly fieldGender: string;
  readonly fieldAge: string;
  readonly fieldQualifications: string;
  readonly fieldExperience: string;
};

export type Board = {
  readonly cards: readonly JobCard[];
  readonly filters: readonly BoardFilter[];
  readonly labels: BoardLabels;
};

export function buildBoard(messages: Messages, jobs: readonly Job[] = JOBS): Board {
  const m = messages.careersPage;

  // ดูคำอธิบายที่ `genderLabel` ด้านล่าง — map นี้เลี่ยงการใส่ type assertion
  const genderLabels: Readonly<Record<string, string>> = m.genders;

  const cards: readonly JobCard[] = jobs.map((job) => {
    const copy = m.jobs[job.id];

    return {
      id: job.id,
      departmentId: job.department,
      departmentLabel: m.departments[job.department],
      title: copy.title,
      openings: job.openings,
      /*
        `copy.gender` เก็บเป็นคีย์ ("male" | "female" | "any") ของ `m.genders`
        ค่าจริงในพจนานุกรมถูก widen เป็น string จึงทำเป็น map แทนการใส่ type assertion
        (เทสต์ยืนยันว่าทุกคีย์ถูกต้องอยู่แล้ว — ส่วน `??` เป็นการกันเหนียว)
      */
      genderLabel: genderLabels[copy.gender] ?? copy.gender,
      ageLabel: copy.age,
      qualificationsLabel: copy.qualifications,
      // ต้นฉบับใช้ "-" เมื่อไม่ระบุประสบการณ์ → แสดงข้อความจากพจนานุกรมแทน
      experienceLabel: copy.experience ?? m.notSpecified,
    };
  });

  const filters: readonly BoardFilter[] = [
    { id: "all", label: m.filterAll, count: jobs.length },
    ...departmentsInUse(jobs).map((department) => ({
      id: department,
      label: m.departments[department],
      count: jobsInDepartment(department, jobs).length,
    })),
  ];

  return {
    cards,
    filters,
    labels: {
      filterGroup: m.filterGroup,
      positionUnit: m.positionUnit,
      openingsUnit: m.openingsUnit,
      empty: m.empty,
      fieldGender: m.fields.gender,
      fieldAge: m.fields.age,
      fieldQualifications: m.fields.qualifications,
      fieldExperience: m.fields.experience,
    },
  };
}

/** กรองการ์ดตามฝ่าย — `"all"` คืนทุกใบ (ตรงกับ `jobsInDepartment` ของ jobs.ts) */
export function filterCards(cards: readonly JobCard[], department: string): readonly JobCard[] {
  return department === "all" ? cards : cards.filter((card) => card.departmentId === department);
}

/**
 * กระดานจาก **ประกาศในฐานข้อมูล** (`job_posting`) — รอบที่ 265 · มติ D26
 *
 * ทำไมต้องมีตัวแปลงตัวที่สอง (แทนที่จะใช้ `buildBoard` เดิม): ประกาศในฐานข้อมูลเก็บ **ข้อความจริง**
 * (ชื่อ/ฝ่าย/คุณสมบัติ ต่อภาษา) ไม่ได้ผูกกับคีย์พจนานุกรมเหมือน `JOBS` ⇒ ต้องอ่านค่าจากแถวโดยตรง
 * ส่วน **เพศ** ยังเป็นคีย์ในพจนานุกรม (`careersPage.genders`) ⇒ แปลงที่เดียวตรงนี้
 * ผลลัพธ์เป็น `Board` ชนิดเดียวกับของเดิม ⇒ หน้าจอ `JobBoard` (client) ใช้ตัวเดิมได้ทันที
 */
export function buildPostingBoard(
  postings: readonly JobPosting[],
  messages: Messages,
  language: JobLanguage,
): Board {
  const m = messages.careersPage;
  const genderLabels: Readonly<Record<string, string>> = m.genders;
  const ordered = sortJobPostings(postings);

  const cards: readonly JobCard[] = ordered.map((posting) => {
    const experience = jobExperience(posting, language);
    return {
      id: posting.id,
      /* ฝ่ายเป็นข้อความอิสระ (เพิ่มฝ่ายใหม่ได้จากหลังบ้าน) ⇒ ใช้ชื่อที่แสดงเป็นคีย์กรอง */
      departmentId: jobDepartment(posting, language),
      departmentLabel: jobDepartment(posting, language),
      title: jobTitle(posting, language),
      openings: posting.openings,
      /* ไม่ระบุเพศ/อายุ = ค่าว่าง (มติ D26 ข้อ 4) — หน้าจอซ่อนบรรทัดที่ไม่ระบุให้เอง */
      genderLabel: posting.gender === "" ? "" : (genderLabels[posting.gender] ?? ""),
      ageLabel: jobAge(posting, language),
      qualificationsLabel: jobQualifications(posting, language),
      experienceLabel: experience.trim() === "" ? m.notSpecified : experience,
    };
  });

  const filters: readonly BoardFilter[] = [
    { id: "all", label: m.filterAll, count: cards.length },
    ...jobDepartments(postings, language).map((label) => ({
      id: label,
      label,
      count: cards.filter((card) => card.departmentId === label).length,
    })),
  ];

  return {
    cards,
    filters,
    labels: {
      filterGroup: m.filterGroup,
      positionUnit: m.positionUnit,
      openingsUnit: m.openingsUnit,
      empty: m.empty,
      fieldGender: m.fields.gender,
      fieldAge: m.fields.age,
      fieldQualifications: m.fields.qualifications,
      fieldExperience: m.fields.experience,
    },
  };
}
