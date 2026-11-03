/**
 * กัน "ลิงก์ในพรีวิว" ไม่ให้พา iframe ออกไปหน้าอื่น (รอบที่ 325)
 *
 * ที่มา (คำเจ้าของ): *"ในจอ liveview ที่เป็นจอจำลองการปรับเปลี่ยนบล็อคหรือข้อความ
 * ลิงค์ดันทำงานด้วยหากกดผิดหรือไปโดน ในนั้นหน้าของมันก็จะถูกเปลี่ยนตาม …
 * มีการแก้ไขส่วนนั้นโดยไม่กระทบหน้าบ้านไหม"*
 *
 * หลักคิด
 * - พรีวิวของหลังบ้านคือ iframe ที่โหลด **หน้าเว็บจริง** (ฉบับร่าง/เผยแพร่/หน้าเว็บจริง)
 *   ⇒ ปล่อยให้ `<a href>` ทำงานตามปกติ = กดพลาดครั้งเดียว iframe เปลี่ยนหน้า แล้วผู้ใช้หลุดจากหน้าที่กำลังแก้
 * - ห้ามแก้ที่หน้าเว็บสาธารณะ (จะกลายเป็นปิดลิงก์ของเว็บจริง) ⇒ ติด "ตัวดัก" จาก **หน้าต่างแม่**
 *   เข้าไปในเอกสารของ iframe ตอน `load` เท่านั้น (same-origin ตาม `frame-ancestors 'self'`)
 * - ไม่ใช้ `sandbox` เพราะ sandbox **ไม่ได้ห้าม iframe นำทางตัวเอง** และถ้าถอด `allow-same-origin`
 *   จะทำให้ `event.origin` ที่พรีวิวใช้ตรวจ postMessage เปลี่ยนเป็น `"null"` (พรีวิวสดพังทั้งชุด)
 * - ไม่ใช้ `pointer-events: none` เพราะจะพังการคลิกเลือกบล็อก/การลากภาพวางในพรีวิว
 * - ไม่ `stopPropagation` — ปล่อยให้คลิกไหลต่อไปยังตัวเลือกบล็อกของพรีวิว (ต้องการแค่ `preventDefault`)
 *
 * ขอบเขต
 * - ใช้เฉพาะ iframe ที่หน้าจอหลังบ้านเป็นคนติดตั้ง (`features/admin/ui/*`)
 * - หน้าพรีวิวที่เปิดตรง ๆ ในแท็บใหม่ไม่ถูกดัก ⇒ ยังกดลิงก์ดูได้ตามปกติ (เป็นทางออกของผู้ใช้)
 * - ฟอร์มก็ถูกกัน `submit` ไว้ด้วย เพราะพรีวิวไม่ควรยิงข้อมูลเข้าฐานข้อมูลจริงโดยไม่ตั้งใจ
 */

/**
 * ลิงก์แบบนี้ควรถูกบล็อกไหม
 *
 * - `null` = ไม่มีแอตทริบิวต์ `href` (ไม่ใช่ลิงก์ที่นำทางได้) ⇒ ไม่ต้องบล็อก
 * - `#...` = เลื่อนภายในหน้าเดิม ⇒ ปล่อย (ใช้สารบัญในบล็อกได้)
 * - ที่เหลือ (รวม `href=""` ที่ทำให้โหลดหน้าเดิมใหม่ และ `javascript:`/`mailto:`/`tel:`) ⇒ บล็อก
 */
export function shouldBlockPreviewNavigation(href: string | null): boolean {
  if (href === null) return false;
  const value = href.trim();
  if (value.startsWith("#")) return false;
  return true;
}

/** เอกสารที่ติดตั้งตัวดักแล้ว — ใช้ `Document` เป็นกุญแจเพราะ `contentWindow` เป็น proxy ตัวเดิมข้ามการนำทาง */
const guardedDocuments = new WeakSet<Document>();

/** แอตทริบิวต์บน `<html>` ของพรีวิว — ไว้ตรวจด้วยตา/เทสต์ว่าตัวดักติดตั้งแล้ว */
export const PREVIEW_NAVIGATION_GUARD_ATTRIBUTE = "data-preview-nav-guard";

/**
 * ติดตั้งตัวดักบน `window` ของพรีวิว — ใช้ได้ทั้งจากหน้าต่างแม่ (iframe) และจาก **ในพรีวิวเอง**
 *
 * ทำไมต้องมีทางเข้าแบบ window
 * - รอบที่ 325 เจอจริงว่า `onLoad` ของ iframe ไม่พอ: ถ้า iframe โหลดเสร็จก่อน React ของหน้าต่างแม่
 *   hydrate (`onLoad` ยังไม่ถูกผูก) และ `useEffect` ของแม่ไปติดตอนเอกสารยังเป็น `about:blank`
 *   ⇒ เอกสารจริงไม่ถูกดัก (เกิด intermittently กับ `/admin/builder/executives` · `/certifications`)
 * - พรีวิวเรนเดอร์ `<PreviewNavigationGuard>` ไว้ในเอกสารของตัวเอง ⇒ `useEffect` ของมันรัน
 *   เมื่อ **เอกสารนั้น** hydrate แน่นอน ไม่ต้องแย่งเวลากับหน้าต่างแม่
 */
export function installPreviewNavigationGuardInWindow(view: Window | null): boolean {
  if (view === null) return false;

  let guardDocument: Document;
  try {
    guardDocument = view.document;
  } catch {
    /* ต่างโดเมน/ยังไม่พร้อม — ห้ามให้ทั้งหน้าจอล้มเพราะเรื่องนี้ */
    return false;
  }

  return installGuardOnDocument(view, guardDocument);
}

/**
 * ติดตั้งตัวดักใน iframe พรีวิว (เรียกซ้ำได้ปลอดภัย)
 *
 * @returns `true` = เอกสารนี้ถูกป้องกันแล้ว (ติดตั้งใหม่หรือเคยติดตั้ง) · `false` = ยังติดตั้งไม่ได้
 */
export function installPreviewNavigationGuard(frame: HTMLIFrameElement | null): boolean {
  if (frame === null) return false;

  let view: Window | null;
  try {
    view = frame.contentWindow;
  } catch {
    return false;
  }

  return installPreviewNavigationGuardInWindow(view);
}

function installGuardOnDocument(view: Window, guardDocument: Document): boolean {
  if (guardedDocuments.has(guardDocument)) return true;

  /*
    ตรวจชนิดด้วย `Element` ของหน้าต่าง iframe เอง ไม่ใช่ `Element` ของหน้าต่างแม่ —
    คลาสจากคนละ realm (iframe) ไม่ผ่าน `instanceof` ข้ามกัน
  */
  const ElementConstructor = guardDocument.defaultView?.Element ?? null;
  if (ElementConstructor === null) return false;

  const blockLinkActivation = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof ElementConstructor)) return;

    const anchor = target.closest("a[href]");
    if (!(anchor instanceof ElementConstructor)) return;

    if (shouldBlockPreviewNavigation(anchor.getAttribute("href"))) event.preventDefault();
  };

  const blockFormSubmit = (event: Event): void => {
    event.preventDefault();
  };

  try {
    view.addEventListener("click", blockLinkActivation, true);
    /* คลิกกลาง/ปุ่มเสริมก็เปิดลิงก์ได้ (เกิด `auxclick` ไม่ใช่ `click`) */
    view.addEventListener("auxclick", blockLinkActivation, true);
    guardDocument.addEventListener("submit", blockFormSubmit, true);
    guardDocument.documentElement?.setAttribute(PREVIEW_NAVIGATION_GUARD_ATTRIBUTE, "1");
  } catch {
    return false;
  }

  guardedDocuments.add(guardDocument);
  return true;
}
