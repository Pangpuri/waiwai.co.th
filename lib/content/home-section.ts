import type { ItemContent, PageContent } from "@/lib/content/types";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ตัวช่วยอ่านเนื้อหา "หน้าแรกแบบมีโครง" (EAV) ให้หน้าเว็บใช้จริง — เริ่มรอบที่ 209
 *
 * ที่มา (คำเจ้าของ): *"ศึกษาโครงสร้างหน้าแรก ที่ไม่เกี่ยวกับสไลด์และแคมเปญ ว่ามีอะไรบ้าง
 *   แก้ไขส่วนไหนได้บ้าง โดยเก็บส่วน hardcode เป็นค่าเริ่มต้น ไว้ในฐานข้อมูลก่อน"*
 * → เลือกแนวทาง: **ต่อสายทีละส่วน เริ่มจาก "ที่ซื้อสินค้า"**
 *
 * ปัญหาที่แก้: จอ `/admin/content/home` มีช่องของทุกส่วนอยู่แล้ว (ค่าเริ่มต้นถูก seed ลงฐานข้อมูลแล้ว)
 *   แต่ **หน้าเว็บอ่านจากที่เก็บนั้นแค่การ์ด PR ใบเดียว** ⇒ ช่องอื่นแก้แล้วไม่มีผล ("จอโกหก")
 *
 * กติกา (เหมือน `lib/content/home-card.ts` ที่ทำรอบ 200)
 * - **ค่าที่ตั้งในหลังบ้านทับค่าเริ่มต้น** · ช่องว่าง = ถอยไปใช้ค่าเดิม (ห้ามขึ้นช่องว่าง)
 * - EN ใช้เมื่อขอ EN และมีจริง — ไม่งั้นถอยไทย
 * - ตรรกะล้วน (ไม่แตะ DB/React) ⇒ ทดสอบได้ด้วย `node --test`
 */
export type Language = "th" | "en";

/** เลือกค่าตามภาษา: EN ใช้เมื่อขอ EN และมีจริง — ไม่งั้นถอยไทย · ว่างเปล่า = ค่าเดิม */
export function localizedOf(
  value: { readonly th: string; readonly en: string } | undefined,
  fallback: string,
  language: Language,
): string {
  if (value === undefined) return fallback;
  const chosen = language === "en" && value.en.trim() !== "" ? value.en : value.th;
  return chosen.trim() === "" ? fallback : chosen.trim();
}

/** ข้อความระดับ section: ค่าจากที่เก็บ (ถ้ามี) ทับค่าเริ่มต้นจากพจนานุกรม */
export function sectionFieldOf(
  content: PageContent | null,
  sectionKey: string,
  fieldKey: string,
  fallback: string,
  language: Language,
): string {
  return localizedOf(content?.sections[sectionKey]?.fields[fieldKey], fallback, language);
}

/** รายการของ section (เรียงตาม `order` ที่บันทึกไว้ — ลำดับคงที่เสมอ) */
export function sectionItemsOf(content: PageContent | null, sectionKey: string, groupKey: string): readonly ItemContent[] {
  const items = content?.sections[sectionKey]?.items[groupKey] ?? [];
  return [...items].sort((a, b) => a.order - b.order);
}

/** ข้อความของรายการหนึ่ง */
export function itemFieldOf(item: ItemContent, fieldKey: string, fallback: string, language: Language): string {
  return localizedOf(item.fields[fieldKey], fallback, language);
}

/** พาธภาพของรายการ (พาธกลาง ไม่ใช่ URL เต็ม — มติ D9) */
export function itemMediaPathOf(item: ItemContent, fieldKey: string): string {
  return item.media[fieldKey]?.path.trim() ?? "";
}

/* ── ส่วน "ที่ซื้อสินค้า" (รอบที่ 209 · ส่วนแรกที่ต่อสาย) ─────────────────────── */

export type WhereToBuyMarketplaceView = {
  readonly id: string;
  readonly label: string;
  /** ลิงก์ร้าน (เว้นว่างได้ = ปุ่มจะไม่ถูกเรนเดอร์) */
  readonly href: string;
  /** พาธโลโก้ (ไม่บังคับ) */
  readonly logo: string;
};

export type WhereToBuyView = {
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  readonly retailNote: string;
  readonly marketplaces: readonly WhereToBuyMarketplaceView[];
};

/** ช่องทางเริ่มต้น (จากโค้ด `SITE.marketplaces`) — ใช้เมื่อฐานข้อมูลว่าง/ยังไม่ seed */
export type MarketplaceFallback = { readonly id: string; readonly href: string };

/**
 * รวมเนื้อหา "ที่ซื้อสินค้า": **ค่าที่ตั้งในหลังบ้านทับค่าเริ่มต้น**
 * - ข้อความ (eyebrow/title/body/retailNote) = ที่เก็บ → พจนานุกรม
 * - ช่องทาง = รายการในที่เก็บ (ชื่อ + ลิงก์) · ว่าง = ใช้รายการเริ่มต้นจากโค้ด
 * - ช่องทางที่ไม่มีชื่อ/ลิงก์ = **ข้าม** (ไม่เรนเดอร์ปุ่มที่พาไปที่ว่าง)
 */
export function whereToBuyViewOf(
  content: PageContent | null,
  messages: Messages,
  language: Language,
  fallback: readonly MarketplaceFallback[],
): WhereToBuyView {
  const m = messages.whereToBuy;
  const labelById = (id: string): string => {
    const labels = m.marketplaces as Readonly<Record<string, string>>;
    return labels[id] ?? id;
  };

  const stored = sectionItemsOf(content, "whereToBuy", "marketplaces")
    .map((item) => {
      const id = itemFieldOf(item, "name", "", language);
      const href = item.fields["href"]?.th.trim() ?? "";
      return { id: id === "" ? href : id, label: id === "" ? "" : id, href, logo: itemMediaPathOf(item, "logo") };
    })
    .filter((row) => row.href.trim() !== "");

  const marketplaces: readonly WhereToBuyMarketplaceView[] =
    stored.length > 0
      ? stored.map((row) => ({ ...row, label: row.label === "" ? labelById(row.id) : row.label }))
      : fallback.map((row) => ({ id: row.id, label: labelById(row.id), href: row.href, logo: "" }));

  return {
    eyebrow: sectionFieldOf(content, "whereToBuy", "eyebrow", m.eyebrow, language),
    title: sectionFieldOf(content, "whereToBuy", "title", m.title, language),
    body: sectionFieldOf(content, "whereToBuy", "body", m.body, language),
    retailNote: sectionFieldOf(content, "whereToBuy", "retailNote", m.retailNote, language),
    marketplaces,
  };
}
