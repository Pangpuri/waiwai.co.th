/**
 * วัดค่าจริงของหน้าเว็บในเบราว์เซอร์ + ถ่ายภาพหน้าจอ (ไม่เพิ่ม dependency)
 *
 * ── ทำไมต้องมีไฟล์นี้ ─────────────────────────────────────────────────────────
 * รอบที่ 21 เจอบั๊กที่ **ด่านทั้ง 7 ข้อมองไม่เห็น**: CSS เขียนว่า `[data-hero-card] { display: none }`
 * แต่ attribute นั้นถูกสคริปต์ก่อน paint ติดบน `<html>` เอง → **ซ่อนทั้งเว็บ**
 * ตอนนั้น typecheck/lint/test/build/check:dark/check:i18n ผ่านหมด เพราะ CSS ที่ compile "ถูกต้อง"
 * และ HTML ที่ prerender "ถูกต้อง" — สิ่งที่ผิดคือ selector ไปโดน `<html>` ซึ่งเห็นได้เฉพาะตอนรันจริง
 * (อาการที่มองเห็น: ทุก element กว้าง 0 · ภาพ hero ได้ ratio 0 → Next.js เตือนเรื่อง `sizes`)
 *
 * ── วิธีใช้ ───────────────────────────────────────────────────────────────────
 *   npm run build && npm run start -- -p 3100        # อีกหน้าต่างหนึ่ง
 *   node scripts/measure-page.mjs http://localhost:3100/th out.png 1440 1000
 *
 * สคริปต์จะเปิด Chrome แบบ headless + ต่อผ่าน CDP แล้ว
 *   1) พิมพ์พิกัด/ขนาดของ hero · ภาพสไลด์ · การ์ดประกาศ + ค่าที่ควรตรวจ (scrollbarGutter, attributes)
 *   2) ซ่อนป๊อปอัพไว้อาลัย (จำลองว่ากดปิดแล้ว) แล้ววัดซ้ำ
 *   3) ถ่ายภาพหน้าจอไว้ดูด้วยตา (หรือส่งให้โมเดลช่วยอ่านก็ได้)
 *
 * ใช้ Chrome ของเครื่อง (ตั้ง path เองได้ด้วย env CHROME_PATH) — ไม่ได้อยู่ใน DoD และไม่รันใน `npm test`
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const [, , url, outPng, width = "1440", height = "1000"] = process.argv;

if (!url || !outPng) {
  console.error("ใช้: node scripts/measure-page.mjs <url> <outPng> [width] [height]");
  process.exit(1);
}

const chromePath = CANDIDATES.find((candidate) => existsSync(candidate));

if (!chromePath) {
  console.error("หา Chrome/Edge ไม่เจอ — ตั้ง env CHROME_PATH ให้ชี้ไปที่ไฟล์โปรแกรม");
  process.exit(1);
}

const profile = mkdtempSync(path.join(os.tmpdir(), "measure-page-"));
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    `--user-data-dir=${profile}`,
    "--remote-debugging-port=9222",
    `--window-size=${width},${height}`,
    url,
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function findTarget() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:9222/json/list");
      const targets = await response.json();
      const page = targets.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      // ยังไม่เปิดพอร์ต — ลองใหม่
    }
    await sleep(250);
  }
  throw new Error("หา target ของ Chrome ไม่เจอ");
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const pending = new Map();
    let nextId = 1;

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const entry = message.id ? pending.get(message.id) : undefined;
      if (!entry) return;

      pending.delete(message.id);
      if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
      else entry.resolve(message.result);
    });
    socket.addEventListener("error", reject);
    socket.addEventListener("open", () =>
      resolve({
        send(method, params = {}) {
          const id = nextId++;
          return new Promise((resolve_, reject_) => {
            pending.set(id, { resolve: resolve_, reject: reject_ });
            socket.send(JSON.stringify({ id, method, params }));
          });
        },
        close: () => socket.close(),
      }),
    );
  });
}

/* วัดสิ่งที่ "ควรจะจริง" ของทุกหน้า — ถ้าค่าเพี้ยนให้สงสัยบั๊กที่มองไม่เห็นจาก HTML/CSS */
const MEASURE = `(() => {
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const slide = document.querySelector('img[src*="flavours-banner"], img[src*="mourning"], img[src*="promo"]');
  const card = document.querySelector("[data-hero-card-panel]");
  const hero = document.querySelector("main > section");
  return {
    viewport: { innerWidth: window.innerWidth, innerHeight: window.innerHeight },
    document: {
      clientWidth: document.documentElement.clientWidth,
      scrollbarGutter: getComputedStyle(document.documentElement).scrollbarGutter,
      htmlDisplay: getComputedStyle(document.documentElement).display,
    },
    attributes: {
      theme: document.documentElement.getAttribute("data-theme"),
      mourning: document.documentElement.getAttribute("data-mourning"),
      heroCard: document.documentElement.getAttribute("data-hero-card"),
      cookie: document.documentElement.getAttribute("data-cookie-consent"),
      reveal: document.documentElement.getAttribute("data-reveal"),
    },
    hero: box(hero),
    heroFirstImage: box(slide),
    heroImageRatio: slide ? +(slide.getBoundingClientRect().width / window.innerWidth).toFixed(3) : null,
    heroCard: { box: box(card), display: card ? getComputedStyle(card).display : null,
      rotate: card ? getComputedStyle(card).rotate : null,
      text: card ? card.textContent.trim().slice(0, 60) : null },
    bodyOverflow: getComputedStyle(document.body).overflow,
  };
})()`;

const target = await findTarget();
const cdp = await connect(target.webSocketDebuggerUrl);

await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: Number(width),
  height: Number(height),
  deviceScaleFactor: 1,
  mobile: Number(width) < 640,
});
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await sleep(3500); // รอ hydration + ภาพโหลด

const before = await cdp.send("Runtime.evaluate", { expression: MEASURE, returnByValue: true });
console.log("=== วัดครั้งแรก (ยังมีป๊อปอัพไว้อาลัย) ===");
console.log(JSON.stringify(before.result.value, null, 2));

// ซ่อนป๊อปอัพไว้อาลัย (จำลองว่าผู้ใช้กดปิดแล้ว) เพื่อดู hero/การ์ดได้ชัด
await cdp.send("Runtime.evaluate", {
  expression: `document.documentElement.setAttribute("data-mourning", "muted")`,
});
await sleep(900);

const after = await cdp.send("Runtime.evaluate", { expression: MEASURE, returnByValue: true });
console.log("=== วัดหลังซ่อนป๊อปอัพ ===");
console.log(JSON.stringify(after.result.value, null, 2));

// จอเล็ก: การ์ดอยู่ในเนื้อเรื่องของ hero (อาจต่ำกว่าขอบจอ) — เลื่อนให้เห็นก่อนถ่าย
await cdp.send("Runtime.evaluate", {
  expression: `(() => {
    const card = document.querySelector("[data-hero-card-panel]");
    if (!card) return;
    const r = card.getBoundingClientRect();
    if (r.bottom > window.innerHeight) window.scrollTo(0, window.scrollY + r.top - 120);
  })()`,
});
await sleep(800);

const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
writeFileSync(outPng, Buffer.from(shot.data, "base64"));
console.log("บันทึกภาพหน้าจอ:", outPng);

cdp.close();
chrome.kill();
