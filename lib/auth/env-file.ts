/**
 * จัดการไฟล์ `.env` แบบ "แก้เฉพาะบรรทัดที่ต้องแก้" — ตรรกะบริสุทธิ์ ทดสอบได้
 *
 * ใช้โดย `npm run admin:create -- --write-env`
 * ทำไมต้องเขียนผ่านโค้ด (ไม่ให้ผู้ใช้คัดลอกเอง):
 *   1. ค่า hash/secret ยาวและมีอักขระ `$` — คัดลอกมือพลาดได้ง่าย (เคสจริง: shell ตัด `$` ทำให้ hash เพี้ยน)
 *   2. ต้อง **ไม่ลบค่าอื่น** ที่ผู้ใช้อาจมีอยู่ในไฟล์ (เช่น `DATABASE_URL` ในอนาคต · ค่าทดลองอื่น)
 *   3. ต้อง **ไม่เปลี่ยน `SESSION_SECRET` เดิม** ถ้ามีอยู่แล้ว (ไม่งั้นเซสชันที่เปิดอยู่จะหลุดทั้งหมด)
 */

/** อ่านค่าของคีย์หนึ่งจากข้อความ env (เฉพาะบรรทัดที่ "ใช้งานจริง" ไม่นับบรรทัดที่คอมเมนต์) */
export function readEnvValue(text: string, key: string): string | undefined {
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line.trim());
    if (match === null) continue;
    if (match[1] !== key) continue;
    return unquote(match[2] ?? "");
  }
  return undefined;
}

function unquote(raw: string): string {
  const value = raw.trim();
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}

export type EnvEntry = {
  readonly key: string;
  readonly value: string;
};

/**
 * รวมค่าใหม่เข้าไปในข้อความ env
 * - คีย์ที่มีอยู่แล้ว → แทนที่ "ค่าบรรทัดนั้น" (คงตำแหน่งเดิม เพื่อให้ diff อ่านง่าย)
 * - คีย์ใหม่ → ต่อท้าย
 * - ไม่แตะบรรทัดอื่นเลย (คอมเมนต์/บรรทัดว่าง/คีย์อื่น)
 * - คงสไตล์ขึ้นบรรทัดเดิม (CRLF ยังเป็น CRLF)
 */
export function mergeEnvText(existing: string, entries: readonly EnvEntry[]): string {
  const eol = existing.includes("\r\n") ? "\r\n" : "\n";
  const hasTrailingNewline = existing === "" || existing.endsWith("\n");
  const lines = existing === "" ? [] : existing.split(/\r?\n/);
  if (hasTrailingNewline && lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  const remaining = new Map(entries.map((entry) => [entry.key, entry.value]));

  const merged = lines.map((line) => {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line.trim());
    if (match === null) return line;

    const key = match[1] ?? "";
    const value = remaining.get(key);
    if (value === undefined) return line;

    remaining.delete(key);
    return `${key}=${value}`;
  });

  for (const [key, value] of remaining) {
    merged.push(`${key}=${value}`);
  }

  return `${merged.join(eol)}${eol}`;
}

/** ชื่อไฟล์ env ที่โปรเจกต์ใช้ในเครื่อง (Next อ่านไฟล์นี้อัตโนมัติและไม่ถูก commit) */
export const LOCAL_ENV_FILE = ".env.local";
