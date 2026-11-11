import { attributeOf, decodeEntities, hasThai, normalizeText, pathOfHref, rowsOf, tablesOf, textOf } from "@/lib/import/html";

/**
 * ตัวแกะหน้า **สินค้าส่งออก** ของเว็บเดิม (waiwai.co.th · `/en/pages/<id>`) — รอบ 342
 *
 * โครงสร้างต้นทาง (ตรวจจากหน้า 15154, 15235, 15324, 15361 เมื่อ 2026-11-11)
 * - เนื้อหาอยู่ใน `<section class="module-page">` เป็น **ตาราง 2–4 คอลัมน์**
 * - แถวแรกของแต่ละตาราง = รูปสินค้า (บางช่องว่าง)
 * - แถวถัดไปในคอลัมน์เดียวกัน = ชื่อสินค้า + คำอธิบาย + ขนาดบรรจุ (`1 carton = …`)
 * - หน้า 15361 ใช้ชื่อไทยก่อน แล้วจึงชื่ออังกฤษ; หน้าอื่นมีชื่ออังกฤษอย่างเดียว
 *
 * ⚠️ ไฟล์นี้ **ไม่แตะเครือข่าย/ฐานข้อมูล** ⇒ ทดสอบได้ด้วย HTML ตัวอย่าง
 * ⚠️ ตัวแกะผูกกับโครงสร้างเว็บเดิมโดยเจตนา — ถ้าเว็บเดิมเปลี่ยนโครงสร้าง ต้องแก้ที่นี่
 */

export type ParsedExportProduct = {
  /** ลำดับในหน้า (0 เริ่มต้น) — ใช้สร้างรหัสสินค้าแบบ idempotent */
  readonly index: number;
  readonly nameTh: string;
  readonly nameEn: string;
  /** คำอธิบายจากต้นทาง (อังกฤษ) — อาจว่าง */
  readonly detailsEn: string;
  /** ขนาดบรรจุจากต้นทาง เช่น `1 carton = 62.3 x 35.3 x 39.2 cm.` */
  readonly packaging: string;
  readonly imageUrl: string;
  /** พาธหน้ารายละเอียดในเว็บเดิม (ถ้ามี) — เก็บไว้ตรวจย้อนหลังเท่านั้น */
  readonly detailPath: string;
};

export type ParsedExportPage = {
  /** หัวเรื่องหน้า เช่น `Waiwai` · `Quick` · `Serda` */
  readonly title: string;
  readonly products: readonly ParsedExportProduct[];
};

function imageSrcOf(cell: string): string {
  const match = cell.match(/<img[^>]+src="([^"]+)"/i);
  return decodeEntities(match?.[1] ?? "").trim();
}

function anchorHrefOf(cell: string): string {
  return decodeEntities(attributeOf(cell.match(/<a[^>]*>/i)?.[0] ?? "", "href")).trim();
}

function pageTitleOf(html: string): string {
  const header = html.match(/<div class="page-header">([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] ?? "";
  const title = textOf(header.match(/<div class="title">([\s\S]*?)<\/div>/i)?.[1] ?? "");
  if (title !== "") return title;
  return textOf(html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "").replace(/^\s*ไวไว\s*-\s*/, "").trim();
}

function isPackagingLine(value: string): boolean {
  return /carton/i.test(value) || /ลัง/i.test(value);
}

/** แปลงคอลัมน์หนึ่งของตาราง → สินค้า (คืน null เมื่อไม่มีรูป/ไม่มีชื่อ) */
function productFromColumn(
  rows: readonly (readonly string[])[],
  imageRowIndex: number,
  columnIndex: number,
  index: number,
): ParsedExportProduct | null {
  const imageCell = rows[imageRowIndex]?.[columnIndex] ?? "";
  const imageUrl = imageSrcOf(imageCell);
  if (imageUrl === "") return null;

  const lines: string[] = [];
  for (let rowIndex = imageRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const cell = rows[rowIndex]?.[columnIndex] ?? "";
    /* ช่องที่มีรูปอีกรูป = เริ่มสินค้าถัดไปแล้ว (ไม่ควรเกิด แต่กันไว้) */
    if (imageSrcOf(cell) !== "") continue;
    const text = textOf(cell);
    if (text !== "") lines.push(text);
  }
  if (lines.length === 0) return null;

  const first = lines[0] ?? "";
  const second = lines[1] ?? "";
  let nameTh = "";
  let nameEn = "";
  let descriptionStart = 1;

  if (hasThai(first)) {
    nameTh = first;
    if (second !== "" && !hasThai(second)) {
      nameEn = second;
      descriptionStart = 2;
    } else {
      nameEn = first;
    }
  } else {
    nameEn = first;
    nameTh = first;
  }

  if (nameEn === "" || nameTh === "") return null;

  const descriptionLines: string[] = [];
  let packaging = "";
  for (const line of lines.slice(descriptionStart)) {
    if (isPackagingLine(line)) {
      if (packaging === "") packaging = line;
      continue;
    }
    descriptionLines.push(line);
  }

  const detailPath = pathOfHref(anchorHrefOf(imageCell));
  return {
    index,
    nameTh,
    nameEn,
    detailsEn: normalizeText(descriptionLines.join(" ")),
    packaging: normalizeText(packaging),
    imageUrl,
    detailPath,
  };
}

/**
 * แกะหน้าสินค้าส่งออกทั้งหน้า — สินค้าทั้งหมดเรียงตามตาราง → คอลัมน์
 * ⚠️ กันซ้ำด้วย `imageUrl` (บางหน้าวางตารางซ้ำ) โดยเก็บใบแรกที่เจอ
 */
export function parseExportProductPage(html: string): ParsedExportPage {
  const title = pageTitleOf(html);
  const products: ParsedExportProduct[] = [];
  const seen = new Set<string>();

  for (const table of tablesOf(html)) {
    const rows = rowsOf(table);
    const imageRowIndex = rows.findIndex((row) => row.some((cell) => imageSrcOf(cell) !== ""));
    if (imageRowIndex < 0) continue;

    const columnCount = rows[imageRowIndex]?.length ?? 0;
    for (let column = 0; column < columnCount; column += 1) {
      const product = productFromColumn(rows, imageRowIndex, column, products.length);
      if (product === null) continue;
      if (seen.has(product.imageUrl)) continue;
      seen.add(product.imageUrl);
      products.push(product);
    }
  }

  return { title, products };
}
