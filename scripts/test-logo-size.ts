import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { buildFooterColumns, buildHeaderCta, buildPrimaryNav } from "@/features/shell/nav";
import { defaultFooterConfig, parseFooterConfig } from "@/lib/chrome/footer";
import { resolveFooterView } from "@/lib/chrome/footer-view";
import {
  DEFAULT_LOGO_SIZE,
  FOOTER_LOGO_HEIGHTS,
  LOGO_SIZES,
  NAVBAR_LOGO_HEIGHTS,
  isLogoSize,
  logoHeightClass,
  type LogoSize,
} from "@/lib/chrome/logo-size";
import { defaultNavbarConfig } from "@/lib/chrome/navbar";
import { resolveNavbarView } from "@/lib/chrome/navbar-view";
import { th } from "@/lib/i18n/messages/th";
import { SITE } from "@/lib/site";

/**
 * เทสต์ "ขนาดโลโก้" ของส่วนกลาง (รอบที่ 310)
 *
 * 🐞 เคสจริงจากเจ้าของ: *"ทดสอบปรับโลโก้เป็นขนาดใหญ่ ไม่เป็นขนาดใหญ่แต่ยังคงเป็นขนาดกลาง
 *    ครับ Navbar และ footer"*
 * ต้นเหตุ: บันไดเดิม `md = h-8 sm:h-9 lg:h-12` กับ `lg = h-11 sm:h-12`
 * ⇒ ที่จอ ≥ 1024px **ทั้งคู่ได้ 48px เท่ากัน** (`lg:h-12` = `sm:h-12`) และ footer ไม่มีค่าตั้งขนาดเลย
 *
 * เทสต์ชุดนี้จึงล็อก 3 อย่าง:
 *  1. ทุกขั้นต้องสูงขึ้นจริงที่ **ทุกเบรกพอยต์** (กันกลับไปเป็นคู่ที่ชนกันอีก)
 *  2. `md` = หน้าตาที่เว็บใช้อยู่จริงวันนี้ ⇒ ผู้ที่ยังไม่ตั้งค่าเห็นเหมือนเดิม
 *  3. ค่าตั้งต้องไหลถึงตัวเรนเดอร์จริง (ไม่ถูกฝังความสูงตายตัวในคอมโพเนนต์)
 */

const ROOT = process.cwd();
const sourceOf = (relative: string): string => readFileSync(path.join(ROOT, relative), "utf8");

type Breakpoint = "base" | "sm" | "lg";
const BREAKPOINTS: readonly Breakpoint[] = ["base", "sm", "lg"];

/**
 * แปลงคลาส Tailwind (`h-8 sm:h-9 lg:h-12` · `lg:h-[4.5rem]`) → ความสูงที่มีผลจริงของแต่ละเบรกพอยต์
 * (มือถือ-first: ค่าที่ประกาศไว้ก่อนหน้ายังมีผลต่อจนกว่าจะถูกเขียนทับ)
 */
function effectiveHeights(classString: string): Readonly<Record<Breakpoint, number>> {
  const declared: Partial<Record<Breakpoint, number>> = {};

  for (const token of classString.split(/\s+/)) {
    const match = /^(?:(sm|lg):)?h-(?:\[([\d.]+)rem\]|(\d+))$/.exec(token);
    if (match === null) continue;

    const breakpoint = (match[1] ?? "base") as Breakpoint;
    const rem = match[2];
    const spacing = match[3];
    declared[breakpoint] =
      rem !== undefined ? Math.round(Number.parseFloat(rem) * 16) : Number(spacing) * 4;
  }

  const result: Record<Breakpoint, number> = { base: 0, sm: 0, lg: 0 };
  let carried = 0;
  for (const breakpoint of BREAKPOINTS) {
    const value = declared[breakpoint];
    if (value !== undefined) carried = value;
    result[breakpoint] = carried;
  }
  return result;
}

const heightAt = (ladder: Readonly<Record<LogoSize, string>>, size: LogoSize): Readonly<Record<Breakpoint, number>> =>
  effectiveHeights(ladder[size]);

for (const [label, ladder] of [
  ["navbar", NAVBAR_LOGO_HEIGHTS],
  ["footer", FOOTER_LOGO_HEIGHTS],
] as const) {
  test(`ขนาดโลโก้ ${label}: เล็ก < กลาง < ใหญ่ ที่ทุกเบรกพอยต์ (ห้ามมีคู่ที่ได้ขนาดเท่ากัน)`, () => {
    for (const breakpoint of BREAKPOINTS) {
      const sm = heightAt(ladder, "sm")[breakpoint];
      const md = heightAt(ladder, "md")[breakpoint];
      const lg = heightAt(ladder, "lg")[breakpoint];

      assert.ok(sm < md, `${label} @${breakpoint}: เล็ก (${sm}px) ต้องน้อยกว่ากลาง (${md}px)`);
      assert.ok(md < lg, `${label} @${breakpoint}: กลาง (${md}px) ต้องน้อยกว่าใหญ่ (${lg}px) — เคสจริงรอบ 310`);
    }
  });
}

test("★ เคสจริงรอบ 310: navbar 'ใหญ่' ต้องใหญ่กว่า 'กลาง' บนจอคอม (≥1024px)", () => {
  const md = heightAt(NAVBAR_LOGO_HEIGHTS, "md").lg;
  const lg = heightAt(NAVBAR_LOGO_HEIGHTS, "lg").lg;

  assert.equal(md, 48, "กลาง = 48px (ของเดิมทั้งดุ้น)");
  assert.ok(lg > md, `ใหญ่ต้องสูงกว่ากลางบนจอคอม — md ${md}px / lg ${lg}px`);
  assert.equal(lg, 56, "ใหญ่ = 56px");
});

test("navbar: ขนาดใหญ่สุดยังไม่ล้นแถบเมนูที่เตี้ยสุด (compact บนจอใหญ่ = 64px)", () => {
  /* ค่ามาจาก ROW_HEIGHTS.compact ใน lib/chrome/navbar-view.ts */
  const shortestRowAtDesktop = effectiveHeights("h-14 lg:h-16").lg;
  const tallestLogo = heightAt(NAVBAR_LOGO_HEIGHTS, "lg").lg;

  assert.equal(shortestRowAtDesktop, 64);
  assert.ok(
    tallestLogo <= shortestRowAtDesktop,
    `โลโก้ใหญ่ ${tallestLogo}px ต้องไม่เกินความสูงแถบเมนู ${shortestRowAtDesktop}px`,
  );
});

test("ค่าเริ่มต้น = กลาง และ md คือหน้าตาที่เว็บใช้อยู่จริงก่อนรอบนี้ (ไม่ตั้งค่า = เหมือนเดิม)", () => {
  assert.equal(DEFAULT_LOGO_SIZE, "md");
  assert.equal(NAVBAR_LOGO_HEIGHTS.md, "h-8 sm:h-9 lg:h-12");
  assert.equal(FOOTER_LOGO_HEIGHTS.md, "h-9 sm:h-10");
  assert.deepEqual([...LOGO_SIZES], ["sm", "md", "lg"]);
  assert.deepEqual(Object.keys(NAVBAR_LOGO_HEIGHTS).sort(), [...LOGO_SIZES].sort());
  assert.deepEqual(Object.keys(FOOTER_LOGO_HEIGHTS).sort(), [...LOGO_SIZES].sort());
});

test("isLogoSize: รับเฉพาะค่าที่รู้จัก (ค่าอื่นต้องไม่หลุดเข้าไปเป็นคลาส)", () => {
  assert.equal(isLogoSize("sm"), true);
  assert.equal(isLogoSize("lg"), true);
  assert.equal(isLogoSize("xl"), false);
  assert.equal(isLogoSize(""), false);
  assert.equal(isLogoSize(null), false);
  assert.equal(isLogoSize(3), false);
});

test("logoHeightClass: แปลงจากขนาด → คลาสของส่วนนั้น (ไม่เดาเองว่าเป็น navbar หรือ footer)", () => {
  assert.equal(logoHeightClass(NAVBAR_LOGO_HEIGHTS, "lg"), NAVBAR_LOGO_HEIGHTS.lg);
  assert.equal(logoHeightClass(FOOTER_LOGO_HEIGHTS, "lg"), FOOTER_LOGO_HEIGHTS.lg);
  assert.notEqual(NAVBAR_LOGO_HEIGHTS.lg, FOOTER_LOGO_HEIGHTS.lg);
});

/* ── ค่าตั้งต้องไหลถึงตัวเรนเดอร์จริง ─────────────────────────────────────── */

test("navbar view: logoSize ส่งผลกับคลาสที่เรนเดอร์ (ไม่ใช่แค่เก็บใน DB)", () => {
  const base = defaultNavbarConfig(th);

  const mdView = resolveNavbarView(
    { ...base, logo: { path: "/media/logo", altTh: "โลโก้", altEn: "" }, logoSize: "md" },
    "th",
    th,
    buildPrimaryNav("th"),
    { href: buildHeaderCta("th").href, label: th.nav[buildHeaderCta("th").labelKey] },
  );
  const lgView = resolveNavbarView(
    { ...base, logo: { path: "/media/logo", altTh: "โลโก้", altEn: "" }, logoSize: "lg" },
    "th",
    th,
    buildPrimaryNav("th"),
    { href: buildHeaderCta("th").href, label: th.nav[buildHeaderCta("th").labelKey] },
  );

  assert.equal(mdView.logoHeightClass, NAVBAR_LOGO_HEIGHTS.md);
  assert.equal(lgView.logoHeightClass, NAVBAR_LOGO_HEIGHTS.lg);
  assert.notEqual(mdView.logoHeightClass, lgView.logoHeightClass);

  /* ไม่ตั้งค่าเลย ⇒ คลาสเดิม (กลาง) เหมือนก่อนรอบนี้ */
  const fallbackView = resolveNavbarView(null, "th", th, buildPrimaryNav("th"), {
    href: buildHeaderCta("th").href,
    label: th.nav[buildHeaderCta("th").labelKey],
  });
  assert.equal(fallbackView.logoHeightClass, NAVBAR_LOGO_HEIGHTS.md);
});

const footerFallbackOf = () => ({
  columns: buildFooterColumns("th").map((column) => ({
    id: column.id,
    title: th.footer[column.titleKey],
    links: column.links.map((link) => ({ id: `${column.id}-${link.labelKey}`, label: th.footer.links[link.labelKey], href: link.href })),
  })),
  socials: SITE.social.map((item) => ({ id: item.id, label: item.label, href: item.href })),
  contact: { address: SITE.contact.address, phone: SITE.contact.phone, email: SITE.contact.email },
});

test("footer: ค่าเริ่มต้นมี logoSize = กลาง และไม่ตั้งค่า = ความสูงเดิม (h-9 sm:h-10)", () => {
  assert.equal(defaultFooterConfig(th).logoSize, DEFAULT_LOGO_SIZE);

  const fallbackView = resolveFooterView(null, "th", th, footerFallbackOf());
  assert.equal(fallbackView.logoHeightClass, FOOTER_LOGO_HEIGHTS.md);
  assert.equal(fallbackView.logoHeightClass, "h-9 sm:h-10");
});

test("footer: อ่านค่า logoSize จากหลังบ้านได้ + ค่าแปลก ๆ ถอยเป็นกลาง (ไม่ทำก้อนข้อมูลเสีย)", () => {
  const base = defaultFooterConfig(th);

  const large = parseFooterConfig({ ...base, logoSize: "lg" }, th);
  assert.equal(large.ok, true);
  assert.ok(large.ok);
  assert.equal(large.config.logoSize, "lg");

  const missing = parseFooterConfig({ logo: null }, th);
  assert.equal(missing.ok, true);
  assert.ok(missing.ok);
  assert.equal(missing.config.logoSize, DEFAULT_LOGO_SIZE);

  const bogus = parseFooterConfig({ logoSize: "ยักษ์" }, th);
  assert.equal(bogus.ok, true);
  assert.ok(bogus.ok);
  assert.equal(bogus.config.logoSize, DEFAULT_LOGO_SIZE);
});

test("footer view: ตั้ง 'ใหญ่' แล้วคลาสที่เรนเดอร์เปลี่ยนจริง", () => {
  const config = { ...defaultFooterConfig(th), logo: { path: "/media/logo", altTh: "โลโก้", altEn: "" }, logoSize: "lg" as const };
  const view = resolveFooterView(config, "th", th, footerFallbackOf());

  assert.equal(view.logoHeightClass, FOOTER_LOGO_HEIGHTS.lg);
  assert.notEqual(view.logoHeightClass, FOOTER_LOGO_HEIGHTS.md);
});

/* ── ด่านกันถอยหลัง: คอมโพเนนต์ต้องไม่ฝังความสูงตายตัวอีก ─────────────────── */

test("BrandMark: รับคลาสความสูงจากค่าตั้ง (ไม่ฝังความสูงตายตัว) และค่าเริ่มต้น = กลางของ navbar", () => {
  const brandMark = sourceOf("features/shell/ui/brand-mark.tsx");

  assert.ok(
    brandMark.includes('logoHeightClass = "h-8 sm:h-9 lg:h-12"'),
    "ค่าเริ่มต้นของ BrandMark ต้องเท่ากับ NAVBAR_LOGO_HEIGHTS.md",
  );
  assert.ok(brandMark.includes("${logoHeightClass}"), "คลาสความสูงต้องมาจาก prop ไม่ใช่ค่าคงที่ใน JSX");
  assert.ok(!brandMark.includes('className="h-8 w-auto'), "ห้ามเหลือความสูงแบบฝังตายตัว (ต้นเหตุของบั๊กรอบ 310)");
  assert.ok(brandMark.includes("max-w-[46vw]"), "ยังต้องมีตัวกันล้นจอเล็ก");
});

test("หัวเว็บ/ท้ายเว็บ: ส่งค่าขนาดที่คำนวณแล้วเข้า BrandMark (ทั้งสองที่)", () => {
  for (const file of ["features/shell/ui/site-header.tsx", "features/shell/ui/site-footer.tsx"]) {
    const source = sourceOf(file);
    assert.ok(source.includes("logoHeightClass={view.logoHeightClass}"), `${file}: ต้องส่งขนาดเข้า BrandMark`);
  }
});

test("หน้าจอหลังบ้าน: ท้ายเว็บมีช่อง 'ขนาดโลโก้' ผูกกับ config.logoSize", () => {
  const editor = sourceOf("features/admin/ui/footer-editor.tsx");

  assert.ok(editor.includes("navbarLogoSize"), "ใช้ป้าย 'ขนาดโลโก้' ตัวเดียวกับ navbar (ไม่เพิ่มคีย์ซ้ำ)");
  assert.ok(editor.includes('value={config.logoSize}'), "ค่าที่เลือกต้องผูกกับ config.logoSize");
  assert.ok(editor.includes('logoSize: event.target.value as FooterConfig["logoSize"]'), "เปลี่ยนขนาดต้องอัปเดต state");
});
