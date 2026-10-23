import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { buildFooterColumns } from "@/features/shell/nav";
import { defaultFooterConfig, parseFooterConfig, type FooterConfig } from "@/lib/chrome/footer";
import { resolveFooterView } from "@/lib/chrome/footer-view";
import { th } from "@/lib/i18n/messages/th";
import { SITE } from "@/lib/site";

/**
 * เทสต์ "ภาษาอังกฤษของท้ายเว็บ" (รอบที่ 311)
 *
 * ที่มา (เจ้าของ): *"มาลุยท้ายเว็บกันครับ"* → เจอว่าหน้าจอแก้ท้ายเว็บแก้ได้แค่ภาษาไทย
 * และค่า `en` ในฐานข้อมูลเป็นสำเนาของไทยทุกช่อง ⇒ `/en` แสดงท้ายเว็บภาษาไทยทั้งแถบ
 *
 * เทสต์ชุดนี้ล็อก 3 อย่าง:
 *  1. ชั้นข้อมูลรับ/เก็บค่า EN ได้ครบทุกช่อง (ไม่ถูกตัดทิ้งตอน parse)
 *  2. ตัวเรนเดอร์เลือก EN เมื่อมี และถอยไปไทยเมื่อว่าง (ห้ามแสดงช่องว่าง)
 *  3. หน้าจอแก้มีช่อง EN ครบทุกจุด และ **ไม่มี** หน้าต่างเตือน "ช่องที่ยังไม่ได้แปล" (ถอดออกตามคำสั่งเจ้าของ รอบที่ 316)
 */

const ROOT = process.cwd();
const sourceOf = (relative: string): string => readFileSync(path.join(ROOT, relative), "utf8");

const fallbackOf = () => ({
  columns: buildFooterColumns("th").map((column) => ({
    id: column.id,
    title: th.footer[column.titleKey],
    links: column.links.map((link) => ({ id: `${column.id}-${link.labelKey}`, label: th.footer.links[link.labelKey], href: link.href })),
  })),
  socials: SITE.social.map((item) => ({ id: item.id, label: item.label, href: item.href })),
  contact: { address: SITE.contact.address, phone: SITE.contact.phone, email: SITE.contact.email },
});

/** ท้ายเว็บที่แปลครบทุกช่อง (ใช้เป็นฐานของเทสต์) */
function fullyTranslated(): FooterConfig {
  const base = defaultFooterConfig(th);
  return {
    ...base,
    about: { th: "ไวไว แบรนด์อาหารไทย", en: "Wai Wai is a Thai food brand" },
    contact: {
      ...base.contact,
      address: { th: "42/1 ถนนเพชรเกษม", en: "42/1 Phetkasem Road" },
    },
    groups: base.groups.map((group, index) => ({
      ...group,
      title: { th: group.title.th, en: `Group ${index + 1}` },
      links: group.links.map((link, linkIndex) => ({
        ...link,
        label: { th: link.label.th, en: `Link ${index + 1}.${linkIndex + 1}` },
      })),
    })),
    socials: [
      /* ⚠️ `SITE.social` ว่างโดยตั้งใจ (ยังไม่มีข้อมูลยืนยัน) ⇒ เทสต์ต้องสร้างช่องทางของตัวเอง */
      { id: "line", label: { th: "ไลน์", en: "LINE" }, href: "https://line.me/example", icon: "line" },
    ],
    rights: { th: "สงวนลิขสิทธิ์ทั้งหมด", en: "All rights reserved" },
  };
}

test("footer EN: parse เก็บค่าอังกฤษครบทุกช่อง (ไม่ถูกตัดทิ้ง)", () => {
  const raw = fullyTranslated();
  const outcome = parseFooterConfig(raw, th);

  assert.equal(outcome.ok, true);
  assert.ok(outcome.ok);
  assert.equal(outcome.config.about.en, "Wai Wai is a Thai food brand");
  assert.equal(outcome.config.contact.address.en, "42/1 Phetkasem Road");
  assert.equal(outcome.config.groups[0]?.title.en, "Group 1");
  assert.equal(outcome.config.groups[0]?.links[0]?.label.en, "Link 1.1");
  assert.equal(outcome.config.socials[0]?.label.en, "LINE");
  assert.equal(outcome.config.rights.en, "All rights reserved");
});

test("footer EN: ตัวเรนเดอร์เลือกอังกฤษเมื่อมีค่า", () => {
  const view = resolveFooterView(fullyTranslated(), "en", th, fallbackOf());

  assert.equal(view.about, "Wai Wai is a Thai food brand");
  assert.equal(view.contact.address, "42/1 Phetkasem Road");
  assert.equal(view.groups[0]?.title, "Group 1");
  assert.equal(view.groups[0]?.links[0]?.label, "Link 1.1");
  assert.equal(view.socials[0]?.label, "LINE");
  assert.equal(view.rights, "All rights reserved");
});

test("footer EN: ช่องอังกฤษว่าง = ถอยไปใช้ไทย (ไม่โชว์ช่องว่าง)", () => {
  const base = defaultFooterConfig(th);
  const emptied: FooterConfig = {
    ...base,
    about: { th: "ข้อความไทย", en: "" },
    contact: { ...base.contact, address: { th: "ที่อยู่ไทย", en: "   " } },
    rights: { th: "ลิขสิทธิ์ไทย", en: "" },
  };

  const view = resolveFooterView(emptied, "en", th, fallbackOf());
  assert.equal(view.about, "ข้อความไทย");
  assert.equal(view.contact.address, "ที่อยู่ไทย");
  assert.equal(view.rights, "ลิขสิทธิ์ไทย");

  /* ภาษาไทยยังใช้ค่าไทยเสมอ ไม่ขึ้นกับ EN */
  const thView = resolveFooterView(fullyTranslated(), "th", th, fallbackOf());
  assert.equal(thView.about, "ไวไว แบรนด์อาหารไทย");
  assert.equal(thView.contact.address, "42/1 ถนนเพชรเกษม");
});

test("หน้าจอหลังบ้าน: มีช่องอังกฤษครบทุกจุด + ไม่มีหน้าต่างเตือน 'ยังไม่ได้แปล' แล้ว", () => {
  const editor = sourceOf("features/admin/ui/footer-editor.tsx");

  const bindings = [
    "value={config.about.en}",
    "value={config.contact.address.en}",
    "value={group.title.en}",
    "value={link.label.en}",
    "value={social.label.en}",
    "value={config.rights.en}",
  ];
  for (const binding of bindings) {
    assert.ok(editor.includes(binding), `ต้องมีช่องอังกฤษ: ${binding}`);
  }

  /*
    รอบที่ 316 (เจ้าของ): *"หน้าต่างเตือนส่วนนี้เอาออกได้เลยจากการตั้งค่าท้ายเว็บ"*
    ⇒ ห้ามมีกล่องนับ "ช่องที่ยังไม่ได้แปล" กลับมา + ห้ามเรียกตรรกะกลางที่ถอดออกแล้ว
  */
  assert.ok(!editor.includes("untranslatedFooterFields"), "ต้องไม่เหลือตรรกะนับช่องที่ยังไม่แปล");
  assert.ok(!editor.includes("footerUntranslatedLabel"), "ต้องไม่เหลือหัวข้อ 'ช่องที่ยังไม่ได้แปล'");
  assert.ok(!editor.includes("footerUntranslatedHint"), "ต้องไม่เหลือคำอธิบายที่ถอดออกแล้ว");
});

test("พจนานุกรม: ป้ายภาษาไทย/อังกฤษของท้ายเว็บมีทั้งสองภาษา (ไม่มีคีย์กำพร้า)", () => {
  const thSource = sourceOf("lib/i18n/messages/areas/th/admin.ts");
  const enSource = sourceOf("lib/i18n/messages/areas/en/admin.ts");

  for (const key of ["footerLangTh", "footerLangEn", "footerLogo", "footerNoLogo"]) {
    assert.ok(thSource.includes(`${key}:`), `th: ขาดคีย์ ${key}`);
    assert.ok(enSource.includes(`${key}:`), `en: ขาดคีย์ ${key}`);
  }

  /* คีย์ที่ถอดออกในรอบ 316 ต้องไม่ค้างอยู่ในพจนานุกรม (ด่าน check:i18n จะฟ้อง orphan) */
  for (const key of ["footerUntranslatedLabel", "footerUntranslatedHint"]) {
    assert.ok(!thSource.includes(`${key}:`), `th: ยังมีคีย์ที่ถอดออกแล้ว ${key}`);
    assert.ok(!enSource.includes(`${key}:`), `en: ยังมีคีย์ที่ถอดออกแล้ว ${key}`);
  }
});
