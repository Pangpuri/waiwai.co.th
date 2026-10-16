/**
 * ตัวช่วยอ่านฟอร์มจาก HTML สำหรับเครื่องมือ probe (รอบที่ 293) — **ตรรกะล้วน ไม่มี I/O**
 *
 * ## ทำไมต้องมี (บทเรียนจริงรอบ 292)
 * สคริปต์ probe รุ่นแรก "เก็บช่อง" จาก `<input>` เท่านั้น ⇒ **`<select>` ถูกมองข้าม**
 * ⇒ ยิงฟอร์ม "สร้างลิงก์พรีวิว" โดยไม่ส่ง `page` → ฟอร์มดูเหมือนสำเร็จแต่ **ไม่มีแถวเกิดขึ้นในฐานข้อมูล**
 * (จับได้เพราะตรวจ "จำนวนแถวก่อน/หลัง" ไม่ใช่ดูข้อความบนจอ)
 *
 * ⇒ เก็บให้ครบแบบที่เบราว์เซอร์ส่งจริง: input (ยกเว้น submit/file/button/reset) · select (ตัวที่ `selected`
 *   หรือตัวแรก) · textarea · และ `$ACTION_REF_*` (ต้องส่งเป็นค่าว่างเพื่อบอก Next ว่าเป็น Server Action ไหน)
 *
 * ⚠️ `select` แบบ multiple / checkbox หลายค่า ยังไม่รองรับ (ฟอร์มในโปรเจกต์นี้ไม่มี) — ถ้าเพิ่มในอนาคต
 *    ต้องขยายที่นี่ พร้อมเทสต์
 */

/** ตัดทุก `<form>…</form>` ออกจาก HTML (เรียงตามที่ปรากฏ) */
export function formsOf(html: string): readonly string[] {
  return [...html.matchAll(/<form\b[\s\S]*?<\/form>/g)].map((match) => match[0]);
}

function unescapeAttribute(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
}

/** ฟอร์มที่มีช่องอัปโหลดไฟล์ (`<input type="file">`) — ใช้เลือกฟอร์มเป้าหมายให้ถูกใบ */
export function formWithFileInput(forms: readonly string[]): string | undefined {
  return forms.find((form) => /<input\b[^>]*type="file"/.test(form));
}

/** ฟอร์มที่มีช่องชื่อ `name` ตามที่ระบุ (เช่นฟอร์ม "ตัดเซสชัน" ที่มี `name="hash"`) — นับทุกชนิดของช่อง */
export function formWithField(forms: readonly string[], name: string): string | undefined {
  /* escape อักขระ regex ของชื่อช่อง (ชื่อมาจากโค้ดของเรา แต่กันไว้ให้ปลอดภัย) */
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\bname="${escaped}"`);
  return forms.find((form) => pattern.test(form));
}

/**
 * ค่าทุกช่องที่เบราว์เซอร์จะส่งเมื่อกด submit (ยังไม่รวมไฟล์ — ผู้เรียกเติม `file` เอง)
 * คืนคู่ `[name, value]` เรียงตามที่ปรากฏในฟอร์ม
 */
export function formFieldsOf(form: string): readonly (readonly [string, string])[] {
  const fields: [string, string][] = [];

  for (const match of form.matchAll(/<input\b[^>]*>/g)) {
    const tag = match[0];
    const name = /\bname="([^"]*)"/.exec(tag)?.[1];
    if (name === undefined) continue;
    if (/\btype="(submit|file|button|reset|image)"/.test(tag)) continue;
    fields.push([name, unescapeAttribute(/\bvalue="([^"]*)"/.exec(tag)?.[1] ?? "")]);
  }

  for (const match of form.matchAll(/<select\b[\s\S]*?<\/select>/g)) {
    const block = match[0];
    const name = /\bname="([^"]*)"/.exec(block)?.[1];
    if (name === undefined) continue;

    const options = [...block.matchAll(/<option\b[^>]*>/g)].map((option) => ({
      tag: option[0],
      value: unescapeAttribute(/\bvalue="([^"]*)"/.exec(option[0])?.[1] ?? ""),
    }));
    const chosen = options.find((option) => /\bselected\b/.test(option.tag)) ?? options[0];
    if (chosen !== undefined) fields.push([name, chosen.value]);
  }

  for (const match of form.matchAll(/<textarea\b[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/textarea>/g)) {
    fields.push([match[1] ?? "", unescapeAttribute(match[2] ?? "")]);
  }

  /* `$ACTION_REF_*` ไม่มีค่าใน HTML — ต้องส่งเป็นค่าว่าง (ไม่งั้น Next ไม่รู้ว่าจะเรียก action ไหน) */
  for (const match of form.matchAll(/<input\b[^>]*name="(\$ACTION_REF[^"]*)"[^>]*>/g)) {
    const name = match[1];
    if (name !== undefined) fields.push([name, ""]);
  }

  return fields;
}

/** มีช่อง Server Action ครบไหม (ถ้าไม่มี = ฟอร์มนั้นไม่ใช่ Server Action — เช่นฟอร์มตัวกรอง GET) */
export function hasServerActionFields(form: string): boolean {
  return /\$ACTION_KEY/.test(form) && /name="\$ACTION_\d+:\d+"/.test(form);
}
