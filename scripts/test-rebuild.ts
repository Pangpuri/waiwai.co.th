import assert from "node:assert/strict";
import { test } from "node:test";

import {
  REBUILD_COMMAND_VAR,
  REBUILD_HOOK_URL_VAR,
  resolveRebuildMode,
  runRebuild,
} from "@/lib/rebuild";

/** เทสต์ตรรกะ "สั่งสร้างเว็บใหม่" — ผู้ใช้เลือกให้ตั้งค่าได้ทั้ง hook และคำสั่ง (เซสชั่น S1) */

test("rebuild: ไม่ตั้งค่าอะไร = โหมดทำมือ (ไม่เดา)", () => {
  assert.deepEqual(resolveRebuildMode({}), { kind: "manual" });
  assert.deepEqual(resolveRebuildMode({ [REBUILD_HOOK_URL_VAR]: "   " }), { kind: "manual" });
  assert.deepEqual(resolveRebuildMode({ [REBUILD_COMMAND_VAR]: "" }), { kind: "manual" });
});

test("rebuild: ตั้ง hook = ใช้ hook (ตัดช่องว่างหัวท้าย)", () => {
  const mode = resolveRebuildMode({ [REBUILD_HOOK_URL_VAR]: " https://example.test/hook " });
  assert.deepEqual(mode, { kind: "hook", url: "https://example.test/hook" });
});

test("rebuild: ตั้งคำสั่ง = ใช้คำสั่ง", () => {
  assert.deepEqual(resolveRebuildMode({ [REBUILD_COMMAND_VAR]: "npm run build" }), {
    kind: "command",
    command: "npm run build",
  });
});

test("rebuild: ตั้งทั้งสอง = hook มาก่อน (ตั้งใจใช้โฮสต์)", () => {
  const mode = resolveRebuildMode({
    [REBUILD_HOOK_URL_VAR]: "https://example.test/hook",
    [REBUILD_COMMAND_VAR]: "npm run build",
  });
  assert.equal(mode.kind, "hook");
});

test("rebuild: โหมดทำมือ = ไม่ยิงอะไรเลย", async () => {
  let called = false;
  const result = await runRebuild({
    mode: { kind: "manual" },
    fetchImpl: async () => {
      called = true;
      return new Response(null, { status: 200 });
    },
  });

  assert.deepEqual(result, { kind: "manual" });
  assert.equal(called, false, "ห้ามยิง hook เมื่อไม่มีค่า");
});

test("rebuild: hook สำเร็จ / hook ตอบไม่ใช่ 2xx / hook โยน error", async () => {
  const okResult = await runRebuild({
    mode: { kind: "hook", url: "https://example.test/hook" },
    fetchImpl: async () => new Response(null, { status: 201 }),
  });
  assert.deepEqual(okResult, { kind: "hook-triggered" });

  const badResult = await runRebuild({
    mode: { kind: "hook", url: "https://example.test/hook" },
    fetchImpl: async () => new Response(null, { status: 401 }),
  });
  assert.equal(badResult.kind, "failed");

  const thrown = await runRebuild({
    mode: { kind: "hook", url: "https://example.test/hook" },
    fetchImpl: async () => {
      throw new Error("boom https://example.test/hook?token=secret");
    },
  });
  assert.equal(thrown.kind, "failed");
  /* ข้อความที่คืนห้ามมี URL/โทเคนหลุดออกไป */
  assert.ok(thrown.kind === "failed" && !thrown.detail.includes("example.test"));
  assert.ok(thrown.kind === "failed" && !thrown.detail.includes("secret"));
});

test("rebuild: คำสั่งสำเร็จ = command-ok · ล้มเหลว = failed (และการเผยแพร่ไม่ล้มตาม)", async () => {
  const okResult = await runRebuild({
    mode: { kind: "command", command: "npm run build" },
    execImpl: async () => undefined,
  });
  assert.deepEqual(okResult, { kind: "command-ok" });

  const badResult = await runRebuild({
    mode: { kind: "command", command: "npm run build" },
    execImpl: async () => {
      throw new Error("exit 1");
    },
  });
  assert.equal(badResult.kind, "failed");
});
