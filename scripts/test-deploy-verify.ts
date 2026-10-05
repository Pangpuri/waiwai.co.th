import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assessHomePage,
  assessNewsArticlePage,
  assessNewsListPage,
  isVercelProtectionPage,
  mediaIdFromHtml,
  pooledEndpointWarning,
} from "@/lib/deploy/verify";

/**
 * เทสต์ "ตรวจเว็บที่ deploy แล้ว" (รอบที่ 117)
 *
 * โจทย์จริง: หน้าเว็บที่อ่านฐานข้อมูลไม่ได้จะตอบ **200 ปกติ แต่ไม่มีข้อมูล** (เพราะ repository กลืน error)
 * ⇒ ต้องตรวจ "เนื้อหา" ไม่ใช่แค่ HTTP status และต้องชี้สาเหตุที่พบบ่อย (ไม่ได้ตั้ง env · ใช้ URL ของ pooler)
 */

/** หน้าแรกที่ "ปกติ" (จำลองร่องรอยจริง: โลโก้ · 6 หมวด · จำนวนสินค้า · ข่าว 3 ใบ) */
const GOOD_HTML = `
  <img src="/_next/image?url=%2Fbrand%2Flogo-navbar.png&w=640" alt="">
  ${["instant-noodles", "dried-vermicelli", "serda", "quick-zabb", "noodie", "rod-ded"]
    .map((slug) => `<a href="/th/products/${slug}">x</a>`)
    .join("")}
  <span>22 รายการ</span><span>6 รายการ</span>
  <a href="/th/news/148398">ข่าว</a><a href="/th/news/148175">ข่าว</a><a href="/th/news/148172">ข่าว</a>
`;

/** หน้าแรกที่ "ว่างเงียบ" (อ่านฐานข้อมูลไม่ได้ — ยังมีโครงเว็บปกติ) */
const EMPTY_HTML = `
  <img src="/_next/image?url=%2Fbrand%2Flogo-navbar.png&w=640" alt="">
  ${["instant-noodles", "dried-vermicelli", "serda", "quick-zabb", "noodie", "rod-ded"]
    .map((slug) => `<a href="/th/products/${slug}">x</a>`)
    .join("")}
`;

test("deploy: หน้าแรกที่มีข้อมูลจริง = ผ่าน", () => {
  const result = assessHomePage(GOOD_HTML);
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
  assert.equal(result.facts.categoryLinks, 6);
  assert.equal(result.facts.newsLinks, 3);
  assert.ok(result.facts.productCounts.includes(22));
  assert.ok(result.summary.startsWith("✓"));
});

test("deploy: หน้าแรกที่ไม่มีข้อมูล = ไม่ผ่าน (และบอกให้ไปเช็ค env/endpoint)", () => {
  const result = assessHomePage(EMPTY_HTML);
  assert.equal(result.ok, false);
  const codes = result.issues.map((issue) => issue.code);
  assert.ok(codes.includes("no-product-count"), "ต้องจับได้ว่าไม่มีจำนวนสินค้า");
  assert.ok(codes.includes("no-news"), "ต้องจับได้ว่าไม่มีข่าว");
  const message = result.issues.find((issue) => issue.code === "no-product-count")?.message ?? "";
  assert.ok(message.includes("DATABASE_URL"), "ต้องชี้ให้ตรวจ DATABASE_URL");
  assert.ok(message.includes("pooler"), "ต้องเตือนเรื่อง URL ของ pooler");
});

test("deploy: ข้อมูลทดสอบหลุดขึ้นเว็บจริง = ไม่ผ่าน", () => {
  const result = assessHomePage(`${GOOD_HTML}<p>ข้อมูลทดสอบ</p>`);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "test-data"));
});

test("deploy: หน้าข่าวต้องอ่านจำนวนข่าวได้และมากกว่า 0", () => {
  assert.deepEqual(assessNewsListPage("<h2>ข่าวทั้งหมด 151 ข่าว</h2>"), { ok: true, total: 151 });
  assert.deepEqual(assessNewsListPage("<h2>ข่าวทั้งหมด 1,024 ข่าว</h2>"), { ok: true, total: 1024 });
  assert.equal(assessNewsListPage("<h2>ข่าว</h2>").ok, false);
  assert.equal(assessNewsListPage("<h2>ข่าวทั้งหมด 0 ข่าว</h2>").ok, false);
});

test("deploy: เตือนเมื่อ URL ที่ใช้รันเว็บเป็น pooler ของ Neon", () => {
  const pooled = "postgresql://u:p@ep-x-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
  const direct = "postgresql://u:p@ep-x.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
  assert.ok(pooledEndpointWarning(pooled)?.includes("endpoint ตรง"));
  assert.equal(pooledEndpointWarning(direct), null);
  assert.equal(pooledEndpointWarning("postgresql://waiwai:waiwai@localhost:55432/waiwai"), null);
});

test("deploy: หน้าข่าวรายชิ้น — แยกข่าวจริงออกจากหน้า 404 ด้วยหลักฐานจริง", () => {
  /* เดิมตัดสินจากข้อความในพจนานุกรม ⇒ false positive (ข้อความนั้นอยู่ใน RSC payload ของทุกหน้า) */
  const realHtml = `<h1>ว้าวสนั่นกรุง! ไวไว ว้าว เปลี่ยนรถเมล์เป็นพื้นที่แห่งความสนุก</h1>${"x".repeat(80000)}`;
  const notFoundHtml = `<title>ไม่พบหน้าที่คุณกำลังมองหา</title>${"ไม่พบหน้าที่คุณกำลังมองหา".repeat(100)}`;

  assert.equal(assessNewsArticlePage({ status: 200, html: realHtml }).ok, true);
  assert.equal(assessNewsArticlePage({ status: 404, html: notFoundHtml }).ok, false);
  assert.ok((assessNewsArticlePage({ status: 404, html: notFoundHtml }).reason ?? "").includes("404"));
  assert.equal(assessNewsArticlePage({ status: 200, html: notFoundHtml }).ok, false, "200 ที่ไม่มี h1 ต้องไม่ผ่าน");
  assert.equal(assessNewsArticlePage({ status: 200, html: "<h1>ข่าว</h1>สั้น" }).ok, false, "เนื้อหาสั้นผิดปกติต้องไม่ผ่าน");
});

test("deploy: ต้องจับหน้า 'Protected by Vercel Authentication' ได้ (ไม่ให้วินิจฉัยผิดว่า DB ว่าง)", () => {
  /* เนื้อหาจริงที่ดึงได้จาก deployment ที่ยังเปิด Deployment Protection (263 ไบต์) */
  const protectedHtml =
    "Protected by Vercel Authentication To access this deployment with an authenticated Vercel CLI, run: vercel curl <deployment-url>";

  assert.equal(isVercelProtectionPage(protectedHtml), true);
  assert.equal(isVercelProtectionPage("<html><body>Protected by Vercel Authentication</body></html>"), true);
  assert.equal(isVercelProtectionPage('<a href="https://vercel.com/sso-api?url=x">login</a>'), true);
  assert.equal(isVercelProtectionPage("<html><body>ไวไว</body></html>"), false);
  assert.equal(isVercelProtectionPage(""), false);
});

test("deploy: ต้องจับหน้า login ของ Vercel (แบบเต็ม 341 KB) ได้ด้วย — เคสจริงที่พลาดรอบแรก", () => {
  /* เนื้อหาจริงที่ดึงได้จาก deployment (ย่อ): Vercel Authentication ส่งหน้า login ของตัวเองมาแทนเว็บ */
  const loginHtml =
    '<!DOCTYPE html><html data-dpl-id="dpl_DaqY61CnpCD8fGN63NXtFj16kuWD" lang="en-US"><head><title>Login – Vercel</title></head>' +
    '<body>set-cookie: _v-visitor-id=Engxcdv0RsJCQC6xKQvI7</body></html>';

  assert.equal(isVercelProtectionPage(loginHtml), true, "ต้องจับ <title>Login – Vercel</title> ได้");
  assert.equal(isVercelProtectionPage('<html data-dpl-id="dpl_abc"><title>x</title></html>'), true);
  assert.equal(isVercelProtectionPage('<meta name="x"><title>Login - Vercel</title>'), true);
  /* และต้องไม่จับผิดหน้าเว็บจริงของเรา */
  assert.equal(isVercelProtectionPage('<html><head><title>ไวไว — หน้าแรก</title></head><body>ไวไว</body></html>'), false);
});

test("deploy: ดึง id รูปจากคลัง — ต้องไม่หลงไปโดน path ฟอนต์ของ Next (เคสจริงรอบ 122)", () => {
  const realImage = '<img src="/_next/image?url=%2Fmedia%2FJIIKynFuOs4j&w=640&q=75">';
  assert.equal(mediaIdFromHtml(realImage), "JIIKynFuOs4j");

  /* เคสจริง: ฟอนต์ของ Next อยู่ที่ /_next/static/media/… ⇒ เคยถูกดึงมาเป็น "รูปในคลัง" แล้วได้ 404/500 */
  const fontOnly = '<link rel="preload" href="/_next/static/media/411573def610439a-s.p.woff2" as="font">';
  assert.equal(mediaIdFromHtml(fontOnly), null);

  assert.equal(mediaIdFromHtml('<img src="/media/abc123">'), "abc123");
  assert.equal(mediaIdFromHtml("<html>ไม่มีรูป</html>"), null);
});
