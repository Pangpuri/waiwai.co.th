import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  isYouTubeVideoId,
  recipeIdOfSourceId,
  validateRecipeInput,
  youTubeEmbedUrlOf,
  youTubeIdFromInput,
  youTubeWatchUrlOf,
  type RecipeInput,
} from "@/lib/recipes/model";

/**
 * เทสต์หลังบ้านเมนูอาหาร (รอบที่ 135) — "จอ WordPress ง่าย ๆ" ที่ต้องไม่ทำข้อมูลเดิมเสียหาย
 *
 * หัวใจของรอบนี้
 * - **เว็บสาธารณะเห็นเฉพาะ "เผยแพร่และไม่ถังขยะ"** — ถ้าลืมกรองที่ใด ร่างจะหลุดขึ้นเว็บทันที
 * - **รหัสเมนูถูกล็อก** — id ต้อง derive จาก `source_id` (บทเรียนรอบที่ 134)
 * - **กันสร้างซ้ำ** — กดบันทึกซ้ำหลังสร้างใหม่ ต้องเป็นการแก้ ไม่ใช่สร้างเมนูที่สอง
 * - **ห้าม `<form>` ซ้อน** · **พรีวิวใช้เรนเดอร์ตัวเดียวกับหน้าเว็บ** (`RecipeVideoList`)
 */

/* ── ตรรกะล้วน (ไม่ต้องมี DB) ─────────────────────────────────────────────── */

test("recipes admin: รหัสเมนูต้อง derive จาก source id เสมอ (r<source_id>)", () => {
  assert.equal(recipeIdOfSourceId("134712"), "r134712");
  assert.equal(recipeIdOfSourceId("  134712  "), "r134712", "ตัดช่องว่างหัวท้ายก่อน");
});

test("recipes admin: รหัสวิดีโอ YouTube — รับของจริง ปฏิเสธ URL/ตัวอักษรแปลก", () => {
  assert.equal(isYouTubeVideoId("dQw4w9WgXcQ"), true);
  assert.equal(isYouTubeVideoId("  dQw4w9WgXcQ  "), true);
  assert.equal(isYouTubeVideoId("สั้น"), false);
  assert.equal(isYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ"), false, "ต้องเก็บเฉพาะ id ไม่เก็บ URL");
  assert.equal(isYouTubeVideoId("abc def"), false);
  assert.equal(youTubeEmbedUrlOf("dQw4w9WgXcQ").includes("youtube-nocookie.com"), true, "ผู้เล่นต้องเป็นโดเมนปลอดคุกกี้");
  assert.equal(youTubeWatchUrlOf("dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});

test("recipes admin: validator กลางปฏิเสธค่าที่ทำให้เว็บพัง", () => {
  const base: RecipeInput = {
    id: "r134712",
    sourceId: "134712",
    sourceUrl: "/th/articles/134712-x",
    titleTh: "เมนูทดสอบ",
    titleEn: "",
    videoId: "dQw4w9WgXcQ",
    publishedOn: "2018-10-09",
    sortOrder: 0,
  };

  assert.deepEqual(validateRecipeInput(base), [], "ค่าถูกต้องต้องผ่าน");
  assert.ok(validateRecipeInput({ ...base, id: "r999" }).some((issue) => issue.code === "id-mismatch"));
  assert.ok(validateRecipeInput({ ...base, titleTh: "   " }).some((issue) => issue.code === "empty-title"));
  assert.ok(validateRecipeInput({ ...base, videoId: "ไม่ใช่-id" }).some((issue) => issue.code === "bad-video-id"));
  assert.ok(validateRecipeInput({ ...base, publishedOn: "9/10/2018" }).some((issue) => issue.code === "bad-date"));
  assert.ok(validateRecipeInput({ ...base, sortOrder: -1 }).some((issue) => issue.code === "bad-order"));
  assert.deepEqual(
    validateRecipeInput({ ...base, publishedOn: null }),
    [],
    "ไม่ระบุวันเผยแพร่ต้องผ่าน (เว็บเดิมมีเมนูที่อ่านวันไม่ได้)",
  );
});

/* ── ตรวจซอร์ส: กฎที่ "ห้ามลืม" ───────────────────────────────────────────── */

const repository = readFileSync("lib/recipes/repository.ts", "utf8");
const actions = readFileSync("app/admin/recipes/actions.ts", "utf8");
const listPage = readFileSync("app/admin/recipes/page.tsx", "utf8");
const editorPage = readFileSync("app/admin/recipes/[id]/page.tsx", "utf8");
const editorForm = readFileSync("features/admin/ui/recipe-editor-form.tsx", "utf8");
const publicList = readFileSync("features/recipes/ui/recipe-video-list.tsx", "utf8");
const auditLabels = readFileSync("features/admin/audit-labels.ts", "utf8");

const formTags = (value: string): number => (value.match(/<form[ \n]/g) ?? []).length;

test("recipes admin: ฝั่งเว็บสาธารณะต้องกรองเฉพาะ 'เผยแพร่และไม่ถังขยะ'", () => {
  assert.ok(repository.includes("PUBLIC_RECIPE_CONDITION"), "ต้องมีค่าคงที่เงื่อนไขกลาง");
  assert.ok(
    /r\.status = 'published' and r\.deleted_at is null/.test(repository),
    "เงื่อนไขต้องกันทั้งสถานะร่างและของในถังขยะ",
  );
  assert.ok(
    /where \$\{PUBLIC_RECIPE_CONDITION\}/.test(repository),
    "คำสั่งอ่านฝั่งเว็บต้องใช้เงื่อนไขนี้จริง (ไม่ใช่ประกาศทิ้งไว้)",
  );
});

test("recipes admin: ทุก action ต้องตรวจสิทธิ์ + เขียน audit + สั่งสร้างหน้าเว็บใหม่", () => {
  const permissionChecks = (actions.match(/requireAdminUser\("content"\)/g) ?? []).length;
  assert.ok(permissionChecks >= 5, `ต้องตรวจสิทธิ์ทุก action (พบ ${String(permissionChecks)} ครั้ง)`);
  assert.equal(
    (actions.match(/^export async function/gm) ?? []).length,
    5,
    "ไฟล์นี้มี 5 action (บันทึก · ย้าย/กู้คืนถังขยะ · อัปโหลดภาพ · ลบถาวร · กู้คืนประวัติ)",
  );
  assert.ok(actions.includes("recordAudit("), "ทุกการแก้เนื้อหาต้องมีร่องรอย audit");
  assert.ok(actions.includes('refreshPublicSite("page")'), "บันทึกแล้วต้องสั่งสร้างหน้าเว็บใหม่ (ISR)");
  assert.ok(actions.includes("validateRecipeInput("), "ต้องตรวจค่าที่รับจากเบราว์เซอร์ด้วย validator กลาง");
  assert.ok(actions.includes("storeImageFile("), "ต้องใช้ท่ออัปโหลดกลาง (ย่อภาพ/ตรวจหัวไฟล์/เพดาน 5MB)");
});

test("recipes admin: รหัสเมนูถูกล็อก — ห้ามใช้ id ที่ส่งมาจากเบราว์เซอร์ตรง ๆ", () => {
  assert.ok(actions.includes("recipeIdOfSourceId("), "id ต้อง derive จาก source id ด้วยตัวช่วยกลาง");
  assert.ok(!/\?\s*`r\$\{/.test(actions), "ต้องไม่มีการประกอบ `r${...}` เองใน action");
  assert.ok(actions.includes("existing?.sourceId"), "ต้องอ่าน source id ของแถวเดิมมาใช้ ไม่ใช่ค่าที่ฟอร์มส่งมา");
});

test("recipes admin: แก้เมนูต้องไม่แตะ source_id/source_url (ลิงก์เดิมต้องอยู่)", () => {
  const updateBlock = repository.slice(repository.indexOf("export async function updateRecipeForAdmin"));
  const updateSql = updateBlock.slice(0, updateBlock.indexOf(");"));
  assert.ok(!updateSql.includes("source_id"), "update ต้องไม่เขียน source_id ทับ");
  assert.ok(!updateSql.includes("source_url"), "update ต้องไม่เขียน source_url ทับ");
});

test("recipes admin: พรีวิวต้องใช้ตัวเรนเดอร์เดียวกับหน้าเว็บจริง (กัน 'พรีวิวโกหก')", () => {
  assert.ok(
    /import \{ RecipeVideoList, type RecipeVideoListStrings \} from "@\/features\/recipes\/ui\/recipe-video-list"/.test(editorForm),
    "พรีวิวต้อง import RecipeVideoList ตัวเดียวกับหน้า /recipes",
  );
  assert.ok(editorForm.includes("<RecipeVideoList"), "ต้องเรนเดอร์การ์ดผ่าน RecipeVideoList");
  assert.equal(
    (publicList.match(/export function RecipeVideoList/g) ?? []).length,
    1,
    "ต้องมีตัวเรนเดอร์รายการเมนูเพียงตัวเดียวในระบบ",
  );
  assert.ok(!editorForm.includes("dangerouslySetInnerHTML"), "พรีวิวห้ามตีความเป็น HTML");
});

test("recipes admin: ห้ามมี <form> ซ้อน <form> (บทเรียนรอบที่ 129)", () => {
  assert.equal(formTags(editorForm), 1, "จอแก้เมนูมีแท็ก <form> ได้เพียงตัวเดียว (ฟอร์มบันทึก)");
  assert.ok(editorForm.includes("uploadRecipeImageAction("), "ปุ่มอัปโหลดต้องเรียก Server Action เอง (ไม่ใช้ <form>)");
  /* หน้ารายการมี 2 ฟอร์ม: ค้นหา (GET) + ย้ายเข้าถังขยะ (action) — ต้องเป็นพี่น้องกัน ไม่ซ้อนกัน */
  assert.equal(formTags(listPage), 3, "หน้ารายการมี <form> 3 ตัว (ค้นหา + ย้าย/กู้คืน + ลบถาวร) เป็นพี่น้องกัน");
  const searchFormEnd = listPage.indexOf("</form>");
  const trashFormStart = listPage.indexOf("action={trashRecipeAction}");
  assert.ok(searchFormEnd >= 0 && trashFormStart > searchFormEnd, "ฟอร์มถังขยะต้องอยู่นอกฟอร์มค้นหา");
  assert.ok(
    listPage.indexOf("action={deleteRecipeForeverAction}") > searchFormEnd,
    "ฟอร์มลบถาวรต้องอยู่นอกฟอร์มค้นหา",
  );
});

test("recipes admin: กันสร้างเมนูซ้ำ — หลังสร้างสำเร็จต้องใช้ id ที่เซิร์ฟเวอร์คืนมา", () => {
  /* ถ้าไม่ทำ: กดบันทึกซ้ำบนหน้า /new จะสร้างเมนูที่สอง (เคสจริงของ pattern นี้) */
  assert.ok(editorForm.includes("state.createdId"), "ฟอร์มต้องใช้ createdId จาก Server Action");
  assert.ok(editorForm.includes("const effectiveId"), "ต้องคำนวณ id ที่จะส่งจริงก่อนเรนเดอร์");
});

test("recipes admin: audit ใหม่ต้องมีป้ายข้อความครบ", () => {
  for (const action of ["recipe-save", "recipe-trash", "recipe-restore", "recipe-delete"]) {
    assert.ok(auditLabels.includes(`"${action}"`), `audit-labels ต้องมีป้ายของ ${action}`);
  }
});

test("recipes admin: หน้าจอหลังบ้านต้องตรวจสิทธิ์ที่หน้าเพจด้วย", () => {
  assert.ok(listPage.includes('requireAdminUser("content")'), "/admin/recipes ต้องตรวจสิทธิ์ก่อนอ่านข้อมูล");
  assert.ok(editorPage.includes('requireAdminUser("content")'), "/admin/recipes/[id] ต้องตรวจสิทธิ์ก่อนอ่านข้อมูล");
});

/* ── รอบที่ 136: วาง "ลิงก์ YouTube เต็ม" แล้วดึงรหัสให้เอง ─────────────────── */

test("recipes admin: ดึงรหัสวิดีโอจากลิงก์ทุกรูปแบบที่ YouTube ให้คัดลอก", () => {
  const id = "dQw4w9WgXcQ";
  const inputs = [
    "dQw4w9WgXcQ",
    "  dQw4w9WgXcQ  ",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
    "https://www.youtube.com/watch?app=desktop&v=dQw4w9WgXcQ",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
    "www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?t=42",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ",
    "//www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  ];
  for (const value of inputs) assert.equal(youTubeIdFromInput(value), id, `ต้องดึงรหัสได้จาก: ${value}`);
});

test("recipes admin: ลิงก์ที่ไม่ใช่ YouTube / ของเสีย ต้องไม่ถูกเดาเป็นรหัส", () => {
  const inputs = [
    "",
    "   ",
    "สั้น",
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/",
    "https://www.youtube.com/watch?v=abc",
    "javascript:alert(1)",
    "https://vimeo.com/123456",
  ];
  for (const value of inputs) assert.equal(youTubeIdFromInput(value), null, `ต้องอ่านไม่ได้: ${value}`);
});

test("recipes admin: ใช้ตัวดึงรหัสกลางตัวเดียว — action · ฟอร์ม · สคริปต์นำเข้า (ไม่เขียน regex ซ้ำ)", () => {
  assert.ok(actions.includes("youTubeIdFromInput("), "action ต้อง normalize ลิงก์ก่อนตรวจ");
  assert.ok(editorForm.includes("youTubeIdFromInput("), "ฟอร์มต้องดึงรหัสให้เห็นสด ๆ");
  assert.ok(editorForm.includes('videoId: detectedVideoId ?? ""'), "พรีวิวต้องใช้รหัสที่ดึงได้ ไม่ใช่ลิงก์");
  assert.ok(editorForm.includes("recipesAdminVideoDetected"), "ต้องบอกผู้ใช้ว่าดึงรหัสได้อะไร");
  const importParse = readFileSync("lib/recipes/import-parse.ts", "utf8");
  assert.ok(importParse.includes("youTubeIdFromInput("), "สคริปต์นำเข้าต้องใช้ตัวดึงกลาง");
  assert.ok(!/match\(\/\(\?:youtube/.test(importParse), "ต้องไม่เหลือ regex ดึงลิงก์ชุดเก่าในสคริปต์นำเข้า");
});

/* ── รอบที่ 137: พรีวิวเมนูให้เหมือนพรีวิวข่าว (สลับ ไทย/EN + ชื่อว่างมีข้อความแทน) ── */

test("recipes admin: พรีวิวสลับ ไทย/EN ได้ และส่ง placeholder ให้ตัวเรนเดอร์กลาง", () => {
  assert.ok(editorForm.includes("setPreviewLanguage"), "ต้องมี state ภาษาของพรีวิว");
  assert.ok(editorForm.includes("aria-pressed={previewLanguage === item}"), "ปุ่มสลับต้องบอกสถานะให้ screen reader");
  assert.ok(editorForm.includes("language={previewLanguage}"), "ต้องส่งภาษาที่เลือกเข้า RecipeVideoList");
  assert.ok(
    editorForm.includes("titlePlaceholder={m.recipesAdminPreviewUntitled}"),
    "ชื่อเมนูว่างต้องมีข้อความแทน (แบบเดียวกับพรีวิวข่าว)",
  );
  assert.ok(publicList.includes("titlePlaceholder?: string"), "ตัวเรนเดอร์กลางต้องรับ placeholder แบบไม่บังคับ");
  assert.ok(publicList.includes("computedTitle"), "ต้องคิดชื่อก่อน แล้วค่อยใช้ placeholder เมื่อว่าง");
});

test("recipes admin: placeholder มีผลเฉพาะหลังบ้าน — หน้าเว็บจริงต้องไม่ส่งค่านี้", () => {
  const publicPage = readFileSync("app/[lang]/recipes/page.tsx", "utf8");
  assert.ok(!publicPage.includes("titlePlaceholder"), "หน้าเว็บจริงห้ามส่ง placeholder (ชื่อว่าง = ชื่อว่าง)");
  assert.equal((publicPage.match(/<RecipeVideoList/g) ?? []).length, 2, "หน้าเว็บจริงเรียกตัวเรนเดอร์ 2 ที่ตามเดิม");
});

/* ── รอบที่ 139: ลบถาวรจากถังขยะ (ประตูอยู่ที่ SQL ไม่ใช่ที่ปุ่ม) ─────────────── */

test("recipes admin: ลบถาวรมีเฉพาะของในถัง + ประตูอยู่ที่ SQL (fail-closed)", () => {
  assert.ok(repository.includes("export async function deleteRecipeForever"), "ต้องมีตัวลบถาวร");
  assert.ok(
    repository.includes("delete from recipe where id = $1 and deleted_at is not null"),
    "ประตูต้องอยู่ใน SQL ⇒ เมนูที่ยังใช้งานอยู่ลบไม่ได้แม้ยิง action ตรง ๆ",
  );
  assert.ok(actions.includes("deleteRecipeForever("), "action ต้องเรียกผ่านตัวที่มีประตู");
  assert.ok(actions.includes('action: "recipe-delete"'), "ลบถาวรต้องมี audit");
  assert.ok(
    !/\bdeleteRecipe\(/.test(actions),
    "action ห้ามเรียก `deleteRecipe()` (ตัวที่ข้ามประตูถังขยะ) — ใช้ได้แค่ในสคริปต์/ด่านตรวจ",
  );
  assert.ok(listPage.includes("deleteRecipeForeverAction"), "ปุ่มลบถาวรอยู่ในหน้ารายการ");
  assert.ok(listPage.includes("item.trashed ? ("), "ปุ่มลบถาวรโผล่เฉพาะของที่อยู่ในถัง");
  assert.ok(listPage.includes("recipesAdminDeleteForeverWarning"), "ต้องมีคำเตือนว่ากู้คืนไม่ได้");
});
