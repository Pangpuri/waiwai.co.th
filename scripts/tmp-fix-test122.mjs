import { readFileSync, writeFileSync } from "node:fs";
const f = "C:/Users/user/waiwai_demo/scripts/test-public-env-surface.ts";
let s = readFileSync(f, "utf8").replaceAll("\r\n", "\n");
const from = `  assert.match(
    body,
    /if\s*\(\s*secret\s*===\s*undefined[^)]*\)\s*return false/,
    "ต้อง return false เมื่อไม่มี/ใช้ไม่ได้ (ห้ามโยน error ⇒ ไม่งั้นเว็บล่มทั้งเว็บ)",
  );`;
if (!s.includes(from)) throw new Error("ไม่พบบล็อกเดิม");
s = s.replace(
  from,
  `  assert.ok(body.includes("return false"), "ต้องคืน false เมื่อตรวจไม่ผ่าน (fail-closed)");
  assert.ok(!body.includes("throw"), "ห้าม throw ในเส้นทางนี้ ⇒ ไม่งั้นเว็บล่มทั้งเว็บเมื่อไม่ตั้งค่าหลังบ้าน");
  assert.ok(
    /secret\s*===\s*undefined/.test(body) && body.includes("isSecretUsable"),
    "ต้องเช็คทั้ง 'ไม่มีค่า' และ 'ค่าใช้ไม่ได้' ก่อนใช้",
  );`,
);
writeFileSync(f, s);
process.stdout.write("แก้เทสต์แล้ว\n");
