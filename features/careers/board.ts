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
  type DepartmentId,
  type Job,
} from "@/features/careers/jobs";

/**
 * แปลงข้อมูลรับสมัคร (+ พจนานุกรม) เป็นข้อมูลธรรมดาที่ส่งข้ามไปฝั่ง client ได้
 *
 * ใช้แพตเทิร์นเดียวกับ `buildCertificationCards` ของหน้าใบรับรอง:
 * ตัวกรองฝ่ายต้องเป็น client component (เพื่อให้หน้าเว็บยัง prerender เป็น static)
 * แต่เราไม่ส่งพจนานุกรมทั้งก้อนไปฝั่ง client — ส่งเฉพาะข้อความที่ใช้จริง
 */

export type JobCard = {
  readonly id: string;
  readonly departmentId: DepartmentId;
  readonly departmentLabel: string;
  readonly title: string;
  readonly openings: number;
  readonly genderLabel: string;
  readonly ageLabel: string;
  readonly qualificationsLabel: string;
  readonly experienceLabel: string;
};

export type BoardFilter = {
  readonly id: DepartmentId | "all";
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
export function filterCards(
  cards: readonly JobCard[],
  department: DepartmentId | "all",
): readonly JobCard[] {
  return department === "all" ? cards : cards.filter((card) => card.departmentId === department);
}
