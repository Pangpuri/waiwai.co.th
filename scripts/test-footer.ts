import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { th } from "@/lib/i18n/messages/th";
import {
  FOOTER_PAGE_KEY,
  MAX_FOOTER_GROUPS,
  defaultFooterConfig,
  footerErrorsOf,
  parseFooterConfig,
  validateFooterConfig,
  type FooterConfig,
} from "@/lib/chrome/footer";
import { compactFooterLinks, resolveFooterHref, resolveFooterView } from "@/lib/chrome/footer-view";
import { buildFooterColumns } from "@/features/shell/nav";
import { SITE } from "@/lib/site";

/** เทสต์ท้ายเว็บ (W3) — ตรรกะล้วน ไม่ต้องมีฐานข้อมูล */

const fallbackOf = () => ({
  columns: buildFooterColumns("th").map((column) => ({
    id: column.id,
    title: th.footer[column.titleKey],
    links: column.links.map((link) => ({ id: `${column.id}-${link.labelKey}`, label: th.footer.links[link.labelKey], href: link.href })),
  })),
  socials: SITE.social.map((item) => ({ id: item.id, label: item.label, href: item.href })),
  contact: { address: SITE.contact.address, phone: SITE.contact.phone, email: SITE.contact.email },
});

test("footer: คีย์ในฐานข้อมูลคือ chrome-footer", () => {
  assert.equal(FOOTER_PAGE_KEY, "chrome-footer");
});

test("defaultFooterConfig: ตรงกับท้ายเว็บปัจจุบันในโค้ด (กลุ่ม/หัวข้อ/ลิงก์)", () => {
  const config = defaultFooterConfig(th);
  const columns = buildFooterColumns("th");

  assert.equal(config.groups.length, columns.length);
  assert.deepEqual(
    config.groups.map((group) => group.id),
    columns.map((column) => column.id),
  );
  const firstTitleKey = columns[0]?.titleKey;
  assert.equal(config.groups[0]?.title.th, firstTitleKey === undefined ? undefined : th.footer[firstTitleKey]);
  assert.equal(config.background, "cream", "พื้นหลังเดิมคือ bg-bg-subtle");
  assert.equal(config.logo, null, "ยังไม่มีโลโก้ท้ายเว็บ ⇒ ใช้ wordmark เดิม");
  assert.equal(footerErrorsOf(validateFooterConfig(config)).length, 0, "ค่าเริ่มต้นต้องผ่านการตรวจ");
});

test("★ ไม่ตั้งค่า = view เหมือนเดิม (ใช้ค่า fallback จากโค้ด)", () => {
  const view = resolveFooterView(null, "th", th, fallbackOf());

  assert.equal(view.footerClass, "relative bg-bg-subtle");
  assert.equal(view.about, th.footer.about);
  assert.equal(view.rights, th.footer.rights);
  assert.equal(view.groups.length, fallbackOf().columns.length);
  assert.equal(view.groups[0]?.links[0]?.href, fallbackOf().columns[0]?.links[0]?.href);
  assert.deepEqual(view.contact, fallbackOf().contact);
});

test("resolveFooterHref: ลิงก์ในเว็บเติมภาษา · ลิงก์นอก/mailto คงเดิม", () => {
  assert.equal(resolveFooterHref("th", "/about"), "/th/about");
  assert.equal(resolveFooterHref("en", "/about#team"), "/en/about#team");
  assert.equal(resolveFooterHref("th", "/"), "/th");
  assert.equal(resolveFooterHref("th", "https://example.test/x"), "https://example.test/x");
  assert.equal(resolveFooterHref("th", "mailto:a@b.test"), "mailto:a@b.test");
});

/**
 * ★ 2026-11-12 — footer มือถือยาว ~820px ⇒ ทำ "เมนูลัด" แถวเดียว
 * - ตัด privacy/cookies ที่ซ้ำกับแถวลิขสิทธิ์
 * - ตัด href ซ้ำ (FAQ กับ Contact ชี้หน้าเดียวกัน)
 * - จำกัดจำนวนเพื่อไม่ให้กลับยาวถ้าผู้ดูแลเพิ่มลิงก์
 */
test("compactFooterLinks: ตัดลิงก์ซ้ำ + เก็บลิงก์สำคัญไม่เกินเพดาน", () => {
  const view = resolveFooterView(null, "th", th, fallbackOf());
  const quick = compactFooterLinks(view);
  assert.deepEqual(
    quick.map((link) => link.href),
    ["/th/about", "/th/about/executives", "/th/about/certifications", "/th/careers", "/th/products", "/th/recipes", "/th/news", "/th/contact"],
  );
  assert.equal(quick.some((link) => link.href === view.privacyHref), false, "privacy ซ้ำกับแถวลิขสิทธิ์");
  assert.equal(quick.filter((link) => link.href === "/th/contact").length, 1, "FAQ กับ Contact ชี้ที่เดียวกัน → เหลืออันเดียว");
  assert.equal(compactFooterLinks(view, 3).length, 3, "เพดานจำนวนลิงก์มีผล");
  assert.deepEqual(compactFooterLinks({ ...view, groups: [] }), [], "ไม่มีกลุ่ม = ไม่มีลิงก์");

  const customView = {
    ...view,
    groups: [
      {
        id: "custom",
        title: "Custom",
        links: [
          { id: "p", label: "P", href: view.privacyHref, icon: "none" as const, external: false },
          { id: "c", label: "C", href: view.cookiesHref, icon: "none" as const, external: false },
          { id: "a", label: "A", href: "/th/about", icon: "none" as const, external: false },
        ],
      },
    ],
  };
  assert.deepEqual(compactFooterLinks(customView).map((link) => link.href), ["/th/about"], "privacy/cookies ถูกตัดออก");

  /* สายไฟ UI: มือถือใช้ลิงก์ลัด + ปุ่มกลับขึ้นด้านบน · จอใหญ่ยังใช้ 3 คอลัมน์ */
  const footerSource = readFileSync("features/shell/ui/site-footer.tsx", "utf8");
  assert.ok(footerSource.includes("data-footer-quick-links"), "ต้องมีบล็อกเมนูลัดบนมือถือ");
  assert.ok(footerSource.includes("hidden sm:grid"), "เมนู 3 คอลัมน์ต้องกลับมาแสดงบนจอใหญ่");
  assert.ok(footerSource.includes("line-clamp-2"), "ข้อความ about บนมือถือต้องถูกย่อ");
  assert.ok(footerSource.includes("<BackToTop label={messages.actions.backToTop} />"), "ต้องมีปุ่มกลับขึ้นด้านบน");
  const backToTopSource = readFileSync("features/shell/ui/back-to-top.tsx", "utf8");
  assert.ok(backToTopSource.includes("window.scrollTo"), "ปุ่มต้องเลื่อนขึ้นด้านบนจริง");
  assert.ok(backToTopSource.includes("prefers-reduced-motion"), "ต้องเคารพการตั้งค่าลดอนิเมชัน");
  assert.ok(backToTopSource.includes("sm:hidden"), "ปุ่มนี้แสดงเฉพาะมือถือ");
});

test("ตั้งค่าแล้ว: ข้อความ/ลิงก์/โซเชียล/พื้นหลัง ถูกใช้ตามที่ตั้ง", () => {
  const config: FooterConfig = {
    ...defaultFooterConfig(th),
    about: { th: "ข้อความใหม่", en: "New text" },
    contact: { address: { th: "ที่อยู่ใหม่", en: "" }, phone: "021234567", email: "a@b.test" },
    groups: [{ id: "g1", title: { th: "หัวข้อ", en: "Title" }, links: [{ id: "l1", label: { th: "ลิงก์", en: "Link" }, href: "/about", icon: "phone" }] }],
    socials: [{ id: "line", label: { th: "ไลน์", en: "LINE" }, href: "https://line.me/x", icon: "line" }],
    rights: { th: "สงวนลิขสิทธิ์", en: "Rights" },
    background: "ink",
  };

  const view = resolveFooterView(config, "th", th, fallbackOf());
  assert.equal(view.about, "ข้อความใหม่");
  assert.equal(view.contact.email, "a@b.test");
  assert.equal(view.groups.length, 1);
  assert.equal(view.groups[0]?.links[0]?.href, "/th/about");
  assert.equal(view.groups[0]?.links[0]?.icon, "phone");
  assert.equal(view.socials[0]?.icon, "line");
  assert.equal(view.rights, "สงวนลิขสิทธิ์");
  assert.match(view.footerClass, /bg-fg/);

  /* อังกฤษ: มีค่า = ใช้ค่า · ว่าง = ถอยไปใช้ไทย */
  const en = resolveFooterView(config, "en", th, fallbackOf());
  assert.equal(en.about, "New text");
  assert.equal(en.contact.address, "ที่อยู่ใหม่", "ที่อยู่อังกฤษว่าง ⇒ ใช้ไทย");
});

test("validateFooterConfig: จับคอลัมน์ว่าง/ลิงก์อันตราย/อีเมลผิดรูป/โลโก้ผิดมติ D9", () => {
  const base = defaultFooterConfig(th);

  assert.ok(footerErrorsOf(validateFooterConfig({ ...base, groups: [] })).some((issue) => issue.code === "no-groups"));
  assert.ok(
    footerErrorsOf(
      validateFooterConfig({
        ...base,
        groups: [{ id: "g", title: { th: "หัวข้อ", en: "" }, links: [{ id: "l", label: { th: "ลิงก์", en: "" }, href: "javascript:alert(1)", icon: "none" }] }],
      }),
    ).some((issue) => issue.code === "bad-href"),
  );
  assert.ok(footerErrorsOf(validateFooterConfig({ ...base, contact: { ...base.contact, email: "ไม่ใช่อีเมล" } })).some((issue) => issue.code === "bad-email"));
  assert.ok(
    footerErrorsOf(validateFooterConfig({ ...base, logo: { path: "https://x/y.png", altTh: "โลโก้", altEn: "" } })).some(
      (issue) => issue.code === "media-path-is-url",
    ),
  );
});

test("parseFooterConfig: รับค่าจากหน้าจอได้ + ตัดรายการเกินเพดาน + ไม่พังกับค่าที่ไม่รู้จัก", () => {
  const groups = Array.from({ length: MAX_FOOTER_GROUPS + 3 }, (_unused, index) => ({
    id: `g${index}`,
    title: { th: `หัวข้อ ${index}`, en: "" },
    links: [{ id: `l${index}`, label: { th: "ลิงก์", en: "" }, href: "/x", icon: "none" }],
  }));

  const outcome = parseFooterConfig({ groups, background: "ม่วงนีออน", socials: "ไม่ใช่รายการ" }, th);
  assert.equal(outcome.ok, false, "socials ผิดชนิด ⇒ รายงานเป็นปัญหา");
  if (!outcome.ok) assert.ok(outcome.problems.some((line) => line.includes("socials")));

  const ok = parseFooterConfig({ groups, background: "ม่วงนีออน" }, th);
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.config.groups.length, MAX_FOOTER_GROUPS, "ตัดตามเพดาน");
    assert.equal(ok.config.background, "cream", "ค่าที่ไม่รู้จัก ⇒ ใช้ค่าเดิม");
  }
});
