import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CONTACT_FIELDS,
  CONTACT_PHONES,
  CONTACT_PLANTS,
  CONTACT_TOPICS,
  MAP_IMAGE,
} from "@/features/contact/content";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

/** ขนาดจริงของไฟล์ JPEG (อ่าน marker SOF) */
function readJpegSize(filePath: string): { width: number; height: number } | null {
  const buffer = readFileSync(filePath);
  let offset = 2;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const isStartOfFrame =
      marker !== undefined && marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    const length = buffer.readUInt16BE(offset + 2);
    offset += 2 + length;
  }

  return null;
}

test("หัวข้อ 'เรื่องที่ติดต่อ': ต้องตรงกับฟอร์มต้นฉบับทั้ง 7 ข้อ เรียงตามเดิม", () => {
  // คัดจาก contact/formcontact.txt ตรง ๆ (ช่องว่างภายในข้อความต้องเหมือนต้นฉบับ)
  const sourceTopics = [
    "สอบถามผลิตภัณฑ์ และแจ้งปัญหา",
    "สั่งซื้อสินค้า (ในประเทศ)",
    "สั่งซื้อสินค้า (ต่างประเทศ)",
    "ขอการสนับสนุน การตลาดและประชาสัมพันธ์",
    "พนักงานขาย และหน่วยรถ",
    "เสนอสินค้า และวัตถุดิบ",
    "Quick Terrace",
  ];

  assert.equal(CONTACT_TOPICS.length, 7);
  assert.deepEqual(
    CONTACT_TOPICS.map((topic) => th.contactPage.topics[topic]),
    sourceTopics,
  );
});

test("ช่องในฟอร์ม: ต้องมีทั้ง 5 ช่อง (ชื่อ · อีเมล · เบอร์ติดต่อ · หัวข้อ · รายละเอียด)", () => {
  assert.deepEqual([...CONTACT_FIELDS], ["name", "email", "phone", "subject", "details"]);

  const labelKeys = {
    name: "nameLabel",
    email: "emailLabel",
    phone: "phoneFieldLabel",
    subject: "subjectLabel",
    details: "detailsLabel",
  } as const;
  const placeholderKeys = {
    name: "namePlaceholder",
    email: "emailPlaceholder",
    phone: "phonePlaceholder",
    subject: "subjectPlaceholder",
    details: "detailsPlaceholder",
  } as const;

  for (const [locale, messages] of [
    ["th", th],
    ["en", en],
  ] as const) {
    for (const field of CONTACT_FIELDS) {
      assert.ok(
        messages.contactPage[labelKeys[field]].trim().length > 0,
        `${locale}: ไม่มีป้ายของช่อง ${field}`,
      );
      assert.ok(
        messages.contactPage[placeholderKeys[field]].trim().length > 0,
        `${locale}: ไม่มี placeholder ของช่อง ${field}`,
      );
    }
  }
});

test("พจนานุกรม contactPage: ข้อความที่แสดงต้องครบทั้งสองภาษา", () => {
  for (const [locale, messages] of [
    ["th", th],
    ["en", en],
  ] as const) {
    const m = messages.contactPage;

    for (const [name, value] of [
      ["meta.title", m.meta.title],
      ["meta.description", m.meta.description],
      ["eyebrow", m.eyebrow],
      ["title", m.title],
      ["intro", m.intro],
      ["channelsTitle", m.channelsTitle],
      ["phoneLabel", m.phoneLabel],
      ["addressLabel", m.addressLabel],
      ["mapTitle", m.mapTitle],
      ["mapCaption", m.mapCaption],
      ["mapAlt", m.mapAlt],
      ["formTitle", m.formTitle],
      ["formIntro", m.formIntro],
      ["notice", m.notice],
      ["formStatus", m.formStatus],
      ["requiredNote", m.requiredNote],
      ["topicLabel", m.topicLabel],
      ["topicPlaceholder", m.topicPlaceholder],
      ["submit", m.submit],
      ["consent", m.consent],
      ["note", m.note],
    ] as const) {
      assert.ok(value.trim().length > 0, `${locale}: contactPage.${name} ว่าง`);
    }

    for (const topic of CONTACT_TOPICS) {
      assert.ok(m.topics[topic].trim().length > 0, `${locale}: หัวข้อ ${topic} ว่าง`);
    }

    for (const plant of CONTACT_PLANTS) {
      assert.ok(m[plant.nameKey].trim().length > 0, `${locale}: ไม่มีชื่อ ${plant.id}`);
      assert.ok(m[plant.addressKey].trim().length > 0, `${locale}: ไม่มีที่อยู่ ${plant.id}`);
    }
  }
});

test("notice: ต้องบอกชัดว่าเป็นตัวอย่าง ยังไม่เปิดใช้งาน และรอการอนุมัติ", () => {
  assert.ok(th.contactPage.notice.includes("ตัวอย่าง"), "th ต้องมีคำว่า ตัวอย่าง");
  assert.ok(th.contactPage.notice.includes("ยังไม่เปิดใช้งาน"), "th ต้องบอกว่ายังไม่เปิดใช้งาน");
  assert.ok(th.contactPage.notice.includes("รอการอนุมัติ"), "th ต้องบอกว่ารอการอนุมัติ");

  assert.ok(en.contactPage.notice.toLowerCase().includes("sample"), "en ต้องมี sample");
  assert.ok(en.contactPage.notice.toLowerCase().includes("not live"), "en ต้องบอกว่า not live");
  assert.ok(en.contactPage.notice.toLowerCase().includes("pending approval"), "en ต้องบอกว่า pending approval");
});

test("แผนที่: ไฟล์ต้องมีอยู่จริง · เป็น JPEG · ขนาดที่ประกาศต้องตรงกับไฟล์จริง", () => {
  assert.ok(MAP_IMAGE.src.startsWith("/contact/"), "path ต้องอยู่ใต้ /contact/");

  const filePath = path.join(PROJECT_ROOT, "public", MAP_IMAGE.src.replace(/^\//, ""));
  assert.ok(existsSync(filePath), `ไม่พบไฟล์ ${filePath}`);

  const buffer = readFileSync(filePath);
  assert.equal(buffer.subarray(0, 2).toString("hex"), "ffd8", `${MAP_IMAGE.src} ไม่ใช่ JPEG`);

  const actual = readJpegSize(filePath);
  assert.ok(actual, "อ่านขนาดภาพไม่สำเร็จ");
  assert.equal(MAP_IMAGE.width, actual.width, `width ประกาศ ${MAP_IMAGE.width} แต่ไฟล์จริง ${actual.width}`);
  assert.equal(MAP_IMAGE.height, actual.height, `height ประกาศ ${MAP_IMAGE.height} แต่ไฟล์จริง ${actual.height}`);

  // ไฟล์ที่ใช้จริงต้องย่อมาแล้ว ไม่ควรใหญ่ระดับต้นฉบับ 6MB
  assert.ok(buffer.length < 1_000_000, `ไฟล์ใหญ่เกินไป (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
});

test("เบอร์โทร: ลิงก์ tel: ต้องเป็นรูปแบบสากลและไม่ซ้ำกัน", () => {
  assert.equal(CONTACT_PHONES.length, 2);

  const tels = CONTACT_PHONES.map((phone) => phone.tel);
  assert.equal(new Set(tels).size, tels.length, "มีเบอร์ซ้ำ");

  for (const phone of CONTACT_PHONES) {
    assert.ok(phone.tel.startsWith("+66"), `${phone.display}: tel: ต้องขึ้นต้นด้วย +66`);
    assert.ok(/^\+\d{9,}$/.test(phone.tel), `${phone.display}: รูปแบบ tel: ไม่ถูกต้อง`);
    assert.ok(phone.display.trim().length > 0, "ไม่มีข้อความแสดงเบอร์");
  }
});
