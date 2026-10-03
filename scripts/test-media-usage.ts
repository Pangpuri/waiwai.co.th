import assert from "node:assert/strict";
import { test } from "node:test";

import { containsMediaId, extractMediaPaths, mediaIdFromPath } from "@/lib/media/usage";

/** เทสต์การตรวจ "ภาพถูกใช้ที่ไหน" (X1.2) — ตรรกะล้วน ไม่ต้องมี DB */

test("mediaIdFromPath: อ่าน id จากพาธของเรา และปฏิเสธอย่างอื่น", () => {
  assert.equal(mediaIdFromPath("/media/abc123"), "abc123");
  assert.equal(mediaIdFromPath("  /media/abc123  "), "abc123");
  assert.equal(mediaIdFromPath("/media/abc123?v=2"), "abc123");
  assert.equal(mediaIdFromPath("/media/abc123#x"), "abc123");
  assert.equal(mediaIdFromPath("/media/"), null, "ไม่มี id = ไม่ใช่");
  assert.equal(mediaIdFromPath("https://cdn.test/media/abc"), null, "URL เต็มไม่นับ (มติ D9)");
  assert.equal(mediaIdFromPath("/products/a.jpg"), null, "พาธในโปรเจกต์แบบเก่าไม่นับ");
  assert.equal(mediaIdFromPath(""), null);
});

test("extractMediaPaths: เดินดู JSON ทุกชั้น (ออบเจ็กต์ · อาร์เรย์ · ซ้อนลึก)", () => {
  const document = {
    blocks: [
      { type: "hero", data: { image: "/media/aaa", alt: "ก" } },
      { type: "cards", cards: [{ image: "/media/bbb" }, { image: "/media/aaa" }] },
    ],
    logo: { path: "/media/ccc", altTh: "โลโก้" },
    note: "ข้อความทั่วไป",
    count: 3,
    empty: null,
  };

  const paths = extractMediaPaths(document);
  assert.deepEqual([...paths].sort(), ["/media/aaa", "/media/bbb", "/media/ccc"], "ไม่ซ้ำ และเก็บครบ");
});

test("containsMediaId: บอกได้ว่าก้อนนี้ใช้ภาพนั้นไหม", () => {
  const document = { image: "/media/xyz789" };
  assert.equal(containsMediaId(document, "xyz789"), true);
  assert.equal(containsMediaId(document, "other"), false);
  assert.equal(containsMediaId({ a: [1, true, null] }, "xyz789"), false, "ค่าที่ไม่ใช่สตริงต้องไม่ทำพัง");
});

test("extractMediaPaths: ไม่พังกับค่าที่ไม่ใช่ JSON ปรกติ", () => {
  assert.deepEqual(extractMediaPaths(null), []);
  assert.deepEqual(extractMediaPaths(undefined), []);
  assert.deepEqual(extractMediaPaths(42), []);
  assert.deepEqual(extractMediaPaths("/media/a"), ["/media/a"]);
});
