import assert from "node:assert/strict";
import { test } from "node:test";

import { readEnvValue, mergeEnvText } from "@/lib/auth/env-file";

/** เทสต์ของตัวจัดการไฟล์ .env (ตรรกะบริสุทธิ์) */

test("env-file: อ่านค่าคีย์ที่มีอยู่ และคืน undefined ถ้าไม่มี/ถูกคอมเมนต์", () => {
  const text = ["# คอมเมนต์", "ADMIN_EMAIL=admin@waiwai.co.th", "", "  SPACED = hi  ", 'QUOTED="a b"'].join("\n");

  assert.equal(readEnvValue(text, "ADMIN_EMAIL"), "admin@waiwai.co.th");
  assert.equal(readEnvValue(text, "SPACED"), "hi");
  assert.equal(readEnvValue(text, "QUOTED"), "a b");
  assert.equal(readEnvValue(text, "NOT_THERE"), undefined);
  assert.equal(readEnvValue("# ADMIN_EMAIL=x", "ADMIN_EMAIL"), undefined, "บรรทัดคอมเมนต์ต้องไม่ถูกนับ");
});

test("env-file: เขียนไฟล์ใหม่จากศูนย์ได้", () => {
  const merged = mergeEnvText("", [
    { key: "ADMIN_EMAIL", value: "a@b.co.th" },
    { key: "SESSION_SECRET", value: "s" },
  ]);
  assert.equal(merged, "ADMIN_EMAIL=a@b.co.th\nSESSION_SECRET=s\n");
});

test("env-file: แทนที่ค่าคีย์เดิมโดยไม่แตะบรรทัดอื่นเลย", () => {
  const before = ["# ความเห็นของผู้ใช้", "ADMIN_EMAIL=old@x.th", "DATABASE_URL=postgres://keep-me", "", "OTHER=1"].join("\n");
  const after = mergeEnvText(before, [{ key: "ADMIN_EMAIL", value: "new@x.th" }]);

  assert.ok(after.includes("# ความเห็นของผู้ใช้"), "คอมเมนต์ต้องอยู่");
  assert.ok(after.includes("DATABASE_URL=postgres://keep-me"), "คีย์อื่นต้องอยู่และค่าเดิม");
  assert.ok(after.includes("OTHER=1"), "บรรทัดอื่นต้องอยู่");
  assert.ok(after.includes("ADMIN_EMAIL=new@x.th"));
  assert.ok(!after.includes("old@x.th"));
  assert.equal(after.split("\n").indexOf("ADMIN_EMAIL=new@x.th"), 1, "ต้องแทนที่ตรงตำแหน่งเดิม");
});

test("env-file: คีย์ใหม่ถูกต่อท้าย และไม่ซ้ำกับของเดิม", () => {
  const after = mergeEnvText("ADMIN_EMAIL=a@b.th\n", [
    { key: "ADMIN_EMAIL", value: "a@b.th" },
    { key: "SESSION_SECRET", value: "abc" },
  ]);
  assert.equal(after, "ADMIN_EMAIL=a@b.th\nSESSION_SECRET=abc\n");
});

test("env-file: ค่าที่มีอักขระพิเศษ ($ ขึ้นบรรทัด) ถูกเก็บตามจริง", () => {
  const hash = "scrypt$32768$8$1$salt$hash";
  const after = mergeEnvText("", [{ key: "ADMIN_PASSWORD_HASH", value: hash }]);
  assert.equal(readEnvValue(after, "ADMIN_PASSWORD_HASH"), hash);
});

test("env-file: คงสไตล์ CRLF ของไฟล์เดิมไว้", () => {
  const after = mergeEnvText("A=1\r\nB=2\r\n", [{ key: "B", value: "9" }]);
  assert.equal(after, "A=1\r\nB=9\r\n");
});

test("env-file: ไฟล์ที่ไม่มีบรรทัดว่างท้าย ต้องได้บรรทัดใหม่ต่อท้ายถูกต้อง", () => {
  const after = mergeEnvText("A=1", [{ key: "B", value: "2" }]);
  assert.equal(after, "A=1\nB=2\n");
});
