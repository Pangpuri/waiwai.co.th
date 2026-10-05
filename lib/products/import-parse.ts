/**
 * ตัวแกะ HTML ของเว็บเดิม (waiwai.co.th · CMS "iGetWeb") — **ตรรกะล้วน ทดสอบได้ ไม่มี dependency**
 *
 * ทำไมเขียนเอง (ไม่ใช้ไลบรารีแกะ HTML)
 * - โครงสร้างต้นทางเป็น **ตารางคงที่** (ยืนยันจากหน้าเว็บจริง 2026-10-05):
 *     แถวรูป(+ลิงก์) → แถวชื่อไทย (`<strong>`) → แถวชื่ออังกฤษ (`<span>`) → แถวสายผลิตภัณฑ์
 *   และหน้ารายละเอียดเป็นตาราง 3 คอลัมน์ (ไทย | อังกฤษ | %) ปิดท้ายด้วยข้อความรวมบรรทัดเดียว
 * - กฎโปรเจกต์: **ห้ามเพิ่ม dependency โดยไม่ถาม** ⇒ เขียนตัวแกะที่ทดสอบได้เอง
 *   ⚠️ ตัวแกะนี้ผูกกับโครงสร้างเว็บเดิมโดยเจตนา — ถ้าเว็บเดิมเปลี่ยนโครงสร้าง ต้องแก้ตัวนี้
 *      (สคริปต์นำเข้ามีเทสต์คุมด้วย fixture ⇒ รู้ทันที)
 *
 * หมายเหตุ: ไฟล์นี้ **ไม่แตะเครือข่าย/ฐานข้อมูล** ⇒ เทสต์ได้ด้วย HTML ตัวอย่าง
 */

/** ถอด entity ที่พบบ่อยในเว็บเดิม */
export function decodeEntities(input: string): string {
  const named: Readonly<Record<string, string>> = {
    nbsp: " ",
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    rsquo: "\u2019",
    lsquo: "\u2018",
    ldquo: "\u201C",
    rdquo: "\u201D",
    hellip: "\u2026",
    ndash: "\u2013",
    mdash: "\u2014",
  };

  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return named[body.toLowerCase()] ?? whole;
  });
}

/** ตัดแท็กออกแล้วเหลือข้อความ (ยังไม่ยุบช่องว่าง) */
export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "));
}

/** ยุบช่องว่างซ้ำ/ตัดหัวท้าย — ใช้กับทุกข้อความที่นำเข้า */
export function normalizeText(value: string): string {
  return value.replace(/[\s\u00A0]+/g, " ").trim();
}

export function textOf(html: string): string {
  return normalizeText(stripTags(html));
}

const THAI = /[\u0E00-\u0E7F]/;
const LATIN = /[A-Za-z]/;

export function hasThai(value: string): boolean {
  return THAI.test(value);
}

export function isLatinOnly(value: string): boolean {
  return LATIN.test(value) && !THAI.test(value);
}

function tablesOf(html: string): readonly string[] {
  return [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((match) => match[0]);
}

function rowsOf(table: string): readonly (readonly string[])[] {
  return [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
    [...(row[1] ?? "").matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => cell[1] ?? ""),
  );
}

function imageSrcOf(cell: string): string | null {
  const match = cell.match(/<img[^>]+src="([^"]+)"/i);
  if (match === null) return null;
  const src = decodeEntities(match[1] ?? "").trim();
  return src.startsWith("http") ? src : null;
}

export type ParsedCategoryProduct = {
  readonly sourceId: string;
  /** พาธในเว็บเดิม เช่น `/th/pages/15136-…` */
  readonly detailPath: string;
  readonly imageUrl: string;
  readonly nameTh: string;
  readonly nameEn: string;
  readonly groupTh: string;
  readonly groupEn: string;
};

export type ParsedCategoryPage = {
  readonly descriptionTh: string;
  readonly heroImageUrl: string;
  readonly products: readonly ParsedCategoryProduct[];
};

/** id หน้าในเว็บเดิมจากพาธ `/th/pages/15136-...` */
export function sourceIdOfDetailPath(detailPath: string): string {
  return detailPath.match(/\/pages\/(\d+)/)?.[1] ?? "";
}

/**
 * ทำให้ href เป็น **พาธ** เสมอ (เว็บเดิมมีทั้งแบบ `/th/pages/…` และแบบ URL เต็ม)
 * ⚠️ เราเก็บพาธ ไม่เก็บ URL เต็ม (มติ D9) และทำให้ย้ายโดเมนได้โดยไม่ต้องแก้ข้อมูล
 */
export function pathOfHref(href: string): string {
  const value = href.trim();
  if (value === "") return "";
  if (value.startsWith("/")) return value;
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}`;
  } catch {
    return "";
  }
}

/**
 * หาคำอธิบายหมวด — ใช้ **ข้อความไทยที่ยาวที่สุด** จาก **แถวก่อนแถวรูปแรก** ของแต่ละตาราง
 * ⚠️ บทเรียนจากของจริง (2026-10-05): หน้า "ไวไว"/"ควิกแสบ" ใส่คำอธิบายเป็นแถวแรก **ของตารางเดียวกับสินค้า**
 *    ⇒ ถ้าดูแค่ตารางที่ "ไม่มีรูปเลย" จะไม่เจอคำอธิบาย (และห้ามดูกว้าง ๆ ทั้งตาราง เพราะชื่อสินค้าจะถูกจับเป็นคำอธิบาย)
 */
function findCategoryDescription(tables: readonly string[]): string {
  let longest = "";
  for (const table of tables) {
    const rows = rowsOf(table);
    const firstImageRow = rows.findIndex((row) => row.some((cell) => imageSrcOf(cell) !== null));
    const head = firstImageRow < 0 ? rows : rows.slice(0, firstImageRow);
    for (const cell of head.flat()) {
      const text = textOf(cell);
      if (hasThai(text) && text.length > longest.length) longest = text;
    }
  }
  return longest.length > 30 ? longest : "";
}

/**
 * แกะหน้าหมวด: คำอธิบาย + ภาพหัวหมวด (og:image) + รายการสินค้า (เรียงตามที่ปรากฏ)
 * ⚠️ สินค้าในตารางเดียวกันเรียงทีละคอลัมน์ ⇒ ลำดับรวม = ลำดับตาราง → ลำดับคอลัมน์
 */
export function parseCategoryPage(html: string): ParsedCategoryPage {
  const heroImageUrl = decodeEntities(html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] ?? "").trim();

  const tables = tablesOf(html);
  const descriptionTh = findCategoryDescription(tables);
  const products: ParsedCategoryProduct[] = [];

  for (const table of tables) {
    const rows = rowsOf(table);
    const firstImageRow = rows.findIndex((row) => row.some((cell) => imageSrcOf(cell) !== null));
    if (firstImageRow < 0) continue;

    const block = rows.slice(firstImageRow);
    const columns = (block[0] ?? []).length;
    for (let column = 0; column < columns; column += 1) {
      const imageCell = block[0]?.[column] ?? "";
      const imageUrl = imageSrcOf(imageCell);
      if (imageUrl === null) continue;

      const detailPath = pathOfHref(decodeEntities(imageCell.match(/<a[^>]+href="([^"]+)"/i)?.[1] ?? ""));
      const sourceId = sourceIdOfDetailPath(detailPath);
      if (sourceId === "") continue;

      let nameTh = "";
      let nameEn = "";
      let groupTh = "";
      let groupEn = "";
      for (let index = 1; index < block.length; index += 1) {
        const text = textOf(block[index]?.[column] ?? "");
        if (text === "") continue;
        if (nameTh === "" && hasThai(text)) {
          nameTh = text;
          continue;
        }
        if (nameTh !== "" && nameEn === "" && isLatinOnly(text)) {
          nameEn = text;
          continue;
        }
        if (nameEn !== "" && groupEn === "" && isLatinOnly(text)) {
          groupEn = text;
          continue;
        }
        if (nameEn === "" && groupTh === "" && hasThai(text) && nameTh !== text) {
          groupTh = text;
        }
      }

      if (nameTh === "") continue;
      products.push({ sourceId, detailPath, imageUrl, nameTh, nameEn, groupTh, groupEn });
    }
  }

  return { descriptionTh, heroImageUrl, products };
}

export type ParsedDetailPage = {
  readonly taglineTh: string;
  readonly ingredients: readonly { readonly nameTh: string; readonly nameEn: string; readonly percentText: string }[];
  readonly detailsTh: string;
  readonly allergensTh: string;
  readonly netWeightTh: string;
  readonly fdaNumber: string;
  readonly packagingTh: string;
  readonly images: readonly string[];
};

/**
 * แยกข้อความรายละเอียดก้อนเดียวออกเป็นฟิลด์ (ตามต้นฉบับ — ไม่แต่งเพิ่ม)
 * ต้นฉบับเรียงว่า: [วัตถุเจือปน…] ข้อมูลสำหรับผู้แพ้อาหาร : … น้ำหนักสุทธิ … (อย.) … ขนาดบรรจุ …
 * ⚠️ ถ้าไม่พบเครื่องหมาย ฟิลด์นั้นเป็นค่าว่าง (ไม่เดา)
 */
export function splitDetailFields(text: string): Pick<ParsedDetailPage, "allergensTh" | "netWeightTh" | "fdaNumber" | "packagingTh"> {
  /** ค่าของฟิลด์ = ข้อความ *หลัง* เครื่องหมาย จนถึงเครื่องหมายถัดไป (ตัดตัวคั่น/ช่องว่างหัวท้าย) */
  const valueAfter = (marker: string, nextMarker: string): string => {
    const at = text.indexOf(marker);
    if (at < 0) return "";
    const after = at + marker.length;
    const nextAt = nextMarker === "" ? -1 : text.indexOf(nextMarker, after);
    const end = nextAt > after ? nextAt : text.length;
    return normalizeText(text.slice(after, end)).replace(/^[:：\-–—\s]+/, "").replace(/[-–—\s]+$/, "");
  };

  return {
    allergensTh: valueAfter("ข้อมูลสำหรับผู้แพ้อาหาร", "น้ำหนักสุทธิ"),
    netWeightTh: valueAfter("น้ำหนักสุทธิ", "(อย.)"),
    fdaNumber: valueAfter("(อย.)", "ขนาดบรรจุ"),
    packagingTh: valueAfter("ขนาดบรรจุ", ""),
  };
}

/**
 * แกะหน้ารายละเอียดสินค้า
 * @param nameTh ชื่อสินค้าที่รู้อยู่แล้วจากหน้าหมวด (ใช้ตัดคำโปรยออกจากชื่อ)
 */
export function parseDetailPage(html: string, options: { readonly nameTh: string }): ParsedDetailPage {
  const images = [...new Set(
    [...html.matchAll(/<img[^>]+src="([^"]+)"/gi)]
      .map((match) => decodeEntities(match[1] ?? "").trim())
      .filter((src) => src.startsWith("http") && src.includes("filemanager")),
  )];

  const marker = "ส่วนประกอบที่สำคัญ";
  let taglineTh = "";
  let detailsTh = "";
  const ingredients: { nameTh: string; nameEn: string; percentText: string }[] = [];

  for (const table of tablesOf(html)) {
    if (!table.includes(marker)) continue;
    const rows = rowsOf(table);

    for (const row of rows) {
      const cells = row.map((cell) => textOf(cell));
      const filled = cells.filter((value) => value !== "");
      const firstFilled = filled[0];
      const firstCell = cells[0];

      /* แถวรวมข้อความยาว (วัตถุเจือปน/สารก่อภูมิแพ้/น้ำหนัก/อย./ขนาดบรรจุ) */
      if (cells.length === 1 && filled.length === 1 && firstFilled !== undefined && /น้ำหนักสุทธิ|ขนาดบรรจุ|ผู้แพ้อาหาร/.test(firstFilled)) {
        detailsTh = firstFilled;
        continue;
      }

      /* แถวหัวเรื่อง (มีชื่อสินค้า + คำโปรย + marker) */
      if (filled.length === 1 && cells.some((value) => value.includes(marker))) {
        const intro = filled[0];
        if (intro === undefined) continue;
        const beforeMarker = intro.slice(0, intro.indexOf(marker));
        const trimmed = normalizeText(beforeMarker);
        const name = normalizeText(options.nameTh);
        taglineTh = name !== "" && trimmed.startsWith(name) ? normalizeText(trimmed.slice(name.length)) : trimmed;
        continue;
      }

      /* แถวส่วนผสม: ไทย | อังกฤษ | % */
      if (cells.length >= 3 && firstCell !== undefined && firstCell !== "" && !firstCell.includes(marker)) {
        ingredients.push({ nameTh: firstCell, nameEn: cells[1] ?? "", percentText: cells[2] ?? "" });
      }
    }

    break;
  }

  return { taglineTh, ingredients, detailsTh, ...splitDetailFields(detailsTh), images };
}
