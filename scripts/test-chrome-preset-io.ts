import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultFooterConfig } from "@/lib/chrome/footer";
import {
  CHROME_PRESET_EXPORT_FORMAT,
  CHROME_PRESET_EXPORT_VERSION,
  MAX_CHROME_PRESET_IMPORT,
  chromePresetPreview,
  parseChromePresetExport,
  serializeChromePresetExport,
  type ChromePreset,
} from "@/lib/chrome/presets";
import { defaultMourningConfig } from "@/lib/mourning/config";
import { defaultNavbarConfig } from "@/lib/chrome/navbar";
import { th } from "@/lib/i18n/messages/th";

/**
 * เทสต์ W3b ต่อ (รอบที่ 91) — "ดูตัวอย่างชุด" + "ส่งออก/นำเข้าชุด"
 *
 * จุดที่ต้องคุม
 * 1. **ตัวอย่างต้องมาจากเนื้อหาจริงของชุด** (ไม่ใช่ตัวเลขสรุป) และต้องเห็นครบทุกส่วน
 * 2. **ไฟล์ส่งออกต้องนำเข้ากลับได้เท่าเดิม** (ไปกลับได้ = สำรองใช้ได้จริง)
 * 3. **ไฟล์ที่ไม่เชื่อถือต้องไม่ทำให้ระบบเขียนข้อมูลเสีย** — รูปแบบผิด/เวอร์ชันใหม่กว่า = ปฏิเสธ
 *    · ชุดที่เสียปนมากับชุดที่ดี = ข้ามเฉพาะชุดนั้น (ไม่ทิ้งทั้งไฟล์)
 */

function preset(kind: "navbar" | "footer" | "mourning", name: string): ChromePreset {
  const payload =
    kind === "navbar"
      ? ({ kind: "navbar", config: defaultNavbarConfig(th) } as const)
      : kind === "footer"
        ? ({ kind: "footer", config: defaultFooterConfig(th) } as const)
        : ({ kind: "mourning", config: defaultMourningConfig(th) } as const);

  return {
    id: `preset_${kind}_${name}`,
    kind,
    name,
    payload,
    createdAt: "2026-10-03T00:00:00.000Z",
    updatedAt: "2026-10-03T00:00:00.000Z",
    createdBy: "owner@example.invalid",
  };
}

/* ── 1) ตัวอย่างชุด ─────────────────────────────────────────────────────────── */

test("chrome preset: ตัวอย่างของแถบเมนูเห็นทั้งเมนูและปุ่มจริง", () => {
  const config = defaultNavbarConfig(th);
  const rows = chromePresetPreview({ kind: "navbar", config });

  assert.equal(rows.length, config.items.length + config.buttons.length);
  assert.deepEqual(
    rows.map((row) => row.value),
    [...config.items.map((item) => item.href), ...config.buttons.map((button) => button.href)],
    "พาธต้องตรงกับของจริงในชุด",
  );
  assert.ok(rows.every((row) => row.label.trim() !== ""), "ทุกบรรทัดต้องมีป้ายให้อ่าน");
  assert.ok(rows.every((row) => row.group === null), "แถบเมนูไม่มีกลุ่ม");
});

test("chrome preset: ตัวอย่างของท้ายเว็บเห็นกลุ่ม/ลิงก์ และไอคอนโซเชียล", () => {
  const config = defaultFooterConfig(th);
  const rows = chromePresetPreview({ kind: "footer", config });
  const linkCount = config.groups.reduce((total, group) => total + group.links.length, 0);

  assert.equal(rows.length, linkCount + config.socials.length);
  assert.ok(rows.some((row) => row.group !== null), "ลิงก์ในกลุ่มต้องมีชื่อกลุ่มกำกับ");
  assert.ok(
    config.socials.every((social) => rows.some((row) => row.value === social.href)),
    "โซเชียลทุกตัวต้องอยู่ในตัวอย่าง",
  );
});

test("chrome preset: ตัวอย่างของป้ายประกาศเห็นภาพ (พาธ) และใช้ EN เมื่อไทยว่าง", () => {
  const base = defaultMourningConfig(th);
  const config = {
    ...base,
    images: [{ path: "/rip/notice.jpg", altTh: "", altEn: "Notice image", width: null, height: null }],
  };
  const rows = chromePresetPreview({ kind: "mourning", config });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.value, "/rip/notice.jpg");
  assert.equal(rows[0]?.label, "Notice image", "ไทยว่าง ⇒ ถอยไปใช้ EN");
});

/* ── 2) ส่งออก → นำเข้า (ไปกลับได้) ─────────────────────────────────────────── */

test("chrome preset: ไฟล์ส่งออกนำเข้ากลับได้เท่าเดิม", () => {
  const presets = [preset("navbar", "เมนูหลัก"), preset("footer", "ท้ายเว็บเดิม"), preset("mourning", "ป้ายเดิม")];
  const file = serializeChromePresetExport(presets, "2026-10-03T07:00:00.000Z");

  const parsed = JSON.parse(file) as Record<string, unknown>;
  assert.equal(parsed["format"], CHROME_PRESET_EXPORT_FORMAT);
  assert.equal(parsed["version"], CHROME_PRESET_EXPORT_VERSION);
  assert.equal(parsed["count"], 3);

  const back = parseChromePresetExport(file, th);
  assert.ok(back.ok);
  assert.equal(back.skipped, 0);
  assert.deepEqual(
    back.presets.map((entry) => [entry.kind, entry.name]),
    [
      ["navbar", "เมนูหลัก"],
      ["footer", "ท้ายเว็บเดิม"],
      ["mourning", "ป้ายเดิม"],
    ],
  );
});

test("chrome preset: นำเข้าไฟล์ที่ว่างเปล่าไม่ได้ (ไม่มีชุดเลย)", () => {
  const empty = JSON.stringify({ format: CHROME_PRESET_EXPORT_FORMAT, version: 1, count: 0, presets: [] });
  const parsed = parseChromePresetExport(empty, th);

  assert.equal(parsed.ok, false);
  assert.ok(!parsed.ok);
  assert.equal(parsed.reason, "empty");
});

/* ── 3) ไฟล์ที่ไม่เชื่อถือ ──────────────────────────────────────────────────── */

test("chrome preset: ไฟล์ที่ไม่ใช่ JSON / ไม่ใช่ไฟล์ของเว็บนี้ / เวอร์ชันใหม่กว่า = ปฏิเสธ", () => {
  const bad = parseChromePresetExport("{ not json", th);
  assert.ok(!bad.ok);
  assert.equal(bad.reason, "bad-json");

  const wrongFormat = parseChromePresetExport(
    JSON.stringify({ format: "some-other-tool", version: 1, presets: [{ kind: "navbar", name: "x", config: {} }] }),
    th,
  );
  assert.ok(!wrongFormat.ok);
  assert.equal(wrongFormat.reason, "bad-format");

  const future = parseChromePresetExport(
    JSON.stringify({
      format: CHROME_PRESET_EXPORT_FORMAT,
      version: CHROME_PRESET_EXPORT_VERSION + 1,
      presets: [{ kind: "navbar", name: "x", config: defaultNavbarConfig(th) }],
    }),
    th,
  );
  assert.ok(!future.ok);
  assert.equal(future.reason, "bad-format", "ไฟล์จากรุ่นใหม่กว่า = ไม่เดา");
});

test("chrome preset: ชุดที่เสียถูกข้าม (ชุดที่ดีในไฟล์เดียวกันยังเข้าได้)", () => {
  const good = preset("navbar", "เมนูหลัก");
  const file = JSON.stringify({
    format: CHROME_PRESET_EXPORT_FORMAT,
    version: CHROME_PRESET_EXPORT_VERSION,
    presets: [
      { kind: "navbar", name: "เมนูหลัก", config: good.payload.config },
      { kind: "sidebar", name: "ส่วนที่ไม่มี", config: {} },
      { kind: "footer", name: "   ", config: {} },
      { kind: "mourning", name: "ป้ายพัง", config: { enabled: "yes" } },
    ],
  });

  const parsed = parseChromePresetExport(file, th);
  assert.ok(parsed.ok);
  assert.equal(parsed.presets.length, 1);
  assert.equal(parsed.skipped, 3);
  assert.equal(parsed.presets[0]?.name, "เมนูหลัก");
});

test("chrome preset: ไฟล์ที่มีชุดเกินเพดาน = ปฏิเสธทั้งไฟล์ (ไม่ทำครึ่ง ๆ กลาง ๆ)", () => {
  const config = defaultNavbarConfig(th);
  const presets = Array.from({ length: MAX_CHROME_PRESET_IMPORT + 1 }, (_unused, index) => ({
    kind: "navbar",
    name: `ชุด ${index}`,
    config,
  }));

  const parsed = parseChromePresetExport(
    JSON.stringify({ format: CHROME_PRESET_EXPORT_FORMAT, version: CHROME_PRESET_EXPORT_VERSION, presets }),
    th,
  );
  assert.ok(!parsed.ok);
  assert.equal(parsed.reason, "too-many");
});
