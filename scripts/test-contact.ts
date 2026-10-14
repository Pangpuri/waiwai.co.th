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
import { publishGoesLive } from "@/lib/blocks/live-scope";
import { contactChannelCards, buildContactDocument } from "@/lib/contact/document";
import { localizedBlockHref } from "@/lib/blocks/href";
import { documentErrorsOf, validateDocument } from "@/lib/blocks/validate";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { buildBlockTemplate } from "@/lib/blocks/templates";

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

test("contact: ต้องไม่มีป้าย \"ตัวอย่าง/ยังไม่เปิดใช้งาน\" แล้ว — ฟอร์มทำงานจริงตั้งแต่รอบที่ 66 (มติเจ้าของรอบที่ 267)", () => {
  const source = readFileSync(path.join(PROJECT_ROOT, "app/[lang]/contact/page.tsx"), "utf8");
  assert.ok(!source.includes("SampleNotice"), "หน้าติดต่อต้องไม่เรนเดอร์ป้ายตัวอย่างอีก");
  assert.ok(source.includes('formKind="contact"'), "ฟอร์มติดต่อจริงต้องยังอยู่ (ส่งเข้า DB)");

  const dictionary = JSON.stringify(th.contactPage) + JSON.stringify(en.contactPage);
  for (const stale of ["ยังไม่เปิดใช้งาน", "รอการอนุมัติ", "not live", "pending approval"]) {
    assert.ok(!dictionary.includes(stale), `พจนานุกรมต้องไม่มีข้อความล้าสมัย: ${stale}`);
  }
  /* หมายเหตุ PDPA ของฟอร์มจริงยังต้องอยู่ (บอกว่าเก็บข้อมูลและขอลบได้) */
  assert.ok(th.contactPage.note.trim().length > 0 && en.contactPage.note.trim().length > 0);
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

/* ── รอบที่ 267 (มติเจ้าของ D27): เอกสารตั้งต้นของหน้า /contact + ตัวนำเข้า ───── */

test("contact: เอกสารตั้งต้น 4 บล็อก (แบนเนอร์ · ช่องทางติดต่อ · ฟอร์ม · แผนที่) ผ่าน parser+validator ของระบบเอง 0 error", () => {
  const document = buildContactDocument();
  assert.equal(document.page, "contact");
  assert.deepEqual(
    document.blocks.map((block) => block.type),
    ["hero", "cards", "form", "map"],
    "ลำดับบล็อกตั้งต้นต้องตรงกับหน้าเว็บที่ใช้งานอยู่",
  );

  /* ⚠️ ต้องรันผ่านด่านของระบบเอง — บทเรียนรอบ 257: เอกสารที่มี error จะกดเผยแพร่ไม่ได้ */
  const parsed = parseBlockDocument("contact", JSON.parse(JSON.stringify(document)) as unknown);
  assert.ok(parsed.ok, "เอกสารตั้งต้นต้องผ่าน parser");
  if (!parsed.ok) return;
  const errors = documentErrorsOf(validateDocument(parsed.document));
  assert.equal(errors.length, 0, `เอกสารตั้งต้นต้องไม่มี error: ${errors.map((entry) => entry.code).join(", ")}`);
});

test("contact: การ์ดช่องทางติดต่อ — เบอร์โทรทุกเบอร์กดโทรได้ (tel:) · ที่อยู่เป็นข้อความ", () => {
  const cards = contactChannelCards();
  assert.equal(cards.length, CONTACT_PHONES.length + CONTACT_PLANTS.length, "1 เบอร์ = 1 การ์ด + 1 โรงงาน = 1 การ์ด");

  const telHrefs = cards.map((card) => card.href).filter((href) => href.startsWith("tel:"));
  assert.deepEqual(
    telHrefs,
    CONTACT_PHONES.map((phone) => `tel:${phone.tel}`),
    "ทุกเบอร์ต้องมีลิงก์โทรของตัวเอง (ห้ามยุบรวมเป็นเบอร์เดียว)",
  );
  for (const [index, phone] of CONTACT_PHONES.entries()) {
    assert.equal(cards[index]?.body.th, phone.display, "เนื้อการ์ดต้องเป็นเบอร์ที่แสดงบนหน้าเว็บ");
  }
  for (const plant of CONTACT_PLANTS) {
    const card = cards.find((entry) => entry.title.th === th.contactPage[plant.nameKey]);
    assert.ok(card !== undefined, `ต้องมีการ์ดของ ${plant.id}`);
    assert.equal(card.href, "", "ที่อยู่ไม่ใช่ลิงก์");
    assert.ok(card.body.th.includes("นครปฐม"), "ที่อยู่ต้องมีจังหวัดตามข้อมูลจริง");
  }

  /* `tel:` ต้องไม่ถูกเติม prefix ภาษา (ไม่งั้นลิงก์โทรพัง) */
  assert.equal(localizedBlockHref("tel:+6628115101", "en"), "tel:+6628115101");
});

test("contact: เทมเพลตในทะเบียน = เอกสารตั้งต้นตัวเดียวกัน (แหล่งเดียว — ไม่มีชุดเทมเพลตซ้อนอีก)", () => {
  assert.deepEqual(buildBlockTemplate("contact"), buildContactDocument(), "ปุ่ม 'เริ่มจากเทมเพลต' ต้องได้ชุดเดียวกับตัวนำเข้า");
});

test("contact: เอกสารตั้งต้นต้องไม่มีข้อความ 'ตัวอย่าง/ยังไม่เปิดใช้งาน' และไม่มีการปิดปุ่มส่ง", () => {
  const serialized = JSON.stringify(buildContactDocument());
  for (const stale of ["ตัวอย่าง", "ยังไม่เปิดใช้งาน", "sample", "not live", "pending approval"]) {
    assert.ok(!serialized.includes(stale), `เอกสารตั้งต้นต้องไม่มีข้อความล้าสมัย: ${stale}`);
  }
});

test("contact: ตัวนำเข้าเขียนเฉพาะฉบับร่าง · ต้องตรวจ validator ก่อนเขียน · ไม่ทับงานคน", () => {
  const source = readFileSync(path.join(PROJECT_ROOT, "scripts/import-contact.ts"), "utf8");
  assert.ok(source.includes('import { parseBlockDocument }'), "ต้อง parse ด้วยตัวตรวจกลาง");
  assert.ok(source.includes("validateDocument("), "ต้องรัน validator ก่อนเขียน (บทเรียนรอบ 257)");
  assert.ok(source.includes('loadDocumentRow("contact", "draft")'), "ต้องอ่านฉบับร่างเดิมก่อน");
  assert.ok(source.includes("--force"), "ต้องมีทางเลือก --force สำหรับทับงานคน");
  assert.ok(source.includes("saveDraft("), "เขียนด้วย saveDraft ของ repository (มีประวัติ/ผู้เขียน)");
  assert.ok(!/publishDraft|setPageLive/.test(source), "ห้ามเผยแพร่เอง — การขึ้นเว็บต้องกดจากหลังบ้าน");

  const pkg = JSON.parse(readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8")) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  assert.ok(pkg.scripts["contact:import"]?.includes("scripts/import-contact.ts"), "ต้องมีสคริปต์ npm run contact:import");
});

test("contact: กดเผยแพร่ = ขึ้นเว็บทันที (มติ D27 ข้อ 3) — อยู่ในนโยบายกลาง", () => {
  assert.equal(publishGoesLive("contact"), true, "contact ต้องอยู่ใน PUBLISH_GOES_LIVE_PAGES");
  assert.equal(publishGoesLive("news"), false, "หน้าอื่นต้องไม่ถูกเปลี่ยนนโยบายไปด้วย");
});

test("a11y: หน้าที่เรนเดอร์จากบล็อกต้องมี h1 พอดี 1 อัน (ส่ง heading ให้ตัวเรนเดอร์)", () => {
  /* เคสจริงรอบ 267: เผยแพร่หน้า /contact แล้วหน้าเว็บ **ไม่มี h1 เลย** เพราะไม่ได้ส่ง `heading` */
  const contact = readFileSync(path.join(PROJECT_ROOT, "app/[lang]/contact/page.tsx"), "utf8");
  assert.ok(
    contact.includes("heading={messages.contactPage.title}"),
    "หน้า /contact ต้องส่ง heading ให้ BlockDocumentView (เอกสารบล็อกไม่มี h1 ในตัวเอง)",
  );

  /* หน้าแรกมี <h1> ตัวจริงจาก Hero อยู่แล้ว ⇒ ห้ามใส่ h1 ซ้ำ (sr-only) เป็นอันขาด */
  const home = readFileSync(path.join(PROJECT_ROOT, "app/[lang]/page.tsx"), "utf8");
  const start = home.indexOf("<BlockDocumentView");
  const call = home.slice(start, home.indexOf("/>", start));
  assert.ok(start > 0 && call.length > 0, "ต้องพบการเรียก BlockDocumentView ในหน้าแรก");
  assert.ok(!call.includes("heading="), "หน้าแรกต้องไม่ส่ง heading (Hero เรนเดอร์ h1 อยู่แล้ว — ไม่งั้นได้ 2 h1)");
});
