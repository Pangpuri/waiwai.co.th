import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

import {
  CAMPAIGN_ANCHOR_PRESETS,
  CAMPAIGN_STATUSES,
  EMPTY_CAMPAIGN_IMAGE_DRAFT,
  MAX_CAMPAIGNS,
  anchorPresetOf,
  campaignCardImage,
  campaignProblemFields,
  campaignReadiness,
  campaignWindowState,
  clampAnchor,
  isCampaignLiveNow,
  liveCampaignsOf,
  mergeCampaignImage,
  normalizeMoment,
  parseCampaignInput,
  toDateTimeLocalValue,
  type Campaign,
  type CampaignImageDraft,
} from "@/lib/campaigns/model";
import { feedbackOf, invalidCampaignHref } from "@/lib/hero/feedback";

/** รอบที่ 190 — แคมเปญเป็นเอนทิตีของตัวเอง (มติเจ้าของ: ตัด 1:1 กับสไลด์ออก) */

const NOW = Date.parse("2026-10-07T12:00:00.000Z");
const at = (iso: string): string => new Date(Date.parse(iso)).toISOString();
const base = {
  name: "แคมเปญทดสอบ",
  title: { th: "ทดสอบ", en: "" },
  body: { th: "", en: "" },
  ctaLabel: { th: "", en: "" },
  ctaHref: "",
  imagePath: "",
  imageAltTh: "",
  imageAltEn: "",
  anchorX: 50,
  anchorY: 50,
  startsAt: "",
  endsAt: "",
  isActive: true,
  slideIds: [],
};

test("campaigns: สถานะตามช่วงเวลา (เริ่มรวมขอบ · จบไม่รวมขอบ)", () => {
  assert.equal(campaignWindowState({ startsAt: null, endsAt: null }, NOW), "always");
  assert.equal(campaignWindowState({ startsAt: at("2026-10-08T00:00:00Z"), endsAt: null }, NOW), "scheduled");
  assert.equal(campaignWindowState({ startsAt: null, endsAt: at("2026-10-07T11:00:00Z") }, NOW), "expired");
  assert.equal(campaignWindowState({ startsAt: at("2026-10-07T12:00:00Z"), endsAt: null }, NOW), "live");
  assert.equal(campaignWindowState({ startsAt: null, endsAt: at("2026-10-07T12:00:00Z") }, NOW), "expired");
});

test("campaigns: ขึ้นเว็บได้ต้อง เผยแพร่ + เปิดใช้ + มีหัวข้อ + อยู่ในช่วงเวลา", () => {
  const live = { startsAt: null, endsAt: null, isActive: true, status: "published" as const, title: { th: "ก", en: "" } };
  assert.equal(isCampaignLiveNow(live, NOW), true);
  assert.equal(isCampaignLiveNow({ ...live, status: "draft" }, NOW), false, "ฉบับร่างห้ามขึ้นเว็บ");
  assert.equal(isCampaignLiveNow({ ...live, isActive: false }, NOW), false);
  assert.equal(isCampaignLiveNow({ ...live, title: { th: "  ", en: "x" } }, NOW), false, "แคมเปญเปล่าห้ามขึ้นเว็บ");
});

test("campaigns: ตรวจค่าฟอร์ม + คำเตือนความพร้อม", () => {
  const ok = parseCampaignInput(base);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.ok ? ok.value.slideIds : ["x"], []);
  assert.equal(ok.ok ? ok.value.startsAt : "x", null);

  assert.equal(parseCampaignInput({ ...base, title: { th: "", en: "" } }).ok, false, "หัวข้อไทยบังคับ");
  assert.equal(parseCampaignInput({ ...base, ctaHref: "javascript:alert(1)" }).ok, false, "ลิงก์อันตราย");
  assert.equal(
    parseCampaignInput({ ...base, startsAt: "2026-11-01T00:00", endsAt: "2026-10-01T00:00" }).ok,
    false,
    "จบก่อนเริ่ม",
  );
  const dupSlides = parseCampaignInput({ ...base, slideIds: ["a", "a", "b", ""] });
  assert.deepEqual(dupSlides.ok ? dupSlides.value.slideIds : [], ["a", "b"], "สไลด์ต้องไม่ซ้ำ");

  assert.equal(clampAnchor(-5), 0);
  assert.equal(clampAnchor(500), 100);
  assert.equal(clampAnchor("x"), 50);
  assert.equal(anchorPresetOf(8, 50), "left");
  assert.equal(anchorPresetOf(92, 50), "right");
  assert.equal(anchorPresetOf(33, 33), null, "ตำแหน่งที่ลากเอง = ไม่ตรงสำเร็จรูป");
  assert.equal(normalizeMoment(""), null);
  assert.equal(toDateTimeLocalValue(null), "");
  assert.equal(CAMPAIGN_STATUSES.length, 2);

  assert.ok(campaignReadiness({ ...base, status: "published" as const }).length > 0, "แคมเปญที่ยังไม่มีข้อความต้องเตือน");
  const ready = campaignReadiness({
    name: "มีชื่อ",
    title: { th: "หัวข้อ", en: "" },
    body: { th: "รายละเอียด", en: "" },
    ctaHref: "/products",
    imagePath: "",
    imageAltTh: "",
    status: "published",
  });
  assert.deepEqual(ready, [], "ครบทุกอย่าง = ไม่มีคำเตือน");
});

test("campaigns: ต่อสายจริง — แท็บในหน้าจอ · เงื่อนไข SQL · อ่านผ่านประตูอ่านอย่างเดียว · ไม่ผูกสไลด์ = ทุกสไลด์", () => {
  const repo = readFileSync("lib/campaigns/repository.ts", "utf8");
  assert.ok(repo.includes("PUBLIC_CAMPAIGN_CONDITION"), "ต้องมีเงื่อนไขกลาง");
  assert.ok(
    repo.includes("status = 'published'") && repo.includes("ends_at is null or ends_at > now()"),
    "ต้องกรองสถานะ/ช่วงเวลาที่ SQL",
  );
  assert.ok(repo.includes("await readQuery<"), "ฝั่งเว็บต้องอ่านผ่านประตูอ่านอย่างเดียว");
  assert.ok(/catch \{[\s\S]{0,160}return \[\];/.test(repo), "อ่านพังต้องคืนค่าว่าง");

  const actions = readFileSync("app/admin/hero/campaign-actions.ts", "utf8");
  /* 5 action: เพิ่ม · บันทึก · เผยแพร่/ถอน · ย้ายเข้าถัง · กู้คืน (รอบที่ 198 เพิ่มตัวสุดท้าย) */
  for (const fn of [
    "addCampaignAction",
    "saveCampaignAction",
    "setCampaignStatusAction",
    "removeCampaignAction",
    "restoreCampaignAction",
  ]) {
    assert.ok(actions.includes(`export async function ${fn}`), `ต้องมี ${fn}`);
  }
  assert.equal((actions.match(/requireAdminUser\("content"\)/g) ?? []).length, 5, "ทุก action ต้องตรวจสิทธิ์");
  assert.ok(actions.includes("MAX_CAMPAIGNS"), "ต้องมีเพดานกันสร้างมั่ว");
  assert.ok(actions.includes("campaign-publish"), "ต้องมี audit ตอนเผยแพร่");

  const page = readFileSync("app/admin/hero/page.tsx", "utf8");
  assert.ok(page.includes("campaignTabCampaigns") && page.includes('tab=campaigns'), "หน้าจอต้องมีแท็บแคมเปญ (จำใน URL)");
  assert.ok(page.includes("CampaignManager"), "แท็บแคมเปญต้องใช้ตัวจัดการแคมเปญ");

  const manager = readFileSync("features/admin/ui/campaign-manager.tsx", "utf8");
  assert.ok(manager.includes("campaignReadiness"), "ต้องแสดงคำเตือนความพร้อม");
  assert.ok(manager.includes("name=\"slideIds\""), "ต้องเลือกสไลด์ที่จะแสดงได้");
  assert.ok(!/<form[^>]*>[\s\S]{0,400}<form/.test(manager.replace(/\/\*[\s\S]*?\*\//g, "")), "ห้าม <form> ซ้อน <form>");
  assert.ok(MAX_CAMPAIGNS >= 1 && Object.keys(CAMPAIGN_ANCHOR_PRESETS).length === 3);
});

test("campaigns: พรีวิวลากกำหนดจุดยึด — สูตรเดียวกับหน้าเว็บ + เมาส์/สัมผัส/คีย์บอร์ด + ไม่มี <form> ซ้อน", () => {
  const preview = readFileSync("features/admin/ui/campaign-anchor-preview.tsx", "utf8");
  assert.ok(preview.includes("onPointerDown") && preview.includes("setPointerCapture"), "ต้องลากด้วยเมาส์/สัมผัสได้");
  assert.ok(preview.includes("touch-none"), "ต้องกันการเลื่อนหน้าจอตอนลากบนมือถือ");
  assert.ok(preview.includes("ArrowLeft") && preview.includes("ArrowRight"), "ต้องขยับด้วยคีย์บอร์ดได้ (a11y)");
  assert.ok(preview.includes("left: anchorX +") && preview.includes("translate(-"), "ตำแหน่งต้องใช้สูตรเดียวกับหน้าเว็บ (left/top % + translate กลับครึ่งตัวเอง)");
  assert.ok(preview.includes("aspect-[16/9]"), "กรอบพรีวิวต้องเป็นสัดส่วนเดียวกับฮีโร่");
  assert.ok(preview.includes("heroAdminNoImage"), "ไม่มีภาพสไลด์ = ต้องบอก (ไม่เรนเดอร์ <img> เปล่า)");
  assert.ok(!preview.includes("<form"), "พรีวิวต้องไม่มี <form> (กันซ้อนกับฟอร์มบันทึก)");

  const manager = readFileSync("features/admin/ui/campaign-manager.tsx", "utf8");
  assert.ok(manager.includes("CampaignAnchorPreview"), "หน้าจอต้องใช้พรีวิวที่ลากได้");
  assert.ok(manager.includes("value={anchorOf(") && manager.includes("setAnchor("), "ช่องตัวเลขต้องผูกกับค่าที่ลาก (controlled)");
  assert.ok(manager.includes('name="anchorX"') && manager.includes('name="anchorY"'), "ค่าที่ลากต้องถูกส่งไปกับฟอร์มบันทึก");

  const page = readFileSync("app/admin/hero/page.tsx", "utf8");
  assert.ok(page.includes("mediaPath: slide.mediaPath"), "หน้าจอต้องส่งภาพของสไลด์มาให้พรีวิว");
});

test("campaigns: หน้าเว็บจับคู่แคมเปญกับสไลด์ + วางตามจุดยึดที่ลากไว้", () => {
  const hero = readFileSync("features/home/ui/hero.tsx", "utf8");
  assert.ok(hero.includes("campaigns?: readonly CampaignData[]"), "hero ต้องรับแคมเปญจากหลังบ้าน");
  assert.ok(
    hero.includes("campaign.slideIds.length === 0 || campaign.slideIds.includes(slide.id)"),
    "ไม่เลือกสไลด์ = ทุกสไลด์ · เลือกไว้ = เฉพาะสไลด์นั้น",
  );
  assert.ok(hero.includes("anchorX: card.anchorX") && hero.includes("anchorY: card.anchorY"), "ต้องส่งจุดยึดเข้าไปด้วย");

  const slider = readFileSync("features/home/ui/hero-slider.tsx", "utf8");
  assert.ok(
    slider.includes('left: (activeCards[0]?.anchorX ?? 8) + "%"') && slider.includes('top: (activeCards[0]?.anchorY ?? 50) + "%"'),
    "การ์ดบนหน้าเว็บต้องวางด้วย left/top เป็นเปอร์เซ็นต์",
  );
  assert.ok(slider.includes('"translate(-"'), "ต้องเลื่อนกลับครึ่งหนึ่งของตัวเอง (สูตรเดียวกับพรีวิวหลังบ้าน)");

  const page = readFileSync("app/[lang]/page.tsx", "utf8");
  assert.ok(page.includes("campaigns={await listLiveCampaigns()}"), "หน้าแรกต้องอ่านแคมเปญที่ยังไม่หมดเวลา");
  assert.ok(!page.includes("listLiveHeroCards"), "ต้องไม่มีระบบการ์ดผูกสไลด์เดิมหลงเหลือ");

  /* ระบบซ้อนต้องถูกถอดออกจริง */
  const adminPage = readFileSync("app/admin/hero/page.tsx", "utf8");
  assert.ok(!adminPage.includes("cardsBySlide"), "หน้าจอสไลด์ต้องไม่โหลดการ์ดแบบผูกสไลด์แล้ว");
  const manager = readFileSync("features/admin/ui/hero-slide-manager.tsx", "utf8");
  assert.ok(!manager.includes("HeroCardEditor"), "พาเนลการ์ดเดิมต้องถูกถอดออกจากหน้าสไลด์");
});

test("hero trash: ตัวลบอัตโนมัติต่อเข้าตัวลบกลาง (ประตูใน SQL · dry-run เส้นทางเดียวกัน · ใช้ระยะเก็บกลาง)", () => {
  const hero = readFileSync("lib/trash/hero.ts", "utf8");
  assert.ok(hero.includes("TRASH_RETENTION_DAYS"), "ต้องใช้ระยะเก็บจากค่ากลาง (ห้ามพิมพ์ตัวเลขซ้ำ)");
  assert.ok(
    /delete from hero_slide where deleted_at is not null and deleted_at <= \$1/.test(hero),
    "ประตูต้องอยู่ใน SQL: ลบเฉพาะแถวที่อยู่ในถังและพ้นกำหนด",
  );
  assert.ok(/dryRun === true[\s\S]{0,400}select count\(\*\)/.test(hero), "dry-run ต้องนับจากเงื่อนไขเดียวกัน (ไม่ลบ)");
  assert.ok(/catch \{[\s\S]{0,120}return 0;/.test(hero), "ตัวลบกลางต้องไม่ล้มเพราะถังขยะสไลด์");

  const purge = readFileSync("lib/retention/purge.ts", "utf8");
  assert.ok(purge.includes("purgeExpiredHeroTrash({ now, dryRun: true })"), "รายงาน dry-run ต้องรวมถังขยะสไลด์");
  assert.ok(purge.includes("await purgeExpiredHeroTrash({ now: options.now })"), "การลบจริงต้องเรียกถังขยะสไลด์");
  assert.ok(purge.includes("heroTrashDue"), "ภาพรวมระยะเก็บต้องรายงานยอดของถังขยะสไลด์");

  const note = readFileSync("lib/i18n/messages/areas/th/adminHero.ts", "utf8");
  assert.ok(/\{days\}/.test(note), "ข้อความบนหน้าจอต้องใช้ {days} (ไม่พิมพ์ตัวเลขเอง)");
  const page = readFileSync("app/admin/hero/page.tsx", "utf8");
  assert.ok(page.includes("TRASH_RETENTION_DAYS"), "หน้าจอต้องเติมจำนวนวันจากค่ากลาง");
});

test("feedback: ทุกการบันทึกต้องบอกผล (สำเร็จ/ไม่สำเร็จ) — ห้ามเงียบ", () => {
  const feedback = readFileSync("lib/hero/feedback.ts", "utf8");
  for (const code of ["slide-saved", "effect-saved", "campaign-saved", "campaign-status"]) {
    assert.ok(feedback.includes('"' + code + '"'), "ต้องมีรหัสผลลัพธ์ " + code);
  }
  assert.ok(feedback.includes('"save-failed"') && feedback.includes('"invalid"'), "ต้องมีรหัสความล้มเหลว");
  assert.ok(feedback.includes("export function feedbackOf"), "ต้องมีตัวอ่านรหัสจาก query");

  const actions = readFileSync("app/admin/hero/actions.ts", "utf8");
  assert.ok(actions.includes('redirect(`/admin/hero?saved=${flag}`)'), "action ต้อง redirect พร้อมรหัสผลลัพธ์");
  assert.equal((actions.match(/refreshAfterChange\("/g) ?? []).length, 8, "ทุกทางบันทึกของสไลด์ต้องส่งรหัสผลลัพธ์");
  assert.ok(actions.includes('redirect("/admin/hero?error=save-failed")'), "บันทึกไม่สำเร็จต้องบอกด้วย");

  const campaignActions = readFileSync("app/admin/hero/campaign-actions.ts", "utf8");
  assert.ok(campaignActions.includes("?tab=campaigns&saved=${flag}"), "แคมเปญต้องกลับไปแท็บเดิมพร้อมรหัสผลลัพธ์");
  /* 5 ทาง: เพิ่ม · บันทึก · สถานะ · ย้ายเข้าถัง · กู้คืน (รอบที่ 198) — ทุกทางต้องมีรหัสผลลัพธ์ */
  assert.equal((campaignActions.match(/refreshAfterCampaignChange\("/g) ?? []).length, 5, "ทุกทางบันทึกของแคมเปญต้องส่งรหัส");
  assert.ok(
    campaignActions.includes("redirect(invalidCampaignHref(parsed.problems))"),
    "ข้อมูลไม่ผ่านต้องบอกว่าไม่สำเร็จ **และบอกช่องที่ต้องแก้** (รอบที่ 195)",
  );

  const page = readFileSync("app/admin/hero/page.tsx", "utf8");
  assert.ok(page.includes("feedbackOf(") && page.includes("savedMessages[feedback.code]"), "หน้าจอต้องแสดงข้อความจากรหัส");
  assert.ok(page.includes('role="status"'), "แบนเนอร์ต้องประกาศให้โปรแกรมอ่านหน้าจอรู้ (a11y)");
});

test("campaign image: พาธในเว็บเท่านั้น + ต้องมีคำอธิบายภาพไทย (ต่อสายจริง หลังบ้าน)", () => {
  const model = readFileSync("lib/campaigns/model.ts", "utf8");
  assert.ok(model.includes("isSafeCampaignImagePath"), "ต้องมีตัวตรวจพาธภาพ");
  assert.ok(model.includes('imageAltTh: มีภาพแล้วต้องมีคำอธิบายภาพภาษาไทย'), "มีภาพต้องมี alt ไทย");
  const repo = readFileSync("lib/campaigns/repository.ts", "utf8");
  assert.ok(repo.includes("image_path") && repo.includes("input.imagePath"), "ชั้นข้อมูลต้องอ่าน/เขียนพาธภาพ");
  const manager = readFileSync("features/admin/ui/campaign-manager.tsx", "utf8");
  assert.ok(manager.includes("<ImageDrop"), "หน้าจอแคมเปญต้องมีช่องเลือกภาพ (คลัง/เครื่อง/ลากวาง)");
  assert.ok(manager.includes('name="imagePath"'), "ค่าภาพต้องถูกส่งไปกับฟอร์มบันทึก");
  assert.ok(manager.indexOf("<ImageDrop") < manager.indexOf("<form action={saveCampaignAction}"), "ช่องภาพต้องอยู่นอกฟอร์ม (กัน <form> ซ้อน)");
});

/**
 * ★ ปิดหนี้รอบ 194 — เทสต์เดิมตรวจด้วย "ชื่อตัวแปร" ในไฟล์ (`card.imagePath.trim() === "" ? null :`)
 * ⇒ เปราะ: เปลี่ยนวิธีเขียนเล็กน้อยแล้วแดงทั้งที่พฤติกรรมถูก · รอบนี้ย้ายการตัดสินมาเป็น "ตรรกะล้วน"
 * แล้วตรวจที่ **พฤติกรรม** (คืน `null` = ไม่มีภาพ) + **โครงสร้าง** (ไม่มี `<img>` ดิบ) แทน
 */
test("★ campaign image: พาธว่าง = ไม่มีภาพให้เรนเดอร์ (ตรรกะล้วน ไม่ค้นชื่อตัวแปร)", () => {
  const fallback = "หัวข้อการ์ด";
  assert.equal(campaignCardImage({ imagePath: "", imageAltTh: "คำอธิบาย", imageAltEn: "caption" }, "th", fallback), null, "พาธว่าง = ไม่มีภาพ");
  assert.equal(campaignCardImage({ imagePath: "   ", imageAltTh: "", imageAltEn: "" }, "th", fallback), null, "มีแต่ช่องว่าง = ไม่มีภาพ");
  assert.equal(campaignCardImage({ imagePath: "\n\t", imageAltTh: "", imageAltEn: "" }, "en", fallback), null, "ขึ้นบรรทัดใหม่/แท็บ = ไม่มีภาพ");

  const card = { imagePath: "  /media/abc  ", imageAltTh: "คำอธิบายไทย", imageAltEn: "English caption" };
  assert.deepEqual(campaignCardImage(card, "th", fallback), { path: "/media/abc", alt: "คำอธิบายไทย" }, "พาธถูกตัดช่องว่าง · ไทยใช้ alt ไทย");
  assert.deepEqual(campaignCardImage(card, "en", fallback), { path: "/media/abc", alt: "English caption" }, "อังกฤษใช้ alt อังกฤษ");
  assert.deepEqual(
    campaignCardImage({ ...card, imageAltEn: "   " }, "en", fallback),
    { path: "/media/abc", alt: "คำอธิบายไทย" },
    "alt อังกฤษว่าง = ถอยไปใช้ไทย",
  );
  assert.deepEqual(
    campaignCardImage({ imagePath: "/media/abc", imageAltTh: "", imageAltEn: "" }, "th", `  ${fallback}  `),
    { path: "/media/abc", alt: fallback },
    "ไม่มี alt เลย = ถอยไปใช้หัวข้อ (ตัดช่องว่าง)",
  );
  assert.deepEqual(
    campaignCardImage({ imagePath: "/media/abc", imageAltTh: "", imageAltEn: "" }, "th", "   "),
    { path: "/media/abc", alt: "" },
    "ไม่มีข้อความให้ใช้เลย = alt ว่าง (ภาพประดับ) — ไม่เป็น undefined",
  );
});

test("★ campaign image: หน้าเว็บไปทาง `next/image` เท่านั้น + วิวไม่มีพาธดิบ (guard ข้ามไม่ได้)", () => {
  const slider = readFileSync("features/home/ui/hero-slider.tsx", "utf8");
  assert.ok(!/<img[\s/>]/.test(slider), "ห้ามมีแท็ก <img> ดิบ (ใช้ next/image — ด่าน lint บังคับด้วย)");
  assert.ok(!/src=(""|'')/.test(slider), "ห้ามมี src ว่างแบบเขียนค่าตรง ๆ");
  assert.ok(
    !slider.includes("imagePath") && !slider.includes("imageAlt"),
    "วิวของการ์ดต้องไม่เหลือพาธ/alt ดิบ — รับแต่ 'ภาพที่ตัดสินแล้ว' (จึงไม่มีทางปล่อย src ว่าง)",
  );

  const hero = readFileSync("features/home/ui/hero.tsx", "utf8");
  assert.ok(hero.includes("campaignCardImage(card"), "hero ต้องใช้ตัวตัดสินกลาง (ไม่เช็คพาธเองซ้ำที่อื่น)");
  assert.ok(!hero.includes("imagePath:"), "ห้ามส่งพาธดิบเข้าวิว");
});

test("★ ปิดหนี้รอบ 194: 'การ์ดผูกสไลด์ 1:1' ถูกถอดออกทั้งสาย (โค้ด/ตาราง/สิทธิ์/พจนานุกรม)", () => {
  /* 1) โค้ดที่รันจริง (app/features/lib) ต้องไม่อ้างตารางเดิมอีก */
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      if (readFileSync(full, "utf8").includes("hero_slide_card")) offenders.push(full);
    }
  };
  for (const root of ["app", "features", "lib"]) walk(root);
  assert.deepEqual(offenders, [], "ห้ามเหลือโค้ดที่อ้างตาราง hero_slide_card");

  /* 2) ไฟล์ของสายเดิมต้องหายไปจริง */
  for (const gone of [
    "lib/hero/cards.ts",
    "lib/hero/cards-repository.ts",
    "app/admin/hero/card-actions.ts",
    "features/admin/ui/hero-card-editor.tsx",
  ]) {
    assert.equal(existsSync(gone), false, `${gone} ต้องถูกถอดออก`);
  }

  /* 3) ประตูอ่านของหน้าเว็บต้องไม่ขอสิทธิ์ตารางที่ถอดแล้ว */
  const roles = readFileSync("scripts/db-roles.ts", "utf8");
  assert.ok(!roles.includes("hero_slide_card"), "PUBLIC_READ_TABLES ต้องไม่มีตารางที่ถอดแล้ว");

  /* 4) migration: ถอดแบบรันซ้ำได้ และไม่แก้ตารางที่จะถอด */
  const drop = readFileSync("db/migrations/0033-drop-hero-slide-card.sql", "utf8");
  assert.ok(drop.includes("drop table if exists hero_slide_card"), "ต้องมี drop table แบบ idempotent");
  assert.ok(!/^alter table hero_slide_card/m.test(drop), "ห้ามแก้ตารางที่กำลังจะถอด");

  /* 5) พจนานุกรม: คีย์ของการ์ด 1:1 ต้องไม่ค้าง (ทั้งสองภาษา) */
  const deadKeys = [
    "heroCardSectionTitle",
    "heroCardSectionHint",
    "heroCardAdd",
    "heroCardEmpty",
    "heroCardMax",
    "heroCardSaveFailed",
    "heroCardEnglishOptional",
  ];
  for (const locale of ["th", "en"]) {
    const area = readFileSync(`lib/i18n/messages/areas/${locale}/adminHeroCards.ts`, "utf8");
    for (const key of deadKeys) assert.ok(!area.includes(key), `คีย์ ${key} ต้องถูกถอดออกจากพื้นที่ ${locale}`);
  }
});

/**
 * ★ รอบที่ 195 — บั๊กจริงที่เจ้าของเจอ 2 ข้อ
 *   1. "กดใช้ภาพ แล้วแก้ชื่อภาพ ⇒ ภาพหาย" = ช่องภาพส่ง **patch บางส่วน** แต่จออ่านเป็น "ค่าเต็ม"
 *   2. "บันทึกไม่สำเร็จทั้งที่ใส่หมด" = ข้อความไม่บอกว่า **ช่องไหน** ไม่ผ่าน
 */
test("★ campaigns: ช่องภาพส่ง patch — แก้คำอธิบายภาพแล้วพาธต้องไม่หาย (บั๊กจริงรอบที่ 195)", () => {
  const picked: CampaignImageDraft = { path: "/media/abc", altTh: "คำอธิบายเดิม", altEn: "" };

  /* พิมพ์คำอธิบายภาพ (patch มีแค่ช่องเดียว) ⇒ พาธต้องอยู่ครบ */
  assert.deepEqual(
    mergeCampaignImage(picked, { altTh: "คำอธิบายใหม่" }),
    { path: "/media/abc", altTh: "คำอธิบายใหม่", altEn: "" },
    "แก้คำอธิบายภาพไทย = พาธไม่หาย",
  );
  assert.deepEqual(
    mergeCampaignImage(picked, { altEn: "caption" }),
    { path: "/media/abc", altTh: "คำอธิบายเดิม", altEn: "caption" },
    "แก้คำอธิบายภาพอังกฤษ = พาธไม่หาย",
  );

  /* กดใช้ภาพจากคลัง = ส่งพาธ + คำอธิบายของภาพนั้น (ทับได้ตามตั้งใจ) */
  assert.deepEqual(mergeCampaignImage(picked, { path: "/media/xyz", altTh: "", altEn: "" }), {
    path: "/media/xyz",
    altTh: "",
    altEn: "",
  });

  /* patch ว่าง = คงค่าเดิมทั้งสามช่อง */
  assert.deepEqual(mergeCampaignImage(picked, {}), picked);

  /* ปุ่ม "ลบภาพ" ส่งมาครบทั้งสามช่องเป็นค่าว่าง ⇒ ต้องลบได้จริง */
  assert.deepEqual(mergeCampaignImage(picked, { path: "", altTh: "", altEn: "" }), EMPTY_CAMPAIGN_IMAGE_DRAFT);

  /* กันถอยหลัง: จอต้องรวมผ่านตัวช่วยกลาง ไม่ใช่ `patch.path ?? ""` */
  const manager = readFileSync("features/admin/ui/campaign-manager.tsx", "utf8");
  assert.ok(manager.includes("mergeCampaignImage("), "จอแคมเปญต้องรวม patch ผ่านตัวช่วยกลาง (mergeCampaignImage)");
  assert.ok(!manager.includes('next.path ?? ""'), "ห้ามอ่าน patch เป็นค่าเต็ม (พาธจะถูกล้างทั้งที่ผู้ใช้แค่แก้คำอธิบายภาพ)");
  assert.ok(manager.includes("showWatermark={false}"), "การ์ดแคมเปญไม่มีลายน้ำ ⇒ ไม่ต้องมีช่องนั้นให้สับสน");
});

test("★ campaigns: บอก “ช่องที่ต้องแก้” เมื่อบันทึกไม่ผ่าน (รอบที่ 195)", () => {
  const problems = [
    "title.th: ต้องมีหัวข้อภาษาไทย",
    "ctaHref: ต้องเป็นพาธในเว็บ หรือ http(s)/mailto/tel",
    "imageAltTh: มีภาพแล้วต้องมีคำอธิบายภาพภาษาไทย",
  ];
  assert.deepEqual(campaignProblemFields(problems), ["titleTh", "ctaHref", "imageAltTh"], "แปลงชื่อฟิลด์จากข้อความ validator");
  assert.deepEqual(campaignProblemFields(["endsAt: ต้องอยู่หลังเวลาเริ่ม", "imagePath: ต้องเป็นพาธในเว็บ"]), ["imagePath", "endsAt"], "เรียงตามทะเบียนกลาง ไม่ใช่ลำดับที่ฟ้อง");
  assert.deepEqual(campaignProblemFields(["อะไรก็ไม่รู้", "title.th: ซ้ำ", "title.th: ซ้ำอีก"]), ["titleTh"], "ไม่รู้จัก/ซ้ำ = ตัดทิ้ง");
  assert.deepEqual(campaignProblemFields([]), []);

  assert.equal(
    invalidCampaignHref(problems),
    "/admin/hero?tab=campaigns&error=invalid&fields=titleTh,ctaHref,imageAltTh",
    "ปลายทางกลับต้องบอกช่องที่ผิด",
  );
  assert.equal(invalidCampaignHref(["ไม่รู้จัก"]), "/admin/hero?tab=campaigns&error=invalid", "ไม่มีช่องที่รู้จัก = ไม่ต้องมี fields");

  assert.deepEqual(
    feedbackOf({ error: "invalid", fields: "ctaHref,bogus,titleTh,ctaHref" }),
    { kind: "error", code: "invalid", fields: ["titleTh", "ctaHref"] },
    "อ่าน fields กลับจาก query (ตัดค่าที่ไม่รู้จัก/ซ้ำ)",
  );
  assert.deepEqual(feedbackOf({ saved: "campaign-saved", fields: "titleTh" }), { kind: "saved", code: "campaign-saved" }, "ความสำเร็จไม่ต้องมี fields");
  assert.equal(feedbackOf({ error: "อะไรก็ได้", fields: "titleTh" }), null, "รหัสเพี้ยน = ไม่แสดงแบนเนอร์");
});

test("★ campaigns: action + หน้าจอ ต่อสาย “ช่องที่ต้องแก้” ครบ (รอบที่ 195)", () => {
  const actions = readFileSync("app/admin/hero/campaign-actions.ts", "utf8");
  assert.equal((actions.match(/invalidCampaignHref\(/g) ?? []).length, 2, "ทั้ง \"บันทึก\" และ \"เผยแพร่\" ต้องบอกช่องที่ผิด");
  assert.ok(!actions.includes('error=invalid"'), "ห้าม redirect แบบไม่บอกสาเหตุอีก");

  const page = readFileSync("app/admin/hero/page.tsx", "utf8");
  assert.ok(page.includes("fieldMessages[code]"), "หน้าจอต้องแสดงข้อความของช่องที่ผิด");
  assert.ok(page.includes("fields: query.fields"), "หน้าจอต้องส่ง fields เข้า feedbackOf");

  /* ทุกช่องในทะเบียนกลางต้องมีข้อความทั้งสองภาษา (TS บังคับที่หน้าจอ — กันลืมในพจนานุกรมด้วย) */
  for (const locale of ["th", "en"]) {
    const area = readFileSync(`lib/i18n/messages/areas/${locale}/adminHeroCards.ts`, "utf8");
    for (const key of ["feedbackFieldTitleTh", "feedbackFieldCtaHref", "feedbackFieldImagePath", "feedbackFieldImageAltTh", "feedbackFieldEndsAt"]) {
      assert.ok(area.includes(`${key}:`), `${locale} ต้องมีคีย์ ${key}`);
    }
  }
});

/**
 * ★ รอบที่ 198 — เจ้าของทดสอบแล้วเจอว่า *"กดเพิ่ม = ได้การ์ดใหม่ ไม่ได้แก้การ์ดที่ขยับอยู่"*
 * ⇒ จอแคมเปญต้องรู้ก่อนว่า **ใบไหนคือการ์ดที่คนเห็นบนเว็บตอนนี้** แล้วพาไปแก้ใบนั้น
 * (ไม่ใช่ให้ปุ่มที่เด่นที่สุดสร้างใบใหม่)
 */
test("★ campaigns: หา “การ์ดที่แสดงบนเว็บตอนนี้” ได้ + จอพาไปแก้ใบเดิม (รอบที่ 198)", () => {
  const base: Campaign = {
    id: "c1",
    name: "ใบที่ใช้อยู่",
    title: { th: "หัวข้อ", en: "" },
    body: { th: "", en: "" },
    ctaLabel: { th: "", en: "" },
    ctaHref: "",
    imagePath: "",
    imageAltTh: "",
    imageAltEn: "",
    anchorX: 8,
    anchorY: 50,
    startsAt: null,
    endsAt: null,
    isActive: true,
    status: "published",
    sortOrder: 10,
    slideIds: [],
  };
  const now = Date.parse("2026-10-08T09:00:00.000Z");
  const live = liveCampaignsOf(
    [
      base,
      { ...base, id: "c2", status: "draft" },
      { ...base, id: "c3", isActive: false },
      { ...base, id: "c4", title: { th: "  ", en: "" } },
      { ...base, id: "c5", startsAt: "2026-10-09T00:00:00.000Z" },
      { ...base, id: "c6", endsAt: "2026-10-07T00:00:00.000Z" },
    ],
    now,
  );
  assert.deepEqual(
    live.map((campaign) => campaign.id),
    ["c1"],
    "ต้องได้เฉพาะใบที่เผยแพร่+เปิดใช้+มีหัวข้อ+อยู่ในช่วงเวลา",
  );
  assert.equal(liveCampaignsOf([], now).length, 0, "ไม่มีแคมเปญ = ว่าง (ไม่ throw)");

  /* จอหลังบ้าน: แผง "การ์ดที่แสดงบนเว็บตอนนี้" + ลิงก์ไปฟอร์มใบนั้น + ป้ายบอกว่าใบไหนขึ้นอยู่ */
  const manager = readFileSync("features/admin/ui/campaign-manager.tsx", "utf8");
  assert.ok(manager.includes("liveCampaignsOf(campaigns, now)"), "จอต้องคำนวณการ์ดที่ขึ้นอยู่จริง");
  assert.ok(manager.includes("id={`campaign-${campaign.id}`}"), "แต่ละการ์ดต้องมี id ให้ลิงก์กระโดดไปหาได้");
  assert.ok(manager.includes("href={`#campaign-${campaign.id}`}"), "ปุ่มแก้ไขต้องพาไปที่ฟอร์มของการ์ดใบนั้น");
  assert.ok(manager.includes("strings.campaignLiveTitle"), "ต้องมีหัวข้อแผงการ์ดที่ใช้อยู่");
  assert.ok(manager.includes("strings.campaignLiveEdit"), "ต้องมีปุ่ม “แก้ไขการ์ดนี้”");
  assert.ok(manager.includes("strings.campaignLiveBadge"), "ต้องมีป้ายบอกใบที่กำลังแสดงบนเว็บ");
  assert.ok(manager.includes("strings.campaignAddHint"), "ปุ่มเพิ่มใหม่ต้องมีคำเตือนว่าจะได้การ์ดซ้อน");

  /* ลำดับความสำคัญในจอ: ปุ่ม “แก้ไขการ์ดนี้” ต้องมาก่อนปุ่ม “เพิ่มแคมเปญใหม่” */
  const editAt = manager.indexOf("strings.campaignLiveEdit");
  const addAt = manager.indexOf("action={addCampaignAction}");
  assert.ok(editAt > 0 && addAt > editAt, "แผงการ์ดที่ใช้อยู่ต้องอยู่เหนือปุ่มเพิ่มใบใหม่");

  for (const locale of ["th", "en"]) {
    const area = readFileSync(`lib/i18n/messages/areas/${locale}/adminHeroCards.ts`, "utf8");
    for (const key of [
      "campaignLiveTitle",
      "campaignLiveNone",
      "campaignLiveEdit",
      "campaignLiveBadge",
      "campaignLivePosition",
      "campaignAddHint",
    ]) {
      assert.ok(area.includes(`${key}:`), `${locale} ต้องมีคีย์ ${key}`);
    }
  }
});

/**
 * ★ รอบที่ 198 (ต่อ) — ถังขยะของแคมเปญ
 * ก่อนรอบนี้ "ย้ายเข้าถัง" ได้อย่างเดียว ⇒ การ์ดที่เผยแพร่อยู่หายไปจากจอเลย (กู้คืนต้องเข้า SQL)
 * เคสจริง: เจ้าของกดลบการ์ดทดสอบ แล้วพบว่ากู้คืนไม่ได้ (ของค้างในถัง 9 ใบ)
 */
test("★ campaigns: ถังขยะแคมเปญ — ดูได้ + กู้คืนได้ (ประตูอยู่ที่ SQL) (รอบที่ 198)", () => {
  const repo = readFileSync("lib/campaigns/repository.ts", "utf8");
  assert.ok(
    /listTrashedCampaigns[\s\S]{0,500}deleted_at is not null/.test(repo),
    "ตัวอ่านถังขยะต้องกรอง deleted_at is not null",
  );
  assert.ok(
    /restoreCampaign[\s\S]{0,400}deleted_at is not null/.test(repo),
    "กู้คืนต้องมีประตู fail-closed อยู่ที่ SQL (กู้ได้เฉพาะของในถัง)",
  );
  assert.ok(/restoreCampaign[\s\S]{0,300}deleted_at = null, deleted_by = null/.test(repo), "กู้คืนต้องล้าง deleted_at/deleted_by");

  const actions = readFileSync("app/admin/hero/campaign-actions.ts", "utf8");
  assert.ok(actions.includes("export async function restoreCampaignAction"), "ต้องมี action กู้คืน");
  assert.ok(actions.includes('detail: "campaign-restore"'), "ต้องมี audit ของการกู้คืน");
  assert.ok(actions.includes('requireAdminUser("content")'), "action กู้คืนต้องตรวจสิทธิ์");

  const manager = readFileSync("features/admin/ui/campaign-manager.tsx", "utf8");
  assert.ok(manager.includes("restoreCampaignAction"), "จอต้องมีปุ่มกู้คืน");
  assert.ok(manager.includes("strings.campaignTrashTitle"), "จอต้องมีหัวข้อถังขยะแคมเปญ");
  assert.ok(manager.includes("trashedCampaigns.length"), "จอต้องโชว์จำนวนของในถัง");

  const page = readFileSync("app/admin/hero/page.tsx", "utf8");
  assert.ok(page.includes("listTrashedCampaigns()"), "หน้าจอต้องอ่านถังขยะแคมเปญ");
  assert.ok(page.includes("trashedCampaigns={trashedCampaigns}"), "หน้าจอต้องส่งรายการถังขยะเข้าไป");

  for (const locale of ["th", "en"]) {
    const area = readFileSync(`lib/i18n/messages/areas/${locale}/adminHeroCards.ts`, "utf8");
    for (const key of ["campaignTrashTitle", "campaignTrashHint", "campaignTrashEmpty", "campaignRestore"]) {
      assert.ok(area.includes(`${key}:`), `${locale} ต้องมีคีย์ ${key}`);
    }
  }
});
