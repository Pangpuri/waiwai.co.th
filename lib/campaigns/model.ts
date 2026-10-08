/**
 * "แคมเปญ" — ตรรกะล้วน (รอบที่ 190 · โมดูล "สไลด์ & แคมเปญ")
 *
 * มติเจ้าของ 2026-10-07: *"แคมเปญซ้ำซ้อน เอฟเฟคซ้ำซ้อนไม่อิสระจากกัน ต้องทำหน้าเฉพาะแคมเปญขึ้นมา
 * แล้วตัดแคมเปญที่ต่อกับสไลด์แบบ 1:1 ออก"*
 *
 * ⇒ แคมเปญเป็น **เอนทิตีของตัวเอง**: มีชื่อไว้ดูในหลังบ้าน · ข้อความ 2 ภาษา · ช่วงเวลา · สถานะร่าง/เผยแพร่ ·
 *    และ **เลือกได้ว่าจะแสดงบนสไลด์ไหน** (เลือกหลายใบ · ไม่เลือกเลย = แสดงทุกสไลด์ — ค่าเริ่มต้น)
 *
 * ที่นี่เป็นตรรกะล้วน (ตรวจค่า/คำนวณสถานะ/ประเมินความพร้อม) ⇒ ทดสอบได้โดยไม่ต้องมี DOM/DB
 * การกรองตามเวลาจริงทำที่ SQL ด้วย `now()` ของฐานข้อมูล (ไม่มีตัวจับเวลาในแอป)
 */

export const CAMPAIGN_STATUSES = ["draft", "published"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/** เพดานจำนวนแคมเปญที่ยังไม่ลบ — กัน "ขึ้นมั่วจนเละ" ตามที่เจ้าของกังวล */
export const MAX_CAMPAIGNS = 24;

/** จุดยึดสำเร็จรูป (ลากเองได้ — ตัวเลขเป็นเปอร์เซ็นต์ของพื้นที่สไลด์) */
export const CAMPAIGN_ANCHOR_PRESETS = {
  left: { x: 8, y: 50 },
  center: { x: 50, y: 50 },
  right: { x: 92, y: 50 },
} as const;
export type CampaignAnchorPreset = keyof typeof CAMPAIGN_ANCHOR_PRESETS;

export const CAMPAIGN_WINDOW_STATES = ["always", "scheduled", "live", "expired"] as const;
export type CampaignWindowState = (typeof CAMPAIGN_WINDOW_STATES)[number];

export type CampaignText = { readonly th: string; readonly en: string };

export type Campaign = {
  readonly id: string;
  /** ชื่อสำหรับดูในหลังบ้าน (ไม่ขึ้นเว็บ) — กันแคมเปญไม่มีชื่อ/ซ้ำกันจนแยกไม่ออก */
  readonly name: string;
  readonly title: CampaignText;
  readonly body: CampaignText;
  readonly ctaLabel: CampaignText;
  readonly ctaHref: string;
  /** พาธภาพในการ์ด (ว่าง = การ์ดข้อความล้วน) — รอบที่ 193 */
  readonly imagePath: string;
  readonly imageAltTh: string;
  readonly imageAltEn: string;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly isActive: boolean;
  readonly status: CampaignStatus;
  readonly sortOrder: number;
  /** สไลด์ที่แคมเปญนี้จะแสดง — **ว่าง = ทุกสไลด์** */
  readonly slideIds: readonly string[];
};

export type CampaignInput = {
  readonly name: string;
  readonly title: CampaignText;
  readonly body: CampaignText;
  readonly ctaLabel: CampaignText;
  readonly ctaHref: string;
  /** พาธภาพในการ์ด (ว่าง = การ์ดข้อความล้วน) — รอบที่ 193 */
  readonly imagePath: string;
  readonly imageAltTh: string;
  readonly imageAltEn: string;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly isActive: boolean;
  readonly slideIds: readonly string[];
};

export type CampaignParseOutcome =
  | { readonly ok: true; readonly value: CampaignInput }
  | { readonly ok: false; readonly problems: readonly string[] };

export function isCampaignStatus(value: string): value is CampaignStatus {
  return (CAMPAIGN_STATUSES as readonly string[]).includes(value);
}

/** บีบจุดยึดให้เป็นจำนวนเต็ม 0–100 (ค่าที่ไม่ใช่ตัวเลข = กึ่งกลาง) */
export function clampAnchor(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** ตำแหน่งสำเร็จรูปที่ตรงกับจุดยึดนี้ (ไม่ตรง = ผู้ใช้ลากเอง) */
export function anchorPresetOf(x: number, y: number): CampaignAnchorPreset | null {
  for (const preset of Object.keys(CAMPAIGN_ANCHOR_PRESETS) as CampaignAnchorPreset[]) {
    const anchor = CAMPAIGN_ANCHOR_PRESETS[preset];
    if (anchor.x === x && anchor.y === y) return preset;
  }
  return null;
}

/** วันที่จาก `datetime-local`/ISO → ISO string · ค่าที่อ่านไม่ได้ = null (ไม่จำกัดเวลา) */
export function normalizeMoment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** ISO → ค่าสำหรับ `<input type="datetime-local">` (เวลาท้องถิ่นของผู้ใช้) */
export function toDateTimeLocalValue(iso: string | null): string {
  if (iso === null) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms - new Date(ms).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** พาธภาพที่ปลอดภัย — ต้องเป็นพาธในเว็บ (มติ D9: ห้ามเก็บ URL เต็ม) · ว่างได้ = ไม่มีภาพ */
export function isSafeCampaignImagePath(value: string): boolean {
  const path = value.trim();
  if (path === "") return true;
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("://");
}

/** ภาพของการ์ดที่พร้อมเรนเดอร์จริง (รอบที่ 194) */
export type CampaignCardImage = { readonly path: string; readonly alt: string };

/**
 * ตัดสินว่า "การ์ดนี้มีภาพให้เรนเดอร์ไหม" — **จุดเดียว** ที่ตัดสิน (ตัวเรนเดอร์ไม่ต้องเดาเอง)
 *
 * - พาธว่าง/มีแต่ช่องว่าง = `null` ⇒ ตัวเรนเดอร์ **ไม่สร้างองค์ประกอบภาพเลย**
 *   (สิ่งที่ต้องกัน: `<img src="">` ทำให้เบราว์เซอร์ยิงคำขอไปที่ URL ของหน้าปัจจุบันซ้ำ)
 * - คำอธิบายภาพ: ภาษาที่ขอ → อีกภาษา → หัวข้อการ์ด (มีภาพแล้วไม่ปล่อย `alt` ว่าง)
 *
 * ตรรกะล้วน ไม่แตะ DOM/DB ⇒ เทสต์ได้ตรง ๆ (ดู `scripts/test-campaigns.ts`)
 */
export function campaignCardImage(
  card: Pick<Campaign, "imagePath" | "imageAltTh" | "imageAltEn">,
  language: "th" | "en",
  fallbackTitle: string,
): CampaignCardImage | null {
  const path = card.imagePath.trim();
  if (path === "") return null;

  const preferred = (language === "en" ? card.imageAltEn : card.imageAltTh).trim();
  const other = (language === "en" ? card.imageAltTh : card.imageAltEn).trim();
  const alt = [preferred, other, fallbackTitle.trim()].find((candidate) => candidate !== "") ?? "";
  return { path, alt };
}

/** สถานะภาพของการ์ดที่ **หน้าจอ** ถืออยู่ก่อนกดบันทึก (คนละเรื่องกับ `CampaignCardImage`) */
export type CampaignImageDraft = { readonly path: string; readonly altTh: string; readonly altEn: string };

/** ค่าเริ่มต้นของภาพการ์ดในหน้าจอ (ใช้ร่วมกันหลายที่ — ห้ามพิมพ์ซ้ำ) */
export const EMPTY_CAMPAIGN_IMAGE_DRAFT: CampaignImageDraft = { path: "", altTh: "", altEn: "" };

/**
 * รวม "patch" จากช่องภาพ (`ImageDrop`) เข้ากับค่าที่มีอยู่ — **ฟิลด์ที่ไม่ส่งมา = คงค่าเดิมไว้**
 *
 * ⚠️ บทเรียนรอบที่ 195 (บั๊กจริงที่เจ้าของเจอ): ช่องภาพส่งค่าเป็น **patch บางส่วน**
 *    (พิมพ์คำอธิบายภาพ → `{ altTh }` · กดใช้ภาพจากคลัง → `{ path, altTh, altEn }`)
 *    ถ้าอ่านแบบเป็น "ค่าเต็ม" (`patch.path ?? ""`) ⇒ **พาธถูกล้างทันทีที่แก้คำอธิบายภาพ ⇒ ภาพหาย**
 *    ⇒ ต้องรวมผ่านฟังก์ชันนี้เท่านั้น (การ "ลบภาพ" ส่งมาครบทั้งสามฟิลด์เป็นค่าว่าง จึงยังลบได้)
 */
export function mergeCampaignImage(current: CampaignImageDraft, patch: Partial<CampaignImageDraft>): CampaignImageDraft {
  return {
    path: patch.path ?? current.path,
    altTh: patch.altTh ?? current.altTh,
    altEn: patch.altEn ?? current.altEn,
  };
}

/**
 * ฟิลด์ที่ `parseCampaignInput` ปฏิเสธได้ — ใช้บอกผู้ใช้ว่า "ต้องแก้ช่องไหน" (รอบที่ 195)
 * ⚠️ ลำดับในรายการนี้ = ลำดับที่หน้าจอใช้แสดง (ค่าคงที่ ไม่สลับตามลำดับที่ validator ฟ้อง)
 */
export const CAMPAIGN_FIELD_CODES = ["titleTh", "ctaHref", "imagePath", "imageAltTh", "endsAt"] as const;
export type CampaignFieldCode = (typeof CAMPAIGN_FIELD_CODES)[number];

/**
 * แปลงรายการปัญหา (ข้อความจาก `parseCampaignInput` รูปแบบ `ชื่อฟิลด์: คำอธิบาย`) → รหัสฟิลด์
 * · ไม่รู้จัก/ซ้ำ = ตัดทิ้ง (ข้อความเพี้ยนไม่ทำให้หน้าจอพัง)
 */
export function campaignProblemFields(problems: readonly string[]): readonly CampaignFieldCode[] {
  const found = new Set<CampaignFieldCode>();
  for (const problem of problems) {
    const raw = problem.split(":")[0]?.trim() ?? "";
    const code = raw === "title.th" ? "titleTh" : raw;
    if ((CAMPAIGN_FIELD_CODES as readonly string[]).includes(code)) found.add(code as CampaignFieldCode);
  }
  return CAMPAIGN_FIELD_CODES.filter((code) => found.has(code));
}

/** ลิงก์ที่ปลอดภัย — พาธในเว็บ หรือปลายทางที่ระบุโปรโตคอลชัดเจน */
export function isSafeCampaignHref(value: string): boolean {
  const href = value.trim();
  if (href === "") return true;
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  return /^(https?:|mailto:|tel:)/i.test(href);
}

/**
 * สถานะแคมเปญตามช่วงเวลา ณ `nowMs`
 * · ไม่มีทั้งสองฝั่ง = `always` · ยังไม่ถึงเริ่ม = `scheduled` · หมดเวลาแล้ว = `expired` · อยู่ในช่วง = `live`
 * ⚠️ เริ่ม = รวมขอบ (`>=`) · จบ = ไม่รวมขอบ (`<`) — ให้ตรงกับเงื่อนไขที่ SQL ใช้
 */
export function campaignWindowState(campaign: Pick<Campaign, "startsAt" | "endsAt">, nowMs: number): CampaignWindowState {
  const start = campaign.startsAt === null ? null : Date.parse(campaign.startsAt);
  const end = campaign.endsAt === null ? null : Date.parse(campaign.endsAt);
  const hasStart = start !== null && Number.isFinite(start);
  const hasEnd = end !== null && Number.isFinite(end);
  if (!hasStart && !hasEnd) return "always";
  if (hasStart && start !== null && nowMs < start) return "scheduled";
  if (hasEnd && end !== null && nowMs >= end) return "expired";
  return "live";
}

/**
 * แคมเปญนี้ควรขึ้นหน้าเว็บ **ตอนนี้** ไหม
 * ต้องผ่านครบ: เผยแพร่แล้ว · เปิดใช้งาน · อยู่ในช่วงเวลา · และมีหัวข้อไทย (แคมเปญเปล่าห้ามขึ้น)
 */
export function isCampaignLiveNow(
  campaign: Pick<Campaign, "startsAt" | "endsAt" | "isActive" | "status" | "title">,
  nowMs: number,
): boolean {
  if (campaign.status !== "published") return false;
  if (!campaign.isActive) return false;
  if (campaign.title.th.trim() === "") return false;
  const state = campaignWindowState(campaign, nowMs);
  return state === "live" || state === "always";
}

/**
 * แคมเปญที่ **ขึ้นเว็บอยู่จริงตอนนี้** (เรียงตามลำดับที่แสดง)
 *
 * ใช้ที่จอหลังบ้าน (รอบที่ 198): เจ้าของบ่นว่า *"กดเพิ่มแล้วได้การ์ดใหม่ ไม่ได้แก้การ์ดที่ขยับอยู่"*
 * ⇒ ต้องรู้ก่อนว่า "ใบไหนคือการ์ดที่คนเห็นบนเว็บ" แล้วพาไปแก้ใบนั้น ไม่ใช่สร้างใบใหม่
 */
export function liveCampaignsOf(campaigns: readonly Campaign[], nowMs: number): readonly Campaign[] {
  return campaigns.filter((campaign) => isCampaignLiveNow(campaign, nowMs));
}

/**
 * ประเมิน "ความพร้อมขึ้นเว็บ" — คืนรายการที่ยังต้องแก้ (ว่าง = พร้อม)
 * ใช้เตือนในหน้าจอ เพื่อกันปัญหาที่เจ้าของกังวล: *"แคมเปญเปล่าบ้าง อะไรบ้างเละแน่"*
 * ⚠️ เป็น **คำเตือน** ไม่บล็อกการบันทึก (ยกเว้นค่าที่ผิดรูปแบบซึ่ง `parseCampaignInput` ปฏิเสธ)
 */
export function campaignReadiness(campaign: Pick<Campaign, "name" | "title" | "body" | "ctaHref" | "imagePath" | "imageAltTh" | "status">): readonly string[] {
  const problems: string[] = [];
  if (campaign.name.trim() === "") problems.push("name: ควรตั้งชื่อเพื่อแยกแคมเปญในหลังบ้าน");
  if (campaign.title.th.trim() === "") problems.push("title.th: ยังไม่มีหัวข้อ (แคมเปญจะไม่ขึ้นเว็บ)");
  if (campaign.body.th.trim() === "" && campaign.body.en.trim() === "") problems.push("body: ยังไม่มีข้อความรายละเอียด");
  if (campaign.ctaHref.trim() === "") problems.push("ctaHref: ยังไม่มีลิงก์ปุ่ม (การ์ดจะไม่มีปุ่มให้กด)");
  if (campaign.imagePath.trim() !== "" && campaign.imageAltTh.trim() === "") {
    problems.push("imageAltTh: มีภาพแล้วต้องมีคำอธิบายภาพภาษาไทย");
  }
  if (campaign.status === "published" && campaign.title.th.trim() === "") {
    problems.push("status: เผยแพร่แล้วแต่ยังไม่มีหัวข้อ ⇒ จะไม่มีอะไรแสดงบนเว็บ");
  }
  return problems;
}

/**
 * ตรวจค่าจากฟอร์มหลังบ้าน
 * - **หัวข้อไทยบังคับ** (การ์ดที่ไม่มีข้อความ = ไม่มีอะไรให้อ่าน ⇒ ปฏิเสธการบันทึก)
 * - ลิงก์ว่างได้ (การ์ดประกาศล้วน) · ถ้ามี ต้องปลอดภัย
 * - ช่วงเวลาที่ "จบก่อนเริ่ม" = ปฏิเสธ (แคมเปญนั้นจะไม่มีวันแสดง)
 * - `slideIds` = รายการสไลด์ที่ไม่ซ้ำ · **ว่าง = ทุกสไลด์**
 */
export function parseCampaignInput(raw: unknown): CampaignParseOutcome {
  const problems: string[] = [];
  const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const text = (key: string): CampaignText => {
    const value = record[key];
    const box = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
    return {
      th: typeof box["th"] === "string" ? box["th"].trim() : "",
      en: typeof box["en"] === "string" ? box["en"].trim() : "",
    };
  };

  const name = typeof record["name"] === "string" ? record["name"].trim() : "";
  const title = text("title");
  const body = text("body");
  const ctaLabel = text("ctaLabel");
  const ctaHref = typeof record["ctaHref"] === "string" ? record["ctaHref"].trim() : "";
  const imagePath = typeof record["imagePath"] === "string" ? record["imagePath"].trim() : "";
  const imageAltTh = typeof record["imageAltTh"] === "string" ? record["imageAltTh"].trim() : "";
  const imageAltEn = typeof record["imageAltEn"] === "string" ? record["imageAltEn"].trim() : "";
  const startsAt = normalizeMoment(record["startsAt"]);
  const endsAt = normalizeMoment(record["endsAt"]);
  const slideIdsRaw = Array.isArray(record["slideIds"]) ? record["slideIds"] : [];
  const slideIds = [...new Set(slideIdsRaw.filter((id): id is string => typeof id === "string" && id.trim() !== "").map((id) => id.trim()))];

  if (title.th === "") problems.push("title.th: ต้องมีหัวข้อภาษาไทย");
  if (!isSafeCampaignHref(ctaHref)) problems.push("ctaHref: ต้องเป็นพาธในเว็บ หรือ http(s)/mailto/tel");
  if (!isSafeCampaignImagePath(imagePath)) problems.push("imagePath: ต้องเป็นพาธในเว็บ (ห้าม URL เต็ม)");
  if (imagePath !== "" && imageAltTh === "") problems.push("imageAltTh: มีภาพแล้วต้องมีคำอธิบายภาพภาษาไทย");
  if (startsAt !== null && endsAt !== null && Date.parse(endsAt) <= Date.parse(startsAt)) {
    problems.push("endsAt: ต้องอยู่หลังเวลาเริ่ม");
  }

  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    value: {
      name,
      title,
      body,
      ctaLabel,
      ctaHref,
      imagePath,
      imageAltTh,
      imageAltEn,
      anchorX: clampAnchor(record["anchorX"]),
      anchorY: clampAnchor(record["anchorY"]),
      startsAt,
      endsAt,
      isActive: record["isActive"] !== false,
      slideIds,
    },
  };
}
