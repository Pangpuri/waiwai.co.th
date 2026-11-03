import assert from "node:assert/strict";
import { test } from "node:test";

import { isUnresolvedConflict, latestVersionOf, versionValueOf } from "@/lib/blocks/version";

import { codeOf } from "./source-scan.ts";

/**
 * เทสต์ปิดหนี้รอบที่ 323 (D-323-1/D-323-2)
 *
 * ตรวจ "สายไฟ" ของ optimistic concurrency ที่ต้องครบทุกทางเขียน:
 * ตัวสร้างหน้าเว็บ · ส่วนกลางของเว็บ (navbar/footer/ป้าย) · พรีเซ็ต · ตัวย้ายรุ่นข้อมูล
 * และตรวจว่ากำหนดเวลาของหน้าเปล่ามีเตือน + ทางล้างบน /admin
 */

test("version helpers: เทียบ token ด้วย BigInt และไม่หลุดเมื่อค่าผิดรูป", () => {
  assert.equal(versionValueOf("1760000000000000"), BigInt("1760000000000000"));
  assert.equal(versionValueOf(""), null);
  assert.equal(versionValueOf("not-a-number"), null);
  assert.equal(versionValueOf(null), null);

  /* สตริงยาว 16 หลัก — Number จะปัดเศษได้ แต่ BigInt ต้องเลือกตัวมากกว่าถูก */
  assert.equal(latestVersionOf(["1760000000000001", "1760000000000000"]), "1760000000000001");
  assert.equal(latestVersionOf([null, "10", "not-a-number", "9"]), "10");
  assert.equal(latestVersionOf([null, undefined, "x"]), null);

  assert.equal(isUnresolvedConflict(null, "10"), false);
  assert.equal(isUnresolvedConflict({ version: "10", updatedAt: null, updatedBy: null }, "11"), false);
  assert.equal(isUnresolvedConflict({ version: "10", updatedAt: null, updatedBy: null }, "10"), true);
  assert.equal(isUnresolvedConflict({ version: "10", updatedAt: null, updatedBy: null }, null), true);
});

test("repository: ทางเขียนฉบับร่าง/เผยแพร่มี guarded path ครบทั้งบล็อกและ JSON", () => {
  const code = codeOf("lib/blocks/repository.ts");

  assert.ok(code.includes("saveDraftIfCurrent"), "ต้องมี guarded save ของเอกสารบล็อก");
  assert.ok(code.includes("saveJsonDraftIfCurrent"), "ต้องมี guarded save ของเอกสาร JSON (navbar/footer/ป้าย)");
  assert.ok(code.includes("publishJsonDraftIfCurrent"), "ต้องมี guarded publish ของเอกสาร JSON");
  assert.ok(code.includes("writeDraftIfCurrent"), "must share one guarded write path");
  assert.ok(
    code.includes("(extract(epoch from updated_at) * 1000000)::bigint::text"),
    "version token ต้องเป็น epoch ไมโครวินาที (ไม่ตัดเหลือมิลลิวินาที)",
  );
  assert.ok(code.includes("expectedVersion"), "guarded write ต้องรับ version ที่หน้าจอเห็น");
  assert.ok(code.includes("requireBlocks"), "publish ต้องแยกได้ว่าเอกสาร JSON ไม่ต้องมีบล็อก");
  assert.ok(code.includes('throw new Error("empty-document")'), "ห้ามเผยแพร่เอกสารบล็อกที่ว่าง");
  assert.ok(
    code.includes("expectedDraftVersion") && code.includes("replaceDocumentRaw(page, status, parsed.document, actor, expectedDraftVersion)"),
    "ตัวย้ายรุ่นข้อมูลต้องเขียนฉบับร่างแบบ guarded",
  );
});

test("ส่วนกลางของเว็บ: navbar/footer/ป้าย ต้องส่ง version และรับ conflict กลับมา", () => {
  for (const file of [
    "app/admin/builder/navbar/actions.ts",
    "app/admin/builder/footer/actions.ts",
    "app/admin/builder/mourning/actions.ts",
  ]) {
    const code = codeOf(file);
    assert.ok(code.includes("saveJsonDraftIfCurrent"), `${file}: save ต้อง guarded`);
    assert.ok(code.includes("publishJsonDraftIfCurrent"), `${file}: publish ต้อง guarded`);
    assert.ok(code.includes("expectedVersionOf(formData)"), `${file}: ต้องอ่าน version จากฟอร์ม`);
    assert.ok(code.includes('status: "conflict"'), `${file}: ต้องคืนสถานะ conflict`);
    assert.ok(!code.includes("await saveJsonDraft("), `${file}: ห้ามกลับไปใช้ save ที่ไม่ guard`);
    assert.ok(!code.includes("await publishDraft("), `${file}: ห้ามกลับไปใช้ publish ที่ไม่ guard`);
  }

  for (const file of [
    "features/admin/ui/navbar-editor.tsx",
    "features/admin/ui/footer-editor.tsx",
    "features/admin/ui/mourning-editor.tsx",
  ]) {
    const code = codeOf(file);
    assert.ok(code.includes("draftVersion"), `${file}: ต้องรับ version เริ่มต้นจากเซิร์ฟเวอร์`);
    assert.ok(code.includes('name="version"'), `${file}: ฟอร์มต้องส่ง version`);
    assert.ok(
      code.includes('latestVersionOf(['),
      `${file}: ต้องรวม version จากการบันทึก/เผยแพร่ล่าสุด`,
    );
    assert.ok(code.includes('status === "conflict"'), `${file}: ต้องแสดง/ปิดปุ่มเมื่อ conflict`);
  }

  const page = codeOf("app/admin/builder/chrome/page.tsx");
  assert.ok(page.includes("draftVersion={navbarDraftRow?.version"), "หน้าส่วนกลางต้องส่ง version ของ navbar");
  assert.ok(page.includes("draftVersion={footerDraftRow?.version"), "หน้าส่วนกลางต้องส่ง version ของ footer");
  assert.ok(page.includes("draftVersion={noticeDraftRow?.version"), "หน้าส่วนกลางต้องส่ง version ของป้าย");
  assert.ok(page.includes("draftVersion={footerDraftRow?.version"), "ต้องส่ง version ให้แผงพรีเซ็ตด้วย");
});

test("พรีเซ็ตของส่วนกลาง: apply/undo ต้องไม่เขียนทับ draft ที่ถูกแก้จากที่อื่น", () => {
  const repo = codeOf("lib/chrome/preset-repository.ts");
  assert.ok(repo.includes("saveJsonDraftIfCurrent"), "พรีเซ็ตต้องใช้ guarded save");
  assert.ok(repo.includes("expectedVersion"), "apply/undo ต้องรับ version");
  assert.ok(repo.includes('reason: "conflict"'), "ต้องคืน conflict ให้หน้าจอ");
  assert.ok(
    repo.indexOf("const saved = await saveJsonDraftIfCurrent") < repo.indexOf("insert into chrome_draft_undo"),
    "ต้องเขียนข้อมูลย้อนกลับหลัง guarded save สำเร็จเท่านั้น",
  );

  const actions = codeOf("app/admin/builder/chrome/preset-actions.ts");
  assert.ok(actions.includes("expectedVersion: expectedVersionOf(formData)"), "action ต้องส่ง version จากฟอร์ม");
  assert.ok(actions.includes('result.reason === "conflict" ? "conflict" : "invalid"'), "undo ต้องแมป conflict");

  const panel = codeOf("features/admin/ui/chrome-preset-panel.tsx");
  assert.ok(panel.includes('name="version"'), "ฟอร์มใช้ชุด/ย้อนกลับต้องมี hidden version");
  assert.ok(panel.includes("chromePresetConflict"), "แผงต้องมีข้อความ conflict จากพจนานุกรม");

  const state = codeOf("features/admin/chrome-preset-state.ts");
  assert.ok(state.includes('"conflict"'), "สถานะของแผงต้องมีรหัส conflict");
});

test("ตัวย้ายรุ่นข้อมูล: ต้องส่ง version ของฉบับร่างและไม่เขียนทับเมื่อ stale", () => {
  const actions = codeOf("app/admin/builder/actions.ts");
  assert.ok(
    actions.includes("migrateStoredDocuments(page, user.email, expectedVersion)"),
    "action ต้องส่ง version ที่หน้าจอเห็นให้ตัวย้าย",
  );
  assert.ok(actions.includes("if (!result.ok) return conflictState"), "ผล conflict ต้องไม่ถูกนับว่าย้ายสำเร็จ");

  const builder = codeOf("features/admin/ui/block-builder.tsx");
  assert.ok(
    builder.includes("migrateState.draftVersion"),
    "version หลังย้ายต้องเข้าระบบเพื่อไม่ให้ autosave ใช้ token เก่า",
  );
});

test("D-323-2: หน้าเปล่าที่ตั้งกำหนดไว้ต้องเตือนบน /admin และล้างกำหนดได้", () => {
  const scheduler = codeOf("lib/blocks/publish-scheduler.ts");
  assert.ok(scheduler.includes("ScheduledBlockedPage"), "overview ต้องมีชนิดข้อมูลหน้าที่ถูกบล็อก");
  assert.ok(scheduler.includes("countRawBlocks(draft.raw) === 0"), "ต้องตรวจฉบับร่างว่างจริง");
  assert.ok(scheduler.includes("blocked"), "overview ต้องส่ง blocked ให้หน้าจอ");

  const actions = codeOf("app/admin/actions.ts");
  assert.ok(actions.includes("clearScheduledPublishAction"), "ต้องมี action ล้างกำหนด");
  assert.ok(actions.includes("setPublishSchedule(page, null, user.email)"), "action ต้องล้างกำหนดจริง");
  assert.ok(actions.includes('action: "schedule-clear"'), "การล้างกำหนดต้องมี audit");
  assert.ok(actions.includes("isBlockBuilderPage(page)"), "ต้องจำกัด page ที่ล้างได้");

  const page = codeOf("app/admin/page.tsx");
  assert.ok(page.includes("schedule.blocked"), "การ์ดบน /admin ต้องอ่าน blocked");
  assert.ok(page.includes("clearScheduledPublishAction"), "การ์ดต้องมีปุ่มล้างกำหนด");
  assert.ok(page.includes("scheduleCardBlocked"), "การ์ดต้องมีข้อความเตือน");

  const audit = codeOf("lib/audit/log.ts");
  assert.ok(audit.includes('"schedule-clear"'), "ชนิด audit ต้องรองรับ schedule-clear");
  const labels = codeOf("features/admin/audit-labels.ts");
  assert.ok(labels.includes("auditScheduleClear"), "audit ต้องมีป้ายชื่อสองภาษา");

  const th = codeOf("lib/i18n/messages/areas/th/adminSchedule.ts");
  const en = codeOf("lib/i18n/messages/areas/en/adminSchedule.ts");
  for (const key of ["scheduleCardBlocked:", "scheduleCardBlockedHint:", "scheduleCardOpen:", "scheduleCardClear:", "auditScheduleClear:"]) {
    assert.ok(th.includes(key), `th ต้องมีคีย์ ${key}`);
    assert.ok(en.includes(key), `en ต้องมีคีย์ ${key}`);
  }
});
