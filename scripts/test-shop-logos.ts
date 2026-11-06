import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { defaultMarketplaceItems } from "@/lib/blocks/marketplace-links";
import { readImageInfo } from "@/lib/media/image-info";

import { codeOf } from "./source-scan.ts";

const ROOT = join(import.meta.dirname, "..");

function publicPathOf(path: string): string {
  return join(ROOT, "public", path.replace(/^\/+/, ""));
}

test("shop-logos: ค่าเริ่มต้นมี 7 ปุ่มจาก 5 แพลตฟอร์ม และไฟล์โลโก้เป็นภาพจริง", () => {
  const items = defaultMarketplaceItems();

  assert.equal(items.length, 7, "ต้องมี 7 ปุ่ม");
  assert.equal(new Set(items.map((item) => item.id)).size, 7, "id ต้องไม่ซ้ำ");
  assert.equal(items.filter((item) => item.logo !== null).length, 7, "ทุกปุ่มต้องมีโลโก้แพลตฟอร์ม");
  assert.equal(items.filter((item) => item.brand !== null).length, 4, "Shopee/Lazada แยกแบรนด์ = 4 ป้าย");

  const shopee = items.filter((item) => item.logo?.altTh === "Shopee");
  const lazada = items.filter((item) => item.logo?.altTh === "Lazada");
  assert.deepEqual(shopee.map((item) => item.label.th), ["Waiwai", "Serda"]);
  assert.deepEqual(lazada.map((item) => item.label.th), ["Waiwai", "Serda"]);

  for (const item of items) {
    assert.ok(item.label.th.trim() !== "" && item.label.en.trim() !== "", `${item.id}: ต้องมีข้อความใต้ปุ่ม TH/EN`);
    assert.ok(item.href.startsWith("https://"), `${item.id}: ลิงก์ร้านต้องเป็น https`);
    assert.equal(item.id === "lineShop", false, "LINE Shop ต้องถูกถอด");

    const logo = item.logo;
    assert.ok(logo !== null, `${item.id}: ต้องมีโลโก้แพลตฟอร์ม`);
    if (logo !== null) {
      assert.ok(logo.path.startsWith("/"), `${item.id}: พาธต้องขึ้นต้นด้วย /`);
      const bytes = readFileSync(publicPathOf(logo.path));
      const info = readImageInfo(bytes);
      assert.ok(info !== null, `${item.id}: ${logo.path} ต้องเป็น PNG/JPEG/WebP จริง`);
      assert.ok(logo.altTh.trim() !== "" && logo.altEn.trim() !== "", `${item.id}: ภาพต้องมี alt TH/EN`);
    }
  }
});

test("shop-logos: มีสคริปต์นำเข้าที่อัปเดตทั้ง draft และ published", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  assert.ok(
    pkg.scripts?.["shop-logos:import"]?.includes("scripts/import-shop-logos.ts"),
    "ต้องมี npm run shop-logos:import",
  );

  const script = codeOf("scripts/import-shop-logos.ts");
  for (const needle of [
    "ensureImportedMedia",
    "defaultMarketplaceItems",
    "loadDocumentRow",
    "replaceDocumentRaw",
    "draft",
    "published",
    "--dry-run",
    "prepareTargetRun",
  ]) {
    assert.ok(script.includes(needle), `สคริปต์นำเข้าต้องมี: ${needle}`);
  }
});

test("shop-logos: ไม่เหลือ LINE Shop ในค่าเริ่มต้น/พจนานุกรม/แหล่งลิงก์", () => {
  for (const path of ["lib/site.ts", "lib/i18n/messages/areas/th/home.ts", "lib/i18n/messages/areas/en/home.ts"]) {
    assert.equal(codeOf(path).includes("lineShop"), false, `${path}: ต้องไม่มี LINE Shop`);
  }
});
