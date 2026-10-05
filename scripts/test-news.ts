import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  newsBlocksFromHtml,
  newsImageVariantUrl,
  parseNewsArticlePage,
  parseNewsListingPage,
  sourceIdOfNewsPath,
} from "@/lib/news/import-parse";
import { MAX_NEWS_BLOCKS, newsBodyImageIds, newsBodyPlainText, parseNewsBody, validateNewsBody } from "@/lib/news/body";
import {
  formatNewsDate,
  newsIdOfSourceId,
  newsInstantOf,
  newsPathOfId,
  newsPathOfSourceId,
  newsSourceIdOfId,
  validateNewsInput,
  type NewsInput,
} from "@/lib/news/model";

/**
 * เทสต์ หน้า /news (รอบที่ 105) — นำเข้าข่าวสาร & กิจกรรมจากเว็บเดิม
 *
 * ตัวอย่าง HTML ในไฟล์นี้ **คัดลอกโครงสร้างจริง** จาก waiwai.co.th (2026-10-05):
 * - หน้าข่าว = กริด `div.item` → `a.item-image` (href + ภาพย่อ 400×300) + `a.title`
 *   + `ul.item-meta` (วันที่ไทย) + `div.item-description` (คำโปรย)
 * - หน้าข่าวเดี่ยว = `div.item-post > div.title` + `Created:` + `div.item-content`
 *   ⚠️ เนื้อหา **วางมาจาก Facebook** ⇒ มีตาราง/span/style ปนมา และรูป **ไม่มี alt**
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/* ── fixture: หน้าข่าว (2 การ์ด · การ์ดที่สองใช้ URL เต็ม) ──────────────────── */

const LISTING_HTML = `
<div id="layout-view"><div class="row">
  <div class="item col-xs-6 col-sm-4 ">
    <div class="thumbnail">
      <a href="/th/news/148398-%E0%B8%A7%E0%B9%89%E0%B8%B2%E0%B8%A7" class="item-image">
        <img src="https://cache-igetweb-v2.mt108.info/uploads/images-cache/5052/news/101d392c6d99d30c4849d36a7f914ed7_400x300.jpg?w=399&amp;h=299&amp;q=60">
      </a>
      <div class="caption">
        <a href="/th/news/148398-%E0%B8%A7%E0%B9%89%E0%B8%B2%E0%B8%A7" class="title"><strong>ว้าวสนั่นกรุง &ldquo;ไวไว ว้าว&rdquo;</strong></a>
        <ul class="item-meta">
          <li class="item-date"> <i class="fa fa-clock-o"></i> 12 กันยายน 2026 11:28 </li>
          <li class="item-views"> <i class="fa fa-eye"></i> 198 </li>
        </ul>
        <div class="item-description">&nbsp; ว้าวสนั่นกรุง! &ldquo;ไวไว ว้าว&rdquo; ปล่อย &ldquo;WOW BUS&rdquo; &nbsp;</div>
      </div>
    </div>
  </div>
  <div class="item col-xs-6 col-sm-4 ">
    <div class="thumbnail">
      <a href="https://waiwai.co.th/th/news/61287-%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B9%80%E0%B8%9E" class="item-image">
        <img src="https://cache-igetweb-v2.mt108.info/uploads/images-cache/5052/news/aaaabbbb_400x300.jpg">
      </a>
      <div class="caption">
        <a href="/th/news/61287-%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B9%80%E0%B8%9E" class="title"><strong>ประเพณีทิ้งทานกระจาด</strong></a>
        <ul class="item-meta"><li class="item-date"> <i class="fa fa-clock-o"></i> 20 กันยายน 2018 09:00 </li></ul>
        <div class="item-description">งานประเพณีประจำปี</div>
      </div>
    </div>
  </div>
</div></div>
`;

/* ── fixture: หน้าเนื้อหา (มีกับดัก div.title ของป๊อปอัป + HTML จาก Facebook) ── */

const ARTICLE_HTML = `
<html><head>
<title>ไวไว - ว้าวสนั่นกรุง</title>
<meta property="og:image" content="https://waiwai.co.th/uploads/images-cache/5052/news/101d392c6d99d30c4849d36a7f914ed7_full.jpg" />
</head><body>
<div class="modal"><div class="title">เข้าสู่ระบบ</div></div>
<div class="item-post">
  <div class="title"><strong>ว้าวสนั่นกรุง &ldquo;ไวไว ว้าว&rdquo;</strong></div>
  <ul class="item-meta">
    <li class="item-date"><strong>Created:</strong> 12 กันยายน 2026 11:28 </li>
  </ul>
  <div class="item-content">
    <p style="text-align: center;">&nbsp;</p>
    <table style="height: 83px;"><tbody><tr><td>
      <div class="xdj266r x14z9mp" style="white-space: pre-wrap;">บรรทัดแรกจาก Facebook<br>บรรทัดที่สอง</div>
    </td></tr></tbody></table>
    <p><img src="/uploads/images-cache/5052/filemanager/aaa_full.JPG" width="650" /></p>
    <p><img src="/uploads/images-cache/5052/filemanager/aaa_full.JPG" /></p>
    <h1>หัวข้อย่อยในเนื้อหา</h1>
    <p>ปิดท้ายด้วยข้อความ</p>
    <p><img src="/uploads/images-cache/5052/filemanager/bbb_full.JPG" /></p>
    <script>var x = 1;</script>
    <style>.a { color: red; }</style>
  </div>
  <div class="item-meta"><div class="item-post-tag"></div></div>
</div>
</body></html>
`;

/* ── 1) ตัวแกะหน้าเว็บ ───────────────────────────────────────────────────── */

test("news: แกะหน้ารายการได้ครบ (ชื่อ · วันที่ไทย · คำโปรย · ภาพย่อ) และเรียงตามที่ปรากฏ", () => {
  const cards = parseNewsListingPage(LISTING_HTML);
  assert.equal(cards.length, 2);

  const first = cards[0];
  const second = cards[1];
  assert.ok(first !== undefined && second !== undefined);

  assert.equal(first.sourceId, "148398");
  assert.equal(first.detailPath, "/th/news/148398-%E0%B8%A7%E0%B9%89%E0%B8%B2%E0%B8%A7");
  assert.equal(first.title, "ว้าวสนั่นกรุง “ไวไว ว้าว”", "ต้องถอด entity ให้เป็นอักขระจริง");
  assert.equal(first.publishedLabel, "12 กันยายน 2026 11:28");
  assert.equal(first.publishedLocal, "2026-09-12T11:28", "วันที่ต้องเป็นเวลาไทยแบบไม่มีเขตเวลา");
  assert.equal(first.excerpt, "ว้าวสนั่นกรุง! “ไวไว ว้าว” ปล่อย “WOW BUS”");
  assert.ok(first.coverUrl.endsWith("101d392c6d99d30c4849d36a7f914ed7_400x300.jpg?w=399&h=299&q=60"));

  assert.equal(second.sourceId, "61287");
  assert.equal(second.detailPath, "/th/news/61287-%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B9%80%E0%B8%9E", "URL เต็มต้องกลายเป็นพาธ (มติ D9)");
});

test("news: หน้ารายการว่าง = ไม่คืนการ์ด (ไม่พัง)", () => {
  assert.deepEqual([...parseNewsListingPage("<html><body>ไม่มีอะไร</body></html>")], []);
});

test("news: เปลี่ยน URL รูปเป็นรุ่นย่อ 1024×768 (และไม่แตะ URL ที่ไม่มีรูปแบบ)", () => {
  assert.equal(
    newsImageVariantUrl("https://x/uploads/filemanager/aaa_full.JPG", "1024x768"),
    "https://x/uploads/filemanager/aaa_1024x768.JPG",
  );
  assert.equal(newsImageVariantUrl("https://x/news/bbb_full.jpg", "400x300"), "https://x/news/bbb_400x300.jpg");
  assert.equal(
    newsImageVariantUrl("https://x/news/ccc_400x300.jpg?w=399&h=299", "1024x768"),
    "https://x/news/ccc_1024x768.jpg?w=399&h=299",
  );
  assert.equal(newsImageVariantUrl("https://x/plain/photo.jpg", "1024x768"), "https://x/plain/photo.jpg");
  assert.equal(newsImageVariantUrl("", "1024x768"), "");
});

test("news: id ข่าวออกมาจากพาธ", () => {
  assert.equal(sourceIdOfNewsPath("/th/news/148398-ว้าวสนั่นกรุง"), "148398");
  assert.equal(sourceIdOfNewsPath("/th/news"), "");
});

/* ── 2) เนื้อหา: HTML จาก Facebook → บล็อก ───────────────────────────────── */

test("news: แกะเนื้อหาเป็นบล็อกเรียงลำดับ (ย่อหน้า/หัวข้อ/รูป) — ตัดตาราง/สคริปต์/สไตล์ทิ้ง", () => {
  const blocks = newsBlocksFromHtml(ARTICLE_HTML.match(/<div class="item-content">([\s\S]*?)<\/div>\s*<div class="item-meta">/)?.[1] ?? "");

  assert.deepEqual(
    blocks.map((block) => block.kind),
    ["paragraph", "paragraph", "image", "heading", "paragraph", "image"],
    "บรรทัด &nbsp; ต้องถูกตัด · รูปที่วางซ้ำ **ติดกัน** ต้องยุบเหลือใบเดียว (แต่รูปต่างใบยังอยู่)",
  );

  const texts = blocks.filter((block): block is { kind: "paragraph" | "heading"; text: string } => block.kind !== "image");
  assert.deepEqual(
    texts.map((block) => block.text),
    ["บรรทัดแรกจาก Facebook", "บรรทัดที่สอง", "หัวข้อย่อยในเนื้อหา", "ปิดท้ายด้วยข้อความ"],
    "ข้อความในตาราง Facebook ต้องถูกเก็บ · <br> ต้องแยกบรรทัด · <h1> ต้องเป็นหัวข้อ",
  );

  const image = blocks.find((block) => block.kind === "image");
  assert.equal(image?.kind === "image" ? image.sourceUrl : "", "/uploads/images-cache/5052/filemanager/aaa_full.JPG");
  assert.ok(!blocks.some((block) => block.kind !== "image" && block.text.includes("var x")), "script ต้องถูกตัดออก");
});

test("news: แกะหน้าข่าวเดี่ยว — ต้องไม่ถูกป๊อปอัปล็อกอินหลอก และอ่านวันที่จาก Created", () => {
  const parsed = parseNewsArticlePage(ARTICLE_HTML);
  assert.equal(parsed.title, "ว้าวสนั่นกรุง “ไวไว ว้าว”");
  assert.equal(parsed.publishedLocal, "2026-09-12T11:28");
  assert.equal(parsed.publishedLabel, "12 กันยายน 2026 11:28");
  assert.ok(parsed.body.some((block) => block.kind === "image"), "ต้องมีบล็อกรูป");
});

test("news: เนื้อหาว่าง/สคริปต์ล้วน = ไม่มีบล็อก", () => {
  assert.deepEqual([...newsBlocksFromHtml("<script>var a=1;</script><p>&nbsp;</p>")], []);
});

/* ── 3) ตัวอ่านบล็อกจากข้อมูลไม่น่าเชื่อถือ ─────────────────────────────────── */

test("news: parseNewsBody กรองบล็อกเพี้ยน/ไม่รู้จัก และคุมเพดานรูป", () => {
  const parsed = parseNewsBody([
    { type: "paragraph", text: "  ย่อหน้า   ปกติ " },
    { type: "unknown", text: "ข้าม" },
    { type: "paragraph", text: "   " },
    { type: "heading", text: "หัวข้อ" },
    { type: "image", mediaId: "abc", alt: "" },
    { type: "image", mediaId: "", alt: "ไม่มี id" },
    null,
    "ข้อความลอย",
  ]);

  assert.deepEqual(
    parsed.map((block) => block.type),
    ["paragraph", "heading", "image"],
  );
  assert.equal(parsed[0]?.type === "paragraph" ? parsed[0].text : "", "ย่อหน้า ปกติ", "ต้องยุบช่องว่างซ้ำ");
  assert.equal(newsBodyPlainText(parsed), "ย่อหน้า ปกติ\n\nหัวข้อ");
  assert.deepEqual([...newsBodyImageIds(parsed)], ["abc"]);

  const many = parseNewsBody(
    Array.from({ length: MAX_NEWS_BLOCKS + 50 }, (_, index) => ({ type: "paragraph", text: `บรรทัด ${index}` })),
  );
  assert.equal(many.length, MAX_NEWS_BLOCKS, "ต้องตัดที่เพดานบล็อก");
});

test("news: validateNewsBody จับเนื้อหาว่าง/รูปไม่มี id/รูปไม่มี alt", () => {
  assert.deepEqual(validateNewsBody([], "body").map((issue) => issue.code), ["body-empty"]);

  const issues = validateNewsBody(
    [
      { type: "image", mediaId: "", alt: "" },
      { type: "paragraph", text: "มีข้อความ" },
    ],
    "body",
  );
  assert.deepEqual(issues.map((issue) => issue.code).sort(), ["image-no-alt", "image-no-media"]);

  assert.deepEqual([...validateNewsBody([{ type: "paragraph", text: "อ่านได้" }], "body")], []);
});

/* ── 4) โมเดล/วันที่/ตัวตรวจ ──────────────────────────────────────────────── */

test("news: id/พาธ ไป-กลับได้ และวันที่แปลงเป็นค่า timestamptz ของเวลาไทย", () => {
  assert.equal(newsIdOfSourceId("148398"), "n148398");
  assert.equal(newsSourceIdOfId("n148398"), "148398");
  assert.equal(newsPathOfSourceId("148398"), "/news/148398");
  assert.equal(newsPathOfId("n148398"), "/news/148398");
  assert.equal(newsInstantOf("2026-09-12T11:28"), "2026-09-12T11:28:00+07:00");
  assert.equal(newsInstantOf(null), null);
});

test("news: แสดงวันที่ตามภาษา (ไทย = พ.ศ. · อังกฤษ = ค.ศ.) และมีเวลาเมื่อขอ", () => {
  const th = formatNewsDate("2026-09-12T11:28", "th");
  const en = formatNewsDate("2026-09-12T11:28", "en");
  assert.ok(th.includes("2569"), `ไทยต้องเป็นพุทธศักราช (ได้ "${th}")`);
  assert.equal(en, "12 September 2026");
  assert.ok(formatNewsDate("2026-09-12T11:28", "th", true).includes("11:28"));
  assert.equal(formatNewsDate(null, "th"), "");
});

const validNews: NewsInput = {
  id: newsIdOfSourceId("148398"),
  sourceId: "148398",
  sourceUrl: "/th/news/148398-x",
  titleTh: "ว้าวสนั่นกรุง",
  titleEn: "",
  excerptTh: "คำโปรย",
  excerptEn: "",
  publishedLocal: "2026-09-12T11:28",
  publishedLabel: "12 กันยายน 2026 11:28",
};

test("news: ข้อมูลที่ถูกต้องผ่าน · ที่ผิดถูกจับครบ", () => {
  assert.deepEqual([...validateNewsInput(validNews)], []);

  const bad = validateNewsInput({
    ...validNews,
    id: "news-1",
    sourceId: "abc",
    titleTh: " ",
    excerptTh: "x".repeat(700),
    publishedLocal: "12/09/2026",
    sourceUrl: "https://waiwai.co.th/th/news/1",
  });
  assert.deepEqual(
    bad.map((issue) => issue.code).sort(),
    ["bad-date", "bad-source-id", "bad-source-url", "empty-title", "excerpt-too-long", "id-mismatch"],
  );
});

/* ── 5) กติกาหน้าเว็บ (สแกนซอร์ส) ─────────────────────────────────────────── */

test("news: หน้ารายการ/หน้าแบ่งหน้า เป็น static + ISR และไม่เพิ่ม JS ในส่วนรายการ", () => {
  const listPage = sourceOf("app/[lang]/news/page.tsx");
  assert.ok(listPage.includes("export const revalidate = 300;"), "ต้องประกาศ revalidate (ISR)");
  assert.ok(listPage.includes("listNews("), "ต้องอ่านข่าวจริงจากฐานข้อมูล");
  assert.ok(listPage.includes("countNews("), "ต้องรู้จำนวนทั้งหมดเพื่อแบ่งหน้า");
  assert.ok(!listPage.includes("searchParams"), "ห้ามใช้ searchParams (ทำให้หน้าเป็น dynamic)");

  const pageN = sourceOf("app/[lang]/news/page/[page]/page.tsx");
  assert.ok(pageN.includes("export const revalidate = 300;"));
  assert.ok(pageN.includes("notFound()"), "เกินจำนวนหน้า = 404 ไม่ใช่หน้าว่าง");

  const list = sourceOf("features/news/ui/news-list.tsx");
  assert.ok(!list.includes('"use client"'), "รายการข่าวต้องเป็น Server Component (ไม่เพิ่ม JS)");
  assert.ok(
    list.includes("localePath(language, newsPathOfSourceId(record.sourceId))"),
    "ลิงก์การ์ดต้องเติมภาษา (ห้าม hard-code /th)",
  );
});

test("news: หน้ารายละเอียดเรนเดอร์เนื้อหาที่ผ่านการตรวจแล้ว และยัง noindex", () => {
  const detail = sourceOf("app/[lang]/news/[id]/page.tsx");
  assert.ok(detail.includes("export const revalidate = 300;"));
  assert.ok(detail.includes("<NewsBody"), "ต้องเรนเดอร์ผ่านตัวเรนเดอร์บล็อก (ไม่ใช่ HTML ดิบ)");
  assert.ok(!detail.includes("dangerouslySetInnerHTML"), "ห้ามฉีด HTML จากฐานข้อมูล");
  assert.ok(detail.includes("robots: { index: false, follow: false }"), "ยังต้อง noindex จนเจ้าของอนุมัติ");
  assert.ok(detail.includes("loadMediaSizes"), "ต้องอ่านขนาดรูปจากคลังเพื่อกันภาพกระตุก (CLS)");

  const body = sourceOf("features/news/ui/news-body.tsx");
  assert.ok(!body.includes("dangerouslySetInnerHTML"));
  assert.ok(body.includes("block.text"), "ข้อความต้องเรนเดอร์เป็นข้อความล้วน");
});

test("news: สคริปต์นำเข้ามีตัวช่วยกลาง + เพดานขนาดรูปกันไฟล์ยักษ์", () => {
  const script = sourceOf("scripts/import-news.ts");
  assert.ok(script.includes("ensureImportedMedia"), "ต้องใช้ตัวช่วยกลาง (dedupe sha256) ไม่เขียนซ้ำ");
  assert.ok(script.includes("maxBytes: MAX_IMAGE_BYTES"), "ต้องมีเพดานขนาดรูป (ต้นฉบับ 4–5 MB/ใบ)");
  assert.ok(script.includes('BODY_IMAGE_SIZE = "1024x768"'), "รูปในเนื้อหาต้องเป็นรุ่น 1024×768 ตามมติ");

  const media = sourceOf("lib/import/media.ts");
  assert.ok(media.includes("maxBytes"), "ตัวช่วยกลางต้องรองรับเพดานขนาดไฟล์");
});
