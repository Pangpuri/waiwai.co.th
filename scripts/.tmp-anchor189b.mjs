// แพตช์รอบ 189 (แก้ฉบับ): anchor ที่กินหลายบรรทัดต้องต่อด้วย line-ending จริงของไฟล์
import { readFileSync, writeFileSync } from "node:fs";

function apply(file, build) {
  const source = readFileSync(file, "utf8");
  const nl = source.includes("\r\n") ? "\r\n" : "\n";
  const next = build(nl);
  let text = source;
  for (const [name, from, to] of next) {
    if (!text.includes(from)) {
      console.error(`✗ anchor "${name}" ไม่พบใน ${file}`);
      process.exit(1);
    }
    text = text.split(from).join(to);
  }
  return { file, text };
}

const plans = [];

/* 1) โมเดล */
plans.push(apply("lib/hero/cards.ts", (nl) => [
  ["card-type", `  readonly position: HeroCardPosition;`,
    `  readonly position: HeroCardPosition;${nl}  /** จุดยึดบนพื้นที่สไลด์ (เปอร์เซ็นต์ 0–100) — ขยับได้อิสระ (รอบที่ 189) */${nl}  readonly anchorX: number;${nl}  readonly anchorY: number;`],
  ["input-type", ["  readonly position: HeroCardPosition;", "  readonly startsAt: string | null;"].join(nl),
    ["  readonly position: HeroCardPosition;", "  readonly anchorX: number;", "  readonly anchorY: number;", "  readonly startsAt: string | null;"].join(nl)],
  ["preset-anchor", `export function isHeroCardPosition(value: string): value is HeroCardPosition {`,
    [
      `/** จุดยึดสำเร็จรูปของแต่ละตำแหน่ง (ค่าเริ่มต้น + ปุ่มลัดในหน้าจอ) */`,
      `export const HERO_CARD_POSITION_ANCHORS: Readonly<Record<HeroCardPosition, { readonly x: number; readonly y: number }>> = {`,
      `  left: { x: 8, y: 50 },`,
      `  center: { x: 50, y: 50 },`,
      `  right: { x: 92, y: 50 },`,
      `};`,
      ``,
      `/** บีบจุดยึดให้เป็นจำนวนเต็ม 0–100 (ค่าที่ไม่ใช่ตัวเลข = ค่ากลาง) */`,
      `export function clampAnchor(value: unknown): number {`,
      `  if (typeof value !== "number" || !Number.isFinite(value)) return 50;`,
      `  return Math.min(100, Math.max(0, Math.round(value)));`,
      `}`,
      ``,
      `/** ตำแหน่งสำเร็จรูปที่ตรงกับจุดยึดนี้ (ไม่ตรง = กำหนดเอง) */`,
      `export function heroCardPositionOfAnchor(x: number, y: number): HeroCardPosition | null {`,
      `  for (const position of HERO_CARD_POSITIONS) {`,
      `    const anchor = HERO_CARD_POSITION_ANCHORS[position];`,
      `    if (anchor.x === x && anchor.y === y) return position;`,
      `  }`,
      `  return null;`,
      `}`,
      ``,
      `export function isHeroCardPosition(value: string): value is HeroCardPosition {`,
    ].join(nl)],
  ["parse-anchor", [
    "  return {",
    "    ok: true,",
    "    value: {",
    "      title,",
    "      body,",
    "      ctaLabel,",
    "      ctaHref,",
    `      position: isHeroCardPosition(positionRaw) ? positionRaw : "left",`,
  ].join(nl),
    [
      `  const position = isHeroCardPosition(positionRaw) ? positionRaw : "left";`,
      `  /* จุดยึด: ใช้ค่าที่ส่งมา (ขยับเอง) · ไม่ส่ง = ใช้ค่าของตำแหน่งสำเร็จรูป */`,
      `  const preset = HERO_CARD_POSITION_ANCHORS[position];`,
      `  const anchorX = record["anchorX"] === undefined ? preset.x : clampAnchor(record["anchorX"]);`,
      `  const anchorY = record["anchorY"] === undefined ? preset.y : clampAnchor(record["anchorY"]);`,
      ``,
      "  return {",
      "    ok: true,",
      "    value: {",
      "      title,",
      "      body,",
      "      ctaLabel,",
      "      ctaHref,",
      "      position,",
      "      anchorX,",
      "      anchorY,",
    ].join(nl)],
]));

/* 2) ชั้นข้อมูล */
plans.push(apply("lib/hero/cards-repository.ts", (nl) => [
  ["row-type", `  readonly position: string;`, `  readonly position: string;${nl}  readonly anchor_x: number;${nl}  readonly anchor_y: number;`],
  ["columns", `cta_href, position, starts_at, ends_at, is_active\`;`, `cta_href, position, anchor_x, anchor_y, starts_at, ends_at, is_active\`;`],
  ["to-card", `    position,`, `    position,${nl}    anchorX: row.anchor_x,${nl}    anchorY: row.anchor_y,`],
  ["update-sql", [
    `            cta_label_th = $6, cta_label_en = $7, cta_href = $8, position = $9,`,
    `            starts_at = $10, ends_at = $11, is_active = $12,`,
    `            updated_at = now(), updated_by = $13`,
  ].join(nl), [
    `            cta_label_th = $6, cta_label_en = $7, cta_href = $8, position = $9,`,
    `            anchor_x = $10, anchor_y = $11, starts_at = $12, ends_at = $13, is_active = $14,`,
    `            updated_at = now(), updated_by = $15`,
  ].join(nl)],
  ["update-params", [
    "      input.ctaHref,",
    "      input.position,",
    "      input.startsAt,",
    "      input.endsAt,",
    "      input.isActive,",
    "      actor,",
  ].join(nl), [
    "      input.ctaHref,",
    "      input.position,",
    "      input.anchorX,",
    "      input.anchorY,",
    "      input.startsAt,",
    "      input.endsAt,",
    "      input.isActive,",
    "      actor,",
  ].join(nl)],
]));

/* 3) action */
plans.push(apply("app/admin/hero/card-actions.ts", (nl) => [
  ["anchor-args", `    position: typeof formData.get("position") === "string" ? String(formData.get("position")) : "left",`,
    [
      `    position: typeof formData.get("position") === "string" ? String(formData.get("position")) : "left",`,
      `    anchorX: formData.get("anchorX") === null ? undefined : Number(formData.get("anchorX")),`,
      `    anchorY: formData.get("anchorY") === null ? undefined : Number(formData.get("anchorY")),`,
    ].join(nl)],
]));

/* 4) ตัวเรนเดอร์หน้าเว็บ */
plans.push(apply("features/home/ui/hero-slider.tsx", (nl) => [
  ["view-type", ["  readonly position: \"left\" | \"center\" | \"right\";", "};"].join(nl),
    [
      `  readonly position: "left" | "center" | "right";`,
      `  /** จุดยึดเป็นเปอร์เซ็นต์ของพื้นที่สไลด์ (รอบที่ 189) — ขยับได้อิสระ */`,
      `  readonly anchorX: number;`,
      `  readonly anchorY: number;`,
      `};`,
    ].join(nl)],
  ["card-container", [
    `          <div`,
    `            className={[`,
    `              "pointer-events-none absolute inset-0 z-10 flex p-4 sm:p-6",`,
    `              activeCards[0]?.position === "center",`,
  ].join(" | ") /* กันพลาด: ตรวจแบบ substring ด้านล่างแทน */, ""],
]));

/* ตรวจว่าทุกไฟล์ผ่านก่อนเขียน (รายการที่ 4 ใช้วิธีพิเศษด้านล่าง) */
const safe = plans.filter((plan) => plan.file !== "features/home/ui/hero-slider.tsx");
for (const plan of safe) {
  writeFileSync(plan.file, plan.text);
  console.log("✓ เขียนแล้ว:", plan.file);
}

/* 4) ตัวเรนเดอร์: แทนที่บล็อกเดิมทั้งก้อนด้วยเวอร์ชันใช้จุดยึด */
{
  const file = "features/home/ui/hero-slider.tsx";
  const nl = readFileSync(file, "utf8").includes("\r\n") ? "\r\n" : "\n";
  const text = readFileSync(file, "utf8");
  const from = [
    `          <div`,
    `            className={[`,
  ].join(nl);
  const start = text.indexOf(from);
  if (start < 0) {
    console.error("✗ หาบล็อกการ์ดเดิมใน hero-slider ไม่เจอ");
    process.exit(1);
  }
  const closeMark = `          </div>${nl}        ) : null}`;
  const end = text.indexOf(closeMark, start);
  if (end < 0) {
    console.error("✗ หาจุดปิดบล็อกการ์ดเดิมไม่เจอ");
    process.exit(1);
  }
  const replacement = [
    `          <div className="pointer-events-none absolute inset-0 z-10">`,
    `            <div`,
    `              /* วางตาม "จุดยึด" ที่ตั้งในหลังบ้าน — left/top เป็นเปอร์เซ็นต์ แล้วเลื่อนกลับครึ่งหนึ่งของตัวเอง */`,
    `              style={{`,
    `                left: (activeCards[0]?.anchorX ?? 8) + "%",`,
    `                top: (activeCards[0]?.anchorY ?? 50) + "%",`,
    `                transform: "translate(-" + (activeCards[0]?.anchorX ?? 8) + "%, -" + (activeCards[0]?.anchorY ?? 50) + "%)",`,
    `              }}`,
    `              className="pointer-events-auto absolute flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 rounded-2xl bg-surface/95 p-4 text-fg shadow-lg sm:max-w-md"`,
    `            >`,
  ].join(nl);
  writeFileSync(file, text.slice(0, start) + replacement + text.slice(end + `          </div>`.length));
  console.log("✓ เขียนแล้ว:", file);
}

/* 5) hero.tsx: ส่งจุดยึดไปกับวิวการ์ด */
{
  const file = "features/home/ui/hero.tsx";
  const text = readFileSync(file, "utf8");
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  const from = [`      ctaHref: card.ctaHref,`, `      position: card.position,`].join(nl);
  if (!text.includes(from)) {
    console.error("✗ หาบล็อกแปลงการ์ดใน hero.tsx ไม่เจอ");
    process.exit(1);
  }
  writeFileSync(file, text.replace(from, [`      ctaHref: card.ctaHref,`, `      position: card.position,`, `      anchorX: card.anchorX,`, `      anchorY: card.anchorY,`].join(nl)));
  console.log("✓ เขียนแล้ว:", file);
}

console.log("แพตช์จุดยึด (รอบ 189) เสร็จ");
