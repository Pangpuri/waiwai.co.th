import type {
  FieldSpec,
  ItemContent,
  ItemSpec,
  LocalizedValue,
  MediaValue,
  PageContent,
  PageSpec,
  SectionContent,
  SectionSpec,
} from "@/lib/content/types";

/**
 * กติกาการตรวจเนื้อหา (validator เขียนมือ — โปรเจกต์นี้ไม่ใช้ Zod)
 *
 * ⚠️ **ห้ามมีข้อความไทยในไฟล์นี้** — คืน "รหัสปัญหา" ให้หลังบ้านแปลเอง
 * (แบบเดียวกับที่ UI ใช้พจนานุกรม) เพื่อให้ด่านนี้ใช้ได้ทั้ง th/en และเพิ่มภาษาได้โดยไม่ต้องแก้ตรรกะ
 *
 * ใช้ได้ทั้ง 3 จุด — โดยไม่ต้องมีฐานข้อมูล
 * 1. ด่าน `npm run check:content` (ตรวจ seed/ข้อมูลที่ดึงจาก DB)
 * 2. หลังบ้าน — ก่อนกด publish
 * 3. เทสต์ (scripts/test-content-validate.ts)
 */

export type IssueSeverity = "error" | "warning";

export type IssueCode =
  | "page-mismatch"
  | "unknown-section"
  | "missing-section"
  | "unknown-field"
  | "unknown-item-group"
  | "missing-item-group"
  | "too-many-items"
  | "bad-order"
  | "duplicate-order"
  | "empty-th"
  | "empty-media-path"
  | "too-long"
  | "bad-url"
  | "bad-date"
  | "missing-en"
  | "incomplete-en"
  | "missing-alt"
  | "media-path-is-url"
  | "watermark"
  | "placeholder";

export type ContentIssue = {
  readonly severity: IssueSeverity;
  readonly code: IssueCode;
  /** ตำแหน่งแบบอ่านได้ เช่น `home.hero.slides[2].image` */
  readonly path: string;
  /** ค่าที่เกี่ยวข้อง (ตัดสั้น) — ใช้โชว์ในหลังบ้าน ไม่ใช่ข้อความที่แปลแล้ว */
  readonly detail: string;
};

/** ข้อความที่ยังเป็นข้อมูลตัวอย่าง — ไม่ใช่ error แต่ต้องเห็นในรายงาน */
const PLACEHOLDER_MARKERS: readonly string[] = ["XX", "ข้อมูลทดสอบ", "Test data"];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isFullUrl(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) || value.startsWith("//");
}

function containsPlaceholder(value: string): boolean {
  return PLACEHOLDER_MARKERS.some((marker) => value.includes(marker));
}

/** ตัดค่าให้สั้นพอโชว์ในหลังบ้านได้ */
function brief(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
}

function toLocalizedValue(value: unknown): LocalizedValue | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as { th?: unknown; en?: unknown };
  if (typeof candidate.th !== "string") return null;
  return { th: candidate.th, en: typeof candidate.en === "string" ? candidate.en : "" };
}

function toMediaValue(value: unknown): MediaValue | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as { path?: unknown; altTh?: unknown; altEn?: unknown; hasWatermark?: unknown };
  if (typeof candidate.path !== "string") return null;
  return {
    path: candidate.path,
    altTh: typeof candidate.altTh === "string" ? candidate.altTh : "",
    altEn: typeof candidate.altEn === "string" ? candidate.altEn : "",
    hasWatermark: candidate.hasWatermark === true,
  };
}

/** ตรวจฟิลด์ข้อความหนึ่งช่อง */
function checkTextField(
  issues: ContentIssue[],
  spec: FieldSpec,
  rawValue: LocalizedValue | undefined,
  path: string,
): void {
  const value = toLocalizedValue(rawValue);
  const th = (value?.th ?? "").trim();
  const en = (value?.en ?? "").trim();

  if (th === "") {
    if (spec.required) {
      issues.push({ severity: "error", code: "empty-th", path, detail: "" });
      return;
    }
  } else {
    if (th.length > spec.maxLength) {
      issues.push({ severity: "error", code: "too-long", path, detail: `${th.length}/${spec.maxLength}` });
    }
    if (spec.kind === "url" && !th.startsWith("/") && !th.startsWith("https://")) {
      issues.push({ severity: "error", code: "bad-url", path, detail: brief(th) });
    }
    if (spec.kind === "date" && !DATE_PATTERN.test(th)) {
      issues.push({ severity: "error", code: "bad-date", path, detail: brief(th) });
    }
  }

  /* มติ D3: EN บังคับเฉพาะฟิลด์ระดับ "ส่วน/หน้า" และเฉพาะฟิลด์ที่ต้องแปล */
  if (spec.level === "section" && spec.localized && spec.required && en === "") {
    issues.push({ severity: "error", code: "missing-en", path, detail: brief(th) });
  }

  if (containsPlaceholder(th) || containsPlaceholder(en)) {
    issues.push({ severity: "warning", code: "placeholder", path, detail: brief(th || en) });
  }
}

/** ตรวจฟิลด์ภาพหนึ่งช่อง (D9: เก็บพาธ · D7: ต้องมี alt ไทย) */
function checkMediaField(
  issues: ContentIssue[],
  spec: FieldSpec,
  rawValue: MediaValue | undefined,
  path: string,
): void {
  const value = toMediaValue(rawValue);

  if (value === null) {
    if (spec.required) {
      issues.push({ severity: "error", code: "empty-media-path", path, detail: "" });
    }
    return;
  }

  const filePath = value.path.trim();
  if (filePath === "") {
    issues.push({ severity: "error", code: "empty-media-path", path, detail: "" });
    return;
  }
  if (isFullUrl(filePath)) {
    issues.push({ severity: "error", code: "media-path-is-url", path, detail: brief(filePath) });
  }
  if (spec.altRequired && value.altTh.trim() === "") {
    issues.push({ severity: "error", code: "missing-alt", path, detail: brief(filePath) });
  }
  if (value.hasWatermark) {
    issues.push({ severity: "warning", code: "watermark", path, detail: brief(filePath) });
  }
  if (containsPlaceholder(value.altTh) || containsPlaceholder(value.altEn)) {
    issues.push({ severity: "warning", code: "placeholder", path: `${path}.altTh`, detail: brief(value.altTh) });
  }
}

/** ตรวจรายการหนึ่งกลุ่ม (การ์ด/สไลด์) */
function checkItemGroup(
  issues: ContentIssue[],
  itemSpec: ItemSpec,
  rows: readonly ItemContent[] | undefined,
  sectionKey: string,
): void {
  const groupPath = `${sectionKey}.${itemSpec.key}`;

  if (rows === undefined) {
    if (itemSpec.fields.length > 0) {
      issues.push({ severity: "error", code: "missing-item-group", path: groupPath, detail: "" });
    }
    return;
  }
  if (rows.length > itemSpec.maxItems) {
    issues.push({
      severity: "error",
      code: "too-many-items",
      path: groupPath,
      detail: `${rows.length}/${itemSpec.maxItems}`,
    });
  }

  const seenOrders = new Set<number>();
  const orderOfIndex: number[] = rows.map((row) => row.order);
  for (const order of orderOfIndex) {
    if (!Number.isInteger(order) || order < 1) {
      issues.push({ severity: "error", code: "bad-order", path: groupPath, detail: String(order) });
    } else if (seenOrders.has(order)) {
      issues.push({ severity: "error", code: "duplicate-order", path: groupPath, detail: String(order) });
    } else {
      seenOrders.add(order);
    }
  }

  rows.forEach((row, index) => {
    const rowPath = `${groupPath}[${index}]`;

    for (const field of itemSpec.fields) {
      const fieldPath = `${rowPath}.${field.key}`;
      if (field.kind === "media") {
        checkMediaField(issues, field, row.media[field.key] as MediaValue | undefined, fieldPath);
      } else {
        checkTextField(issues, field, row.fields[field.key] as LocalizedValue | undefined, fieldPath);
      }
    }

    /* กติกา D3 ระดับรายการ: ไม่มี EN เลย = ยอมรับ · ถ้ามี EN ต้องครบทุกช่องที่ต้องแปล */
    const localizedKeys = itemSpec.fields.filter((field) => field.localized);
    const filledKeys = localizedKeys.filter((field) => {
      const value = toLocalizedValue(row.fields[field.key]);
      if (value !== null) return value.en.trim() !== "";
      const media = toMediaValue(row.media[field.key]);
      return media !== null && media.altEn.trim() !== "";
    });
    if (filledKeys.length > 0) {
      for (const field of localizedKeys) {
        const text = toLocalizedValue(row.fields[field.key]);
        const media = toMediaValue(row.media[field.key]);
        const en = text !== null ? text.en : media !== null ? media.altEn : "";
        if (en.trim() === "") {
          issues.push({ severity: "error", code: "incomplete-en", path: `${rowPath}.${field.key}`, detail: field.key });
        }
      }
    }
  });
}

function checkSection(issues: ContentIssue[], spec: SectionSpec, content: SectionContent): void {
  for (const field of spec.fields) {
    checkTextField(issues, field, content.fields[field.key] as LocalizedValue | undefined, `${spec.key}.${field.key}`);
  }

  for (const key of Object.keys(content.fields)) {
    if (!spec.fields.some((field) => field.key === key)) {
      issues.push({ severity: "error", code: "unknown-field", path: `${spec.key}.${key}`, detail: key });
    }
  }

  for (const itemSpec of spec.items) {
    checkItemGroup(issues, itemSpec, content.items[itemSpec.key], spec.key);
  }

  for (const key of Object.keys(content.items)) {
    if (!spec.items.some((itemSpec) => itemSpec.key === key)) {
      issues.push({ severity: "error", code: "unknown-item-group", path: `${spec.key}.${key}`, detail: key });
    }
  }
}

/**
 * ตรวจเนื้อหาทั้งหน้าตามโครงที่ประกาศไว้
 * คืนรายการปัญหา (ไม่โยน exception) — ผู้เรียกตัดสินเองว่าจะให้ผ่านหรือไม่
 */
export function validateContent(spec: PageSpec, content: PageContent): readonly ContentIssue[] {
  const issues: ContentIssue[] = [];

  if (spec.page !== content.page) {
    issues.push({
      severity: "error",
      code: "page-mismatch",
      path: content.page,
      detail: `expected ${spec.page}`,
    });
  }

  for (const sectionSpec of spec.sections) {
    const sectionContent = content.sections[sectionSpec.key];
    if (sectionContent === undefined) {
      issues.push({ severity: "error", code: "missing-section", path: sectionSpec.key, detail: "" });
      continue;
    }
    checkSection(issues, sectionSpec, sectionContent);
  }

  for (const key of Object.keys(content.sections)) {
    if (!spec.sections.some((sectionSpec) => sectionSpec.key === key)) {
      issues.push({ severity: "error", code: "unknown-section", path: key, detail: key });
    }
  }

  return issues;
}

export function errorsOf(issues: readonly ContentIssue[]): readonly ContentIssue[] {
  return issues.filter((issue) => issue.severity === "error");
}

export function warningsOf(issues: readonly ContentIssue[]): readonly ContentIssue[] {
  return issues.filter((issue) => issue.severity === "warning");
}

/**
 * รายงาน "รายการที่ยังไม่มี EN" — เป็น **รายงาน** ไม่ใช่ด่าน (มติ D3: เราไม่คุ้มครองความครบของ EN)
 * ใช้ในหลังบ้านเพื่อให้การตลาดเห็นว่ามีอะไรค้างอยู่
 */
export function missingEnglishReport(spec: PageSpec, content: PageContent): readonly string[] {
  const missing: string[] = [];

  for (const sectionSpec of spec.sections) {
    const sectionContent = content.sections[sectionSpec.key];
    if (sectionContent === undefined) continue;

    for (const itemSpec of sectionSpec.items) {
      const rows = sectionContent.items[itemSpec.key] ?? [];
      rows.forEach((row, index) => {
        const hasAnyEn = itemSpec.fields.some((field) => {
          const text = toLocalizedValue(row.fields[field.key]);
          if (text !== null) return text.en.trim() !== "";
          const media = toMediaValue(row.media[field.key]);
          return media !== null && media.altEn.trim() !== "";
        });
        if (!hasAnyEn) missing.push(`${sectionSpec.key}.${itemSpec.key}[${index}]`);
      });
    }
  }

  return missing;
}
