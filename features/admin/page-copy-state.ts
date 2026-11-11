/** สถานะฟอร์ม "ข้อความหัวหน้าหน้าเนื้อหา" (รอบ 342 — recipes/news) — ตรรกะล้วน */
export type PageCopyState = {
  readonly status: "idle" | "saved" | "error";
  readonly reason: "" | "database" | "invalid";
};

export const INITIAL_PAGE_COPY_STATE: PageCopyState = { status: "idle", reason: "" };

export type PageCopyFormStrings = {
  readonly title: string;
  readonly hint: string;
  readonly eyebrowTh: string;
  readonly eyebrowEn: string;
  readonly titleTh: string;
  readonly titleEn: string;
  readonly introTh: string;
  readonly introEn: string;
  readonly save: string;
  readonly saving: string;
  readonly saved: string;
  readonly invalid: string;
  readonly failed: string;
};
