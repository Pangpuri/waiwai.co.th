import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  parseRecipeArticlePage,
  parseRecipeCategoryPage,
  parseThaiDate,
  sourceIdOfArticlePath,
  youTubeIdOf,
} from "@/lib/recipes/import-parse";
import {
  isYouTubeVideoId,
  recipeIdOfSourceId,
  recipeTitleOf,
  validateRecipeInput,
  youTubeEmbedUrlOf,
  youTubeWatchUrlOf,
  type RecipeInput,
} from "@/lib/recipes/model";

/**
 * เทสต์ S3 ส่วนที่ 4 (รอบที่ 104) — นำเข้าเมนูอาหาร (วิดีโอ) จากเว็บเดิม
 *
 * ตัวอย่าง HTML ในไฟล์นี้ **คัดลอกโครงสร้างจริง** จาก waiwai.co.th (2026-10-05):
 * หน้าหมวด = กริด `div.item` → `a.item-image` (href + img) + `a.title` > strong
 * หน้าบทความ = `div.item-post > div.title` + og:image + `div.item-content` มี iframe YouTube + `Created:` วันที่ไทย
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/* ── fixture: หน้าหมวด (ตัดมา 2 เมนู) ─────────────────────────────────────── */

const CATEGORY_HTML = `
<html><body>
<div id="layout-view" class="layout-view layout-view-grid"><div class="row">
  <div class="item col-xs-6 col-sm-4 ">
    <div class="thumbnail">
      <a href="/th/articles/297734-%E0%B9%84%E0%B8%A7" class="item-image">
        <img src="https://cache-igetweb-v2.mt108.info/uploads/images-cache/5052/article/0ee1279361bee6e83a48defb003966a2_400x300.jpg?w=399&amp;h=299&amp;q=60">
      </a>
      <div class="caption">
        <a href="/th/articles/297734-%E0%B9%84%E0%B8%A7" class="title"><strong>ไวไวเส้นญี่ปุ่นผัดพริกเฉฉวน</strong></a>
        <ul class="item-meta"><li class="item-date">24 สิงหาคม 2024</li></ul>
      </div>
    </div>
  </div>
  <div class="item col-xs-6 col-sm-4 ">
    <div class="thumbnail">
      <a href="https://waiwai.co.th/th/articles/134712-%E0%B9%84%E0%B8%A7" class="item-image">
        <img src="https://cache-igetweb-v2.mt108.info/uploads/images-cache/5052/article/11425bec94a944629460c7da6e31e6b7_400x300.jpg">
      </a>
      <div class="caption">
        <a href="/th/articles/134712-%E0%B9%84%E0%B8%A7" class="title"><strong>ไวไวคาโบนาร่า</strong></a>
      </div>
    </div>
  </div>
</div></div>
</body></html>
`;

/* ── fixture: หน้าบทความ (มี "กับดัก" ป๊อปอัปล็อกอินมาก่อน!) ──────────────── */

const ARTICLE_HTML = `
<html><head>
<title>ไวไวคาโบนาร่า</title>
<meta property="og:image" content="https://waiwai.co.th/uploads/images-cache/5052/article/11425bec94a944629460c7da6e31e6b7_full.jpg" />
</head><body>
<div class="modal"><div class="title">เข้าสู่ระบบ</div></div>
<div class="item-post">
  <div class="title"><strong>ไวไวคาโบนาร่า</strong></div>
  <ul class="item-meta">
    <li class="item-date"><i class="fa fa-clock-o"></i> <strong>Created:</strong> 9 ตุลาคม 2018 at 09:21 </li>
  </ul>
  <div class="item-content">
    <p style="text-align: center;"><iframe src="//www.youtube.com/embed/6XkLdl6C_Xo" width="560" height="314" allowfullscreen="allowfullscreen"></iframe></p>
  </div>
  <div class="item-meta"><div class="item-post-tag"></div></div>
</div>
</body></html>
`;

/* ── 1) วันที่ไทย + id วิดีโอ ─────────────────────────────────────────────── */

test("recipes: แปลงวันที่ไทยของเว็บเดิมเป็น ISO (รวมปี พ.ศ.) และคืน null เมื่ออ่านไม่ได้", () => {
  assert.equal(parseThaiDate("9 ตุลาคม 2018 at 09:21"), "2018-10-09");
  assert.equal(parseThaiDate("5 ตุลาคม 2569"), "2026-10-05", "ปี พ.ศ. (> 2400) ต้องถูกลบ 543");
  assert.equal(parseThaiDate("1 ม.ค. 2020"), "2020-01-01", "ชื่อเดือนแบบย่อก็ได้");
  assert.equal(parseThaiDate(""), null);
  assert.equal(parseThaiDate("ไม่มีวันที่"), null);
  assert.equal(parseThaiDate("31 ไม่มีเดือนนี้ 2020"), null);
  assert.equal(parseThaiDate("9 ตุลาคม 1200"), null, "ปีนอกช่วงที่สมเหตุสมผล = null");
});

test("recipes: ดึง id วิดีโอ YouTube ได้ทุกแบบที่เว็บเดิมใช้", () => {
  assert.equal(youTubeIdOf("//www.youtube.com/embed/6XkLdl6C_Xo"), "6XkLdl6C_Xo");
  assert.equal(youTubeIdOf("https://www.youtube-nocookie.com/embed/abc_-123?x=1"), "abc_-123");
  assert.equal(youTubeIdOf("https://youtu.be/TtP-xvCIpqQ"), "TtP-xvCIpqQ");
  assert.equal(youTubeIdOf("https://www.youtube.com/watch?v=TtP-xvCIpqQ&t=3"), "TtP-xvCIpqQ");
  assert.equal(youTubeIdOf("https://vimeo.com/12345"), "");
  assert.equal(youTubeIdOf(""), "");
});

/* ── 2) ตัวแกะหน้าเว็บ ───────────────────────────────────────────────────── */

test("recipes: แกะหน้าหมวดได้ครบ (ชื่อ · พาธ · ภาพปกย่อ) และเรียงตามที่ปรากฏ", () => {
  const cards = parseRecipeCategoryPage(CATEGORY_HTML);
  assert.equal(cards.length, 2);

  const first = cards[0];
  const second = cards[1];
  assert.ok(first !== undefined && second !== undefined);

  assert.equal(first.sourceId, "297734");
  assert.equal(first.detailPath, "/th/articles/297734-%E0%B9%84%E0%B8%A7");
  assert.equal(first.title, "ไวไวเส้นญี่ปุ่นผัดพริกเฉฉวน");
  assert.ok(first.coverUrl.endsWith("0ee1279361bee6e83a48defb003966a2_400x300.jpg?w=399&h=299&q=60"), "ต้องถอด &amp; แล้วเก็บ URL ภาพย่อ");

  assert.equal(second.sourceId, "134712");
  assert.equal(second.detailPath, "/th/articles/134712-%E0%B9%84%E0%B8%A7", "href แบบ URL เต็มต้องกลายเป็นพาธ (มติ D9)");
  assert.equal(second.title, "ไวไวคาโบนาร่า");
});

test("recipes: หน้าหมวดว่าง/ไม่ใช่หน้านี้ = ไม่คืนเมนู (ไม่พัง)", () => {
  assert.deepEqual([...parseRecipeCategoryPage("<html><body>ไม่มีอะไร</body></html>")], []);
});

test("recipes: แกะหน้าบทความ — ต้องไม่ถูกป๊อปอัปล็อกอินหลอก (บทเรียนจริง)", () => {
  const parsed = parseRecipeArticlePage(ARTICLE_HTML);
  assert.equal(parsed.title, "ไวไวคาโบนาร่า", "ห้ามได้ 'เข้าสู่ระบบ' จาก div.title ตัวแรกของหน้า");
  assert.equal(parsed.videoId, "6XkLdl6C_Xo");
  assert.equal(parsed.publishedOn, "2018-10-09");
  assert.equal(parsed.publishedLabel, "9 ตุลาคม 2018 at 09:21");
  assert.ok(parsed.coverUrl.endsWith("11425bec94a944629460c7da6e31e6b7_full.jpg"));
});

test("recipes: หน้าบทความที่ไม่มีวิดีโอ = videoId ว่าง (ผู้เรียกจะข้ามแถวนั้น)", () => {
  const parsed = parseRecipeArticlePage("<html><body><div class='item-post'><div class='title'>ก</div></div></body></html>");
  assert.equal(parsed.videoId, "");
  assert.equal(parsed.publishedOn, null);
});

test("recipes: source id ออกมาจากพาธบทความ", () => {
  assert.equal(sourceIdOfArticlePath("/th/articles/134712-%E0%B9%84%E0%B8%A7"), "134712");
  assert.equal(sourceIdOfArticlePath("/th/pages/15136-x"), "");
});

/* ── 3) โมเดล/ตัวตรวจ ───────────────────────────────────────────────────── */

const validRecipe: RecipeInput = {
  id: recipeIdOfSourceId("134712"),
  sourceId: "134712",
  sourceUrl: "/th/articles/134712-x",
  titleTh: "ไวไวคาโบนาร่า",
  titleEn: "",
  videoId: "6XkLdl6C_Xo",
  publishedOn: "2018-10-09",
  sortOrder: 0,
};

test("recipes: ข้อมูลที่ถูกต้องผ่าน · ที่ผิดถูกจับครบ", () => {
  assert.deepEqual([...validateRecipeInput(validRecipe)], []);

  const bad = validateRecipeInput({ ...validRecipe, id: "recipe-1", sourceId: "abc", titleTh: " ", videoId: "สั้น", publishedOn: "9/10/2018", sortOrder: -1, sourceUrl: "https://waiwai.co.th/x" });
  assert.deepEqual(
    bad.map((issue) => issue.code).sort(),
    ["bad-date", "bad-order", "bad-source-id", "bad-source-url", "bad-video-id", "empty-title", "id-mismatch"],
  );

  assert.equal(isYouTubeVideoId("6XkLdl6C_Xo"), true);
  assert.equal(isYouTubeVideoId("สั้น"), false);
  assert.equal(isYouTubeVideoId(""), false);
});

test("recipes: URL ที่ประกอบขึ้นใช้ youtube-nocookie + ลิงก์ดูที่ YouTube แยกกัน", () => {
  assert.equal(youTubeEmbedUrlOf("6XkLdl6C_Xo"), "https://www.youtube-nocookie.com/embed/6XkLdl6C_Xo?autoplay=1&rel=0");
  assert.equal(youTubeWatchUrlOf("6XkLdl6C_Xo"), "https://www.youtube.com/watch?v=6XkLdl6C_Xo");
  assert.ok(youTubeEmbedUrlOf("x").includes("nocookie"), "ต้องไม่ตั้งคุกกี้ของผู้ใช้ผ่านโดเมนหลักของ YouTube");
});

test("recipes: ชื่อเมนูตามภาษา — อังกฤษว่าง = ถอยไปใช้ไทย", () => {
  assert.equal(recipeTitleOf("ไวไวคาโบนาร่า", "", "en"), "ไวไวคาโบนาร่า");
  assert.equal(recipeTitleOf("ไวไวคาโบนาร่า", "Wai Wai Carbonara", "en"), "Wai Wai Carbonara");
  assert.equal(recipeTitleOf("ไวไวคาโบนาร่า", "Wai Wai Carbonara", "th"), "ไวไวคาโบนาร่า");
});

/* ── 4) กติกาความเป็นส่วนตัว + ที่ตั้งไฟล์ ───────────────────────────────── */

test("recipes: facade ต้องโหลดวิดีโอ 'หลังผู้ใช้กด' เท่านั้น และเป็น client component", () => {
  const facade = sourceOf("features/recipes/ui/video-facade.tsx");
  assert.ok(facade.startsWith('"use client";'), "facade ต้องเป็น client component");
  assert.ok(facade.includes("useState"), "ต้องมีสถานะ 'ยังไม่เล่น → เล่น'");
  assert.ok(facade.includes("youtube-nocookie.com"), "ผู้เล่นต้องมาจากโดเมนปลอดคุกกี้");

  /* ⚠️ ตัว component ที่เรนเดอร์บนเซิร์ฟเวอร์ต้อง **ไม่มี** iframe ตรง ๆ */
  const list = sourceOf("features/recipes/ui/recipe-video-list.tsx");
  assert.ok(!list.includes("<iframe"), "ห้ามฝัง iframe ในฝั่งเซิร์ฟเวอร์ (จะส่งข้อมูลผู้ใช้ก่อนกด)");
  assert.ok(list.includes("VideoFacade"), "ต้องเรนเดอร์ผ่าน facade");
  assert.ok(!list.includes('"use client"'), "รายการเมนูเป็น Server Component (ไม่เพิ่ม JS ทั้งก้อน)");

  const page = sourceOf("app/[lang]/recipes/page.tsx");
  assert.ok(page.includes("RecipeVideoList"), "หน้า /recipes ต้องแสดงรายการเมนูจากฐานข้อมูล");
  assert.ok(page.includes("listRecipes("), "อ่านเมนูจากฐานข้อมูลจริง");
});
