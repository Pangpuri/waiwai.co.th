import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

import {
  PREVIEW_NAVIGATION_GUARD_ATTRIBUTE,
  installPreviewNavigationGuard,
  installPreviewNavigationGuardInWindow,
  shouldBlockPreviewNavigation,
} from "@/features/admin/ui/preview-navigation";
import { REPO_ROOT, codeOf, stripComments } from "./source-scan.ts";

/**
 * เทสต์รอบที่ 325 — "ลิงก์ในพรีวิวห้ามพา iframe เปลี่ยนหน้า"
 *
 * ที่มา (คำเจ้าของ): *"ในจอ liveview … ลิงค์ดันทำงานด้วยหากกดผิดหรือไปโดน
 * ในนั้นหน้าของมันก็จะถูกเปลี่ยนตาม … มีการแก้ไขส่วนนั้นโดยไม่กระทบหน้าบ้านไหม"*
 *
 * ด่านนี้คุม 3 ชั้น
 * 1. ตรรกะตัดสิน (pure): `#anchor` ปล่อย · ลิงก์นอก/ฟอร์ม/`javascript:` บล็อก
 * 2. ตัวติดตั้งทำงานจริงบนเอกสารจำลอง: click/auxclick/submit ถูกดัก · ติดซ้ำไม่ซ้ำ listener
 * 3. สายไฟ: ทั้ง 2 จอที่ฝัง iframe พรีวิว + ตัวดักในเอกสารพรีวิวเอง และ **ไม่มีหน้าบ้านสาธารณะ import ตัวนี้**
 */

/* ── 1) ตรรกะตัดสิน ─────────────────────────────────────────────────────────── */

test("preview-nav: ปล่อยเฉพาะลิงก์เลื่อนในหน้า (#...) และลิงก์ที่ไม่มี href", () => {
  assert.equal(shouldBlockPreviewNavigation(null), false, "ไม่มี href = ไม่ใช่นavigation");
  assert.equal(shouldBlockPreviewNavigation("#"), false);
  assert.equal(shouldBlockPreviewNavigation("#section-2"), false);
  assert.equal(shouldBlockPreviewNavigation("  #section-2  "), false, "ตัดช่องว่างหัวท้ายก่อนตัดสิน");
});

test("preview-nav: ลิงก์ที่จะเปลี่ยนหน้า/เปิดแอป/ยิงสคริปต์ต้องถูกบล็อกทั้งหมด", () => {
  const blocked = [
    "",
    "   ",
    "/th/about",
    "/en",
    "about",
    "./contact",
    "?page=2",
    "https://waiwai.co.th/th",
    "//example.test/x",
    "mailto:hr@waiwai.co.th",
    "tel:+6620000000",
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
  ];
  for (const href of blocked) {
    assert.equal(shouldBlockPreviewNavigation(href), true, `"${href}" ต้องถูกบล็อก`);
  }
});

/* ── 2) ตัวติดตั้งบนเอกสารจำลอง (ไม่ต้องมีเบราว์เซอร์) ───────────────────────── */

type RegisteredListener = { readonly listener: EventListener; readonly capture: boolean };

class FakeElementNode {
  private readonly anchor: FakeElementNode | null;
  private readonly href: string | null;

  constructor(anchor: FakeElementNode | null = null, href: string | null = null) {
    this.anchor = anchor;
    this.href = href;
  }

  closest(selector: string): FakeElementNode | null {
    return selector === "a[href]" ? this.anchor : null;
  }

  getAttribute(name: string): string | null {
    return name === "href" ? this.href : null;
  }
}

class FakeEvent {
  readonly target: unknown;
  defaultPrevented = false;

  constructor(target: unknown) {
    this.target = target;
  }

  preventDefault(): void {
    this.defaultPrevented = true;
  }
}

type FakeWindow = {
  document: FakeDocument;
  Element: typeof FakeElementNode;
  addEventListener: (type: string, listener: EventListener, capture?: boolean) => void;
};

type FakeDocument = {
  defaultView: FakeWindow | null;
  documentElement: { setAttribute: (name: string, value: string) => void };
  addEventListener: (type: string, listener: EventListener, capture?: boolean) => void;
};

function createFakeFrame(): {
  readonly frame: HTMLIFrameElement;
  readonly attributes: Map<string, string>;
  readonly windowListeners: Map<string, RegisteredListener[]>;
  readonly documentListeners: Map<string, RegisteredListener[]>;
  readonly replaceDocument: () => void;
  readonly fireWindow: (type: string, target: FakeElementNode) => FakeEvent;
  readonly fireDocument: (type: string, target: FakeElementNode) => FakeEvent;
} {
  const attributes = new Map<string, string>();
  const windowListeners = new Map<string, RegisteredListener[]>();
  const documentListeners = new Map<string, RegisteredListener[]>();

  const addTo = (map: Map<string, RegisteredListener[]>) => (type: string, listener: EventListener, capture = false) => {
    const bucket = map.get(type) ?? [];
    bucket.push({ listener, capture });
    map.set(type, bucket);
  };

  const fakeWindow: FakeWindow = {
    document: {
      defaultView: null,
      documentElement: {
        setAttribute: (name: string, value: string) => attributes.set(name, value),
      },
      addEventListener: addTo(documentListeners),
    },
    Element: FakeElementNode,
    addEventListener: addTo(windowListeners),
  };

  const buildDocument = (): FakeDocument => ({
    defaultView: fakeWindow,
    documentElement: {
      setAttribute: (name: string, value: string) => attributes.set(name, value),
    },
    addEventListener: addTo(documentListeners),
  });

  fakeWindow.document = buildDocument();

  const frame = { contentWindow: fakeWindow } as unknown as HTMLIFrameElement;

  const fire = (map: Map<string, RegisteredListener[]>, type: string, target: FakeElementNode): FakeEvent => {
    const event = new FakeEvent(target);
    for (const entry of map.get(type) ?? []) entry.listener(event as unknown as Event);
    return event;
  };

  return {
    frame,
    attributes,
    windowListeners,
    documentListeners,
    replaceDocument: () => {
      fakeWindow.document = buildDocument();
    },
    fireWindow: (type, target) => fire(windowListeners, type, target),
    fireDocument: (type, target) => fire(documentListeners, type, target),
  };
}

test("preview-nav: คลิก/คลิกกลางบนลิงก์นอกถูก preventDefault แต่คลิกเลือกบล็อกยังไหลต่อ", () => {
  const fake = createFakeFrame();
  assert.equal(installPreviewNavigationGuard(fake.frame), true);
  assert.equal(fake.attributes.get(PREVIEW_NAVIGATION_GUARD_ATTRIBUTE), "1", "ต้องติดแอตทริบิวต์ไว้ตรวจ");

  const externalAnchor = new FakeElementNode(null, "/th/about");
  const click = fake.fireWindow("click", new FakeElementNode(externalAnchor));
  assert.equal(click.defaultPrevented, true, "ลิงก์นอกต้องไม่นำทาง");

  const externalAnchorAgain = new FakeElementNode(null, "https://example.test/x");
  const auxclick = fake.fireWindow("auxclick", new FakeElementNode(externalAnchorAgain));
  assert.equal(auxclick.defaultPrevented, true, "คลิกกลางก็ต้องไม่เปิดแท็บใหม่");

  const hashAnchor = new FakeElementNode(null, "#section");
  const hashClick = fake.fireWindow("click", new FakeElementNode(hashAnchor));
  assert.equal(hashClick.defaultPrevented, false, "ลิงก์ในหน้าเดิมต้องทำงาน");

  const plain = fake.fireWindow("click", new FakeElementNode());
  assert.equal(plain.defaultPrevented, false, "คลิกที่ไม่ใช่ลิงก์ต้องไหลต่อไปให้ตัวเลือกบล็อก");
});

test("preview-nav: listener ติดตั้งแบบ capture · ติดซ้ำบนเอกสารเดิมไม่เพิ่มซ้ำ · เอกสารใหม่ติดใหม่", () => {
  const fake = createFakeFrame();
  installPreviewNavigationGuard(fake.frame);

  for (const type of ["click", "auxclick"]) {
    const listeners = fake.windowListeners.get(type) ?? [];
    assert.equal(listeners.length, 1, `${type}: ต้องมี listener เดียว`);
    assert.equal(listeners[0]?.capture, true, `${type}: ต้องเป็น capture เพื่อดักก่อน React Link`);
  }
  assert.equal((fake.documentListeners.get("submit") ?? []).length, 1);

  /* เรียกซ้ำเพราะ React onLoad ยิงซ้ำได้ — ต้องไม่เพิ่ม listener บนเอกสารเดิม */
  installPreviewNavigationGuard(fake.frame);
  assert.equal((fake.windowListeners.get("click") ?? []).length, 1, "ห้ามติดซ้ำ");
  assert.equal((fake.documentListeners.get("submit") ?? []).length, 1, "ห้ามติดซ้ำ");

  /*
    จำลองการนำทางเต็มหน้า: เอกสารใหม่ = listener เก่าหาย ⇒ ต้องติดตั้งชุดใหม่ให้เอกสารใหม่
    (Window proxy ตัวเดิมถูกใช้ซ้ำข้ามการนำทาง จึงใช้ Document เป็นกุญแจ)
  */
  fake.replaceDocument();
  installPreviewNavigationGuard(fake.frame);
  assert.equal((fake.documentListeners.get("submit") ?? []).length, 2, "เอกสารใหม่ต้องได้ listener ของตัวเอง");
});

test("preview-nav: ฟอร์มในพรีวิวถูกกัน submit · กรอบที่ยังไม่พร้อม/ต่างโดเมนไม่ทำให้หน้าจอล้ม", () => {
  const fake = createFakeFrame();
  installPreviewNavigationGuard(fake.frame);
  const submit = fake.fireDocument("submit", new FakeElementNode());
  assert.equal(submit.defaultPrevented, true, "พรีวิวห้ามยิงฟอร์มเข้าฐานข้อมูลจริง");

  assert.equal(installPreviewNavigationGuard(null), false, "ไม่มี iframe = ไม่ทำอะไร");
  assert.equal(
    installPreviewNavigationGuard({ contentWindow: null } as unknown as HTMLIFrameElement),
    false,
    "ยังไม่มี contentWindow = ไม่ทำอะไร",
  );

  const crossOriginWindow = {
    get document(): never {
      throw new Error("SecurityError");
    },
  };
  assert.equal(
    installPreviewNavigationGuard({ contentWindow: crossOriginWindow } as unknown as HTMLIFrameElement),
    false,
    "อ่านเอกสารไม่ได้ต้องคืน false ไม่โยน error",
  );
});

test("preview-nav: ติดตั้งจากในเอกสารพรีวิวเองได้ (window ตรง ๆ) — กันแพ้การแข่งเวลา hydrate", () => {
  const fake = createFakeFrame();
  assert.equal(installPreviewNavigationGuardInWindow(fake.frame.contentWindow), true);
  assert.equal(fake.attributes.get(PREVIEW_NAVIGATION_GUARD_ATTRIBUTE), "1");

  const click = fake.fireWindow("click", new FakeElementNode(new FakeElementNode(null, "/th/about")));
  assert.equal(click.defaultPrevented, true, "แม้ติดจากในพรีวิวเองก็ต้องดักลิงก์");
  assert.equal(installPreviewNavigationGuardInWindow(null), false, "ไม่มี window = ไม่ทำอะไร");
});

/* ── 3) สายไฟ + ขอบเขต (ต้องไม่แตะหน้าบ้าน) ─────────────────────────────────── */

test("preview-nav: ตัวสร้างหน้าเว็บติดตัวดักทั้งสองขนาด iframe ตอน load", () => {
  const builder = codeOf("features/admin/ui/block-builder.tsx");

  assert.ok(builder.includes('from "@/features/admin/ui/preview-navigation"'), "ต้อง import ตัวดัก");
  assert.ok(builder.includes("installPreviewNavigationGuard(frameRef.current)"), "ต้องติดตั้งจาก ref ของ iframe");
  assert.equal((builder.match(/onLoad=\{onFrameLoad\}/g) ?? []).length, 2, "iframe ทั้งโหมดปกติ/เต็มจอต้องใช้ handler เดียวกัน");
  assert.ok(!builder.includes("onLoad={postToFrame}"), "ห้ามกลับไปผูก onLoad กับ postToFrame ตรง ๆ (จะไม่มีตัวดัก)");
  assert.ok(
    /useEffect\(\(\) => \{\s*installPreviewNavigationGuard\(frameRef\.current\);/.test(builder),
    "ต้องติดตั้งซ้ำหลัง mount — iframe อาจโหลดเสร็จก่อน React hydrate",
  );
});

test("preview-nav: จอ 'ส่วนกลางของเว็บ' ติดตัวดักก่อนส่งค่าสดเข้า iframe", () => {
  const chrome = codeOf("features/admin/ui/chrome-workspace.tsx");

  assert.ok(chrome.includes('from "@/features/admin/ui/preview-navigation"'), "ต้อง import ตัวดัก");
  assert.ok(
    /onLoad=\{\(\) => \{[\s\S]{0,240}installPreviewNavigationGuard\(frameRef\.current\)[\s\S]{0,240}postLiveValues\(\)/.test(chrome),
    "ต้องติดตั้งตัวดักใน onLoad ก่อน postLiveValues",
  );
  assert.ok(
    /useEffect\(\(\) => \{\s*installPreviewNavigationGuard\(frameRef\.current\);/.test(chrome),
    "ต้องติดตั้งซ้ำหลัง mount — iframe อาจโหลดเสร็จก่อน React hydrate",
  );
});

test("preview-nav: หน้า /preview ติดตัวดักจากในเอกสารเองด้วย ไม่พึ่ง onLoad ของแม่", () => {
  const previewPage = codeOf("app/[lang]/preview/[page]/page.tsx");
  assert.ok(
    previewPage.includes('from "@/features/admin/ui/preview-navigation-guard"'),
    "หน้าพรีวิวต้อง import ตัวดักในเอกสาร",
  );
  assert.ok(previewPage.includes("<PreviewNavigationGuard />"), "ต้องเรนเดอร์ตัวดักในทุกโหมดพรีวิว");

  const component = codeOf("features/admin/ui/preview-navigation-guard.tsx");
  assert.ok(component.includes("window.parent === window"), "เปิดตรง ๆ ในแท็บใหม่ต้องไม่ดัก");
  assert.ok(
    component.includes("installPreviewNavigationGuardInWindow(window)"),
    "ต้องติดตั้งบน window ของเอกสารพรีวิวเอง",
  );
});

test("preview-nav: ใช้เฉพาะหลังบ้าน + หน้าพรีวิวที่ต้องล็อกอิน — หน้าบ้านสาธารณะไม่ import", () => {
  const files = [...sourceFilesUnder("features"), ...sourceFilesUnder("app")];
  const users = files
    .filter((file) => stripComments(readFileSync(file, "utf8")).includes("preview-navigation"))
    .map((file) => relative(REPO_ROOT, file).replaceAll("\\", "/"))
    .sort();

  assert.deepEqual(users, [
    "app/[lang]/preview/[page]/page.tsx",
    "features/admin/ui/block-builder.tsx",
    "features/admin/ui/chrome-workspace.tsx",
    "features/admin/ui/preview-navigation-guard.tsx",
  ]);
});

function sourceFilesUnder(relativeDir: string): readonly string[] {
  const root = join(REPO_ROOT, relativeDir);
  const found: string[] = [];

  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) found.push(fullPath);
    }
  };

  walk(root);
  return found;
}
