import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CERTIFICATIONS,
  buildCertificationCards,
  formatValidityLabel,
  type Certification,
} from "@/features/about/certifications";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

/** ไฟล์ภาพต้องมีจริงใน public/ — กัน path พิมพ์ผิดที่จะพังเงียบ ๆ ตอน build */
test("CERTIFICATIONS: ทุกไฟล์ภาพมีอยู่จริงใน public/", () => {
  for (const item of CERTIFICATIONS) {
    assert.ok(
      item.image.src.startsWith("/certifications/"),
      `${item.id}: path ต้องอยู่ใต้ /certifications/`,
    );

    const filePath = path.join(PROJECT_ROOT, "public", item.image.src.replace(/^\//, ""));
    assert.ok(existsSync(filePath), `${item.id}: ไม่พบไฟล์ ${filePath}`);
  }
});

test("CERTIFICATIONS: id ไม่ซ้ำ และมีข้อความครบทั้งสองภาษา", () => {
  const ids = CERTIFICATIONS.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, "มี id ซ้ำในรายการใบรับรอง");

  for (const item of CERTIFICATIONS) {
    for (const [locale, messages] of [
      ["th", th],
      ["en", en],
    ] as const) {
      const copy = messages.about.certifications.items[item.id];
      assert.ok(copy.title.trim().length > 0, `${locale} ขาดชื่อมาตรฐาน ${item.id}`);
      assert.ok(copy.issuer.trim().length > 0, `${locale} ขาดผู้ออกใบรับรอง ${item.id}`);
      assert.ok(copy.certificateNo.trim().length > 0, `${locale} ขาดเลขที่ใบรับรอง ${item.id}`);
    }
  }
});

test("CERTIFICATIONS: ขอบเขตโรงงานชี้คีย์ที่มีอยู่ในพจนานุกรมทั้งสองภาษา", () => {
  for (const item of CERTIFICATIONS) {
    for (const [locale, messages] of [
      ["th", th],
      ["en", en],
    ] as const) {
      const label = messages.about.certifications.sites[item.site];
      assert.ok(label.trim().length > 0, `${locale} ขาดชื่อขอบเขต ${item.site}`);
    }
  }
});

test("CERTIFICATIONS: ขนาดภาพต้องเป็นจำนวนเต็มบวก และวันที่ต้องเรียงถูก", () => {
  for (const item of CERTIFICATIONS) {
    assert.ok(Number.isInteger(item.image.width) && item.image.width > 0, `${item.id}: กว้างผิด`);
    assert.ok(Number.isInteger(item.image.height) && item.image.height > 0, `${item.id}: สูงผิด`);

    if (item.validFrom && item.validUntil) {
      const from = new Date(item.validFrom).getTime();
      const until = new Date(item.validUntil).getTime();

      assert.ok(!Number.isNaN(from), `${item.id}: validFrom แปลงไม่ได้`);
      assert.ok(!Number.isNaN(until), `${item.id}: validUntil แปลงไม่ได้`);
      assert.ok(from < until, `${item.id}: วันเริ่มต้องอยู่ก่อนวันสิ้นสุด`);
    }
  }
});

test("formatValidityLabel: วันที่ใช้ไม่ได้ต้องไม่ทำให้หน้าจอขึ้น Invalid Date", () => {
  assert.equal(formatValidityLabel(undefined, undefined, "th"), "");
  assert.equal(formatValidityLabel("ไม่ใช่วันที่", undefined, "en"), "");

  // มีแต่วันเริ่มที่ใช้ได้ → คืนเฉพาะวันเริ่ม ไม่ใช่สตริงที่มี "Invalid Date" ติดมา
  const fromOnly = formatValidityLabel("2024-03-28", undefined, "th");
  assert.ok(fromOnly.length > 0, "ควรคืนวันเริ่มที่ใช้ได้");
  assert.equal(formatValidityLabel("2024-03-28", "ไม่ใช่วันที่", "th"), fromOnly);
});

test("formatValidityLabel: แสดงเป็นพุทธศักราชในไทย และค.ศ. ในอังกฤษ", () => {
  const thai = formatValidityLabel("2024-03-28", "2027-03-27", "th");
  const english = formatValidityLabel("2024-03-28", "2027-03-27", "en");

  assert.ok(thai.includes("2567"), `ไทยควรเป็น พ.ศ. 2567 → ได้ "${thai}"`);
  assert.ok(english.includes("2024"), `อังกฤษควรเป็น ค.ศ. 2024 → ได้ "${english}"`);
  assert.notEqual(thai, english);
});

test("buildCertificationCards: แปลข้อความ + แนบข้อมูลภาพให้ Client Component", () => {
  const cards = buildCertificationCards(th, "th");

  assert.equal(cards.length, CERTIFICATIONS.length);

  for (const card of cards) {
    assert.ok(card.src.startsWith("/certifications/"), `${card.id}: src ผิด`);
    assert.ok(card.title.trim().length > 0, `${card.id}: ไม่มีชื่อมาตรฐาน`);
    assert.ok(card.issuer.trim().length > 0, `${card.id}: ไม่มีผู้ออกใบรับรอง`);
    assert.ok(card.certificateNo.trim().length > 0, `${card.id}: ไม่มีเลขที่ใบรับรอง`);
    assert.ok(card.siteLabel.trim().length > 0, `${card.id}: ไม่มีขอบเขต`);
  }
});

test("buildCertificationCards: ใบที่ไม่มีวันที่ต้องได้ validLabel เป็นสตริงว่าง (ให้ผู้เรียกซ่อนบรรทัด)", () => {
  const items: readonly Certification[] = [
    { id: "iso9001Annex", image: { src: "/certifications/iso-9001-2015-annex.jpg", width: 10, height: 10 }, site: "both" },
  ];

  const cards = buildCertificationCards(en, "en", items);

  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.validLabel, "");
});
