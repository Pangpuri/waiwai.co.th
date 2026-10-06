/**
 * โมเดล "เมนูอาหาร (วิดีโอ)" ที่นำเข้าจากเว็บเดิม (S3 ส่วนที่ 4 · รอบที่ 104) — **ตรรกะล้วน ทดสอบได้**
 *
 * ⚠️ ของจริงคือ **วิดีโอ** (ไม่ใช่สูตรข้อความ) — ตรวจ 18 บทความแล้วเมื่อ 2026-10-05
 * - เก็บ **id ของวิดีโอ** ไม่เก็บ URL เต็ม ⇒ ประกอบ URL ที่นี่ที่เดียว (ย้ายโดเมน/ผู้ให้บริการได้)
 * - **ไม่ฝัง iframe เองในโมดูลนี้** — URL ที่คืนคือ URL ของ facade (ผู้ใช้กดก่อนจึงโหลด)
 * - `id = r<source_id>` ⇒ นำเข้าซ้ำได้แบบ idempotent
 */

export type RecipeInput = {
  readonly id: string;
  readonly sourceId: string;
  /** พาธในเว็บเดิม */
  readonly sourceUrl: string;
  readonly titleTh: string;
  readonly titleEn: string;
  readonly videoId: string;
  /** วันเผยแพร่ (ISO `YYYY-MM-DD`) — null = อ่านจากเว็บเดิมไม่ได้ */
  readonly publishedOn: string | null;
  readonly sortOrder: number;
};

export type ImportIssue = {
  readonly code: string;
  readonly path: string;
  readonly message: string;
};

/** id วิดีโอ YouTube: ตัวอักษร ตัวเลข `_` `-` (ยาว 6–20) */
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;
const MAX_TITLE_LENGTH = 200;

export function recipeIdOfSourceId(sourceId: string): string {
  return `r${sourceId.trim()}`;
}

export function isYouTubeVideoId(value: string): boolean {
  return VIDEO_ID_PATTERN.test(value.trim());
}

/**
 * ดึง "รหัสวิดีโอ" จากสิ่งที่คนวางมา (รอบที่ 136)
 *
 * ที่มา: เจ้าของถามว่า *"รองรับลิงค์มาโชว์ได้ตามลักษณะคอนเท้นใช่ไหมครับ"* — เดิมช่องนี้รับเฉพาะ **รหัสล้วน**
 * ⇒ การตลาดต้องตัดรหัสเองจากลิงก์ (พลาดง่าย) ⇒ ตัวนี้รับได้ทั้งรหัสล้วนและลิงก์ทุกรูปแบบที่ YouTube ให้คัดลอก
 *   · `youtube.com/watch?v=<id>` (มีพารามิเตอร์ก่อน/หลังก็ได้ เช่น `?app=desktop&v=…` หรือ `?v=…&t=30s`)
 *   · `youtu.be/<id>` · `youtube.com/shorts/<id>` · `…/embed/<id>` · `…/live/<id>` (รวม `m.`/`music.`/`-nocookie`)
 *
 * ⚠️ **ยังเก็บเฉพาะรหัสลงฐานข้อมูล** (มติ D20 · ไม่เก็บ URL เต็ม ⇒ เปลี่ยนโดเมน/ผู้ให้บริการได้)
 * ⚠️ คืน `null` = อ่านไม่ได้ — ผู้เรียกต้องแจ้ง error เอง (ห้ามเดารหัสขึ้นมา)
 */
export function youTubeIdFromInput(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (VIDEO_ID_PATTERN.test(trimmed)) return trimmed;

  const patterns: readonly RegExp[] = [
    /* watch?v=<id> — รองรับพารามิเตอร์ที่มาก่อน/ตามหลัง v */
    /(?:youtube\.com|youtube-nocookie\.com)\/watch\?(?:[^#\s]*&)?v=([A-Za-z0-9_-]{6,20})/i,
    /* /embed/<id> · /shorts/<id> · /live/<id> · /v/<id> */
    /(?:youtube\.com|youtube-nocookie\.com)\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{6,20})/i,
    /* ลิงก์ย่อ youtu.be/<id> */
    /youtu\.be\/([A-Za-z0-9_-]{6,20})/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1] !== undefined) return match[1];
  }
  return null;
}

/**
 * URL ของผู้เล่น — ใช้ **youtube-nocookie.com** (ไม่ตั้งคุกกี้โฆษณา) และ **โหลดเฉพาะตอนผู้ใช้กด**
 * ⚠️ ฟังก์ชันนี้คืน URL เฉย ๆ — การเอาไปฝังต้องผ่าน facade เท่านั้น (ห้ามฝังใน SSR)
 */
export function youTubeEmbedUrlOf(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId.trim()}?autoplay=1&rel=0`;
}

/** URL หน้าเว็บ YouTube (ใช้เป็นลิงก์ "เปิดใน YouTube" — ให้ผู้ใช้เลือกเองได้) */
export function youTubeWatchUrlOf(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId.trim()}`;
}

/** ชื่อเมนูตามภาษา — อังกฤษว่าง = ถอยไปใช้ไทย (เว็บเดิมมีแต่ไทย) */
export function recipeTitleOf(titleTh: string, titleEn: string, language: "th" | "en"): string {
  const preferred = language === "en" ? titleEn.trim() : titleTh.trim();
  return preferred === "" ? titleTh.trim() : preferred;
}

/**
 * แสดงวันที่เผยแพร่ตามภาษา (`2018-10-09` → `9 ตุลาคม 2018` / `9 October 2018`)
 * - ตรึง `timeZone: "UTC"` เพราะวันที่เป็น "วันทั้งวัน" ที่ไม่มีเวลา — ไม่งั้นฝั่งที่เขตเวลาติดลบจะได้วันก่อนหน้า
 * - จัดรูปแบบไม่ได้ = คืนสตริง ISO เดิม (ไม่ให้หน้าพังเพราะ Intl)
 */
export function formatRecipeDate(publishedOn: string | null, language: "th" | "en"): string {
  if (publishedOn === null || publishedOn.trim() === "") return "";
  const date = new Date(`${publishedOn.trim()}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return publishedOn.trim();

  try {
    return new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  } catch {
    return publishedOn.trim();
  }
}

export function validateRecipeInput(input: RecipeInput): readonly ImportIssue[] {
  const issues: ImportIssue[] = [];

  if (input.id !== recipeIdOfSourceId(input.sourceId)) {
    issues.push({ code: "id-mismatch", path: "id", message: `id ต้องเป็น "${recipeIdOfSourceId(input.sourceId)}"` });
  }
  if (!/^\d{3,}$/.test(input.sourceId.trim())) {
    issues.push({ code: "bad-source-id", path: "sourceId", message: `source id ต้องเป็นตัวเลข (ได้ "${input.sourceId}")` });
  }
  if (input.titleTh.trim() === "") {
    issues.push({ code: "empty-title", path: "titleTh", message: "ชื่อเมนูไทยห้ามว่าง" });
  }
  if (input.titleTh.length > MAX_TITLE_LENGTH) {
    issues.push({ code: "too-long", path: "titleTh", message: `ชื่อเมนูยาวเกิน ${MAX_TITLE_LENGTH} ตัวอักษร` });
  }
  if (!isYouTubeVideoId(input.videoId)) {
    issues.push({ code: "bad-video-id", path: "videoId", message: `id วิดีโอไม่ถูกต้อง (ได้ "${input.videoId}")` });
  }
  if (input.publishedOn !== null && !/^\d{4}-\d{2}-\d{2}$/.test(input.publishedOn)) {
    issues.push({ code: "bad-date", path: "publishedOn", message: `วันเผยแพร่ต้องเป็น YYYY-MM-DD (ได้ "${input.publishedOn}")` });
  }
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0) {
    issues.push({ code: "bad-order", path: "sortOrder", message: "ลำดับต้องเป็นจำนวนเต็ม ≥ 0" });
  }
  if (input.sourceUrl !== "" && !input.sourceUrl.startsWith("/")) {
    issues.push({ code: "bad-source-url", path: "sourceUrl", message: "เก็บพาธของเว็บเดิม (เริ่มด้วย /) ไม่ใช่ URL เต็ม" });
  }

  return issues;
}
