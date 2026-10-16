/**
 * ทะเบียน "เส้นทางที่ต้องยิง" + ตรรกะตัดสินว่ามีปัญหาไหม — **ตรรกะบริสุทธิ์ ไม่มี I/O** (รอบที่ 292)
 *
 * ใช้โดย `scripts/probe-routes.ts` (`npm run probe:routes`) — เครื่องมือยิง HTTP จริงใส่เซิร์ฟเวอร์ที่รันอยู่
 * (dev/prod/เดโม) เพื่อจับ "บั๊กที่ด่านอัตโนมัติมองไม่เห็น": สถานะผิด · 500 · หน้าที่พังเพราะพารามิเตอร์
 *
 * ## บทเรียนที่กลายเป็นกติกาของที่นี่ (รอบ 117 · 291)
 * 1. **ห้ามตัดสิน error จากข้อความในพจนานุกรม** — พจนานุกรมทั้งก้อนถูก serialize ลง RSC payload ทุกหน้า
 *    (`"เกิดข้อผิดพลาดในระบบ"` โผล่ทุกหน้าแบบไม่มีความหมาย) ⇒ สัญญาณจริงมีแค่
 *    HTTP ≥ 500 · ข้อความเฉพาะของ Next ที่แสดงหน้า error จริง · ค่าที่หลุดเป็น `undefined`
 * 2. **`<html id="__next_error__">` ไม่ใช่สัญญาณ error** — เป็นเอกสาร not-found ปกติใน dev
 * 3. เส้นที่ "ต้อง 404/307" ก็ต้องยิงด้วย — ไม่งั้นหน้าที่ควรหายไปแล้วจะโผล่กลับมาโดยไม่มีใครรู้
 */

/** ข้อความเฉพาะที่แปลว่า "หน้า error ของ Next" จริง ๆ */
export const PROBE_ERROR_SIGNS: readonly string[] = [
  "Application error: a server-side exception",
  "Unhandled Runtime Error",
  "Hydration failed",
];

/** ค่าที่หลุดจากตัวแปร/ข้อมูลที่ไม่ครบ (เจอได้จริงเมื่อสูตรผิด) */
export const PROBE_DIRTY_SIGNS: readonly string[] = [">undefined<", "undefined</", "[object Object]", "NaN</", 'class="undefined'];

export type ProbeGroup = "public" | "admin" | "fuzz" | "maintenance";

export type ProbeTarget = {
  readonly url: string;
  /** ต้องยิงด้วยคุกกี้ผู้ดูแล (มินต์เซสชันเอง — ไม่ใช้รหัสผ่านของเจ้าของ) */
  readonly admin?: boolean;
  /** สถานะที่ยอมรับได้ (มีได้หลายค่า เช่น [404, 200]) */
  readonly expect: readonly number[];
  /** ต้องมีข้อความนี้ใน HTML */
  readonly must?: readonly string[];
  readonly note?: string;
  readonly group: ProbeGroup;
  /** ต้องแนบ "บัตรผ่านดูเว็บระหว่างปิดปรับปรุง" (`waiwai_maint_bypass`) — คนละคุกกี้กับเซสชันหลังบ้าน */
  readonly bypass?: boolean;
};

/**
 * เส้นทางปกติ (หน้าบ้าน + หลังบ้าน) + เคสพารามิเตอร์ขยะ
 *
 * ⚠️ บางเส้นอ้าง "ข้อมูลจริง" (รหัสสินค้า/เมนู/ข่าว/ภาพ) — ถ้าข้อมูลในเครื่องเปลี่ยน เส้นนั้นจะตก
 *    ⇒ ใช้ `--only=<คำ>` เพื่อยิงเฉพาะเส้นที่สนใจ และดู `note` ประกอบ
 */
export const PROBE_TARGETS: readonly ProbeTarget[] = [
  // ── หน้าบ้าน (TH/EN) ───────────────────────────────────────────────────────
  { url: "/th", expect: [200], must: ["ไวไว"], group: "public" },
  { url: "/en", expect: [200], must: ["Wai Wai"], group: "public" },
  { url: "/th/products", expect: [200], must: ["บะหมี่"], group: "public" },
  { url: "/en/products", expect: [200], must: ["Products"], group: "public" },
  { url: "/th/products/instant-noodles", expect: [200], must: ["บะหมี่"], group: "public" },
  { url: "/th/products/dried-vermicelli", expect: [200], group: "public" },
  { url: "/th/products/serda", expect: [200], group: "public" },
  { url: "/th/products/quick-zabb", expect: [200], group: "public" },
  { url: "/th/products/noodie", expect: [200], group: "public" },
  { url: "/th/products/rod-ded", expect: [200], group: "public" },
  { url: "/th/products/nope-nope", expect: [404], must: ["ไม่พบหน้าที่คุณกำลังมองหา"], group: "public" },
  { url: "/th/recipes", expect: [200], must: ["เมนู"], group: "public" },
  { url: "/en/recipes", expect: [200], group: "public" },
  { url: "/th/news", expect: [200], must: ["ทั้งหมด 151 ข่าว"], note: "จำนวนข่าวในเครื่อง = 151", group: "public" },
  { url: "/th/news/oldest", expect: [200], group: "public" },
  { url: "/th/news/page/2", expect: [200], group: "public" },
  { url: "/th/news/page/11", expect: [200], group: "public" },
  { url: "/th/news/page/99", expect: [404], group: "public" },
  { url: "/th/news/year/2564", expect: [200], group: "public" },
  { url: "/th/news/year/2564/oldest", expect: [200], group: "public" },
  { url: "/th/news/year/2599", expect: [404], group: "public" },
  { url: "/th/news/148398", expect: [200], note: "หน้าเว็บข่าวใช้ source id ไม่ใช่รหัสแถว (n…)", group: "public" },
  { url: "/en/news/148398", expect: [200], group: "public" },
  { url: "/th/news/000000", expect: [404], group: "public" },
  { url: "/th/news/n148398", expect: [404], group: "public" },
  { url: "/th/about", expect: [200], group: "public" },
  { url: "/en/about", expect: [200], group: "public" },
  { url: "/th/about/certifications", expect: [200], group: "public" },
  { url: "/th/about/executives", expect: [200], group: "public" },
  { url: "/th/contact", expect: [200], must: ["tel:"], group: "public" },
  { url: "/en/contact", expect: [200], group: "public" },
  { url: "/th/careers", expect: [200], group: "public" },
  { url: "/en/careers", expect: [200], group: "public" },
  { url: "/th/privacy", expect: [200], group: "public" },
  { url: "/en/privacy", expect: [200], group: "public" },
  { url: "/th/cookie-policy", expect: [200], group: "public" },
  { url: "/th/terms", expect: [200], group: "public" },
  { url: "/th/sustainability", expect: [200], group: "public" },
  { url: "/th/where-to-buy", expect: [308], note: "ถอดหน้าแล้ว · 308 → /th#where-to-buy", group: "public" },
  { url: "/th/search", expect: [404], must: ["ไม่พบหน้าที่คุณกำลังมองหา"], group: "public" },
  { url: "/th/nope-nope-nope", expect: [404], must: ["ไม่พบหน้าที่คุณกำลังมองหา"], group: "public" },
  { url: "/sitemap.xml", expect: [200], must: ["/th/news/"], group: "public" },
  { url: "/robots.txt", expect: [200], group: "public" },
  { url: "/media/JIIKynFuOs4j", expect: [200], note: "ภาพจริงในคลัง (รหัสอาจเปลี่ยน)", group: "public" },
  { url: "/media/nope", expect: [404], group: "public" },
  { url: "/healthz", expect: [404], note: "ไม่ตั้ง HEALTH_KEY = 404 ตามดีไซน์ (prod อาจ 200)", group: "public" },
  { url: "/healthz?key=wrong", expect: [404], group: "public" },

  // ── พารามิเตอร์ขยะ (ดัก 500) ───────────────────────────────────────────────
  { url: "/th/news/page/0", expect: [404, 200], group: "fuzz" },
  { url: "/th/news/page/abc", expect: [404], group: "fuzz" },
  { url: "/th/news/page/-1", expect: [404], group: "fuzz" },
  { url: "/th/news/page/99999999999999999999", expect: [404], group: "fuzz" },
  { url: "/th/news/year/abc", expect: [404], group: "fuzz" },
  { url: "/th/news/year/0", expect: [404, 200], group: "fuzz" },
  { url: "/th/news/year/99999999999999999999", expect: [404], group: "fuzz" },
  { url: "/th/news/abc", expect: [404], group: "fuzz" },
  { url: "/th/products/%20", expect: [404, 308], group: "fuzz" },
  { url: "/th/?utm_source=probe&x=%00", expect: [200, 308], note: "Next ตัด trailing slash = 308 ปกติ", group: "fuzz" },

  // ── หลังบ้าน (ต้องมีคุกกี้) ─────────────────────────────────────────────────
  { url: "/admin", admin: true, expect: [200], must: ["ภาพรวมหลังบ้าน"], group: "admin" },
  { url: "/admin/activity", admin: true, expect: [200], group: "admin" },
  { url: "/admin/inbox", admin: true, expect: [200], must: ["กล่องข้อความ"], group: "admin" },
  { url: "/admin/inbox?status=new", admin: true, expect: [200], group: "admin" },
  { url: "/admin/inbox?status=nope", admin: true, expect: [200], group: "admin" },
  { url: "/admin/inbox/export", admin: true, expect: [200], group: "admin" },
  { url: "/admin/inbox/nope/attachment", admin: true, expect: [404, 400], group: "admin" },
  { url: "/admin/media", admin: true, expect: [200], must: ["คลังภาพ"], group: "admin" },
  { url: "/admin/media?page=abc&q=%00", admin: true, expect: [200], group: "admin" },
  { url: "/admin/settings", admin: true, expect: [200], group: "admin" },
  { url: "/admin/trash", admin: true, expect: [200], must: ["ถังขยะ"], group: "admin" },
  { url: "/admin/trash?page=abc", admin: true, expect: [200], group: "admin" },
  { url: "/admin/trash/thumbnail/JIIKynFuOs4j", admin: true, expect: [200, 404], group: "admin" },
  { url: "/admin/trash/thumbnail/nope", admin: true, expect: [404], group: "admin" },
  { url: "/admin/preview-links", admin: true, expect: [200], group: "admin" },
  { url: "/admin/users", admin: true, expect: [200], must: ["สร้างบัญชี"], group: "admin" },
  { url: "/admin/sort", admin: true, expect: [200], group: "admin" },
  { url: "/admin/sort?kind=nope", admin: true, expect: [200], group: "admin" },
  { url: "/admin/denied", admin: true, expect: [200], group: "admin" },
  { url: "/admin/careers", admin: true, expect: [200], must: ["ตำแหน่ง"], group: "admin" },
  { url: "/admin/careers?tab=nope", admin: true, expect: [200], group: "admin" },
  { url: "/admin/careers/new", admin: true, expect: [200], group: "admin" },
  { url: "/admin/careers/driverUpcountry", admin: true, expect: [200], note: "รหัสตำแหน่งจากข้อมูลจริง", group: "admin" },
  { url: "/admin/careers/nope", admin: true, expect: [404], group: "admin" },
  { url: "/admin/product-categories", admin: true, expect: [200], must: ["พรีเซ็ต"], group: "admin" },
  { url: "/admin/product-categories/export", admin: true, expect: [200], group: "admin" },
  { url: "/admin/products", admin: true, expect: [200], must: ["สินค้า"], group: "admin" },
  { url: "/admin/products?page=abc&category=nope&q=%00", admin: true, expect: [200], group: "admin" },
  { url: "/admin/products/p14704", admin: true, expect: [200], must: ["ส่วนผสม", "ประวัติการแก้ไข"], note: "รหัสสินค้าจากข้อมูลจริง", group: "admin" },
  { url: "/admin/products/p14704?revision=abc", admin: true, expect: [200], group: "admin" },
  { url: "/admin/products/p999999", admin: true, expect: [404], group: "admin" },
  { url: "/admin/recipes", admin: true, expect: [200], group: "admin" },
  { url: "/admin/recipes?tab=nope", admin: true, expect: [200], group: "admin" },
  { url: "/admin/recipes/r134712", admin: true, expect: [200], must: ["ประวัติการแก้ไข"], note: "รหัสเมนูจากข้อมูลจริง", group: "admin" },
  { url: "/admin/recipes/r134712?revision=abc", admin: true, expect: [200], group: "admin" },
  { url: "/admin/news", admin: true, expect: [200], group: "admin" },
  { url: "/admin/news?tab=trash", admin: true, expect: [200], group: "admin" },
  { url: "/admin/news?page=abc&tab=nope", admin: true, expect: [200], group: "admin" },
  { url: "/admin/news/n148398", admin: true, expect: [200], must: ["ภาพปก", "ประวัติการแก้ไข"], note: "จอหลังบ้านใช้รหัสแถว (n…)", group: "admin" },
  { url: "/admin/news/n148398?revision=abc", admin: true, expect: [200], group: "admin" },
  { url: "/admin/hero", admin: true, expect: [200], must: ["สไลด์"], group: "admin" },
  { url: "/admin/hero?tab=campaigns", admin: true, expect: [200], group: "admin" },
  { url: "/admin/hero?tab=nope", admin: true, expect: [200], group: "admin" },
  { url: "/admin/hero?tab=trash", admin: true, expect: [200], group: "admin" },
  { url: "/admin/content/home", admin: true, expect: [200], group: "admin" },
  { url: "/admin/builder/home", admin: true, expect: [200], must: ["เทมเพลตนี้ครอบคลุมทุกส่วนของหน้านี้", 'id="builder-add-type"'], group: "admin" },
  { url: "/admin/builder/about", admin: true, expect: [200], group: "admin" },
  { url: "/admin/builder/contact", admin: true, expect: [200], group: "admin" },
  { url: "/admin/builder/certifications", admin: true, expect: [200], group: "admin" },
  { url: "/admin/builder/executives", admin: true, expect: [200], group: "admin" },
  { url: "/admin/builder/product-instant-noodles", admin: true, expect: [200], group: "admin" },
  { url: "/admin/builder/home?mode=nope&part=nope", admin: true, expect: [200], group: "admin" },
  { url: "/admin/builder/chrome", admin: true, expect: [200], must: ["ส่วนกลางของเว็บ"], group: "admin" },
  { url: "/admin/builder/chrome?part=notice&mode=overview", admin: true, expect: [200], group: "admin" },
  { url: "/admin/builder/chrome?part=footer", admin: true, expect: [200], group: "admin" },
  { url: "/admin/builder/chrome?part=nope&mode=nope", admin: true, expect: [200], group: "admin" },
  { url: "/admin/builder/chrome/export", admin: true, expect: [200], group: "admin" },
  { url: "/admin/bypass", admin: true, expect: [405], note: "ออกบัตรผ่าน (POST เท่านั้น)", group: "admin" },
  { url: "/th/preview/home", admin: true, expect: [200], group: "admin" },
  { url: "/th/preview/about", admin: true, expect: [200], group: "admin" },
  { url: "/th/preview/t/nope-token", admin: true, expect: [404], group: "admin" },
  { url: "/admin/builder/careers", admin: true, expect: [404], note: "ถอดจอตัวสร้าง careers (รอบ 266)", group: "admin" },
  { url: "/admin/builder/mourning", admin: true, expect: [404], note: "ถอดจอซ้ำ (รอบ 275)", group: "admin" },
  { url: "/admin/builder/products", admin: true, expect: [404], group: "admin" },
  { url: "/admin/builder/recipes", admin: true, expect: [404], group: "admin" },
  { url: "/admin/builder/news", admin: true, expect: [404], group: "admin" },
  { url: "/admin/builder/nope-nope", admin: true, expect: [404], group: "admin" },
  { url: "/admin/products", expect: [307], note: "ไม่มีคุกกี้ ⇒ เด้งไปล็อกอิน", group: "admin" },
  { url: "/admin/builder/home", expect: [307], group: "admin" },
  { url: "/th/preview/home", expect: [307], group: "admin" },

  /*
    🐞 ชุดกันถอยหลังของรอบที่ 293 — 404 ของหลังบ้านต้องเป็น **หน้าของเรา** (เดิมเป็นดีฟอลต์ของ Next)
  */
  { url: "/admin/nope-nope", admin: true, expect: [404], must: ["ไม่พบหน้านี้ในหลังบ้าน"], note: "ห้ามกลับไปเป็นหน้าดีฟอลต์ของ Next", group: "admin" },
  { url: "/admin/nope-nope/noo", admin: true, expect: [404], must: ["ไม่พบหน้านี้ในหลังบ้าน"], group: "admin" },
  { url: "/admin/nope-nope", expect: [307], note: "ยังไม่ล็อกอิน ⇒ เด้งไปหน้าล็อกอิน (ไม่ใช่ 404 เปล่า)", group: "admin" },

  /*
    🐞 ชุดกันถอยหลังของรอบที่ 291 — พารามิเตอร์ซ้ำ (array) + NUL เคยทำให้ **500**
    (ห้ามลบออกจากทะเบียนนี้: ด่านนี้คือสิ่งที่กันไม่ให้บั๊กกลับมา)
  */
  { url: "/admin/products?q=a&q=b", admin: true, expect: [200], note: "เคย 500 (ค่าซ้ำ = array)", group: "fuzz" },
  { url: "/admin/products?category=a&category=b", admin: true, expect: [200], note: "เคย 500", group: "fuzz" },
  { url: "/admin/news?q=a&q=b", admin: true, expect: [200], note: "เคย 500", group: "fuzz" },
  { url: "/admin/recipes?q=a&q=b", admin: true, expect: [200], note: "เคย 500", group: "fuzz" },
  { url: "/admin/careers?q=a&q=b", admin: true, expect: [200], note: "เคย 500", group: "fuzz" },
  { url: "/admin/inbox?erase=a&erase=b", admin: true, expect: [200], note: "เคย 500", group: "fuzz" },
  { url: "/admin/hero?saved=a&saved=b", admin: true, expect: [200], note: "เคย 500", group: "fuzz" },
  { url: "/admin/hero?error=a&error=b", admin: true, expect: [200], note: "เคย 500", group: "fuzz" },
  { url: "/admin/hero?fields=a&fields=b", admin: true, expect: [200], note: "เคย 500", group: "fuzz" },
  { url: "/admin/builder/chrome?part=a&part=b&mode=a&mode=b", admin: true, expect: [200], note: "เคย 500", group: "fuzz" },
  { url: "/admin/media?q=%00", admin: true, expect: [200], note: "NUL เคย 500 (Postgres ไม่รับ \\u0000)", group: "fuzz" },
  { url: "/admin/products?q=%00", admin: true, expect: [200], group: "fuzz" },
  { url: "/admin/news?q=%00", admin: true, expect: [200], group: "fuzz" },
  { url: "/admin/recipes?q=%00", admin: true, expect: [200], group: "fuzz" },
  { url: "/admin/careers?q=%00", admin: true, expect: [200], group: "fuzz" },
  { url: "/admin/inbox?erase=%00", admin: true, expect: [200], group: "fuzz" },
  { url: "/th/preview/home?parts=a&parts=b", admin: true, expect: [200], note: "เคย 500", group: "fuzz" },
  { url: "/th/preview/home?parts=%00", admin: true, expect: [200], group: "fuzz" },
  { url: "/admin/products/p14704?revision=a&revision=b", admin: true, expect: [200], group: "fuzz" },
  { url: "/admin/news/n148398?revision=a&revision=b", admin: true, expect: [200], group: "fuzz" },
  { url: "/admin/recipes/r134712?revision=a&revision=b", admin: true, expect: [200], group: "fuzz" },
  { url: "/admin/sort?kind=a&kind=b&category=a&category=b", admin: true, expect: [200], group: "fuzz" },
];

/**
 * เส้นที่ต้องยิงตอน **เปิดโหมดปิดปรับปรุง** (`MAINTENANCE_MODE=1`) — ใช้กับ `npm run probe:routes --maintenance`
 * กติกา: หน้าที่ประชาชนเห็น → **503** ที่ URL เดิม + `Retry-After` · ที่ผ่านเสมอ: `/admin` · `/<lang>/maintenance`
 * · `/media/*` · robots/sitemap · `/healthz` · และผู้ถือคุกกี้บายพาสที่ยังไม่หมดอายุ
 */
export const MAINTENANCE_PROBE_TARGETS: readonly ProbeTarget[] = [
  { url: "/th", expect: [503], must: ["เว็บไซต์ปิดปรับปรุงชั่วคราว"], note: "503 + retry-after + no-store", group: "maintenance" },
  { url: "/en", expect: [503], must: ["The site is temporarily unavailable"], note: "หน้าอังกฤษใช้ข้อความอังกฤษ", group: "maintenance" },
  { url: "/th/products", expect: [503], note: "เสิร์ฟหน้าแจ้งเตือนที่ URL เดิม", group: "maintenance" },
  { url: "/th/news", expect: [503], group: "maintenance" },
  { url: "/th/about", expect: [503], group: "maintenance" },
  { url: "/th/maintenance", expect: [200, 503], group: "maintenance" },
  { url: "/en/maintenance", expect: [200, 503], group: "maintenance" },
  { url: "/robots.txt", expect: [200], group: "maintenance" },
  { url: "/sitemap.xml", expect: [200], group: "maintenance" },
  { url: "/media/JIIKynFuOs4j", expect: [200], note: "ไฟล์ภาพต้องผ่านเสมอ", group: "maintenance" },
  { url: "/admin/login", expect: [200], note: "หลังบ้านต้องเข้าได้เสมอ", group: "maintenance" },
  { url: "/healthz", expect: [404, 200], group: "maintenance" },
  /*
    ผู้ถือ **บัตรผ่าน** ต้องดูเว็บได้ — ⚠️ คนละคุกกี้กับเซสชันหลังบ้าน (`waiwai_maint_bypass` · TTL 15 นาที)
    ออกโดย `POST /admin/bypass` (ตัว probe จะออกบัตรให้เองแล้วแนบมาเฉพาะเส้นนี้)
  */
  { url: "/th", bypass: true, expect: [200], note: "บัตรผ่าน (waiwai_maint_bypass) ต้องเห็นเว็บจริง", group: "maintenance" },
];

export type ProbeExpectationInput = {
  readonly status: number;
  readonly body: string;
};

/**
 * ตัดสินว่าผลการยิง "มีปัญหา" ไหม — คืนรายการปัญหา (ว่าง = ผ่าน)
 * ตรรกะล้วน ⇒ ทดสอบได้โดยไม่ต้องมีเซิร์ฟเวอร์
 */
export function probeProblems(input: ProbeExpectationInput, target: ProbeTarget): readonly string[] {
  const problems: string[] = [];

  if (!target.expect.includes(input.status)) problems.push(`สถานะ ${input.status} (คาด ${target.expect.join("/")})`);
  /*
    ⚠️ 5xx ที่ "คาดไว้" ไม่ใช่ความผิด — โหมดปิดปรับปรุงตอบ **503 โดยเจตนา** (รอบที่ 292 จับได้ว่าตัวตรวจ
    รุ่นแรกฟ้อง `503` เป็น "เซิร์ฟเวอร์พัง" ทั้งชุด) ⇒ ตกเฉพาะ 5xx ที่ไม่ได้ระบุใน `expect`
  */
  if (input.status >= 500 && !target.expect.includes(input.status)) problems.push("HTTP 5xx ที่ไม่ได้คาดไว้ = เซิร์ฟเวอร์พังจริง");
  for (const sign of PROBE_ERROR_SIGNS) if (input.body.includes(sign)) problems.push(`สัญญาณ error: "${sign}"`);
  for (const sign of PROBE_DIRTY_SIGNS) if (input.body.includes(sign)) problems.push(`ค่าที่ไม่ควรโผล่: "${sign}"`);
  for (const text of target.must ?? []) if (!input.body.includes(text)) problems.push(`ขาดข้อความ "${text}"`);

  return problems;
}

/** เลือกเส้นที่จะยิง (`--only=<คำ>` กรองจาก url/note · `--maintenance` เพิ่มชุดโหมดปิดปรับปรุง) */
export function selectProbeTargets(options: {
  readonly only?: string;
  readonly maintenance?: boolean;
} = {}): readonly ProbeTarget[] {
  const base = options.maintenance === true ? MAINTENANCE_PROBE_TARGETS : PROBE_TARGETS;
  const only = options.only?.trim();
  if (only === undefined || only === "") return base;
  return base.filter((target) => target.url.includes(only) || (target.note ?? "").includes(only));
}
