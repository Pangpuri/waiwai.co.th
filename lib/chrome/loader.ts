import { cache } from "react";

import { loadDocumentRow } from "@/lib/blocks/repository";
import {
  NAVBAR_PAGE_KEY,
  applyPageMenu,
  defaultNavbarConfig,
  navbarErrorsOf,
  parseNavbarConfig,
  validateNavbarConfig,
  type NavbarConfig,
} from "@/lib/chrome/navbar";
import {
  FOOTER_PAGE_KEY,
  footerErrorsOf,
  parseFooterConfig,
  validateFooterConfig,
  type FooterConfig,
} from "@/lib/chrome/footer";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { defaultPages } from "@/lib/pages/model";
import { listPages } from "@/lib/pages/repository";
import type { Locale } from "@/lib/i18n/config";

/**
 * โหลดค่าตั้ง "แถบเมนู (navbar)" ฉบับที่เผยแพร่ มาใช้กับหน้าเว็บ (ผู้ใช้สั่ง รอบที่ 53)
 *
 * หลักการเดียวกับป้ายประกาศ: **ห้ามทำให้หน้าเว็บพังเพราะฐานข้อมูล**
 * - ยังไม่ตั้ง `DATABASE_URL` → `null` (ใช้เมนูเดิมในโค้ดเป๊ะ ๆ)
 * - ยังไม่มีแถวที่เผยแพร่ → `null`
 * - อ่านแล้วไม่ผ่านการตรวจ / อ่านไม่สำเร็จ → `null`
 *
 * หมายเหตุ: หน้าถูก prerender ตอน build (มติ D1) ⇒ อ่านฐานข้อมูลตอน build
 *   แก้แล้วต้อง rebuild (ผ่านปุ่มเผยแพร่/`REBUILD_HOOK_URL`) จึงเห็นผลบนเว็บจริง
 */
/**
 * โหลดค่าตั้ง "ท้ายเว็บ" ฉบับที่เผยแพร่ (W3)
 * หลักการเดียวกับแถบเมนู: ไม่มี DB / ไม่มีแถว / อ่านพลาด ⇒ `null` (ใช้ท้ายเว็บเดิมในโค้ดเป๊ะ ๆ)
 */
export const loadFooterConfig = cache(async (locale: Locale): Promise<FooterConfig | null> => {
  if (!isDatabaseConfigured()) return null;

  try {
    const messages = await getMessagesFor(locale);
    const row = await loadDocumentRow(FOOTER_PAGE_KEY, "published");
    if (row === null) return null;

    const parsed = parseFooterConfig(row.raw, messages);
    if (!parsed.ok) return null;
    if (footerErrorsOf(validateFooterConfig(parsed.config)).length > 0) return null;

    return parsed.config;
  } catch {
    return null;
  }
});

export const loadNavbarConfig = cache(async (locale: Locale): Promise<NavbarConfig | null> => {
  /* ไม่มีฐานข้อมูล = ใช้เมนูในโค้ดล้วน ๆ (เร็วสุด · ไม่ต้องพึ่ง DB เลย) */
  if (!isDatabaseConfigured()) return null;

  try {
    const messages = await getMessagesFor(locale);

    /*
      ชื่อเมนูมาจาก "ชื่อหน้า" (ตาราง page) — W1 · ผู้ใช้สั่ง "เมนูก็คงเอาไว้ตามหน้า"
      ⚠️ บทเรียน รอบที่ 61: ต้องใช้ชื่อหน้า **แม้ยังไม่มีแถว navbar ที่เผยแพร่**
         (เดิมคืน null ก่อน ⇒ หน้าเว็บใช้พจนานุกรม แล้วชื่อหน้าที่แก้ไปไม่มีผลเลย)
    */
    const pages = await listPages(defaultPages(messages));
    const labels: Record<string, { th: string; en: string }> = {};
    const hidden: string[] = [];
    for (const page of pages) {
      if (page.inMenu) labels[page.id] = { th: page.nameTh, en: page.nameEn.trim() === "" ? page.nameTh : page.nameEn };
      else hidden.push(page.id);
    }

    const row = await loadDocumentRow(NAVBAR_PAGE_KEY, "published");
    const base = defaultNavbarConfig(messages);
    if (row === null) return applyPageMenu(base, { labels, hidden });

    const parsed = parseNavbarConfig(row.raw, messages);
    if (!parsed.ok) return applyPageMenu(base, { labels, hidden });
    if (navbarErrorsOf(validateNavbarConfig(parsed.config)).length > 0) return applyPageMenu(base, { labels, hidden });

    return applyPageMenu(parsed.config, { labels, hidden });
  } catch {
    return null;
  }
});
