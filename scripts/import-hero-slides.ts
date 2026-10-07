/**
 * `npm run hero:import` — ย้ายสไลด์ hero ที่ฝังในโค้ด (`features/home/slides.ts`) ขึ้นฐานข้อมูล (รอบที่ 184)
 *
 * ทำไมต้องมี: เจ้าของเลือก "ย้าย 3 ภาพเดิมขึ้นก่อน" ⇒ การตลาดแก้ภาพ/ตำแหน่ง/ลำดับได้เองจากหลังบ้าน
 * · **รันซ้ำได้** — ใช้ `preserveOrder` ⇒ ไม่ทับ `sort_order` ที่คนจัดไว้ในหลังบ้าน (บทเรียนรอบ 140)
 * · `--dry-run` = ดูผล ไม่เขียนฐานข้อมูล
 * ⚠️ คำอธิบายภาพ (alt) ของ 3 ใบเดิมถูก "ยกมา" ที่นี่ เพราะพจนานุกรมของหน้าเว็บโหลดในสคริปต์ CLI ไม่ได้
 *    (ต้นทางยังอยู่ในพจนานุกรม `hero.slides.<id>.alt` — ตัวเทมเพลตยังใช้ค่านั้น · หลังบ้านแก้เองได้ในเฟสถัดไป)
 */
import { closePool, isDatabaseConfigured } from "@/db/pool";
import { HERO_SLIDES } from "@/features/home/slides";
import { focusFromObjectPosition, type HeroPageSlide } from "@/lib/hero/model";
import { saveHeroPageSlide } from "@/lib/hero/repository";

/** คำอธิบายภาพของสไลด์ชุดเดิม (คัดจากพจนานุกรม ณ รอบที่ 184) — เฉพาะการย้ายครั้งแรก */
const LEGACY_ALT: Readonly<Record<string, { readonly th: string; readonly en: string }>> = {
  flavours: { th: "ภาพผลิตภัณฑ์ว้าว 2 รสชาติ", en: "Wai Wai two-flavour promotion banner" },
  event: { th: "ภาพผู้บริหารบนเวทีงานฉลองครบรอบ", en: "Executives on stage at the anniversary event" },
  promotion: { th: "ภาพเปิดตัวผลิตภัณฑ์วายวาย 3 รส", en: "Launch banner for the three new flavours" },
};

const dryRun = process.argv.includes("--dry-run");

if (!isDatabaseConfigured()) {
  console.error("✗ ต้องมี DATABASE_URL ก่อนจึงจะนำเข้าได้");
  process.exit(1);
}

let created = 0;
let updated = 0;

for (const [index, slide] of HERO_SLIDES.entries()) {
  const focus = focusFromObjectPosition(slide.objectPosition);
  const alt = LEGACY_ALT[slide.id] ?? { th: `ภาพสไลด์ ${slide.id}`, en: "" };
  const row: HeroPageSlide = {
    id: slide.id,
    sortOrder: (index + 1) * 10,
    mediaPath: slide.src,
    altTh: alt.th,
    altEn: alt.en,
    focusX: focus.x,
    focusY: focus.y,
    zoom: 1,
    isActive: true,
  };
  if (dryRun) {
    console.log("· จะเขียน:", JSON.stringify(row));
    continue;
  }
  const result = await saveHeroPageSlide(row, "hero:import", { preserveOrder: true });
  if (result.created) created += 1;
  else updated += 1;
}

console.log(
  dryRun
    ? `ⓘ โหมดดูผลอย่างเดียว: จะย้าย ${HERO_SLIDES.length} ภาพ (ไม่เขียนฐานข้อมูล)`
    : `✓ นำเข้าสไลด์ hero: ใหม่ ${created} · อัปเดต ${updated} (ทั้งหมด ${HERO_SLIDES.length})`,
);
await closePool();
