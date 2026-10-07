import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { CSP_FRAME_SOURCES, CSP_REQUIRED_DIRECTIVES, contentSecurityPolicy } from "@/lib/security/csp";

/**
 * เทสต์ CSP (รอบที่ 170)
 *
 * สองเรื่องที่ต้องคุม
 * 1. **นโยบายต้องแข็งพอที่จะมีค่า** — object/base/form/frame ต้องถูกล็อก
 * 2. **ต้องไม่ทำเว็บพัง** — สคริปต์ inline ของ Next/ธีมยังต้องรันได้ · iframe พรีวิวหลังบ้านยังต้องทำงาน
 *    · ผู้เล่น YouTube ยังต้องโหลดได้ · และ **ห้ามใช้ nonce** (จะปิด ISR ตามเอกสาร Next)
 */

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (...parts: readonly string[]): string => readFileSync(path.join(ROOT, ...parts), "utf8");

function directivesOf(policy: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of policy.split(";")) {
    const trimmed = part.trim();
    if (trimmed === "") continue;
    const space = trimmed.indexOf(" ");
    if (space < 0) map.set(trimmed, "");
    else map.set(trimmed.slice(0, space), trimmed.slice(space + 1).trim());
  }
  return map;
}

test("csp: production ล็อก object/base/form/frame ตามที่ตกลง", () => {
  const policy = contentSecurityPolicy({ isDev: false });
  const directives = directivesOf(policy);

  for (const [directive, expected] of Object.entries(CSP_REQUIRED_DIRECTIVES)) {
    assert.equal(directives.get(directive), expected, `${directive} ต้องเป็น "${expected}"`);
  }

  /* ไฟล์อื่นในเว็บเป็น self ทั้งหมด → origin ภายนอกมีได้เฉพาะผู้เล่นวิดีโอที่อนุญาต */
  assert.equal(directives.get("default-src"), "'self'");
  assert.ok(directives.get("connect-src")?.startsWith("'self'"), "connect-src ต้องเริ่มที่ 'self'");
  assert.ok(!policy.includes("*"), "ห้ามใช้ * ในนโยบาย");
  const httpsOrigins = policy.match(/https:\/\//g) ?? [];
  assert.equal(httpsOrigins.length, CSP_FRAME_SOURCES.length, "origin ภายนอกมีได้เฉพาะผู้เล่นวิดีโอที่อนุญาต");
});

test("csp: frame-ancestors ต้องเป็น 'self' — หลังบ้านฝัง iframe พรีวิวของตัวเอง", () => {
  const directives = directivesOf(contentSecurityPolicy({ isDev: false }));
  assert.equal(directives.get("frame-ancestors"), "'self'");

  /* ยืนยันเหตุผล: หลังบ้าน/พรีวิวใช้ <iframe> จริง (ถ้าวันหนึ่งเลิกใช้ ค่อยพิจารณา 'none') */
  const workspace = read("features", "admin", "ui", "chrome-workspace.tsx");
  const blockBuilder = read("features", "admin", "ui", "block-builder.tsx");
  assert.ok(workspace.includes("<iframe"), "ตัวสร้างส่วนกลางยังใช้ iframe พรีวิว");
  assert.ok(blockBuilder.includes("<iframe"), "ตัวสร้างหน้าเว็บยังใช้ iframe พรีวิว");
});

test("csp: frame-src ยอมเฉพาะพรีวิวของเรา + ผู้เล่น YouTube (nocookie)", () => {
  const directives = directivesOf(contentSecurityPolicy({ isDev: false }));
  const frameSrc = directives.get("frame-src") ?? "";

  assert.ok(frameSrc.includes("'self'"), "ต้องยอม iframe พรีวิวของเรา (same-origin)");

  const facade = read("features", "recipes", "ui", "video-facade.tsx");
  assert.ok(facade.includes("youtube-nocookie.com"), "พรีวิวเมนูใช้ youtube-nocookie (มติ D20)");
  for (const source of CSP_FRAME_SOURCES) {
    assert.ok(frameSrc.includes(source), `frame-src ต้องมี ${source}`);
  }

  assert.ok(!frameSrc.includes("youtube.com"), "ห้ามเปิดโดเมน youtube.com เปล่า ๆ (ควรเป็น nocookie เท่านั้น)");
});

test("csp: ห้ามใช้ nonce — nonce บังคับทุกหน้าเป็น dynamic (ปิด ISR ตามเอกสาร Next)", () => {
  for (const isDev of [false, true]) {
    const policy = contentSecurityPolicy({ isDev });
    assert.ok(!policy.includes("nonce-"), "ห้ามมี nonce- ในนโยบาย (ทั้ง dev/prod)");
    assert.ok(!policy.includes("strict-dynamic"), "ห้ามใช้ strict-dynamic คู่กับ unsafe-inline (ไม่มีผล/สับสน)");
  }

  const cspSource = read("lib", "security", "csp.ts");
  assert.ok(cspSource.includes("content-security-policy.md"), "ต้องอ้างเอกสาร Next ที่อธิบายข้อจำกัดของ nonce");
  assert.ok(cspSource.includes("ปิด ISR") || cspSource.includes("dynamic"), "ต้องบันทึกเหตุผลที่เลือกไม่ใช้ nonce");
});

test("csp: dev ผ่อนเท่าที่จำเป็น (React ใช้ eval + HMR ใช้ websocket) · prod ไม่มี eval", () => {
  const prod = contentSecurityPolicy({ isDev: false });
  const dev = contentSecurityPolicy({ isDev: true });

  const prodScript = directivesOf(prod).get("script-src") ?? "";
  assert.ok(prodScript.includes("'self'") && prodScript.includes("'unsafe-inline'"), "prod ต้องมี self + unsafe-inline");
  assert.ok(!prodScript.includes("'unsafe-eval'"), "prod ห้ามมี unsafe-eval");

  const devScript = directivesOf(dev).get("script-src") ?? "";
  assert.ok(devScript.includes("'unsafe-eval'"), "dev ต้องมี unsafe-eval (React ใช้ eval เฉพาะ dev)");

  const devConnect = directivesOf(dev).get("connect-src") ?? "";
  assert.ok(devConnect.includes("ws:") && devConnect.includes("wss:"), "dev ต้องเปิด websocket ให้ HMR");

  assert.ok(prod.includes("upgrade-insecure-requests"), "prod ต้องบังคับ https");
  assert.ok(!dev.includes("upgrade-insecure-requests"), "dev ห้ามบังคับ https (จะพัง localhost)");
});

test("csp: next.config.ts ใช้ค่าเดียวกันและครอบทุกเส้นทาง", () => {
  const config = read("next.config.ts");
  assert.ok(config.includes("contentSecurityPolicy("), "next.config.ts ต้องเรียกตัวสร้างกลาง");
  assert.ok(config.includes('key: "Content-Security-Policy"'), "ต้องตั้ง header CSP จริง");

  const deployTest = read("scripts", "test-deploy-config.ts");
  assert.ok(deployTest.includes("CSP_REQUIRED_DIRECTIVES"), "ด่าน deploy ต้องตรวจ CSP กับค่ากลาง");
});
