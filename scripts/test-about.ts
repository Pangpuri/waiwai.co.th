import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ABOUT_FACTS,
  AWARD_ITEM_IDS,
  CERTIFICATE_IDS,
  DIRECTION_ORDER,
  EXPLORE_LINKS,
  FACILITY_STATS,
  MISSION_ITEM_IDS,
  SITES,
  TIMELINE_ENTRIES,
  sortTimelineByYear,
  visibleTimeline,
  type TimelineEntry,
} from "@/features/about/content";
import { isDisplayableYear } from "@/lib/format";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";

test("sortTimelineByYear: เรียงจากอดีตไปปัจจุบัน", () => {
  const entries: TimelineEntry[] = [
    { id: "bronzeAward", year: 2005 },
    { id: "founded", year: 1972 },
    { id: "badAward", year: 2001 },
  ];

  assert.deepEqual(
    sortTimelineByYear(entries).map((entry) => entry.year),
    [1972, 2001, 2005],
  );
});

test("sortTimelineByYear: ไม่แก้ array ต้นทาง (ผู้เรียกอาจส่งค่าที่เป็น readonly)", () => {
  const entries: TimelineEntry[] = [
    { id: "bronzeAward", year: 2005 },
    { id: "founded", year: 1972 },
  ];
  const before = [...entries];

  sortTimelineByYear(entries);

  assert.deepEqual(entries, before);
});

test("sortTimelineByYear: ปีเท่ากันต้องคงลำดับเดิม", () => {
  const entries: TimelineEntry[] = [
    { id: "badAward", year: 2001 },
    { id: "primeMinisterExport", year: 2001 },
  ];

  assert.deepEqual(
    sortTimelineByYear(entries).map((entry) => entry.id),
    ["badAward", "primeMinisterExport"],
  );
});

test("sortTimelineByYear: รายการว่างต้องคืน array ว่าง", () => {
  assert.deepEqual(sortTimelineByYear([]), []);
});

test("visibleTimeline: ปีที่แสดงไม่ได้ต้องถูกตัดออก ไม่ทำให้หน้าพัง", () => {
  const entries: TimelineEntry[] = [
    { id: "founded", year: Number.NaN },
    { id: "primeMinisterExport", year: 0 },
    { id: "badAward", year: -1997 },
    { id: "bronzeAward", year: 12345 },
    { id: "founded", year: 1972 },
  ];

  assert.deepEqual(
    visibleTimeline(entries).map((entry) => entry.id),
    ["founded"],
  );
});

test("visibleTimeline: รายการว่างต้องไม่ทำให้ผู้เรียกต้องเช็คซ้ำ", () => {
  assert.deepEqual(visibleTimeline([]), []);
});

test("TIMELINE_ENTRIES: ทุกปีแสดงได้ และทุก id มีข้อความครบทั้งสองภาษา", () => {
  for (const entry of TIMELINE_ENTRIES) {
    assert.ok(isDisplayableYear(entry.year), `${entry.id}: ปี ${entry.year} แสดงไม่ได้`);

    for (const [locale, messages] of [
      ["th", th],
      ["en", en],
    ] as const) {
      const item = messages.about.story.timeline[entry.id];
      assert.ok(item.title.length > 0, `${locale} ขาดหัวข้อ ${entry.id}`);
      assert.ok(item.description.length > 0, `${locale} ขาดคำอธิบาย ${entry.id}`);
    }
  }
});

test("TIMELINE_ENTRIES: เรียงจากอดีตไปปัจจุบันอยู่แล้ว ไม่ต้องพึ่งการ sort ตอนเรนเดอร์", () => {
  assert.deepEqual(visibleTimeline(TIMELINE_ENTRIES), [...TIMELINE_ENTRIES]);
});

test("ABOUT_FACTS: id มีอยู่จริง ป้ายไม่ว่าง และปีที่คำนวณได้ต้องแสดงได้", () => {
  for (const fact of ABOUT_FACTS) {
    for (const [locale, messages] of [
      ["th", th],
      ["en", en],
    ] as const) {
      assert.ok(messages.about.facts[fact.id].label.length > 0, `${locale} ขาดป้าย ${fact.id}`);
    }

    if (fact.year !== undefined) {
      assert.ok(isDisplayableYear(fact.year), `${fact.id}: ปี ${fact.year} แสดงไม่ได้`);
    }
  }
});

test("DIRECTION_ORDER: ชี้คีย์ที่มีอยู่จริงในพจนานุกรมทั้งสองภาษา", () => {
  for (const id of DIRECTION_ORDER) {
    assert.ok(th.about.direction[id].title.length > 0, `th ขาด ${id}`);
    assert.ok(en.about.direction[id].title.length > 0, `en ขาด ${id}`);
  }
});

test("MISSION_ITEM_IDS: มีพันธกิจครบตามเอกสาร และ id มีจริงทั้งสองภาษา", () => {
  assert.equal(MISSION_ITEM_IDS.length, 11);

  for (const id of MISSION_ITEM_IDS) {
    assert.ok(th.about.direction.mission.items[id].length > 0, `th ขาดพันธกิจ ${id}`);
    assert.ok(en.about.direction.mission.items[id].length > 0, `en ขาดพันธกิจ ${id}`);
  }
});

test("FACILITY_STATS / SITES: id มีจริงและข้อความไม่ว่างทั้งสองภาษา", () => {
  for (const id of FACILITY_STATS) {
    for (const [locale, messages] of [
      ["th", th],
      ["en", en],
    ] as const) {
      const stat = messages.about.facilities.stats[id];
      assert.ok(stat.label.length > 0, `${locale} ขาดป้ายพื้นที่ ${id}`);
      assert.ok(stat.value.length > 0, `${locale} ขาดค่าพื้นที่ ${id}`);
    }
  }

  for (const id of SITES) {
    for (const [locale, messages] of [
      ["th", th],
      ["en", en],
    ] as const) {
      const site = messages.about.facilities.sites[id];
      assert.ok(site.title.length > 0, `${locale} ขาดชื่อที่ตั้ง ${id}`);
      assert.ok(site.description.length > 0, `${locale} ขาดที่อยู่ ${id}`);
    }
  }
});

test("AWARD_ITEM_IDS / CERTIFICATE_IDS: id มีจริงและข้อความไม่ว่างทั้งสองภาษา", () => {
  for (const id of AWARD_ITEM_IDS) {
    for (const [locale, messages] of [
      ["th", th],
      ["en", en],
    ] as const) {
      assert.ok(messages.about.awards.items[id].title.length > 0, `${locale} ขาดรางวัล ${id}`);
    }
  }

  for (const id of CERTIFICATE_IDS) {
    for (const [locale, messages] of [
      ["th", th],
      ["en", en],
    ] as const) {
      assert.ok(
        messages.about.awards.certificates[id].title.length > 0,
        `${locale} ขาดใบรับรอง ${id}`,
      );
    }
  }
});

test("EXPLORE_LINKS: มีคีย์ข้อความครบ และ path เป็น absolute", () => {
  for (const link of EXPLORE_LINKS) {
    assert.ok(th.about.explore[link.id].title.length > 0, `th ขาด ${link.id}`);
    assert.ok(en.about.explore[link.id].title.length > 0, `en ขาด ${link.id}`);
    assert.ok(link.path.startsWith("/"), `${link.id}: path ต้องขึ้นต้นด้วย /`);
  }
});

test("พจนานุกรม about: ข้อความที่แสดงบนหน้าต้องไม่ว่างทั้งสองภาษา", () => {
  for (const [locale, messages] of [
    ["th", th],
    ["en", en],
  ] as const) {
    const about = messages.about;

    for (const value of [
      about.eyebrow,
      about.title,
      about.intro,
      about.note,
      about.heroFigure,
      about.media.badge,
      about.story.eyebrow,
      about.story.title,
      about.story.body,
      about.story.bodySecondary,
      about.story.timelineTitle,
      about.story.timelineNote,
      about.facilities.eyebrow,
      about.facilities.title,
      about.facilities.body,
      about.facilities.statsTitle,
      about.facilities.statsNote,
      about.facilities.sitesTitle,
      about.direction.eyebrow,
      about.direction.title,
      about.direction.body,
      about.direction.vision.description,
      about.direction.mission.description,
      about.direction.policy.description,
      about.research.eyebrow,
      about.research.title,
      about.research.body,
      about.research.bodySecondary,
      about.research.qualityTitle,
      about.research.qualityBody,
      about.products.eyebrow,
      about.products.title,
      about.products.body,
      about.products.domestic.description,
      about.products.export.description,
      about.distribution.eyebrow,
      about.distribution.title,
      about.distribution.body,
      about.people.eyebrow,
      about.people.title,
      about.people.body,
      about.people.bodySecondary,
      about.awards.eyebrow,
      about.awards.title,
      about.awards.body,
      about.awards.certificatesTitle,
      about.awards.note,
      about.explore.eyebrow,
      about.explore.title,
      about.explore.body,
      about.meta.title,
      about.meta.description,
    ]) {
      assert.ok(value.trim().length > 0, `${locale}: พบข้อความว่างใน namespace about`);
    }
  }
});
