import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  CAMPAIGN_ANCHOR_PRESETS,
  CAMPAIGN_STATUSES,
  MAX_CAMPAIGNS,
  anchorPresetOf,
  campaignReadiness,
  campaignWindowState,
  clampAnchor,
  isCampaignLiveNow,
  normalizeMoment,
  parseCampaignInput,
  toDateTimeLocalValue,
} from "@/lib/campaigns/model";

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
  for (const fn of ["addCampaignAction", "saveCampaignAction", "setCampaignStatusAction", "removeCampaignAction"]) {
    assert.ok(actions.includes(`export async function ${fn}`), `ต้องมี ${fn}`);
  }
  assert.equal((actions.match(/requireAdminUser\("content"\)/g) ?? []).length, 4, "ทุก action ต้องตรวจสิทธิ์");
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
  assert.equal((campaignActions.match(/refreshAfterCampaignChange\("/g) ?? []).length, 4, "ทุกทางบันทึกของแคมเปญต้องส่งรหัส");
  assert.ok(campaignActions.includes('error=invalid'), "ข้อมูลไม่ผ่านต้องบอกว่าไม่สำเร็จ");

  const page = readFileSync("app/admin/hero/page.tsx", "utf8");
  assert.ok(page.includes("feedbackOf(") && page.includes("savedMessages[feedback.code]"), "หน้าจอต้องแสดงข้อความจากรหัส");
  assert.ok(page.includes('role="status"'), "แบนเนอร์ต้องประกาศให้โปรแกรมอ่านหน้าจอรู้ (a11y)");
});

test("campaign image: พาธในเว็บเท่านั้น + ต้องมีคำอธิบายภาพไทย + ไม่เรนเดอร์ <img> เมื่อไม่มีภาพ", () => {
  const model = readFileSync("lib/campaigns/model.ts", "utf8");
  assert.ok(model.includes("isSafeCampaignImagePath"), "ต้องมีตัวตรวจพาธภาพ");
  assert.ok(model.includes('imageAltTh: มีภาพแล้วต้องมีคำอธิบายภาพภาษาไทย'), "มีภาพต้องมี alt ไทย");
  const repo = readFileSync("lib/campaigns/repository.ts", "utf8");
  assert.ok(repo.includes("image_path") && repo.includes("input.imagePath"), "ชั้นข้อมูลต้องอ่าน/เขียนพาธภาพ");
  const manager = readFileSync("features/admin/ui/campaign-manager.tsx", "utf8");
  assert.ok(manager.includes("<ImageDrop"), "หน้าจอแคมเปญต้องมีช่องเลือกภาพ (คลัง/เครื่อง/ลากวาง)");
  assert.ok(manager.includes('name="imagePath"'), "ค่าภาพต้องถูกส่งไปกับฟอร์มบันทึก");
  assert.ok(manager.indexOf("<ImageDrop") < manager.indexOf("<form action={saveCampaignAction}"), "ช่องภาพต้องอยู่นอกฟอร์ม (กัน <form> ซ้อน)");
  const slider = readFileSync("features/home/ui/hero-slider.tsx", "utf8");
  assert.ok(slider.includes("card.imagePath.trim() === \"\" ? null :"), "ไม่มีภาพ = ไม่เรนเดอร์ <img>");
  assert.ok(slider.includes("card.imageAlt"), "ต้องใช้คำอธิบายภาพเป็น alt");
});
