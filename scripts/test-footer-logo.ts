import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { buildFooterColumns } from "@/features/shell/nav";
import {
  defaultFooterConfig,
  footerErrorsOf,
  parseFooterConfig,
  validateFooterConfig,
  type FooterConfig,
} from "@/lib/chrome/footer";
import { resolveFooterView } from "@/lib/chrome/footer-view";
import { FOOTER_LOGO_HEIGHTS, LOGO_SIZES, logoHeightClass } from "@/lib/chrome/logo-size";
import { th } from "@/lib/i18n/messages/th";
import { SITE } from "@/lib/site";

/**
 * เทสต์ "โลโก้ท้ายเว็บ" (รอบที่ 316)
 *
 * ที่มา (เจ้าของ): *"ส่วนภาพสามารถทำให้อัพโหลดได้แบบส่วนหัวเว็บได้ไหมครับ"*
 * ⇒ ท้ายเว็บเคยมีแค่ช่อง "ขนาดโลโก้" แต่ **ไม่มีที่ให้เปลี่ยนไฟล์โลโก้เลย**
 *    (โลโก้มาจาก `/media/...` ที่สคริปต์นำเข้าเขียนไว้ หรือโลโก้ในโค้ดเมื่อยังไม่ตั้งค่า)
 *
 * เทสต์ชุดนี้ล็อกไว้ 4 อย่าง:
 *  1. ชั้นข้อมูลรับ/เก็บพาธ + คำอธิบายภาพไทย/อังกฤษได้ (มติ D9: เก็บเป็นพาธ ไม่ใช่ URL)
 *  2. โลโก้ที่ไม่มีคำอธิบายภาพไทย = **error** (a11y) และพาธเต็ม URL = error
 *  3. ตัวเรนเดอร์ส่งโลโก้ + คลาสความสูงตามขนาดที่เลือก
 *  4. หน้าจอหลังบ้านใช้ช่องอัปโหลดตัวเดียวกับหัวเว็บ (`ImageDrop`) — ไม่มีช่องที่กดแล้วไม่มีผล
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

function withLogo(overrides: Partial<FooterConfig> = {}): FooterConfig {
  return {
    ...defaultFooterConfig(th),
    logo: { path: "/media/footerLogo01", altTh: "โลโก้ไวไว", altEn: "Wai Wai logo" },
    ...overrides,
  };
}

test("footer logo: parse เก็บพาธ + คำอธิบายภาพทั้งสองภาษา", () => {
  const outcome = parseFooterConfig(withLogo(), th);
  assert.equal(outcome.ok, true);
  assert.ok(outcome.ok);
  assert.deepEqual(outcome.config.logo, { path: "/media/footerLogo01", altTh: "โลโก้ไวไว", altEn: "Wai Wai logo" });
});

test("footer logo: ไม่มีโลโก้ (null) = ยังใช้โลโก้แบรนด์ในโค้ดได้ตามเดิม", () => {
  const outcome = parseFooterConfig({ ...defaultFooterConfig(th), logo: null }, th);
  assert.equal(outcome.ok, true);
  assert.ok(outcome.ok);
  assert.equal(outcome.config.logo, null);

  const view = resolveFooterView(outcome.config, "th", th, fallbackOf());
  assert.equal(view.logo, null, "ไม่ตั้งโลโก้ ⇒ ตัวเรนเดอร์ต้องถอยไปใช้ BrandMark");
});

test("footer logo: validator บังคับคำอธิบายภาพไทย + ห้ามเก็บ URL เต็ม (มติ D9)", () => {
  const base = withLogo();

  assert.deepEqual(footerErrorsOf(validateFooterConfig(base)), []);

  const noAlt = footerErrorsOf(
    validateFooterConfig({ ...base, logo: { path: "/media/footerLogo01", altTh: "  ", altEn: "" } }),
  );
  assert.ok(noAlt.some((issue) => issue.code === "missing-alt"), "โลโก้ต้องมีคำอธิบายภาพไทย");

  const url = footerErrorsOf(
    validateFooterConfig({ ...base, logo: { path: "https://example.com/logo.png", altTh: "โลโก้", altEn: "" } }),
  );
  assert.ok(url.some((issue) => issue.code === "media-path-is-url"), "ห้ามเก็บ URL เต็มแทนพาธ");
});

test("footer logo: ตัวเรนเดอร์ส่งโลโก้ + ความสูงตามขนาดที่เลือก", () => {
  for (const size of LOGO_SIZES) {
    const view = resolveFooterView(withLogo({ logoSize: size }), "th", th, fallbackOf());
    assert.equal(view.logo?.path, "/media/footerLogo01");
    assert.equal(view.logoHeightClass, logoHeightClass(FOOTER_LOGO_HEIGHTS, size));
  }

  /* ขนาดต้องเรียงจากเล็ก → ใหญ่จริง (กันกลับไปเป็นคู่ที่ชนกันแบบรอบ 310) */
  const small = resolveFooterView(withLogo({ logoSize: "sm" }), "th", th, fallbackOf()).logoHeightClass;
  const large = resolveFooterView(withLogo({ logoSize: "lg" }), "th", th, fallbackOf()).logoHeightClass;
  assert.notEqual(small, large);
});

test("หน้าจอหลังบ้าน: ใช้ช่องอัปโหลดตัวเดียวกับหัวเว็บ (ImageDrop) + ไม่มีช่องลายน้ำที่ไม่มีผล", () => {
  const footer = sourceOf("features/admin/ui/footer-editor.tsx");
  const navbar = sourceOf("features/admin/ui/navbar-editor.tsx");

  /* ช่องอัปโหลด/ลากวาง/เลือกจากคลัง — ตัวเดียวกับที่หัวเว็บใช้ */
  assert.ok(footer.includes('import { ImageDrop } from "@/features/admin/ui/image-drop"'), "ต้องใช้ ImageDrop");
  assert.ok(footer.includes("<ImageDrop"), "ต้องมีช่องอัปโหลดโลโก้ในหน้าจอ");
  assert.ok(footer.includes("value={"), "ต้องผูกค่าที่แสดงกับ config");
  assert.ok(footer.includes("config.logo"), "ต้องอ่าน/เขียน config.logo");
  assert.ok(footer.includes("strings.footerLogo"), "ต้องมีหัวข้อช่องโลโก้ท้ายเว็บ");
  assert.ok(footer.includes("strings.footerNoLogo"), "ต้องบอกว่าไม่มีโลโก้แล้วระบบใช้อะไร");

  /* ท้ายเว็บไม่ได้ใช้ลายน้ำ ⇒ ไม่แสดงสวิตช์ที่กดแล้วไม่มีผล (ทั้งสองส่วนกลาง) */
  assert.ok(footer.includes("showWatermark={false}"), "ท้ายเว็บต้องไม่แสดงช่องลายน้ำ");
  assert.ok(navbar.includes("showWatermark={false}"), "แถบเมนูต้องไม่แสดงช่องลายน้ำเช่นกัน");
});

test("ตัวเรนเดอร์หน้าเว็บ: ท้ายเว็บใช้ view.logo (โลโก้ที่อัปโหลด) ไม่ได้ฝังไฟล์ตายตัว", () => {
  const renderer = sourceOf("features/shell/ui/site-footer.tsx");

  assert.ok(renderer.includes("view.logo"), "ต้องอ้างโลโก้จากค่าตั้ง");
  assert.ok(renderer.includes("view.logo.path"), "ต้องใช้พาธจากค่าตั้ง");
  assert.ok(renderer.includes("view.logo.altEn"), "ต้องมีคำอธิบายภาพอังกฤษ (ถอยไทยเมื่อว่าง)");
  assert.ok(renderer.includes("view.logoHeightClass"), "ความสูงต้องมาจากขนาดที่เลือก");
});
