// แพตช์รอบ 189: จุดยึดอิสระ (ขยับได้) ของการ์ดแคมเปญ — โมเดล/ชั้นข้อมูล/ตัวเรนเดอร์
// ตรวจ anchor ทุกจุดก่อนเขียน (กันไฟล์ถูกแก้ครึ่งทาง)
import { readFileSync, writeFileSync } from "node:fs";

const edits = [];

/* ── 1) โมเดล: เพิ่ม anchorX/anchorY + ตัวช่วยแปลงจากตำแหน่งสำเร็จรูป ─────────── */
{
  const file = "lib/hero/cards.ts";
  const source = readFileSync(file, "utf8");
  const nl = source.includes("\r\n") ? "\r\n" : "\n";
  const next = [];

  next.push(["card-type", `  readonly position: HeroCardPosition;`,
    `  readonly position: HeroCardPosition;${nl}  /** จุดยึดบนพื้นที่สไลด์ (เปอร์เซ็นต์ 0–100) — ลากวางได้อิสระ (รอบที่ 189) */${nl}  readonly anchorX: number;${nl}  readonly anchorY: number;`]);

  next.push(["input-type", `  readonly position: HeroCardPosition;
  readonly startsAt: string | null;`,
    `  readonly position: HeroCardPosition;${nl}  readonly anchorX: number;${nl}  readonly anchorY: number;${nl}  readonly startsAt: string | null;`]);

  next.push(["preset-anchor", `export function isHeroCardPosition(value: string): value is HeroCardPosition {`,
    `/** จุดยึดสำเร็จรูปของแต่ละตำแหน่ง (ใช้เป็นค่าเริ่มต้น + ปุ่มลัดในหน้าจอ) */
export const HERO_CARD_POSITION_ANCHORS: Readonly<Record<HeroCardPosition, { readonly x: number; readonly y: number }>> = {
  left: { x: 8, y: 50 },
  center: { x: 50, y: 50 },
  right: { x: 92, y: 50 },
};

/** บีบจุดยึดให้เป็นจำนวนเต็ม 0–100 (ค่าที่ไม่ใช่ตัวเลข = ค่ากลาง) */
export function clampAnchor(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** ตำแหน่งสำเร็จรูปที่ตรงกับจุดยึดนี้ (ไม่ตรง = กําหนดเอง) */
export function heroCardPositionOfAnchor(x: number, y: number): HeroCardPosition | null {
  for (const position of HERO_CARD_POSITIONS) {
    const anchor = HERO_CARD_POSITION_ANCHORS[position];
    if (anchor.x === x && anchor.y === y) return position;
  }
  return null;
}

export function isHeroCardPosition(value: string): value is HeroCardPosition {`]);

  next.push(["parse-anchor", `  return {
    ok: true,
    value: {
      title,
      body,
      ctaLabel,
      ctaHref,
      position: isHeroCardPosition(positionRaw) ? positionRaw : "left",`,
    `  const position = isHeroCardPosition(positionRaw) ? positionRaw : "left";
  /* จุดยึด: ใช้ค่าที่ส่งมา (ลากเอง) · ไม่ส่ง = ใช้ค่าของตำแหน่งสำเร็จรูป */
  const preset = HERO_CARD_POSITION_ANCHORS[position];
  const anchorX = record["anchorX"] === undefined ? preset.x : clampAnchor(record["anchorX"]);
  const anchorY = record["anchorY"] === undefined ? preset.y : clampAnchor(record["anchorY"]);

  return {
    ok: true,
    value: {
      title,
      body,
      ctaLabel,
      ctaHref,
      position,${nl}      anchorX,${nl}      anchorY,`]);

  edits.push({ file, nl, next });
}

/* ── 2) ชั้นข้อมูล: อ่าน/เขียนจุดยึด ────────────────────────────────────────── */
{
  const file = "lib/hero/cards-repository.ts";
  const source = readFileSync(file, "utf8");
  const nl = source.includes("\r\n") ? "\r\n" : "\n";
  const next = [];

  next.push(["row-type", `  readonly position: string;`,
    `  readonly position: string;${nl}  readonly anchor_x: number;${nl}  readonly anchor_y: number;`]);

  next.push(["columns", `       cta_label_th, cta_label_en, cta_href, position, starts_at, ends_at, is_active\`;`,
    `       cta_label_th, cta_label_en, cta_href, position, anchor_x, anchor_y, starts_at, ends_at, is_active\`;`]);

  next.push(["to-card", `    position,`,
    `    position,${nl}    anchorX: row.anchor_x,${nl}    anchorY: row.anchor_y,`]);

  next.push(["update-sql", `            cta_label_th = $6, cta_label_en = $7, cta_href = $8, position = $9,
            starts_at = $10, ends_at = $11, is_active = $12,
            updated_at = now(), updated_by = $13`,
    `            cta_label_th = $6, cta_label_en = $7, cta_href = $8, position = $9,
            anchor_x = $10, anchor_y = $11, starts_at = $12, ends_at = $13, is_active = $14,
            updated_at = now(), updated_by = $15`]);

  next.push(["update-params", `      input.ctaHref,
      input.position,
      input.startsAt,
      input.endsAt,
      input.isActive,
      actor,`,
    `      input.ctaHref,
      input.position,
      input.anchorX,
      input.anchorY,
      input.startsAt,
      input.endsAt,
      input.isActive,
      actor,`]);

  edits.push({ file, nl, next });
}

/* ── 3) action: ส่งจุดยึดเข้า validator ────────────────────────────────────── */
{
  const file = "app/admin/hero/card-actions.ts";
  const source = readFileSync(file, "utf8");
  const nl = source.includes("\r\n") ? "\r\n" : "\n";
  const next = [];
  next.push(["anchor-args", `    position: typeof formData.get("position") === "string" ? String(formData.get("position")) : "left",`,
    `    position: typeof formData.get("position") === "string" ? String(formData.get("position")) : "left",${nl}    anchorX: formData.get("anchorX") === null ? undefined : Number(formData.get("anchorX")),${nl}    anchorY: formData.get("anchorY") === null ? undefined : Number(formData.get("anchorY")),`]);
  edits.push({ file, nl, next });
}

/* ── 4) ตัวเรนเดอร์หน้าเว็บ: ใช้จุดยึด (ลากได้) แทนคลาสซ้าย/กลาง/ขวา ─────────── */
{
  const file = "features/home/ui/hero-slider.tsx";
  const source = readFileSync(file, "utf8");
  const nl = source.includes("\r\n") ? "\r\n" : "\n";
  const next = [];

  next.push(["view-type", `  readonly position: "left" | "center" | "right";
};`,
    `  readonly position: "left" | "center" | "right";
  /** จุดยึดเป็นเปอร์เซ็นต์ของพื้นที่สไลด์ (รอบที่ 189) — ลากวางได้อิสระ */
  readonly anchorX: number;
  readonly anchorY: number;
};`]);

  next.push(["card-container", `          <div
            className={[
              "pointer-events-none absolute inset-0 z-10 flex p-4 sm:p-6",
              activeCards[0]?.position === "center"
                ? "items-start justify-center"
                : activeCards[0]?.position === "right"
                  ? "items-start justify-end"
                  : "items-start justify-start",
            ].join(" ")}
          >
            <div className="flex w-full max-w-sm flex-col gap-2 rounded-2xl bg-surface/95 p-4 text-fg shadow-lg sm:max-w-md">`,
    `          <div className="pointer-events-none absolute inset-0 z-10">
            <div
              /* วางตาม "จุดยึด" ที่ตั้งในหลังบ้าน: left/top เป็นเปอร์เซ็นต์ + เลื่อนกลับครึ่งหนึ่งของตัวเอง */
              style={{
                left: \`\${activeCards[0]?.anchorX ?? 8}%\`,
                top: \`\${activeCards[0]?.anchorY ?? 50}%\`,
                transform: \`translate(-\${activeCards[0]?.anchorX ?? 8}%, -\${activeCards[0]?.anchorY ?? 50}%)\`,
              }}
              className="pointer-events-auto absolute flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 rounded-2xl bg-surface/95 p-4 text-fg shadow-lg sm:max-w-md"
            >`]);

  edits.push({ file, nl, next });
}

/* ── ตรวจ anchor ทั้งหมดก่อนเขียน ──────────────────────────────────────────── */
const plans = [];
for (const edit of edits) {
  let text = readFileSync(edit.file, "utf8");
  for (const [name, from, to] of edit.next) {
    if (!text.includes(from)) {
      console.error(`✗ anchor "${name}" ไม่พบใน ${edit.file}`);
      process.exit(1);
    }
    text = text.split(from).join(to);
  }
  plans.push({ file: edit.file, text });
}
for (const plan of plans) {
  writeFileSync(plan.file, plan.text);
  console.log("✓ เขียนแล้ว:", plan.file);
}
console.log("แพตช์จุดยึด (รอบ 189) เสร็จ");
