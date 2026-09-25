import assert from "node:assert/strict";
import { test } from "node:test";

import {
  activeNavId,
  buildFooterColumns,
  buildHeaderCta,
  buildPrimaryNav,
  isActivePath,
  normalizePath,
  PRIMARY_NAV,
  FOOTER_COLUMNS,
} from "@/features/shell/nav";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";

test("buildPrimaryNav: เติม prefix ภาษาครบทุกเมนู", () => {
  const thNav = buildPrimaryNav("th");
  const enNav = buildPrimaryNav("en");

  assert.equal(thNav.length, PRIMARY_NAV.length);
  assert.equal(thNav[0]?.href, "/th");
  assert.equal(enNav[0]?.href, "/en");

  for (const link of enNav) {
    assert.ok(link.href.startsWith("/en"), `${link.id} ต้องขึ้นต้นด้วย /en`);
  }
});

test("PRIMARY_NAV: เรียงตามเมนูเว็บเดิม และ path ไม่ซ้ำกัน", () => {
  // ลำดับตามเว็บเดิม waiwai.co.th (ผู้ใช้ยืนยัน 2026-09-25)
  assert.deepEqual(
    PRIMARY_NAV.map((item) => item.id),
    [
      "home",
      "about",
      "certifications",
      "executives",
      "products",
      "recipes",
      "news",
      "careers",
      "contact",
    ],
  );

  const paths = PRIMARY_NAV.map((item) => item.path);
  assert.equal(new Set(paths).size, paths.length, "มี path ซ้ำในเมนูหลัก");

  for (const item of PRIMARY_NAV) {
    assert.ok(item.path.startsWith("/"), `${item.id}: path ต้องขึ้นต้นด้วย /`);
  }
});

test("buildHeaderCta: ปุ่มสั่งซื้อออนไลน์ไปยังส่วนที่ซื้อสินค้าในหน้าแรก", () => {
  // ไม่มีหน้า /where-to-buy จึงชี้ไป anchor ที่มีปุ่ม Shopee/Lazada/LINE Shop จริง
  assert.equal(buildHeaderCta("th").href, "/th#where-to-buy");
  assert.equal(buildHeaderCta("en").href, "/en#where-to-buy");
});

test("เมนูทุกป้ายต้องมีคีย์ในพจนานุกรมจริงทั้งสองภาษา", () => {
  for (const link of buildPrimaryNav("th")) {
    assert.ok(th.nav[link.labelKey].length > 0, `th ขาดข้อความสำหรับเมนู ${link.id}`);
    assert.ok(en.nav[link.labelKey].length > 0, `en ขาดข้อความสำหรับเมนู ${link.id}`);
  }

  const ctaKey = buildHeaderCta("th").labelKey;
  assert.ok(th.nav[ctaKey].length > 0, "th ขาดข้อความปุ่ม CTA");
  assert.ok(en.nav[ctaKey].length > 0, "en ขาดข้อความปุ่ม CTA");

  for (const column of FOOTER_COLUMNS) {
    for (const link of column.links) {
      const label: string | undefined = th.footer.links[link.labelKey];
      assert.ok(label && label.length > 0, `ขาดข้อความสำหรับลิงก์ ${link.labelKey}`);
    }
  }
});

test("activeNavId: เมนูลูกต้องชนะเมนูแม่ (ไม่ active พร้อมกันสองอัน)", () => {
  const links = buildPrimaryNav("th");

  // /about/certifications ตรงทั้ง "บริษัท" และ "ใบรับรองมาตรฐาน" → ต้องได้ตัวหลังเท่านั้น
  assert.equal(activeNavId("/th/about/certifications", links), "certifications");
  assert.equal(activeNavId("/th/about", links), "about");
  assert.equal(activeNavId("/th", links), "home");
  assert.equal(activeNavId("/th/news", links), "news");
});

test("activeNavId: หน้าที่ไม่มีในเมนูต้องไม่ทำให้เมนูใด active", () => {
  assert.equal(activeNavId("/th/privacy", buildPrimaryNav("th")), null);
});

test("isActivePath: หน้าแรกต้อง active เฉพาะหน้าแรก", () => {
  assert.equal(isActivePath("/th", "/th", true), true);
  assert.equal(isActivePath("/th/", "/th", true), true);
  assert.equal(isActivePath("/th/news", "/th", true), false);
  assert.equal(isActivePath("/th/news", "/th", false), true);
});

test("isActivePath: หน้าลูกต้อง active กับเมนูแม่", () => {
  assert.equal(isActivePath("/th/products/packet-noodles", "/th/products", false), true);
  assert.equal(isActivePath("/th/news/2026/launch", "/th/news", false), true);
});

test("isActivePath: ชื่อหน้าคล้ายกันต้องไม่ถูกนับว่า active", () => {
  // เคสหลอกที่พลาดง่ายถ้าใช้ startsWith เฉย ๆ
  assert.equal(isActivePath("/th/newsletter", "/th/news", false), false);
  assert.equal(isActivePath("/th/products-archive", "/th/products", false), false);
  assert.equal(isActivePath("/en/abouts", "/en/about", false), false);
});

test("isActivePath: ไม่สนใจ trailing slash และ query string", () => {
  assert.equal(isActivePath("/th/products/", "/th/products", false), true);
  assert.equal(isActivePath("/th/products?page=2", "/th/products", false), true);
  assert.equal(isActivePath("/th/products#top", "/th/products", false), true);
});

test("normalizePath: จัดรูป path ให้เทียบกันได้", () => {
  assert.equal(normalizePath("/th/products/"), "/th/products");
  assert.equal(normalizePath("/th/products?page=2#x"), "/th/products");
  assert.equal(normalizePath("/"), "/");
  assert.equal(normalizePath(""), "");
});

test("buildFooterColumns: ครบทุกคอลัมน์และเติมภาษาให้ลิงก์", () => {
  const columns = buildFooterColumns("en");

  assert.equal(columns.length, FOOTER_COLUMNS.length);
  for (const column of columns) {
    assert.ok(column.links.length > 0);
    for (const link of column.links) {
      assert.ok(link.href.startsWith("/en"), `${link.labelKey} ต้องขึ้นต้นด้วย /en`);
    }
  }
});
