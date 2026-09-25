/**
 * Node module customization hook — ทำให้ `node --test` เข้าใจ path alias `@/*`
 *
 * จำเป็นเพราะ Node รัน TypeScript ด้วย type stripping เองได้
 * แต่ไม่รู้จัก `paths` ใน tsconfig.json (ซึ่งมีแต่ bundler อ่าน)
 *
 * ใช้แทนการติดตั้ง tsx/ts-node → ไม่เพิ่ม dependency ตามกฎข้อ 7
 */
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

/** นามสกุล/รูปแบบไฟล์ที่โปรเจกต์นี้ใช้ */
function candidatesFor(basePath) {
  return [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.mts`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
  ];
}

async function firstExistingFile(paths) {
  for (const candidate of paths) {
    try {
      const stats = await stat(candidate);
      if (stats.isFile()) return candidate;
    } catch {
      // ไม่มีไฟล์นี้ ลองตัวถัดไป
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@" || specifier.startsWith("@/")) {
    const rest = specifier === "@" ? "" : specifier.slice(2);
    const target = await firstExistingFile(candidatesFor(path.join(PROJECT_ROOT, rest)));

    if (target) {
      return nextResolve(pathToFileURL(target).href, context);
    }
  }

  return nextResolve(specifier, context);
}
