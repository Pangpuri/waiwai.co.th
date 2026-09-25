import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import nextConfig from "../next.config.ts";

/**
 * ด่านของ "การตั้งค่าตอน deploy" — กันเคสที่ตั้งไว้ผิดที่จนเว็บจริงไม่มีผล
 *
 * บทเรียนรอบที่ 21: header ความปลอดภัยถูกตั้งใน `netlify.toml` มาตลอด แต่ผู้ใช้ย้ายไป deploy
 * บน **Vercel** ซึ่งอ่านไฟล์นั้นไม่ได้ → เว็บจริงจะไม่มี header เหล่านี้เลยโดยไม่มีใครรู้
 * ด่านนี้จึงบังคับให้ค่าอยู่ใน `next.config.ts` ซึ่งเป็นที่ที่ Next ใช้จริงทุกโฮสต์
 */

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

/** header ที่ต้องมีบนทุกเส้นทาง (ค่าต้องตรงกับที่ตกลงกันไว้) */
const REQUIRED_HEADERS: readonly (readonly [string, string])[] = [
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["X-Frame-Options", "SAMEORIGIN"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
];

test("next.config.ts: ต้องตั้ง header ความปลอดภัยครบและครอบทุกเส้นทาง", async () => {
  const headers = nextConfig.headers;
  assert.equal(typeof headers, "function", "next.config.ts ต้องมี headers() (ย้ายมาจาก netlify.toml)");

  if (typeof headers !== "function") return;

  const rules = await headers();
  const globalRule = rules.find((rule) => rule.source === "/(.*)");
  assert.ok(globalRule, 'ต้องมีกฎที่ source = "/(.*)" (ทุกเส้นทาง)');

  const values = new Map((globalRule?.headers ?? []).map((entry) => [entry.key, entry.value]));

  for (const [key, expected] of REQUIRED_HEADERS) {
    assert.equal(values.get(key), expected, `header ${key} ต้องเป็น "${expected}"`);
  }
});

test("next.config.ts: จงใจไม่ตั้ง Content-Security-Policy", async () => {
  const headers = nextConfig.headers;
  if (typeof headers !== "function") return;

  const rules = await headers();
  const keys = rules.flatMap((rule) => rule.headers.map((entry) => entry.key.toLowerCase()));

  /*
    เว็บนี้ใช้สคริปต์ inline ก่อน paint (ธีม/สถานะป๊อปอัพ/การ์ด) — CSP ที่ไม่มี nonce จะบล็อกสคริปต์เหล่านั้น
    แล้วหน้าจะวาบ · ถ้าวันหนึ่งจะทำ CSP ต้องทำ nonce + ทบทวนผลต่อ static rendering ก่อน (ไม่ใช่แค่เพิ่ม header)
  */
  assert.ok(
    !keys.includes("content-security-policy"),
    "อย่าเพิ่ม CSP แบบสด ๆ — สคริปต์ก่อน paint ต้องมี nonce ก่อน ไม่งั้นหน้าจะวาบ/พัง",
  );
});

test("netlify.toml: ต้องไม่ตั้ง header ซ้ำกับ next.config.ts", () => {
  const netlify = readFileSync(path.join(PROJECT_ROOT, "netlify.toml"), "utf8");
  const activeLines = netlify
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");

  // แหล่งความจริงเดียวคือ next.config.ts — ถ้าตั้งซ้ำสองที่จะเพี้ยนหากันเงียบ ๆ
  assert.ok(
    !activeLines.includes("[[headers]]"),
    "netlify.toml ต้องไม่ตั้ง [[headers]] อีกแล้ว — แก้ที่ next.config.ts เท่านั้น",
  );
});
