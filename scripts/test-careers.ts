import assert from "node:assert/strict";
import { test } from "node:test";

import { buildBoard, filterCards } from "@/features/careers/board";
import { CAREERS_CONTACT } from "@/features/careers/contact";
import {
  JOBS,
  countPositions,
  departmentsInUse,
  jobsInDepartment,
  totalOpenings,
} from "@/features/careers/jobs";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";

test("JOBS: id ไม่ซ้ำ · จำนวนอัตราเป็นจำนวนเต็มบวก · ฝ่ายที่สังกัดมีในพจนานุกรม", () => {
  const ids = JOBS.map((job) => job.id);
  assert.equal(new Set(ids).size, ids.length, "มี id ซ้ำ");

  const departments = new Set(Object.keys(th.careersPage.departments));

  for (const job of JOBS) {
    assert.ok(Number.isInteger(job.openings) && job.openings > 0, `${job.id}: จำนวนอัตราไม่ถูกต้อง`);
    assert.ok(departments.has(job.department), `${job.id}: ไม่รู้จักฝ่าย ${job.department}`);
  }
});

test("ยอดรวมตามประกาศต้นฉบับ: 20 ตำแหน่ง · 59 อัตรา · 11 ฝ่าย", () => {
  // ค่าอ้างอิงจากไฟล์ Work with Wai Wai.txt (นับด้วยมือแล้ว 2 รอบ)
  // ถ้าฝ่ายบุคคลแก้ประกาศ ต้องแก้ตัวเลขนี้พร้อมกันโดยตั้งใจ
  assert.equal(countPositions(), 20);
  assert.equal(totalOpenings(), 59);
  assert.equal(departmentsInUse().length, 11);

  // ยอดรวม = ผลบวกของทุกฝ่าย (กันการนับตกหล่น)
  const sumByDepartment = departmentsInUse().reduce(
    (sum, department) => sum + jobsInDepartment(department).reduce((s, job) => s + job.openings, 0),
    0,
  );
  assert.equal(sumByDepartment, totalOpenings());
});

test("พจนานุกรม careersPage: ทุกตำแหน่งต้องมีข้อความครบทั้งสองภาษา", () => {
  for (const [locale, messages] of [
    ["th", th],
    ["en", en],
  ] as const) {
    const m = messages.careersPage;
    const genderKeys = new Set(Object.keys(m.genders));

    for (const job of JOBS) {
      const copy = m.jobs[job.id];

      assert.ok(copy.title.trim().length > 0, `${locale}: ${job.id} ไม่มีชื่อตำแหน่ง`);
      assert.ok(copy.age.trim().length > 0, `${locale}: ${job.id} ไม่มีอายุ`);
      assert.ok(copy.qualifications.trim().length > 0, `${locale}: ${job.id} ไม่มีคุณสมบัติ`);
      assert.ok(genderKeys.has(copy.gender), `${locale}: ${job.id} เพศไม่ถูกต้อง`);
      assert.ok(
        copy.experience === null || copy.experience.trim().length > 0,
        `${locale}: ${job.id} ประสบการณ์ว่าง (ควรเป็น null ถ้าไม่ระบุ)`,
      );
    }

    for (const [name, value] of [
      ["meta.title", m.meta.title],
      ["meta.description", m.meta.description],
      ["eyebrow", m.eyebrow],
      ["title", m.title],
      ["intro", m.intro],
      ["boardTitle", m.boardTitle],
      ["boardIntro", m.boardIntro],
      ["filterGroup", m.filterGroup],
      ["filterAll", m.filterAll],
      ["positionUnit", m.positionUnit],
      ["openingsUnit", m.openingsUnit],
      ["empty", m.empty],
      ["notSpecified", m.notSpecified],
      ["applyTitle", m.applyTitle],
      ["applyIntro", m.applyIntro],
      ["companyName", m.companyName],
      ["address", m.address],
      ["contactPerson", m.contactPerson],
      ["aboutLink", m.aboutLink],
      ["note", m.note],
    ] as const) {
      assert.ok(value.trim().length > 0, `${locale}: careersPage.${name} ว่าง`);
    }
  }
});

test("ประสบการณ์: ต้นฉบับใช้ '-' เมื่อไม่ระบุ → ต้องแสดงคำจากพจนานุกรม ไม่ใช่ช่องว่าง", () => {
  const unset = JOBS.filter((job) => th.careersPage.jobs[job.id].experience === null);
  assert.ok(unset.length > 0, "ควรมีตำแหน่งที่ไม่ระบุประสบการณ์");

  for (const [locale, messages] of [
    ["th", th],
    ["en", en],
  ] as const) {
    const cards = buildBoard(messages).cards;

    for (const job of unset) {
      const card = cards.find((item) => item.id === job.id);
      assert.ok(card, `${locale}: ไม่พบการ์ด ${job.id}`);
      assert.equal(card.experienceLabel, messages.careersPage.notSpecified);
    }
  }
});

test("buildBoard: การ์ดครบทุกตำแหน่ง · ตัวกรอง 'ทั้งหมด' มาก่อนและนับถูก", () => {
  for (const [locale, messages] of [
    ["th", th],
    ["en", en],
  ] as const) {
    const board = buildBoard(messages);

    assert.equal(board.cards.length, JOBS.length, `${locale}: การ์ดไม่ครบ`);

    const first = board.filters[0];
    assert.ok(first, `${locale}: ไม่มีตัวกรอง`);
    assert.equal(first.id, "all");
    assert.equal(first.count, JOBS.length);

    // ตัวกรองทุกฝ่ายต้องมีจำนวน > 0 และผลรวมเท่ากับจำนวนตำแหน่งทั้งหมด
    const departments = board.filters.filter((filter) => filter.id !== "all");
    assert.equal(departments.length, departmentsInUse().length);

    for (const filter of departments) {
      assert.ok(filter.count > 0, `${locale}: ฝ่าย ${filter.id} มี 0 ตำแหน่ง`);
      assert.ok(filter.label.trim().length > 0, `${locale}: ฝ่าย ${filter.id} ไม่มีชื่อ`);
    }

    assert.equal(
      departments.reduce((sum, filter) => sum + filter.count, 0),
      JOBS.length,
    );
  }
});

test("filterCards ตรงกับ jobsInDepartment และ 'all' คืนทุกใบ", () => {
  const cards = buildBoard(th).cards;

  assert.equal(filterCards(cards, "all").length, cards.length);

  for (const department of departmentsInUse()) {
    assert.equal(
      filterCards(cards, department).length,
      jobsInDepartment(department).length,
      `ฝ่าย ${department}: จำนวนการ์ดกับข้อมูลไม่ตรงกัน`,
    );
    assert.ok(
      filterCards(cards, department).every((card) => card.departmentId === department),
      `ฝ่าย ${department}: มีการ์ดของฝ่ายอื่นหลุดมา`,
    );
  }
});

test("ข้อมูลติดต่อ: อีเมล/เบอร์โทรต้องใช้ได้จริง (มี @ และขึ้นต้นด้วย +66 สำหรับ tel:)", () => {
  assert.ok(CAREERS_CONTACT.email.includes("@"), "อีเมลไม่ถูกต้อง");
  assert.ok(CAREERS_CONTACT.phone.tel.startsWith("+66"), "tel: ต้องเป็นรูปแบบสากล");
  assert.ok(CAREERS_CONTACT.mobile.tel.startsWith("+66"), "tel: ต้องเป็นรูปแบบสากล");
  assert.ok(CAREERS_CONTACT.phone.ext.trim().length > 0, "ไม่มีเบอร์ต่อ");
});
