import { createHash } from "node:crypto";
import ExcelJS from "exceljs";

import {
  JOB_SORT_STEP,
  MAX_JOB_OPENINGS,
  MAX_JOB_TITLE_LENGTH,
  MAX_JOB_DEPARTMENT_LENGTH,
  MAX_JOB_AGE_LENGTH,
  MAX_JOB_TEXT_LENGTH,
  NEW_JOB_SORT_BASE,
  isJobGenderValue,
  validateJobInput,
  type JobInput,
} from "@/lib/careers/model";

export const MAX_CAREERS_XLSX_BYTES = 6 * 1024 * 1024;
export const MAX_CAREERS_XLSX_ROWS = 100;

export type CareersSpreadsheetIssueCode =
  | "invalid-file"
  | "file-too-large"
  | "missing-columns"
  | "no-postings"
  | "too-many-rows"
  | "invalid-row"
  | "invalid-gender"
  | "invalid-openings"
  | "invalid-preview";

export type CareersSpreadsheetIssue = {
  readonly code: CareersSpreadsheetIssueCode;
  readonly row?: number;
};

export class CareersWorkbookParseError extends Error {
  readonly code: CareersSpreadsheetIssueCode;
  readonly row: number | undefined;

  constructor(code: CareersSpreadsheetIssueCode, row?: number) {
    super(code);
    this.name = "CareersWorkbookParseError";
    this.code = code;
    this.row = row;
  }
}

export type CareersSpreadsheetRow = {
  readonly sourceRow: number;
  readonly titleTh: string;
  readonly departmentTh: string;
  readonly gender: string;
  readonly openings: number;
  readonly ageTh: string;
  readonly qualificationsTh: string;
  readonly experienceTh: string;
};

export type CareersSpreadsheetWrite = {
  readonly id: string;
  readonly titleTh: string;
  readonly titleEn: string;
  readonly departmentTh: string;
  readonly departmentEn: string;
  readonly openings: number;
  readonly gender: string;
  readonly ageTh: string;
  readonly ageEn: string;
  readonly qualificationsTh: string;
  readonly qualificationsEn: string;
  readonly experienceTh: string;
  readonly experienceEn: string;
  readonly postedAt: null;
  readonly sortOrder: number;
  readonly status: "draft";
};

const REQUIRED_HEADERS = ["ลำดับ", "ตำแหน่งงาน", "แผนก/ฝ่าย", "เพศ", "จำนวน", "อายุ", "คุณสมบัติ", "ประสบการณ์"];

function cellText(row: ExcelJS.Row, column: number): string {
  return row.getCell(column).text.trim();
}

function normalizeHeader(value: string): string {
  return value.replace(/\s+/g, "");
}

function genderKey(value: string): string | null {
  const normalized = value.replace(/\s+/g, "");
  if (normalized === "") return "";
  if (normalized === "ชาย") return "male";
  if (normalized === "หญิง") return "female";
  if (normalized === "ไม่จำกัด" || normalized === "ไม่จำกัดเพศ") return "any";
  return null;
}

function columnsForHeader(sheet: ExcelJS.Worksheet): { readonly row: number; readonly columns: ReadonlyMap<string, number> } | null {
  const lastHeaderRow = Math.min(sheet.rowCount, 10);
  for (let rowNumber = 1; rowNumber <= lastHeaderRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const columns = new Map<string, number>();
    for (let column = 1; column <= sheet.columnCount; column += 1) {
      const label = normalizeHeader(cellText(row, column));
      if (label !== "") columns.set(label, column);
    }
    if (REQUIRED_HEADERS.every((header) => columns.has(header))) {
      return { row: rowNumber, columns };
    }
  }
  return null;
}

function column(columns: ReadonlyMap<string, number>, name: string): number {
  const value = columns.get(name);
  if (value === undefined) throw new CareersWorkbookParseError("missing-columns");
  return value;
}

type MutableSpreadsheetRow = {
  sourceRow: number;
  titleTh: string;
  departmentTh: string;
  gender: string;
  openings: number;
  ageTh: string;
  qualificationsTh: string;
  experienceTh: string;
};

function validateParsedRow(row: MutableSpreadsheetRow): void {
  const input: JobInput = {
    titleTh: row.titleTh,
    titleEn: "",
    departmentTh: row.departmentTh,
    departmentEn: "",
    openings: row.openings,
    gender: row.gender,
    ageTh: row.ageTh,
    ageEn: "",
    qualificationsTh: row.qualificationsTh,
    qualificationsEn: "",
    experienceTh: row.experienceTh,
    experienceEn: "",
    postedAtLocal: "",
    sortOrder: 0,
    status: "draft",
  };
  if (validateJobInput(input).length > 0) {
    throw new CareersWorkbookParseError("invalid-row", row.sourceRow);
  }
}

/** อ่านข้อมูลตำแหน่งงานจากชีตแรก โดยไม่เดาวันที่จากหัวเอกสาร */
export async function parseCareersWorkbook(data: Uint8Array): Promise<readonly CareersSpreadsheetRow[]> {
  if (data.byteLength === 0 || data.byteLength > MAX_CAREERS_XLSX_BYTES) {
    throw new CareersWorkbookParseError(data.byteLength > MAX_CAREERS_XLSX_BYTES ? "file-too-large" : "invalid-file");
  }

  const workbook = new ExcelJS.Workbook();
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new CareersWorkbookParseError("invalid-file");
  }

  const sheet = workbook.worksheets[0];
  if (sheet === undefined || sheet.rowCount > 500 || sheet.columnCount > 30) {
    throw new CareersWorkbookParseError("invalid-file");
  }

  const header = columnsForHeader(sheet);
  if (header === null) throw new CareersWorkbookParseError("missing-columns");

  const sequenceColumn = column(header.columns, "ลำดับ");
  const titleColumn = column(header.columns, "ตำแหน่งงาน");
  const departmentColumn = column(header.columns, "แผนก/ฝ่าย");
  const genderColumn = column(header.columns, "เพศ");
  const openingsColumn = column(header.columns, "จำนวน");
  const ageColumn = column(header.columns, "อายุ");
  const qualificationsColumn = column(header.columns, "คุณสมบัติ");
  const experienceColumn = column(header.columns, "ประสบการณ์");
  const parsedRows: MutableSpreadsheetRow[] = [];

  for (let rowNumber = header.row + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const sequence = cellText(row, sequenceColumn);
    let populated = false;
    for (let currentColumn = 1; currentColumn <= sheet.columnCount; currentColumn += 1) {
      if (cellText(row, currentColumn) !== "") {
        populated = true;
        break;
      }
    }
    if (!populated) continue;

    if (sequence === "") {
      const previous = parsedRows.at(-1);
      if (previous === undefined) throw new CareersWorkbookParseError("invalid-row", rowNumber);
      const continuation = new Set<string>();
      for (let currentColumn = 1; currentColumn <= sheet.columnCount; currentColumn += 1) {
        if (currentColumn === sequenceColumn) continue;
        const value = cellText(row, currentColumn);
        if (value !== "") continuation.add(value);
      }
      if (continuation.size > 0) {
        previous.qualificationsTh = [previous.qualificationsTh, ...continuation].filter((value) => value !== "").join("\n");
        validateParsedRow(previous);
      }
      continue;
    }

    if (!/^\d+$/.test(sequence)) throw new CareersWorkbookParseError("invalid-row", rowNumber);
    const titleTh = cellText(row, titleColumn);
    const departmentTh = cellText(row, departmentColumn);
    const rawGender = cellText(row, genderColumn);
    const gender = genderKey(rawGender);
    if (gender === null || !isJobGenderValue(gender)) {
      throw new CareersWorkbookParseError("invalid-gender", rowNumber);
    }

    const rawOpenings = cellText(row, openingsColumn);
    const openings = Number(rawOpenings);
    if (rawOpenings === "" || !Number.isInteger(openings) || openings < 0 || openings > MAX_JOB_OPENINGS) {
      throw new CareersWorkbookParseError("invalid-openings", rowNumber);
    }

    const parsed: MutableSpreadsheetRow = {
      sourceRow: rowNumber,
      titleTh,
      departmentTh,
      gender,
      openings,
      ageTh: cellText(row, ageColumn),
      qualificationsTh: cellText(row, qualificationsColumn),
      experienceTh: cellText(row, experienceColumn),
    };
    validateParsedRow(parsed);
    parsedRows.push(parsed);
    if (parsedRows.length > MAX_CAREERS_XLSX_ROWS) {
      throw new CareersWorkbookParseError("too-many-rows", rowNumber);
    }
  }

  if (parsedRows.length === 0) throw new CareersWorkbookParseError("no-postings");
  return parsedRows;
}

/** ตรวจข้อมูล preview ที่ส่งกลับจากเบราว์เซอร์ก่อนยอมเขียนลงฐานข้อมูล */
export function validateCareersSpreadsheetRows(value: unknown): readonly CareersSpreadsheetRow[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_CAREERS_XLSX_ROWS) return null;
  const rows: CareersSpreadsheetRow[] = [];
  const sourceRows = new Set<number>();

  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return null;
    const record = item as Record<string, unknown>;
    const sourceRow = record["sourceRow"];
    const titleTh = record["titleTh"];
    const departmentTh = record["departmentTh"];
    const gender = record["gender"];
    const openings = record["openings"];
    const ageTh = record["ageTh"];
    const qualificationsTh = record["qualificationsTh"];
    const experienceTh = record["experienceTh"];
    if (
      typeof sourceRow !== "number" ||
      !Number.isInteger(sourceRow) ||
      sourceRow < 1 ||
      sourceRows.has(sourceRow) ||
      typeof titleTh !== "string" ||
      titleTh.length > MAX_JOB_TITLE_LENGTH ||
      typeof departmentTh !== "string" ||
      departmentTh.length > MAX_JOB_DEPARTMENT_LENGTH ||
      typeof gender !== "string" ||
      !isJobGenderValue(gender) ||
      typeof openings !== "number" ||
      !Number.isInteger(openings) ||
      openings < 0 ||
      openings > MAX_JOB_OPENINGS ||
      typeof ageTh !== "string" ||
      ageTh.length > MAX_JOB_AGE_LENGTH ||
      typeof qualificationsTh !== "string" ||
      qualificationsTh.length > MAX_JOB_TEXT_LENGTH ||
      typeof experienceTh !== "string" ||
      experienceTh.length > MAX_JOB_TEXT_LENGTH
    ) {
      return null;
    }
    const parsed: CareersSpreadsheetRow = {
      sourceRow,
      titleTh,
      departmentTh,
      gender,
      openings,
      ageTh,
      qualificationsTh,
      experienceTh,
    };
    const candidate: MutableSpreadsheetRow = { ...parsed };
    try {
      validateParsedRow(candidate);
    } catch {
      return null;
    }
    sourceRows.add(sourceRow);
    rows.push(parsed);
  }
  return rows;
}

/** แปลงข้อมูลที่ตรวจแล้วเป็น draft พร้อมรหัสคงที่เพื่อให้การนำเข้าซ้ำปลอดภัย */
export function careersSpreadsheetWrites(rows: readonly CareersSpreadsheetRow[]): readonly CareersSpreadsheetWrite[] {
  const occurrences = new Map<string, number>();
  return rows.map((row, index) => {
    const fingerprint = JSON.stringify([
      row.titleTh.trim(),
      row.departmentTh.trim(),
      row.gender,
      row.openings,
      row.ageTh.trim(),
      row.qualificationsTh.trim(),
      row.experienceTh.trim(),
    ]);
    const occurrence = (occurrences.get(fingerprint) ?? 0) + 1;
    occurrences.set(fingerprint, occurrence);
    const hash = createHash("sha256").update(fingerprint).digest("hex").slice(0, 16);
    return {
      id: `jxl-${hash}-${String(occurrence)}`,
      titleTh: row.titleTh,
      titleEn: "",
      departmentTh: row.departmentTh,
      departmentEn: "",
      openings: row.openings,
      gender: row.gender,
      ageTh: row.ageTh,
      ageEn: "",
      qualificationsTh: row.qualificationsTh,
      qualificationsEn: "",
      experienceTh: row.experienceTh,
      experienceEn: "",
      postedAt: null,
      sortOrder: NEW_JOB_SORT_BASE + index * JOB_SORT_STEP,
      status: "draft",
    };
  });
}
