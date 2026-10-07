/**
 * "การ์ดบนสไลด์" + ช่วงเวลาแคมเปญ — ตรรกะล้วน (รอบที่ 188 · โมดูล "สไลด์ & แคมเปญ")
 *
 * การ์ดผูกกับสไลด์หนึ่งใบ · ตัวการ์ดมีช่วงเวลาเริ่ม–จบ ⇒ แคมเปญขึ้น/ลงเองตามเวลาโดยไม่ต้องมีตัวจับเวลา
 * การกรองตามเวลาจริงทำที่ SQL ด้วย `now()` ของฐานข้อมูล — ที่นี่เป็นแค่การคำนวณ/ตรวจค่า (ทดสอบได้ไม่มี DOM/DB)
 */

export const HERO_CARD_POSITIONS = ["left", "center", "right"] as const;
export type HeroCardPosition = (typeof HERO_CARD_POSITIONS)[number];

/** จำนวนการ์ดสูงสุดต่อสไลด์ — เกินนี้จะบังภาพและอ่านไม่ทัน */
export const MAX_HERO_CARDS_PER_SLIDE = 3;

export type HeroCardText = { readonly th: string; readonly en: string };

export type HeroCard = {
  readonly id: string;
  readonly slideId: string;
  readonly sortOrder: number;
  readonly title: HeroCardText;
  readonly body: HeroCardText;
  readonly ctaLabel: HeroCardText;
  readonly ctaHref: string;
  readonly position: HeroCardPosition;
  /** ISO string หรือ null (= ไม่จำกัดฝั่งนั้น) */
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly isActive: boolean;
};

export type HeroCardInput = {
  readonly title: HeroCardText;
  readonly body: HeroCardText;
  readonly ctaLabel: HeroCardText;
  readonly ctaHref: string;
  readonly position: HeroCardPosition;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly isActive: boolean;
};

export type HeroCardParseOutcome =
  | { readonly ok: true; readonly value: HeroCardInput }
  | { readonly ok: false; readonly problems: readonly string[] };

/** สถานะของแคมเปญ ณ เวลาหนึ่ง (ใช้ทั้งหน้าจอหลังบ้านและเทสต์) */
export type HeroCardWindowState = "always" | "scheduled" | "live" | "expired";

export function isHeroCardPosition(value: string): value is HeroCardPosition {
  return (HERO_CARD_POSITIONS as readonly string[]).includes(value);
}

/** วันที่จาก `datetime-local` หรือ ISO → ISO string · ค่าที่อ่านไม่ได้ = null (ไม่จำกัดเวลา) */
export function normalizeMoment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/**
 * สถานะแคมเปญ ณ เวลา `nowMs`
 * · ไม่มีทั้งสองฝั่ง = `always` · ยังไม่ถึงเริ่ม = `scheduled` · หมดเวลาแล้ว = `expired` · อยู่ในช่วง = `live`
 * ⚠️ เริ่ม = รวมขอบ (`>=`) · จบ = ไม่รวมขอบ (`<`) — ให้ตรงกับเงื่อนไขที่ SQL ใช้
 */
export function heroCardWindowState(card: Pick<HeroCard, "startsAt" | "endsAt">, nowMs: number): HeroCardWindowState {
  const start = card.startsAt === null ? null : Date.parse(card.startsAt);
  const end = card.endsAt === null ? null : Date.parse(card.endsAt);
  const hasStart = start !== null && Number.isFinite(start);
  const hasEnd = end !== null && Number.isFinite(end);
  if (!hasStart && !hasEnd) return "always";
  if (hasStart && start !== null && nowMs < start) return "scheduled";
  if (hasEnd && end !== null && nowMs >= end) return "expired";
  return "live";
}

/** การ์ดนี้ควรแสดงบนหน้าเว็บตอนนี้ไหม (เปิดใช้งาน + อยู่ในช่วงเวลา) */
export function isHeroCardLiveNow(card: Pick<HeroCard, "startsAt" | "endsAt" | "isActive">, nowMs: number): boolean {
  if (!card.isActive) return false;
  const state = heroCardWindowState(card, nowMs);
  return state === "live" || state === "always";
}

/** ลิงก์ที่ปลอดภัยสำหรับการ์ด — พาธในเว็บ หรือปลายทางที่ระบุโปรโตคอลไว้ชัดเจน */
export function isSafeHeroCardHref(value: string): boolean {
  const href = value.trim();
  if (href === "") return true;
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  return /^(https?:|mailto:|tel:)/i.test(href);
}

/** แปลงค่าจาก `datetime-local` (เวลาไทยของผู้ใช้) → ISO สำหรับ `<input type="datetime-local">` */
export function toDateTimeLocalValue(iso: string | null): string {
  if (iso === null) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  /* ตัดให้เหลือ "YYYY-MM-DDTHH:mm" (เวลาท้องถิ่นของผู้ใช้) */
  return new Date(ms - new Date(ms).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/**
 * ตรวจค่าการ์ดจากฟอร์มหลังบ้าน
 * - **หัวข้อไทยบังคับ** (การ์ดที่ไม่มีข้อความ = ไม่มีอะไรให้อ่าน) · อังกฤษไม่บังคับ (แอดมินกรอกเอง — เราไม่แปลให้)
 * - ลิงก์ว่างได้ (การ์ดประกาศล้วน) · ถ้ามี ต้องเป็นพาธในเว็บ หรือ http(s)/mailto/tel ที่ปลอดภัย
 * - ช่วงเวลาที่ "จบก่อนเริ่ม" = **ปฏิเสธ** (ไม่ใช่แค่เตือน — เพราะการ์ดนั้นจะไม่มีวันแสดง)
 */
export function parseHeroCardInput(raw: unknown): HeroCardParseOutcome {
  const problems: string[] = [];
  const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const text = (key: string): HeroCardText => {
    const value = record[key];
    const box = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
    return {
      th: typeof box["th"] === "string" ? box["th"].trim() : "",
      en: typeof box["en"] === "string" ? box["en"].trim() : "",
    };
  };

  const title = text("title");
  const body = text("body");
  const ctaLabel = text("ctaLabel");
  const ctaHref = typeof record["ctaHref"] === "string" ? record["ctaHref"].trim() : "";
  const positionRaw = typeof record["position"] === "string" ? record["position"] : "";
  const startsAt = normalizeMoment(record["startsAt"]);
  const endsAt = normalizeMoment(record["endsAt"]);

  if (title.th === "") problems.push("title.th: ต้องมีหัวข้อภาษาไทย");
  if (!isSafeHeroCardHref(ctaHref)) problems.push("ctaHref: ต้องเป็นพาธในเว็บ หรือ http(s)/mailto/tel");
  if (startsAt !== null && endsAt !== null && Date.parse(endsAt) <= Date.parse(startsAt)) {
    problems.push("endsAt: ต้องอยู่หลังเวลาเริ่ม");
  }

  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    value: {
      title,
      body,
      ctaLabel,
      ctaHref,
      position: isHeroCardPosition(positionRaw) ? positionRaw : "left",
      startsAt,
      endsAt,
      isActive: record["isActive"] !== false,
    },
  };
}
