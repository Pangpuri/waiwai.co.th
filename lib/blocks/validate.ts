import {
  COLUMN_GRID_SPAN,
  collectBlockIds,
  countBlocks,
  isSafeHref,
  layoutOf,
  walkBlocks,
  type Block,
  type BlockDocument,
  type BlockMedia,
} from "@/lib/blocks/types";
import { pageOutline } from "@/lib/blocks/outline";
import type { LocalizedValue } from "@/lib/content/types";

/**
 * ตรวจเอกสารบล็อก (ตรรกะล้วน — ใช้ทั้งในหน้าจอหลังบ้านและด่านตรวจ)
 *
 * ระดับความเข้มที่ตกลง
 * - **error** = บล็อกที่บันทึก/เผยแพร่ไม่ได้ (ข้อความไทยว่าง · ลิงก์อันตราย · เก็บ URL เต็มแทนพาธ · ภาพไม่มี alt)
 * - **warning** = บันทึกได้ แต่ควรรู้ (ยังไม่มีคำแปลอังกฤษ · เป็นข้อความตัวอย่าง · ภาพติดลายน้ำ · คอลัมน์ว่าง)
 *
 * หมายเหตุที่ตั้งใจ: ต่างจากเนื้อหาแบบ "ฟิลด์มีโครง" ตรงที่ **คำแปลอังกฤษเป็นคำเตือน ไม่ใช่ error**
 * เพราะเนื้อหาที่การตลาดเพิ่มเองควรเผยแพร่ได้ก่อน แล้วค่อยเติมคำแปล (ตรงกับเจตนาของเจ้าของเรื่อง TH/EN)
 *
 * ตั้งแต่รอบที่ 71 (X1.1) การตรวจ **เดินลงไปถึงบล็อกที่ซ้อนในคอลัมน์** ด้วย `walkBlocks()` ตัวเดียวกับที่
 * หน้าจอและตัวย้ายรุ่นใช้ ⇒ ไม่มีทางที่บล็อกลูกจะรอดการตรวจไปได้
 */

export type BlockIssueSeverity = "error" | "warning";

export type BlockIssue = {
  readonly severity: BlockIssueSeverity;
  readonly code: string;
  /** เส้นทางในเอกสาร เช่น `blocks[2].columns[0].blocks[1].items[0].title.th` */
  readonly path: string;
  readonly detail: string | null;
};

const PLACEHOLDER = /(^|\s)xx(\s|$)|ทดสอบ|test data|lorem ipsum/i;

function issue(
  severity: BlockIssueSeverity,
  code: string,
  path: string,
  detail: string | null = null,
): BlockIssue {
  return { severity, code, path, detail };
}

function checkText(
  value: LocalizedValue,
  path: string,
  options: { readonly required: boolean; readonly englishRequired: boolean },
  issues: BlockIssue[],
): void {
  if (options.required && value.th.trim() === "") {
    issues.push(issue("error", "empty-th", `${path}.th`));
  }
  if (options.englishRequired && value.en.trim() === "") {
    issues.push(issue("warning", "missing-en", `${path}.en`));
  }
  for (const [language, text] of [
    ["th", value.th],
    ["en", value.en],
  ] as const) {
    if (PLACEHOLDER.test(text)) {
      issues.push(issue("warning", "placeholder", `${path}.${language}`));
    }
  }
}

function checkMedia(media: BlockMedia | null, path: string, issues: BlockIssue[]): void {
  if (media === null) return;

  if (media.path.startsWith("//") || /^[a-z][a-z0-9+.-]*:\/\//i.test(media.path)) {
    issues.push(issue("error", "media-path-is-url", `${path}.path`, "ต้องเก็บเป็นพาธในโปรเจกต์ (มติ D9)"));
  } else if (!media.path.startsWith("/")) {
    issues.push(issue("warning", "media-path-not-absolute", `${path}.path`, "พาธควรขึ้นต้นด้วย /"));
  }

  if (media.altTh.trim() === "") {
    issues.push(issue("error", "missing-alt", `${path}.altTh`, "ภาพต้องมีคำอธิบาย (มติ D7)"));
  }
  if (media.hasWatermark) {
    issues.push(issue("warning", "watermark", path, "ภาพติดลายน้ำ — ต้องเปลี่ยนก่อนเผยแพร่จริง"));
  }
}

function checkHref(href: string, path: string, issues: BlockIssue[]): void {
  if (!isSafeHref(href)) {
    issues.push(issue("error", "bad-href", path, "ลิงก์ต้องเป็น /path · # · mailto: · tel: หรือ https://"));
  }
}

function checkBlock(block: Block, path: string, issues: BlockIssue[]): void {
  switch (block.type) {
    case "hero": {
      /*
        ── หัวข้อของแบนเนอร์เปิดหน้า **ไม่บังคับ** (รอบที่ 258 · เคสจริงจากเจ้าของ 2026-10-10) ──────────
        เจ้าของลบหัวข้อของบล็อกแบนเนอร์ (เพราะชื่อเต็มของบริษัทอยู่บล็อกถัดไปแล้ว ⇒ "บริษัท" ซ้ำสองที่)
        แต่ **เผยแพร่ไม่ผ่าน** เพราะกฎเดิมบังคับ `hero.title` ต้องมีข้อความไทย ⇒ งานที่แก้หายทั้งที่ตั้งใจถูก
        ⇒ กฎที่ตรงกับเจตนาจริงคือ **"แบนเนอร์ต้องไม่ว่างเปล่า"** = มีหัวข้อ **หรือ** มีภาพ อย่างน้อยหนึ่งอย่าง
        ⚠️ `englishRequired: true` ยังอยู่ (มีหัวข้อไทยแล้วควรมี EN — เป็นคำเตือน ไม่บล็อก)
        ⚠️ `<h1>` ของหน้าไม่ได้มาจากบล็อกนี้ (มาจาก `heading` ของ `BlockDocumentView`) ⇒ ไม่กระทบ a11y
      */
      checkText(block.title, `${path}.title`, { required: false, englishRequired: true }, issues);
      checkText(block.subtitle, `${path}.subtitle`, { required: false, englishRequired: false }, issues);
      checkText(block.note, `${path}.note`, { required: false, englishRequired: false }, issues);
      checkText(block.ctaLabel, `${path}.ctaLabel`, { required: false, englishRequired: false }, issues);
      checkMedia(block.image, `${path}.image`, issues);
      checkHref(block.ctaHref, `${path}.ctaHref`, issues);
      if (block.title.th.trim() === "" && block.image === null) {
        issues.push(issue("error", "hero-empty", `${path}.title`, "แบนเนอร์ต้องมีหัวข้อหรือภาพอย่างน้อยหนึ่งอย่าง"));
      }
      if (block.image === null) {
        issues.push(issue("warning", "hero-without-image", `${path}.image`, "แบนเนอร์เปิดหน้าไม่มีภาพ"));
      }
      return;
    }

    case "heading":
      checkText(block.text, `${path}.text`, { required: true, englishRequired: true }, issues);
      return;

    case "richText":
      checkText(block.heading, `${path}.heading`, { required: true, englishRequired: true }, issues);
      checkText(block.body, `${path}.body`, { required: false, englishRequired: false }, issues);
      checkText(block.ctaLabel, `${path}.ctaLabel`, { required: false, englishRequired: false }, issues);
      checkHref(block.ctaHref, `${path}.ctaHref`, issues);
      return;

    case "imageText":
      checkText(block.heading, `${path}.heading`, { required: true, englishRequired: true }, issues);
      checkText(block.body, `${path}.body`, { required: false, englishRequired: false }, issues);
      checkMedia(block.image, `${path}.image`, issues);
      if (block.image === null) {
        issues.push(issue("warning", "imageText-without-image", `${path}.image`, "บล็อกภาพ+ข้อความยังไม่มีภาพ"));
      }
      return;

    /*
      ภาพใหญ่ (รอบที่ 259) — มีแค่ภาพ ⇒ กฎเดียวที่ตรวจได้คือ "ต้องมีภาพ + ต้องมี alt"
      · ยังไม่เลือกภาพ = **คำเตือน** (ไม่บล็อกการบันทึก — ผู้ใช้อาจวางบล็อกไว้ก่อนแล้วค่อยเลือกภาพ)
    */
    case "image":
      checkMedia(block.image, `${path}.image`, issues);
      if (block.image === null) {
        issues.push(issue("warning", "image-block-without-image", `${path}.image`, "บล็อกภาพใหญ่ยังไม่ได้เลือกภาพ"));
      }
      return;

    case "cards":
      checkText(block.heading, `${path}.heading`, { required: false, englishRequired: false }, issues);
      checkText(block.body, `${path}.body`, { required: false, englishRequired: false }, issues);

      if (block.items.length === 0) {
        issues.push(issue("warning", "cards-empty", `${path}.items`, "ยังไม่มีการ์ดในบล็อกนี้"));
      }
      if (block.items.length > 4 && block.columns > block.items.length) {
        issues.push(issue("warning", "columns-more-than-items", `${path}.columns`, "จำนวนคอลัมน์มากกว่าจำนวนการ์ด"));
      }
      block.items.forEach((card, index) => {
        const cardPath = `${path}.items[${index}]`;
        checkText(card.title, `${cardPath}.title`, { required: true, englishRequired: true }, issues);
        checkText(card.body, `${cardPath}.body`, { required: false, englishRequired: false }, issues);
        checkMedia(card.image, `${cardPath}.image`, issues);
        checkHref(card.href, `${cardPath}.href`, issues);
      });
      return;

    case "cta":
      checkText(block.heading, `${path}.heading`, { required: true, englishRequired: true }, issues);
      checkText(block.body, `${path}.body`, { required: false, englishRequired: false }, issues);
      checkText(block.label, `${path}.label`, { required: true, englishRequired: false }, issues);
      checkHref(block.href, `${path}.href`, issues);
      if (block.href.trim() === "") {
        issues.push(issue("warning", "cta-without-href", `${path}.href`, "ปุ่มเชิญชวนยังไม่มีปลายทาง"));
      }
      return;

    case "quote":
      checkText(block.text, `${path}.text`, { required: true, englishRequired: true }, issues);
      checkText(block.attribution, `${path}.attribution`, { required: false, englishRequired: false }, issues);
      return;

    case "divider":
      return;

    case "table":
      checkText(block.heading, `${path}.heading`, { required: false, englishRequired: false }, issues);
      checkText(block.caption, `${path}.caption`, { required: false, englishRequired: false }, issues);

      if (block.columns.length === 0) {
        issues.push(issue("error", "table-without-columns", `${path}.columns`, "ตารางต้องมีอย่างน้อย 1 คอลัมน์"));
      }
      block.columns.forEach((column, index) => {
        checkText(column, `${path}.columns[${index}]`, { required: true, englishRequired: true }, issues);
      });

      if (block.rows.length === 0) {
        issues.push(issue("warning", "table-empty", `${path}.rows`, "ตารางยังไม่มีแถวข้อมูล"));
      }
      block.rows.forEach((row, rowIndex) => {
        row.cells.forEach((cell, cellIndex) => {
          checkText(cell, `${path}.rows[${rowIndex}].cells[${cellIndex}]`, { required: false, englishRequired: false }, issues);
        });
      });
      return;

    case "map":
      checkText(block.heading, `${path}.heading`, { required: false, englishRequired: false }, issues);
      checkText(block.caption, `${path}.caption`, { required: false, englishRequired: false }, issues);
      checkText(block.linkLabel, `${path}.linkLabel`, { required: false, englishRequired: false }, issues);
      checkMedia(block.image, `${path}.image`, issues);
      checkHref(block.linkHref, `${path}.linkHref`, issues);
      if (block.image === null) {
        issues.push(issue("warning", "map-without-image", `${path}.image`, "บล็อกแผนที่ยังไม่มีภาพ"));
      }
      if (block.linkHref.trim() !== "" && block.linkLabel.th.trim() === "" && block.linkLabel.en.trim() === "") {
        issues.push(issue("warning", "map-link-without-label", `${path}.linkLabel`, "มีลิงก์เปิดแผนที่แต่ยังไม่มีข้อความบนปุ่ม"));
      }
      return;

    case "form":
      /*
        ฟอร์มใช้ระบบฟอร์มจริงของเว็บ (ตรวจค่า/กันสแปม/ยินยอม PDPA ที่ Server Action เดิม)
        ⇒ ที่นี่ตรวจแค่ข้อความหัว/คำอธิบาย (ไม่บังคับ) — ไม่มีอะไรให้บล็อกการเผยแพร่
      */
      checkText(block.heading, `${path}.heading`, { required: false, englishRequired: false }, issues);
      checkText(block.body, `${path}.body`, { required: false, englishRequired: false }, issues);
      return;

    case "gallery":
      checkText(block.heading, `${path}.heading`, { required: false, englishRequired: false }, issues);
      if (block.items.length === 0) {
        issues.push(issue("warning", "gallery-empty", `${path}.items`, "แกลเลอรีนี้ยังไม่มีภาพ"));
      }
      block.items.forEach((item, index) => {
        const itemPath = `${path}.items[${index}]`;
        checkMedia(item.image, `${itemPath}.image`, issues);
        if (item.image === null) {
          issues.push(issue("warning", "gallery-item-without-image", `${itemPath}.image`, "ภาพนี้ยังไม่ได้เลือกไฟล์"));
        }
        checkText(item.caption, `${itemPath}.caption`, { required: false, englishRequired: false }, issues);
      });
      return;

    case "jobBoard":
      checkText(block.heading, `${path}.heading`, { required: false, englishRequired: false }, issues);
      checkText(block.body, `${path}.body`, { required: false, englishRequired: false }, issues);

      if (block.items.length === 0) {
        issues.push(issue("warning", "jobBoard-empty", `${path}.items`, "กระดานรับสมัครงานยังไม่มีตำแหน่ง"));
      }
      block.items.forEach((item, index) => {
        const itemPath = `${path}.items[${index}]`;
        checkText(item.title, `${itemPath}.title`, { required: true, englishRequired: true }, issues);
        checkText(item.department, `${itemPath}.department`, { required: false, englishRequired: false }, issues);
        checkText(item.qualifications, `${itemPath}.qualifications`, { required: false, englishRequired: false }, issues);
        checkText(item.experience, `${itemPath}.experience`, { required: false, englishRequired: false }, issues);
        if (item.openings === 0) {
          issues.push(issue("warning", "job-item-without-openings", `${itemPath}.openings`, "ตำแหน่งนี้ยังไม่ระบุจำนวนอัตรา"));
        }
      });
      return;

    case "rosterText":
      checkText(block.heading, `${path}.heading`, { required: false, englishRequired: false }, issues);
      checkText(block.body, `${path}.body`, { required: false, englishRequired: false }, issues);

      if (block.members.length === 0) {
        issues.push(issue("warning", "roster-empty", `${path}.members`, "รายชื่อนี้ยังไม่มีบุคคล"));
      }
      block.members.forEach((member, index) => {
        const memberPath = `${path}.members[${index}]`;
        /* ชื่อคนอาจไม่มีคำแปลอังกฤษ (ชื่อตามเอกสารราชการ) ⇒ บังคับเฉพาะภาษาไทย · "ตำแหน่ง" ต้องมีทั้งสองภาษา */
        checkText(member.name, `${memberPath}.name`, { required: true, englishRequired: false }, issues);
        checkText(member.role, `${memberPath}.role`, { required: true, englishRequired: true }, issues);
        checkMedia(member.image, `${memberPath}.image`, issues);
      });
      return;

    case "recipeCards":
      checkText(block.heading, `${path}.heading`, { required: false, englishRequired: false }, issues);
      checkText(block.body, `${path}.body`, { required: false, englishRequired: false }, issues);

      if (block.items.length === 0) {
        issues.push(issue("warning", "recipeCards-empty", `${path}.items`, "บล็อกเมนูอาหารยังไม่มีเมนู"));
      }
      block.items.forEach((item, index) => {
        const itemPath = `${path}.items[${index}]`;
        checkText(item.title, `${itemPath}.title`, { required: true, englishRequired: true }, issues);
        checkText(item.body, `${itemPath}.body`, { required: false, englishRequired: false }, issues);
        checkText(item.ingredients, `${itemPath}.ingredients`, { required: false, englishRequired: false }, issues);
        checkText(item.steps, `${itemPath}.steps`, { required: false, englishRequired: false }, issues);
        checkMedia(item.image, `${itemPath}.image`, issues);
        if (item.image === null) {
          issues.push(issue("warning", "recipe-item-without-image", `${itemPath}.image`, "เมนูนี้ยังไม่ได้เลือกภาพ"));
        }
      });
      return;

    case "row": {
      /* แถว: ตรวจโครงคอลัมน์ (ตัวบล็อกลูกถูกเดินตรวจด้านล่างผ่าน walkBlocks) */
      if (block.columns.length === 0) {
        issues.push(issue("error", "row-without-columns", `${path}.columns`, "แถวต้องมีอย่างน้อย 1 คอลัมน์"));
        return;
      }

      const span = block.columns.reduce((total, column) => total + COLUMN_GRID_SPAN[column.width], 0);
      if (span > 12) {
        issues.push(
          issue("warning", "row-width-overflow", `${path}.columns`, `รวมความกว้างคอลัมน์เกิน 1 แถว (${span}/12) — ส่วนที่เกินจะตกไปบรรทัดใหม่`),
        );
      }

      block.columns.forEach((column, index) => {
        if (column.blocks.length === 0) {
          issues.push(issue("warning", "column-empty", `${path}.columns[${index}]`, "คอลัมน์นี้ยังไม่มีบล็อก"));
        }
      });
      return;
    }
  }
}

export function validateDocument(document: BlockDocument): readonly BlockIssue[] {
  const issues: BlockIssue[] = [];

  const total = countBlocks(document.blocks);
  if (total === 0) {
    issues.push(issue("warning", "empty-document", "blocks", "หน้านี้ยังไม่มีบล็อก"));
  }

  /* id ต้องไม่ซ้ำกันทั้งหน้า (รวมบล็อกที่ซ้อน) */
  const seen = new Set<string>();
  for (const id of collectBlockIds(document.blocks)) {
    if (seen.has(id)) {
      issues.push(issue("error", "duplicate-id", "blocks", `รหัสบล็อกซ้ำ: ${id}`));
    }
    seen.add(id);
  }

  /* เดินทุกบล็อก (รวมที่ซ้อนในคอลัมน์) — path ชี้จุดที่ผิดได้ตรงเสมอ */
  for (const node of walkBlocks(document.blocks)) {
    checkBlock(node.block, node.path, issues);
  }

  /*
    เลย์เอาต์ "สารบัญด้านข้าง" (X1.8) ต้องมีหัวข้อพอให้สร้างสารบัญ
    ⇒ น้อยกว่า 2 = เตือน (ไม่บล็อกการเผยแพร่ เพราะหน้าเว็บยังแสดงเนื้อหาครบ แค่ไม่มีสารบัญ)
    ⚠️ ตรวจ **ทั้งสองภาษา** (X1.8 ต่อ · รอบที่ 92): ภาษาหนึ่งอาจตั้ง sidebar ไว้อีกภาษาหนึ่งไม่ตั้ง
  */
  if (
    (layoutOf(document, "th") === "sidebar" && pageOutline(document, "th").length < 2) ||
    (layoutOf(document, "en") === "sidebar" && pageOutline(document, "en").length < 2)
  ) {
    issues.push(
      issue(
        "warning",
        "layout-sidebar-few-headings",
        "layout",
        'เลย์เอาต์ "สารบัญด้านข้าง" แต่หน้านี้มีหัวข้อน้อยกว่า 2 ⇒ สารบัญจะไม่แสดง (เพิ่มบล็อกที่มีหัวข้อ หรือเปลี่ยนเป็นเต็มความกว้าง)',
      ),
    );
  }

  return issues;
}

export function documentErrorsOf(issues: readonly BlockIssue[]): readonly BlockIssue[] {
  return issues.filter((entry) => entry.severity === "error");
}

export function documentWarningsOf(issues: readonly BlockIssue[]): readonly BlockIssue[] {
  return issues.filter((entry) => entry.severity === "warning");
}

/** รายงานสั้น ๆ ว่า "ยังไม่มีคำแปลอังกฤษ" กี่จุด — ใช้โชว์ในหน้าจอ (ไม่บล็อกการเผยแพร่) */
export function missingEnglishCount(issues: readonly BlockIssue[]): number {
  return issues.filter((entry) => entry.code === "missing-en").length;
}
