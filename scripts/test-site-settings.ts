import assert from "node:assert/strict";
import { test } from "node:test";

import { th } from "@/lib/i18n/messages/th";
import { LOCALES } from "@/lib/i18n/config";
import { defaultPages } from "@/lib/pages/model";
import { CODE_ONLY_PAGE_PATHS, PAGES_ALWAYS_NOINDEX, pathForPage } from "@/lib/pages/paths";
import { SITE } from "@/lib/site";
import {
  EMPTY_SITE_SETTINGS,
  SITE_SETTINGS_PAGE_KEY,
  defaultSiteSettings,
  parseSiteSettings,
  siteNameFor,
  siteSettingsErrorsOf,
  validateSiteSettings,
} from "@/lib/site-settings/model";
import { buildRobots, buildSitemapEntries } from "@/lib/site-settings/sitemap";

/** เทสต์ตั้งค่าส่วนกลาง + sitemap/robots (X1.3 + X1.4) — ตรรกะล้วน */

test("ค่าเริ่มต้น = สิ่งที่เว็บใช้อยู่จริงวันนี้ (ไม่ตั้งค่า = เหมือนเดิม)", () => {
  const settings = defaultSiteSettings(th);

  assert.equal(settings.name.th, th.meta.siteName);
  assert.equal(settings.organization.legalName.th, SITE.legalName);
  assert.equal(settings.organization.address.th, SITE.contact.address);
  assert.equal(settings.favicon, "", "ยังไม่ตั้งไอคอน ⇒ ไม่ต้องใส่ <link rel=icon>");
  assert.equal(settings.defaultOgImage, "", "ยังไม่ตั้งรูปแชร์ ⇒ พฤติกรรมเดิม");
  assert.equal(siteSettingsErrorsOf(validateSiteSettings(settings)).length, 0);
});

test("คีย์ที่เก็บในฐานข้อมูลคือ site-settings (ใช้กลไก page_document เดิม)", () => {
  assert.equal(SITE_SETTINGS_PAGE_KEY, "site-settings");
});

test("siteNameFor: อังกฤษว่าง = ใช้ไทย", () => {
  const base = defaultSiteSettings(th);
  assert.equal(siteNameFor({ ...base, name: { th: "ไทย", en: "English" } }, "en"), "English");
  assert.equal(siteNameFor({ ...base, name: { th: "ไทย", en: "" } }, "en"), "ไทย");
});

test("validateSiteSettings: พาธไฟล์ต้องไม่ใช่ URL เต็ม (มติ D9) · ลิงก์ภายนอกต้อง http(s)", () => {
  const base = defaultSiteSettings(th);

  assert.ok(siteSettingsErrorsOf(validateSiteSettings({ ...base, favicon: "https://cdn.test/f.ico" })).some((i) => i.code === "media-path-is-url"));
  assert.ok(siteSettingsErrorsOf(validateSiteSettings({ ...base, favicon: "media/f.ico" })).some((i) => i.code === "bad-path"));
  assert.deepEqual(siteSettingsErrorsOf(validateSiteSettings({ ...base, favicon: "/media/f.ico", defaultOgImage: "/media/og.png" })), []);

  assert.ok(siteSettingsErrorsOf(validateSiteSettings({ ...base, organization: { ...base.organization, mapUrl: "javascript:alert(1)" } })).some((i) => i.code === "bad-href"));
  assert.ok(siteSettingsErrorsOf(validateSiteSettings({ ...base, socials: ["ไม่ใช่ลิงก์"] })).some((i) => i.code === "bad-href"));

  assert.ok(siteSettingsErrorsOf(validateSiteSettings({ ...base, name: { th: "", en: "" } })).some((i) => i.code === "empty-th"));
  assert.ok(siteSettingsErrorsOf(validateSiteSettings({ ...base, organization: { ...base.organization, email: "ไม่ใช่อีเมล" } })).some((i) => i.code === "bad-email"));
});

test("parseSiteSettings: รับค่าจากฟอร์ม + ตัดลิงก์ว่าง/เกินเพดาน + ไม่พังกับค่าที่ไม่รู้จัก", () => {
  const raw = {
    name: { th: "ไวไวใหม่", en: "" },
    defaultOgImage: "/media/og.png",
    favicon: "/media/icon.ico",
    organization: { legalName: { th: "บ.ทดสอบ", en: "" }, address: { th: "ที่อยู่", en: "" }, phone: "02", email: "a@b.test", hours: { th: "8-17", en: "" }, mapUrl: "/map" },
    socials: ["https://facebook.com/x", "", "  https://line.me/y  "],
  };

  const parsed = parseSiteSettings(raw, th);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.deepEqual(parsed.value.socials, ["https://facebook.com/x", "https://line.me/y"], "ตัดช่องว่างและไม่เก็บลิงก์ว่าง");
    assert.equal(parsed.value.organization.hours.th, "8-17");
  }

  assert.equal(parseSiteSettings(null, th).ok, false);
  assert.equal(parseSiteSettings({ socials: "ไม่ใช่รายการ" }, th).ok, false);

  const unknown = parseSiteSettings({ somethingElse: 1 }, th);
  assert.equal(unknown.ok, true, "คีย์ที่ไม่รู้จัก = ไม่พัง");
  if (unknown.ok) assert.equal(unknown.value.name.th, th.meta.siteName);
});

test("buildSitemapEntries: มีทั้ง 2 ภาษา · ตัดหน้าที่ noindex/ซ่อนจากเมนู", () => {
  const pages = defaultPages(th);
  const entries = buildSitemapEntries({ siteUrl: SITE.url, pages, locales: LOCALES });

  /* นับจากข้อมูลจริง: หน้าที่อยู่ในเมนู − หน้าที่ noindex ในโค้ด + หน้าในโค้ด (เช่น /privacy) — ต่อภาษา */
  const expectedPerLocale = pages.length - PAGES_ALWAYS_NOINDEX.length + CODE_ONLY_PAGE_PATHS.length;
  assert.equal(entries.length, expectedPerLocale * LOCALES.length, "ตัดหน้าที่ noindex ในโค้ดออกก่อนนับ (และบวกหน้าในโค้ด)");
  assert.ok(entries.some((entry) => entry.url === `${SITE.url}/th`), "หน้าแรกไทยคือ /th");
  assert.ok(entries.some((entry) => entry.url === `${SITE.url}/en/about/certifications`));
  assert.equal(entries.find((entry) => entry.url === `${SITE.url}/th`)?.priority, 1);

  /* หน้าที่ noindex ในโค้ด (เช่น /news หน้าตัวอย่าง) ต้องไม่อยู่ใน sitemap ให้ตรงกับ metadata */
  assert.equal(entries.some((entry) => entry.url.includes("/news")), false, "หน้าที่ noindex เสมอต้องไม่อยู่ใน sitemap");

  const noindex = buildSitemapEntries({
    siteUrl: SITE.url,
    pages: pages.map((page) => (page.id === "news" ? { ...page, seo: { ...page.seo, noindex: true } } : page)),
    locales: LOCALES,
  });
  assert.equal(noindex.some((entry) => entry.url.includes("/news")), false, "หน้า noindex ต้องไม่อยู่ใน sitemap");

  const hidden = buildSitemapEntries({ siteUrl: SITE.url, pages: pages.map((p) => (p.id === "careers" ? { ...p, inMenu: false } : p)), locales: LOCALES });
  assert.equal(hidden.some((entry) => entry.url.includes("/careers")), false);
});

test("buildRobots: ปิดหลังบ้าน + หน้าพรีวิว แต่เปิดเว็บหลัก และชี้ sitemap", () => {
  const robots = buildRobots({ siteUrl: SITE.url, locales: LOCALES });
  const rule = robots.rules[0];

  assert.equal(rule?.userAgent, "*");
  assert.equal(rule?.allow, "/");
  assert.ok(rule?.disallow.includes("/admin"));
  assert.ok(rule?.disallow.includes("/th/preview"));
  assert.equal(robots.sitemap, `${SITE.url}/sitemap.xml`);
});

test("pathForPage: หน้าที่รู้จักได้พาธถูกต้อง · ไม่รู้จักถือเป็นหน้าแรก", () => {
  assert.equal(pathForPage("home"), "/");
  assert.equal(pathForPage("certifications"), "/about/certifications");
  assert.equal(pathForPage("contact"), "/contact");
  assert.equal(pathForPage("ไม่มีหน้านี้"), "/");
});

test("EMPTY_SITE_SETTINGS: ว่างทุกช่องแต่ยังตรวจผ่าน (ใช้เป็นโครงตั้งต้น)", () => {
  /* ว่าง = ยังไม่ตั้ง ⇒ ตรวจแล้วมีแต่คำเตือน ไม่มี error ยกเว้นชื่อเว็บว่าง */
  assert.equal(EMPTY_SITE_SETTINGS.favicon, "");
  assert.equal(siteSettingsErrorsOf(validateSiteSettings(EMPTY_SITE_SETTINGS)).some((issue) => issue.code === "empty-th"), true);
});
