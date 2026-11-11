import assert from "node:assert/strict";
import { test } from "node:test";

import { planMediaSync } from "@/lib/db/media-sync";

test("media sync: หาภาพที่ปลายทางขาด + ไม่แตะภาพที่มีอยู่/ภาพเฉพาะปลายทาง", () => {
  const local = [
    { id: "a", sizeBytes: 10 },
    { id: "b", sizeBytes: 20 },
    { id: "c", sizeBytes: 30 },
  ];
  const target = [
    { id: "b", sizeBytes: 20 },
    { id: "cloud", sizeBytes: 99 },
  ];

  const plan = planMediaSync(local, target);
  assert.deepEqual(plan.missing.map((row) => row.id), ["a", "c"]);
  assert.equal(plan.missingBytes, 40);
  assert.deepEqual(plan.cloudOnly, ["cloud"]);
});

test("media sync: ปลายทางมีครบ = ไม่มีอะไรต้องคัดลอก", () => {
  const local = [{ id: "a", sizeBytes: 10 }];
  const plan = planMediaSync(local, [{ id: "a", sizeBytes: 10 }]);
  assert.deepEqual(plan.missing, []);
  assert.equal(plan.missingBytes, 0);
  assert.deepEqual(plan.cloudOnly, []);
});

test("media sync: local ว่าง/ปลายทางว่าง ไม่ throw", () => {
  assert.deepEqual(planMediaSync([], []), { missing: [], cloudOnly: [], missingBytes: 0 });
  assert.deepEqual(planMediaSync([], [{ id: "x", sizeBytes: 1 }]).cloudOnly, ["x"]);
  assert.deepEqual(planMediaSync([{ id: "x", sizeBytes: 1 }], []).missing.map((row) => row.id), ["x"]);
});
