import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { codeOf } from "./source-scan.ts";
import { CONTENT_TRASH_KINDS, CONTENT_TRASH_SCREENS } from "@/lib/trash/plan.ts";
import {
  JOB_GENDERS,
  MAX_JOB_OPENINGS,
  MAX_JOB_TEXT_LENGTH,
  MAX_JOB_TITLE_LENGTH,
  jobAge,
  jobDepartments,
  jobExperience,
  jobQualifications,
  jobStats,
  jobTitle,
  isJobGenderValue,
  isJobStatus,
  newJobId,
  nextJobSortOrder,
  sortJobPostings,
  validateJobInput,
  type JobInput,
  type JobPosting,
} from "@/lib/careers/model";

/**
 * เทสต์ "ประกาศรับสมัครงาน" (รอบที่ 265 · มติเจ้าของ D26) — **ตรรกะล้วน ไม่ต้องมี DB**
 *
 * ล็อกสิ่งเหล่านี้กันถอยหลัง
 * 1. ตรวจข้อมูล: ชื่อไทยบังคับ · เพศ/อายุ/EN ว่างได้ (มติ D26 ข้อ 4) · เพดานจำนวน/ความยาว
 * 2. การเรียง/ตัวเลข/ฝ่าย (ตัวกรอง + ตัวเลข 3 ช่องบนหน้า /careers)
 * 3. ตัวเลือกภาษา (EN ว่าง = ถอยไทย) + ตัวเลข/ฝ่ายที่หน้าเว็บใช้
 * 4. ประตูความปลอดภัยที่ต้องอยู่ในโค้ด (อ่านสาธารณะผ่าน role อ่าน · ประตู SQL · action ตรวจสิทธิ์)
 * 5. ของในถังขยะถูกนับรวมในระบบถังกลาง (ตัวลบอัตโนมัติ 30 วัน = คำสัญญาบนจอต้องจริง)
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function input(overrides: Partial<JobInput> = {}): JobInput {
  return {
    titleTh: "พนักงานทดสอบ",
    titleEn: "Test staff",
    departmentTh: "ฝ่ายทดสอบ",
    departmentEn: "Test dept",
    openings: 2,
    gender: "",
    ageTh: "",
    ageEn: "",
    qualificationsTh: "",
    qualificationsEn: "",
    experienceTh: "",
    experienceEn: "",
    sortOrder: 100,
    status: "draft",
    ...overrides,
  };
}

function posting(overrides: Partial<JobPosting> & { readonly id: string }): JobPosting {
  return {
    titleTh: "พนักงานทดสอบ",
    titleEn: "",
    departmentTh: "ฝ่ายทดสอบ",
    departmentEn: "",
    openings: 1,
    gender: "",
    ageTh: "",
    ageEn: "",
    qualificationsTh: "",
    qualificationsEn: "",
    experienceTh: "",
    experienceEn: "",
    sortOrder: 100,
    ...overrides,
  };
}

/* ── 1) รหัส + ตรวจข้อมูล ─────────────────────────────────────────────────── */

test("ประกาศงาน: รหัสใหม่มาจากเวลา และไม่ซ้ำกับของเดิม", () => {
  assert.equal(newJobId(1791944519289), "j1791944519289");
  assert.notEqual(newJobId(1), newJobId(2));
});

test("ประกาศงาน: ผ่านเมื่อกรอกแค่ชื่อไทย (+ ช่องอื่นว่างได้ — มติ D26 ข้อ 4)", () => {
  assert.deepEqual([...validateJobInput(input())], [], "กรอกครบขั้นต่ำต้องผ่าน");
  assert.deepEqual(
    [...validateJobInput(input({ titleEn: "", departmentTh: "", openings: 0, gender: "", ageTh: "", status: "published" }))],
    [],
    "ช่อง EN/ฝ่าย/เพศ/อายุ ว่างได้ และเปิดเผยแพร่ได้",
  );
});

test("ประกาศงาน: ปฏิเสธเมื่อชื่อไทยว่าง · เพศ/สถานะไม่รู้จัก · จำนวนติดลบ/เกินเพดาน · ลำดับติดลบ", () => {
  const codes = (overrides: Partial<JobInput>): readonly string[] =>
    validateJobInput(input(overrides)).map((issue) => issue.code);

  assert.ok(codes({ titleTh: "   " }).includes("empty-title-th"));
  assert.ok(codes({ titleTh: "ก".repeat(MAX_JOB_TITLE_LENGTH + 1) }).includes("title-too-long"));
  assert.ok(codes({ qualificationsTh: "ก".repeat(MAX_JOB_TEXT_LENGTH + 1) }).includes("text-too-long"));
  assert.ok(codes({ ageTh: "ก".repeat(200) }).includes("age-too-long"));
  assert.ok(codes({ openings: -1 }).includes("openings-invalid"));
  assert.ok(codes({ openings: MAX_JOB_OPENINGS + 1 }).includes("openings-invalid"));
  assert.ok(codes({ openings: 1.5 }).includes("openings-invalid"));
  assert.ok(codes({ sortOrder: -5 }).includes("sort-order-invalid"));
  assert.ok(codes({ status: "archived" }).includes("status-invalid"));
  assert.ok(codes({ gender: "other" }).includes("gender-invalid"));
});

test("ประกาศงาน: ตัวตรวจค่าจากฟอร์ม (เพศ/สถานะ) — ค่าที่ไม่รู้จักต้องไม่ผ่าน", () => {
  assert.deepEqual([...JOB_GENDERS], ["", "male", "female", "any"]);
  assert.equal(isJobGenderValue(""), true, "ไม่ระบุ = ค่าที่ถูกต้อง");
  assert.equal(isJobGenderValue("male"), true);
  assert.equal(isJobGenderValue("MALE"), false);
  assert.equal(isJobGenderValue("other"), false);
  assert.equal(isJobStatus("draft"), true);
  assert.equal(isJobStatus("published"), true);
  assert.equal(isJobStatus(""), false);
  assert.equal(isJobStatus("archived"), false);
});

/* ── 2) เรียง/ตัวเลข/ฝ่าย ─────────────────────────────────────────────────── */

test("ประกาศงาน: เรียงตามลำดับแล้วปิดท้ายด้วยรหัส — ผลนิ่งทุกครั้ง", () => {
  const rows = [
    posting({ id: "b", sortOrder: 20 }),
    posting({ id: "a", sortOrder: 20 }),
    posting({ id: "c", sortOrder: 10 }),
  ];
  assert.deepEqual(sortJobPostings(rows).map((row) => row.id), ["c", "a", "b"]);
  assert.deepEqual(sortJobPostings(sortJobPostings(rows)).map((row) => row.id), ["c", "a", "b"], "เรียกซ้ำได้ผลเดิม");
});

test("ประกาศงาน: ลำดับถัดไป = ต่อท้ายของเดิมเสมอ", () => {
  assert.equal(nextJobSortOrder([]), 1000);
  assert.equal(nextJobSortOrder([{ id: "a", sortOrder: 200 }]), 210);
});

test("ประกาศงาน: ตัวเลข 3 ช่องมาจากข้อมูลจริง (ไม่นับฝ่ายว่าง/ซ้ำ)", () => {
  const rows = [
    posting({ id: "a", departmentTh: "วิศวกรรม", openings: 3 }),
    posting({ id: "b", departmentTh: "วิศวกรรม", openings: 0 }),
    posting({ id: "c", departmentTh: "ขาย", openings: 6, sortOrder: 10 }),
    posting({ id: "d", departmentTh: "  ", openings: 1 }),
  ];
  assert.deepEqual({ ...jobStats(rows) }, { positions: 4, openings: 10, departments: 2 });
  assert.deepEqual([...jobDepartments(rows, "th")], ["ขาย", "วิศวกรรม"], "เรียงตามลำดับที่พบ (c=10 มาก่อน a=100)");
});

test("ประกาศงาน: ถอยภาษา EN → ไทย เมื่ออังกฤษว่าง (มติ D3)", () => {
  const row = posting({ id: "a", titleTh: "พนักงานขาย", titleEn: "", departmentTh: "ขาย", qualificationsTh: "ป.ตรี" });
  assert.equal(jobTitle(row, "en"), "พนักงานขาย");
  assert.equal(jobQualifications(row, "en"), "ป.ตรี");
  assert.equal(jobAge(row, "en"), "");

  const bilingual = posting({
    id: "b",
    titleTh: "พนักงานขาย",
    titleEn: "Sales",
    departmentTh: "ขาย",
    departmentEn: "Sales dept",
    experienceTh: "1 ปี",
    experienceEn: "1 year",
  });
  assert.equal(jobTitle(bilingual, "en"), "Sales");
  assert.equal(jobDepartments([bilingual], "en")[0], "Sales dept");
  assert.equal(jobExperience(bilingual, "en"), "1 year");
});

/* ── 3) ประตูความปลอดภัยในโค้ด ───────────────────────────────────────────── */

test("ประกาศงาน: คำสั่งอ่านฝั่งเว็บใช้ประตูอ่านอย่างเดียว + มีเงื่อนไข 'เผยแพร่และไม่อยู่ในถัง'", () => {
  const repo = codeOf("lib/careers/repository.ts");
  assert.ok(repo.includes("readQuery<"), "listJobPostings() ต้องอ่านผ่าน readQuery (role อ่านอย่างเดียว)");
  assert.ok(
    repo.includes("status = 'published' and deleted_at is null"),
    "ต้องมีเงื่อนไขกลางของประกาศที่ขึ้นเว็บได้",
  );
  assert.ok(repo.includes("getPool()"), "งานเขียน/หลังบ้านต้องใช้ getPool()");
});

test("ประกาศงาน: ประตูถังขยะอยู่ที่ SQL ทั้งสองทาง + ลบถาวรต้องอยู่ในถังเท่านั้น", () => {
  const repo = codeOf("lib/careers/repository.ts");
  assert.ok(repo.includes('trashed ? "deleted_at is null" : "deleted_at is not null"'), "ย้าย/กู้คืนต้องมีประตูสองทาง");
  assert.ok(
    repo.includes("delete from job_posting where id = $1 and deleted_at is not null"),
    "ลบถาวรต้องบังคับ 'อยู่ในถัง' ที่ SQL",
  );
  assert.ok(repo.includes("deleted_by"), "ต้องบันทึกคนลบไว้ตรวจย้อนหลัง");
});

test("ประกาศงาน: ทุก action ตรวจสิทธิ์ + ประกาศใหม่เป็นฉบับร่างเท่านั้น", () => {
  const actions = codeOf("app/admin/careers/actions.ts");
  const calls = actions.match(/requireAdminUser\("content"\)/g) ?? [];
  const exported = actions.match(/export async function \w+/g) ?? [];
  assert.equal(calls.length, exported.length, "ทุก action ต้องเรียก requireAdminUser (จำนวนต้องเท่ากับ action ที่ export)");
  assert.ok(actions.includes('status: "draft"'), "createJobAction ต้องตั้งเป็นฉบับร่างเสมอ (มติ D26 ข้อ 5)");
  assert.ok(actions.includes("newJobId(Date.now())"), "รหัสประกาศออกที่เซิร์ฟเวอร์ ไม่รับจากฟอร์ม");
});

test("ประกาศงาน: จอหลังบ้านมีฟอร์มเดียว (ไม่มี <form> ซ้อน) และพรีวิวใช้ JobBoard ตัวจริง", () => {
  const form = codeOf("features/admin/ui/job-form.tsx");
  const forms = form.match(/<form/g) ?? [];
  assert.equal(forms.length, 1, "ต้องมี <form> เดียวในไฟล์ฟอร์ม (บทเรียนรอบที่ 129)");
  assert.ok(form.includes("JobBoard"), "พรีวิวต้องใช้ตัวเรนเดอร์เดียวกับหน้าเว็บ");
  assert.ok(form.includes("previewBoard"), "พรีวิวต้องสร้างจากค่าที่กรอกค้าง (ไม่ใช่ภาพนิ่ง)");
});

test("ประกาศงาน: พจนานุกรมพื้นที่ใหม่ + มี EN ครบคู่ (ด่าน check:i18n เสริม)", () => {
  const th = codeOf("lib/i18n/messages/areas/th/adminCareers.ts");
  const en = codeOf("lib/i18n/messages/areas/en/adminCareers.ts");
  const countKeys = (source: string): number => (source.match(/^ {2}\w+:/gm) ?? []).length;
  assert.equal(countKeys(th), countKeys(en), "จำนวนคีย์ th/en ต้องเท่ากัน");
  assert.ok(!th.includes("as const"), "ไฟล์พื้นที่ห้ามใส่ `as const` (type Messages มาจาก th)");
  assert.ok(th.includes("trashContentJob") === false, "ป้ายถังขยะอยู่พื้นที่ adminTrash ไม่ใช่ที่นี่");
  assert.ok(th.includes("trashKindJob") === false, "ป้ายชนิดของถังขยะก็อยู่พื้นที่ adminTrash เช่นกัน");
});

/* ── 4) ถังขยะกลาง + ตัวลบอัตโนมัติ ──────────────────────────────────────── */

test("ประกาศงาน: อยู่ในทะเบียนถังขยะเนื้อหา (ของในถังถูกลบถาวรอัตโนมัติใน 30 วัน) + ชี้แท็บที่มีจริง", () => {
  assert.ok([...CONTENT_TRASH_KINDS].includes("job"), "ประกาศงานต้องอยู่ใน CONTENT_TRASH_KINDS");
  assert.equal(CONTENT_TRASH_SCREENS.job, "/admin/careers?tab=trash", "ต้องลิงก์ไปแท็บถังขยะของจอประกาศงาน");

  const page = codeOf("app/admin/careers/page.tsx");
  assert.ok(page.includes('["all", "draft", "published", "trash"]'), "หน้าจอต้องมีแท็บ trash จริง");
  const repo = codeOf("lib/careers/repository.ts");
  assert.ok(repo.includes("and deleted_at is not null"), "ตัวลบถาวรต้องมีประตู SQL");
});

test("ประกาศงาน: ตัวนำเข้ามีจริง + ลงทะเบียนใน package.json + ค่าเริ่มต้นไม่ทับงานคน", () => {
  const script = codeOf("scripts/import-careers.ts");
  assert.ok(script.includes("protect-edited"), "ค่าเริ่มต้นของตัวนำเข้าต้องเป็น protect-edited");
  assert.ok(script.includes("isJobGenderValue("), "ต้องตรวจคีย์เพศก่อนเขียนลงฐานข้อมูล");
  assert.ok(script.includes("JOBS"), "ต้องดึงข้อมูลตั้งต้นจาก JOBS + พจนานุกรม");

  const pkg = JSON.parse(sourceOf("package.json")) as { readonly scripts?: Readonly<Record<string, string>> };
  assert.ok(
    (pkg.scripts?.["careers:import"] ?? "").includes("scripts/import-careers.ts"),
    "package.json ต้องมีสคริปต์ careers:import",
  );
});

test("ประกาศงาน: หน้า /careers ถอยไปใช้ข้อมูลในโค้ดได้เมื่อไม่มีฐานข้อมูล (หน้าเว็บต้องไม่พัง)", () => {
  const page = codeOf("app/[lang]/careers/page.tsx");
  assert.ok(page.includes("listJobPostings("), "ต้องอ่านประกาศจากฐานข้อมูล");
  assert.ok(page.includes("buildBoard(messages)"), "ต้องมีทางถอยไปใช้ข้อมูลตั้งต้นในโค้ดเมื่อไม่มีฐานข้อมูล");
  assert.ok(page.includes("isDatabaseConfigured()"), "ต้องแยกกรณี 'ไม่มีฐานข้อมูล' ออกจาก 'ไม่มีประกาศที่เผยแพร่'");
  assert.ok(
    page.includes("databaseReady ? buildPostingBoard(") && !page.includes("postings.length > 0 ?"),
    "ฐานข้อมูลพร้อม = ใช้ฐานข้อมูลเสมอ (กระดานว่างได้) · ไม่พร้อม = ถอยไปใช้โค้ด (ห้ามฟื้นประกาศที่ลบไปแล้ว)",
  );
});

test("ประกาศงาน: ช่องเลือกตำแหน่งในใบสมัครใช้รายการเดียวกับกระดาน (จากฐานข้อมูล)", () => {
  const fields = codeOf("features/forms/ui/form-fields.tsx");
  assert.ok(fields.includes("strings.positions ?? JOBS.map("), "ไม่ส่ง positions = ต้องถอยไปใช้ JOBS เดิม (ทางของบล็อก)");

  const form = codeOf("features/careers/ui/application-form.tsx");
  assert.ok(form.includes("positions"), "ApplicationForm ต้องรับรายการตำแหน่งจากผู้เรียกได้");

  const page = codeOf("app/[lang]/careers/page.tsx");
  assert.ok(page.includes("positions={"), "หน้า /careers ต้องส่งรายการตำแหน่งที่แสดงจริงเข้าใบสมัคร");
  assert.ok(page.includes("jobTitle(posting, lang)"), "ชื่อตำแหน่งในตัวเลือกต้องมาจากประกาศในฐานข้อมูล");
});

test("ประกาศงาน: ของเดิมของหน้า /careers ยังอยู่ครบ (เทมเพลต/ตัวกรอง/ข้อมูลตั้งต้นในโค้ด)", () => {
  /* กันการเผลอลบของเดิมที่ยังใช้เป็นทางถอย (เลย์เอาต์เดิม + เทมเพลตบล็อก + ตัวกรองฝ่าย) */
  for (const file of [
    "features/careers/board.ts",
    "features/careers/jobs.ts",
    "features/careers/ui/job-board.tsx",
  ]) {
    assert.ok(sourceOf(file).length > 0, `${file} ต้องยังมีอยู่จริง`);
  }
  /* รอบที่ 266: ถอดตัวสร้างหน้า careers + เทมเพลต + บล็อก jobBoard ออกแล้ว — ต้องไม่กลับมา */
  assert.throws(() => sourceOf("lib/blocks/careers-template.ts"), "เทมเพลต careers ต้องถูกลบแล้ว");
  const registry = codeOf("lib/blocks/templates.ts");
  assert.ok(!registry.includes("careers"), "ทะเบียนเทมเพลตต้องไม่มี careers");
  assert.ok(!codeOf("lib/blocks/types.ts").includes("jobBoard"), "ชนิดบล็อก jobBoard ต้องถูกถอดออก");
});
