import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { buildFooterColumns, buildHeaderCta, buildPrimaryNav } from "@/features/shell/nav";
import { defaultFooterConfig } from "@/lib/chrome/footer";
import { resolveFooterView } from "@/lib/chrome/footer-view";
import { defaultNavbarConfig } from "@/lib/chrome/navbar";
import { resolveNavbarView } from "@/lib/chrome/navbar-view";
import { th } from "@/lib/i18n/messages/th";
import { SITE } from "@/lib/site";

/**
 * เทสต์ "ตัวอักษรบนพื้นแบรนด์ต้องไม่จม" (รอบที่ 313)
 *
 * 🐞 เคสจริงจากเจ้าของ: *"ส่วนของแดงแบรนด์ ตัวอักษรจม เพราะอักษรเป็นสีดำ"*
 * - ดำ `--fg` (#17161a) บนแดง `--brand-red` (#e60012) = **3.75:1** ⇒ ไม่ผ่าน AA (4.5:1)
 * - ขาว `--on-brand` บนแดง = **4.80:1** ⇒ ผ่าน AA
 *
 * เทสต์ชุดนี้ล็อก 3 อย่าง:
 *  1. token ต้องผ่าน AA จริง (คำนวณจากค่าใน `app/globals.css` — ไม่ hardcode ตัวเลขไว้ในเทสต์)
 *  2. โซนที่พื้นเป็นแดง/ดำ ต้องสลับ "ชุดคลาส" ของลูกให้เป็น on-brand (ไม่ปล่อยให้ใช้ `text-fg`)
 *  3. ปุ่มแบรนด์บนพื้นแดงต้องไม่เป็นแดงบนแดง (ต้องกลับด้านเป็นปุ่มขาว)
 */

const ROOT = process.cwd();
const sourceOf = (relative: string): string => readFileSync(path.join(ROOT, relative), "utf8");

function tokenOf(css: string, name: string): string {
  const match = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  assert.ok(match !== null, `ไม่พบ token ${name} ใน app/globals.css`);
  return (match[1] as string).toLowerCase();
}

function luminance(hex: string): number {
  const channels = (hex.replace("#", "").match(/../g) ?? []).map((part) => Number.parseInt(part, 16) / 255);
  const linear = channels.map((value) => (value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)));
  return 0.2126 * (linear[0] as number) + 0.7152 * (linear[1] as number) + 0.0722 * (linear[2] as number);
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const CSS = sourceOf("app/globals.css");
const AA_NORMAL_TEXT = 4.5;

test("★ token: ขาว --on-brand บนแดง --brand-red ต้องผ่าน AA (และดำ --fg ต้องไม่ผ่าน = ต้นเหตุเดิม)", () => {
  const brandRed = tokenOf(CSS, "--brand-red");
  const onBrand = tokenOf(CSS, "--on-brand");
  const foreground = tokenOf(CSS, "--fg");

  assert.equal(onBrand, "#ffffff", "ตัวอักษรบนพื้นแบรนด์ต้องเป็นขาวบริสุทธิ์ (4.80:1)");

  const onBrandRatio = contrast(onBrand, brandRed);
  assert.ok(
    onBrandRatio >= AA_NORMAL_TEXT,
    `ขาวบนแดงต้องผ่าน AA — ได้ ${onBrandRatio.toFixed(2)}:1 (ต้องการ ≥ ${AA_NORMAL_TEXT})`,
  );

  const fgRatio = contrast(foreground, brandRed);
  assert.ok(
    fgRatio < AA_NORMAL_TEXT,
    `ยืนยันโจทย์เดิม: ดำบนแดงต้องไม่ผ่าน AA — ได้ ${fgRatio.toFixed(2)}:1`,
  );
});

const navbarFallback = () => ({
  links: buildPrimaryNav("th"),
  cta: { href: buildHeaderCta("th").href, label: th.nav[buildHeaderCta("th").labelKey] },
});

test("navbar: พื้น 'แดงแบรนด์' ต้องสลับปุ่มเป็นขาว (ไม่ใช่แดงบนแดง) + ลิงก์เป็น on-brand", () => {
  const base = defaultNavbarConfig(th);
  const fallback = navbarFallback();

  const view = resolveNavbarView(
    { ...base, background: "brand", logo: { path: "/media/logo", altTh: "โลโก้", altEn: "" } },
    "th",
    th,
    fallback.links,
    fallback.cta,
  );

  assert.equal(view.onDark, true);

  const brandButton = view.buttonsRight[0];
  assert.ok(brandButton !== undefined);
  assert.ok(brandButton.className.includes("bg-on-brand"), "ปุ่มหลักบนพื้นแดงต้องเป็นพื้นขาว");
  assert.ok(!brandButton.className.includes("bg-brand-red"), "ห้ามเป็นแดงบนแดง (ปุ่มจะหายไปกับพื้น)");
});

test("navbar: พื้นสว่างยังใช้ชุดคลาสเดิม (ไม่กระทบหน้าตาที่ใช้อยู่)", () => {
  const base = defaultNavbarConfig(th);
  const fallback = navbarFallback();

  const view = resolveNavbarView({ ...base, background: "surface" }, "th", th, fallback.links, fallback.cta);

  assert.equal(view.onDark, false);
  const button = view.buttonsRight[0];
  assert.ok(button !== undefined);
  assert.ok(button.className.includes("bg-brand-red"), "พื้นสว่างต้องคงปุ่มแดงเดิม");
});

test("footer: พื้น 'แดงแบรนด์' = onDark · พื้นครีม/ขาว = ปกติ", () => {
  const base = defaultFooterConfig(th);
  const fallback = {
    columns: buildFooterColumns("th").map((column) => ({
      id: column.id,
      title: th.footer[column.titleKey],
      links: column.links.map((link) => ({ id: `${column.id}-${link.labelKey}`, label: th.footer.links[link.labelKey], href: link.href })),
    })),
    socials: SITE.social.map((item) => ({ id: item.id, label: item.label, href: item.href })),
    contact: { address: SITE.contact.address, phone: SITE.contact.phone, email: SITE.contact.email },
  };

  assert.equal(resolveFooterView({ ...base, background: "brand" }, "th", th, fallback).onDark, true);
  assert.equal(resolveFooterView({ ...base, background: "ink" }, "th", th, fallback).onDark, true);
  assert.equal(resolveFooterView({ ...base, background: "cream" }, "th", th, fallback).onDark, false);
  assert.equal(resolveFooterView({ ...base, background: "surface" }, "th", th, fallback).onDark, false);
});

test("หน้าจอจริง: ท้ายเว็บสลับสีข้อความ/เส้นคั่นตาม onDark (ไม่ปล่อย text-fg ค้าง)", () => {
  const footer = sourceOf("features/shell/ui/site-footer.tsx");

  assert.ok(footer.includes("const onDark = view.onDark;"), "ต้องอ่าน onDark จาก view");
  assert.ok(footer.includes('onDark ? "text-on-brand" : "text-fg"'), "หัวข้อต้องสลับเป็น on-brand");
  assert.ok(footer.includes('onDark ? "text-on-brand/85" : "text-fg-muted"'), "ข้อความรองต้องสลับเป็น on-brand");
  assert.ok(footer.includes('onDark ? "border-t border-on-brand/25" : "border-t border-line"'), "เส้นคั่นต้องสลับสี");

  /* ห้ามเหลือคลาสสีมืดแบบติดตายในโซนที่ใช้ onDark */
  const hardcoded = footer.match(/className="[^"]*text-fg(?:-muted)?"/g) ?? [];
  assert.deepEqual(hardcoded, [], `ห้ามเหลือ text-fg แบบติดตาย (พบ ${hardcoded.length} จุด)`);
});

test("หัวเว็บ: ส่ง onDark ให้ตัวควบคุมทั้งหมด (สลับภาษา/ธีม/เมนูมือถือ)", () => {
  const header = sourceOf("features/shell/ui/site-header.tsx");

  assert.ok(header.includes("<LangSwitch current={locale} onDark={view.onDark} />"), "LangSwitch ต้องได้ onDark");
  assert.ok(header.includes("onDark={view.onDark}\n              labels={{"), "ThemeToggle ต้องได้ onDark");
  assert.ok(header.includes("onDark={view.onDark}"), "MobileNav ต้องได้ onDark");

  for (const file of ["features/shell/ui/lang-switch.tsx", "features/shell/ui/theme-toggle.tsx", "features/shell/ui/mobile-nav.tsx"]) {
    const source = sourceOf(file);
    assert.ok(source.includes("onDark"), `${file}: ต้องรองรับ onDark`);
    assert.ok(source.includes("on-brand"), `${file}: ต้องมีคลาส on-brand สำหรับพื้นเข้ม`);
  }
});
