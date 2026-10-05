/**
 * ตรรกะตรวจ "หน้าเว็บที่ deploy แล้ว" (รอบที่ 117) — pure ล้วน (ทดสอบได้โดยไม่ต้องมีเครือข่าย)
 *
 * ทำไมต้องมี: อาการที่อันตรายที่สุดของเดโมนี้คือ **หน้าเว็บว่างเงียบ ๆ**
 * เพราะ `lib/**\/repository.ts` ออกแบบให้ "อ่านฐานข้อมูลไม่สำเร็จ = คืนค่าเปล่า" (หน้าเว็บไม่พัง)
 * ⇒ ถ้าตั้ง env ผิด (ไม่ได้ตั้ง `DATABASE_URL` หรือใส่ URL ของ **pooler** ที่ `search_path` ว่าง)
 *   หน้าเว็บจะ **200 ปกติ** แต่ไม่มีข้อมูลเลย — ดูไม่ออกถ้าไม่ตรวจเนื้อหา
 *
 * เครื่องมือนี้จึงตรวจ "เนื้อหาจริง" จาก HTML ที่ได้ แล้วบอกสาเหตุที่พบบ่อยให้ตรงจุด
 */

export type DeployIssue = {
  readonly code: "no-categories" | "no-product-count" | "no-news" | "test-data" | "no-brand";
  readonly message: string;
};

export type DeployAssessment = {
  readonly ok: boolean;
  readonly issues: readonly DeployIssue[];
  /** ข้อความสรุปพร้อมใช้ (ภาษาไทย) */
  readonly summary: string;
  /** ตัวเลขที่อ่านได้ (ไว้รายงาน) */
  readonly facts: {
    readonly categoryLinks: number;
    readonly newsLinks: number;
    readonly productCounts: readonly number[];
    readonly hasTestData: boolean;
    readonly hasBrandLogo: boolean;
  };
};

const CATEGORY_PATTERN = /\/(?:th|en)\/products\/(?:instant-noodles|dried-vermicelli|serda|quick-zabb|noodie|rod-ded)/g;
const NEWS_LINK_PATTERN = /\/(?:th|en)\/news\/\d+/g;
const COUNT_PATTERN = /(\d+)\s*(?:รายการ|items)/g;

/**
 * ตรวจหน้าแรก (TH หรือ EN) ว่าดึงข้อมูลจริงจากฐานข้อมูลได้ไหม
 * ใช้ "ร่องรอยที่พิสูจน์ได้" จากการเรนเดอร์จริง: ลิงก์หมวดสินค้า 6 ใบ · จำนวนสินค้า · ลิงก์ข่าว · ไม่มีข้อความทดสอบ
 */
export function assessHomePage(html: string): DeployAssessment {
  const categoryLinks = new Set(html.match(CATEGORY_PATTERN) ?? []).size;
  const newsLinks = new Set(html.match(NEWS_LINK_PATTERN) ?? []).size;
  const productCounts = [...html.matchAll(COUNT_PATTERN)].map((match) => Number(match[1] ?? "0"));
  /* มีข้อมูลจริง = มีอย่างน้อยหนึ่งหมวดที่บอกจำนวน > 0 */
  const hasNumbers = productCounts.some((value) => value > 0);
  const hasTestData = /ข้อมูลทดสอบ|Test data|รส XXX/.test(html);
  const hasBrandLogo = html.includes("/brand/logo-navbar.png") || html.includes("logo-navbar");

  const issues: DeployIssue[] = [];

  if (categoryLinks < 6) {
    issues.push({
      code: "no-categories",
      message: `พบลิงก์หมวดสินค้า ${categoryLinks}/6 — ข้อมูลสินค้าไม่ขึ้น`,
    });
  }

  if (!hasNumbers) {
    issues.push({
      code: "no-product-count",
      message:
        "ไม่พบจำนวนสินค้าที่มากกว่า 0 — น่าจะอ่านฐานข้อมูลไม่ได้ " +
        "(ตรวจ: ตั้ง DATABASE_URL แล้วหรือยัง · ต้องเป็น endpoint ตรง ไม่ใช่ URL ของ pooler)",
    });
  }

  if (newsLinks < 3) {
    issues.push({ code: "no-news", message: `พบลิงก์ข่าวจริง ${newsLinks} ใบ (ควรมี 3)` });
  }

  if (hasTestData) {
    issues.push({ code: "test-data", message: "พบข้อความข้อมูลทดสอบบนหน้าเว็บจริง" });
  }

  if (!hasBrandLogo) {
    issues.push({ code: "no-brand", message: "ไม่พบโลโก้แบรนด์ในหน้า (โครงเว็บอาจเพี้ยน)" });
  }

  const facts = { categoryLinks, newsLinks, productCounts, hasTestData, hasBrandLogo };
  const ok = issues.length === 0;

  return {
    ok,
    issues,
    facts,
    summary: ok
      ? `✓ หน้าเว็บดึงข้อมูลจริงได้ — หมวดสินค้า ${categoryLinks}/6 · จำนวนที่อ่านได้ ${productCounts.slice(0, 6).join("/")} · ข่าว ${newsLinks} ใบ`
      : `✗ หน้าเว็บดูเหมือน "ว่างเงียบ" (${issues.length} จุด) — ดูรายละเอียดด้านบน`,
  };
}

/** ตรวจหน้าข่าว: ต้องบอกจำนวนข่าวทั้งหมด (>0) จากพจนานุกรมที่เรนเดอร์จริง */
export function assessNewsListPage(html: string): { readonly ok: boolean; readonly total: number | null } {
  const match = html.match(/ทั้งหมด\s*([\d,]+)\s*ข่าว/);
  const raw = match?.[1]?.replace(/,/g, "");
  const total = raw === undefined ? null : Number(raw);
  return { ok: total !== null && total > 0, total };
}

/**
 * เตือนเมื่อ URL ที่จะใช้รันเว็บเป็น **pooler ของ Neon** (`…-pooler.…`)
 * ⇒ `search_path` ว่าง ⇒ SQL ที่ไม่ระบุ schema ของโปรเจกต์จะล้มทุกคำสั่ง
 */
export function pooledEndpointWarning(url: string): string | null {
  if (!url.includes("-pooler")) return null;
  return (
    "URL นี้เป็น pooler ของ Neon — pooler บังคับ search_path = '' ทำให้ SQL ที่ไม่ระบุ schema ล้ม (หน้าเว็บจะว่าง) " +
    "ให้ใช้ endpoint ตรง (ตัด -pooler) แทน — `npm run env:vercel` สร้างให้แล้ว"
  );
}

/**
 * ตรวจ "หน้าข่าวรายชิ้น" ว่าจริงหรือเป็นหน้าไม่พบข้อมูล
 *
 * ⚠️ บทเรียนรอบที่ 117 (จับได้ด้วยเครื่องมือนี้เอง): อย่าตัดสินจากข้อความในพจนานุกรม
 * เพราะข้อความของหน้าปลอดภัย/404 ถูกฝังอยู่ใน **RSC payload** ของทุกหน้า
 * (`ไม่พบหน้าที่คุณกำลังมองหา` จึงปรากฏเป็น `true` แม้ในหน้าข่าวจริง) ⇒ ตัวชี้วัดเดิม "ผิด" (false positive)
 *
 * ตัวชี้วัดที่วัดจากของจริง (เทียบหน้า `/th/news/148398` กับ `/th/news/999999999`):
 * | | ข่าวจริง | ข่าวที่ไม่มี |
 * |---|---|---|
 * | HTTP | 200 | **404** |
 * | `<h1>` | มี (ชื่อข่าว) | **ไม่มี** |
 * | ขนาด | ~81 KB | ~26 KB |
 */
export function assessNewsArticlePage(input: {
  readonly status: number;
  readonly html: string;
}): { readonly ok: boolean; readonly reason: string | null } {
  if (input.status !== 200) return { ok: false, reason: `HTTP ${String(input.status)}` };

  const heading = (input.html.match(/<h1[^>]*>([\s\S]{0,200}?)<\/h1>/) ?? [])[1] ?? "";
  const text = heading.replace(/<[^>]*>/g, "").trim();

  if (text === "") return { ok: false, reason: "ไม่พบหัวเรื่อง (<h1>) — น่าจะเป็นหน้าไม่พบข้อมูล" };
  if (input.html.length < 20_000) return { ok: false, reason: `เนื้อหาสั้นผิดปกติ (${String(input.html.length)} ไบต์)` };

  return { ok: true, reason: null };
}

/**
 * ตรวจว่าได้ **หน้าป้องกันของ Vercel** แทนเว็บจริงหรือไม่ (รอบที่ 121 — เคสจริง)
 *
 * อาการ: `Deployment Protection (Vercel Authentication)` เปิดอยู่ ⇒ คำขอจากคนที่ไม่ได้ล็อกอิน
 * จะได้หน้าแจ้ง "Protected by Vercel Authentication" (HTTP 200 · ~263 ไบต์) **ไม่ใช่เว็บของเรา**
 * ⚠️ ถ้าไม่จับเคสนี้ก่อน เครื่องมือจะรายงานผิดว่า "หน้าเว็บว่าง / ฐานข้อมูลไม่ถูกตั้งค่า" (วินิจฉัยผิดคน)
 * ⇒ และผลที่สำคัญที่สุด: **คนภายนอก (เช่น การตลาด) เปิดดูไม่ได้เลย** แม้ระบบจะทำงานถูกต้อง
 */
export function isVercelProtectionPage(html: string): boolean {
  /* ทั้งสองแบบที่เจอจริง: (1) หน้าข้อความสั้น "Protected by Vercel Authentication"
     (2) หน้า login เต็มของ Vercel (341 KB · <title>Login – Vercel</title> · data-dpl-id="dpl_…" · cookie _v-visitor-id) */
  const markers = [
    "Protected by Vercel Authentication",
    "Login – Vercel",
    "Login - Vercel",
    "vercel.com/sso-api",
    "sso-api?url=",
    "web_fetch_vercel_url",
    "_v-visitor-id",
    "data-dpl-id=\"dpl_",
  ];
  return markers.some((marker) => html.includes(marker));
}

/**
 * ดึง id ของภาพในคลัง (`/media/<id>`) จาก HTML เพื่อยิงตรวจจริง 1 รูป
 *
 * ⚠️ บทเรียนรอบที่ 122: ตัวดึงรุ่นแรกใช้แพตเทิร์นหลวม `/media/…` ⇒ ไปโดน path ของ **ฟอนต์** ที่ Next
 * สร้างเอง (`/_next/static/media/411573…-s.woff2`) ⇒ ตรวจผิดว่า "รูปในคลังพัง" (และทำให้วินิจฉัยสับสน)
 * ⇒ ต้องเลือกจาก URL ของ `next/image` (`/_next/image?url=%2Fmedia%2F<id>`) ก่อนเสมอ
 *   และถ้าจะดูจาก path ตรง ๆ ต้องไม่ใช่ `/_next/static/...` และต้องไม่ลงท้ายด้วยนามสกุลไฟล์
 */
export function mediaIdFromHtml(html: string): string | null {
  /* 1) เส้นทางที่แอปใช้จริง: next/image ครอบพาธ /media/<id> */
  const viaNextImage = html.match(/\/_next\/image\?url=%2Fmedia%2F([A-Za-z0-9_-]+)/);
  if (viaNextImage?.[1] !== undefined) return viaNextImage[1];

  /* 2) path ตรง ๆ — ต้องไม่ใช่ของ Next (_next/static/media/…) และต้องไม่ใช่นามสกุลไฟล์ (ฟอนต์/ไอคอน) */
  for (const match of html.matchAll(/(?:^|["'(])\/media\/([A-Za-z0-9_-]+)["')?]/g)) {
    const id = match[1];
    if (id !== undefined && !/\.[a-z0-9]{2,4}$/i.test(id)) return id;
  }

  return null;
}
