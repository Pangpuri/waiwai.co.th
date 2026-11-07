import assert from "node:assert/strict";
import { test } from "node:test";

import { COOKIE_BANNER_DEFER_ATTRIBUTE, COOKIE_CONSENT_ATTRIBUTE } from "@/lib/cookie-consent";
import {
  DOCUMENT_STATE_ATTRIBUTES,
  applyDocumentState,
  readDocumentState,
  type DocumentState,
} from "@/lib/document-state";
import { HERO_CARD_ATTRIBUTE } from "@/lib/hero-card";
import { MOURNING_ATTRIBUTE, MOURNING_STATE_SHOWN } from "@/lib/mourning-notice";
import { REVEAL_ATTRIBUTE } from "@/lib/scroll-reveal";

import { readStrippedCss } from "./css-source.ts";
import { codeOf } from "./source-scan.ts";

/**
 * ตรวจกลไก "กู้คืน attribute บน <html> หลังสลับภาษา" (รอบ 335)
 *
 * บั๊กจริงที่ปิด: app/[lang]/layout.tsx เป็น root layout ที่ผูกกับ [lang]
 * ⇒ /th → /en ทำให้ document element ใหม่ และ attribute ที่สคริปต์ก่อน paint ตั้งไว้หายทั้งหมด
 * ⇒ ผู้ใช้ที่กดยอมรับคุกกี้แล้วเห็นแถบคุกกี้เด้งกลับมาให้กดซ้ำ
 */

type FakeRoot = {
  readonly attributes: Map<string, string>;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};

function fakeRoot(initial: Record<string, string> = {}): FakeRoot {
  const attributes = new Map(Object.entries(initial));
  return {
    attributes,
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, value) => {
      attributes.set(name, value);
    },
    removeAttribute: (name) => {
      attributes.delete(name);
    },
  };
}

test("DOCUMENT_STATE_ATTRIBUTES: ครบทุก attribute ที่สคริปต์ก่อน paint ใช้ และไม่ปนของหน้าพรีวิว", () => {
  assert.deepEqual(
    [...DOCUMENT_STATE_ATTRIBUTES],
    [COOKIE_CONSENT_ATTRIBUTE, HERO_CARD_ATTRIBUTE, MOURNING_ATTRIBUTE, REVEAL_ATTRIBUTE],
  );
  const attributes: readonly string[] = DOCUMENT_STATE_ATTRIBUTES;
  assert.ok(!attributes.includes("data-preview-chrome"));
  assert.ok(!attributes.includes("data-preview-parts"));
});

test("readDocumentState: ค่าที่มีอยู่ต้องถูกอ่านครบ และค่าที่ไม่มีต้องเป็น null", () => {
  const root = fakeRoot({
    [COOKIE_CONSENT_ATTRIBUTE]: "all",
    [MOURNING_ATTRIBUTE]: MOURNING_STATE_SHOWN,
  });

  assert.deepEqual(readDocumentState(root), {
    [COOKIE_CONSENT_ATTRIBUTE]: "all",
    [HERO_CARD_ATTRIBUTE]: null,
    [MOURNING_ATTRIBUTE]: MOURNING_STATE_SHOWN,
    [REVEAL_ATTRIBUTE]: null,
  });
});

test("applyDocumentState: เขียนค่ากลับครบ และลบ attribute ที่ snapshot บอกว่าไม่มี", () => {
  const root = fakeRoot({
    [COOKIE_CONSENT_ATTRIBUTE]: "essential",
    [HERO_CARD_ATTRIBUTE]: "shown",
    [MOURNING_ATTRIBUTE]: MOURNING_STATE_SHOWN,
    [REVEAL_ATTRIBUTE]: "ready",
  });

  applyDocumentState(root, {
    [COOKIE_CONSENT_ATTRIBUTE]: "all",
    [HERO_CARD_ATTRIBUTE]: null,
    [MOURNING_ATTRIBUTE]: "muted",
    [REVEAL_ATTRIBUTE]: "ready",
  });

  assert.deepEqual(Object.fromEntries(root.attributes), {
    [COOKIE_CONSENT_ATTRIBUTE]: "all",
    [MOURNING_ATTRIBUTE]: "muted",
    [REVEAL_ATTRIBUTE]: "ready",
  });
});

test("applyDocumentState: snapshot ที่ไม่มีคีย์ต้องไม่ทำให้ค่าค้างจากรอบก่อน", () => {
  const root = fakeRoot({
    [COOKIE_CONSENT_ATTRIBUTE]: "all",
    [MOURNING_ATTRIBUTE]: MOURNING_STATE_SHOWN,
  });

  applyDocumentState(root, {} as DocumentState);

  assert.equal(root.attributes.size, 0);
});

test("applyDocumentState: ค่าว่าง (empty string) ต้องถูกเขียน ไม่ใช่ถูกลบ", () => {
  const root = fakeRoot();

  applyDocumentState(root, { [COOKIE_CONSENT_ATTRIBUTE]: "" });

  assert.equal(root.getAttribute(COOKIE_CONSENT_ATTRIBUTE), "");
});

test("layout: ต้องติดตั้ง DocumentStateSync และส่งสถานะป้ายประกาศให้แถบคุกกี้", () => {
  const layout = codeOf("app/[lang]/layout.tsx");

  assert.ok(layout.includes("<DocumentStateSync />"), "layout ต้องเรนเดอร์ DocumentStateSync");
  assert.ok(
    layout.includes("deferWhileMourningOpen={showsMourningNotice}"),
    "ต้องส่ง deferWhileMourningOpen ตามสถานะป้ายประกาศจริง",
  );
  assert.ok(
    layout.includes("const showsMourningNotice = mourningNotice.enabled && mourningNotice.images.length > 0;"),
    "ต้องคำนวณ showsMourningNotice จากป้ายที่แสดงจริง",
  );
});

test("CookieBanner: ต้องมี attribute เลื่อนแถบ และ CSS ต้องซ่อนขณะป้ายประกาศเปิด", async () => {
  const banner = codeOf("features/shell/ui/cookie-banner.tsx");
  assert.ok(banner.includes("COOKIE_BANNER_DEFER_ATTRIBUTE"));
  assert.ok(banner.includes("deferWhileMourningOpen"));

  const css = await readStrippedCss();
  const rule = `html[${MOURNING_ATTRIBUTE}="${MOURNING_STATE_SHOWN}"] [data-cookie-banner][${COOKIE_BANNER_DEFER_ATTRIBUTE}]`;
  assert.ok(css.includes(rule), `globals.css ต้องมีกฎ ${rule}`);
});
