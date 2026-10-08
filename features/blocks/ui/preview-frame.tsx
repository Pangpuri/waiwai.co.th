"use client";

import { useEffect, useState } from "react";

import { BlockDocumentView } from "@/features/blocks/block-renderer";
import type { ProductShowcaseData } from "@/lib/blocks/product-showcase-data";
import { parseBlockDocument } from "@/lib/blocks/parse";
import type { BlockDocument } from "@/lib/blocks/types";

/**
 * พรีวิวที่โหลดอยู่ใน "เปลือกของหน้าเว็บจริง" (หัวเว็บ · ท้ายเว็บ · ฟอนต์ · ธีม · โหมดมืด)
 *
 * ทำไมต้องเป็นไฟล์นี้
 * - หน้าจอหลังบ้านมีเลย์เอาต์ของตัวเอง (ไม่มีหัวเว็บ/ท้ายเว็บ/ฟอนต์แบรนด์) ⇒ พรีวิวในนั้นจะ "ดูไม่เหมือนเว็บจริง"
 * - หน้าจอนี้ถูกฝังใน `<iframe>` ของ **เส้นทางฝั่งเว็บจริง** (`/[lang]/preview/[page]`) จึงได้ทุกอย่างเหมือนหน้าจริง
 * - อัปเดตสดได้โดยไม่ต้องบันทึก: รับเอกสารจากหน้าจอหลังบ้านทาง `postMessage` (ตรวจ origin เดียวกัน + ผ่าน `parse` ก่อนเรนเดอร์)
 *
 * ผู้ใช้ "แก้ได้จากในพรีวิว" ผ่าน 2 ข้อความ
 * 1. `waiwai:select` — คลิกที่ข้อความ/การ์ด/ภาพส่วนไหน ส่ง `{blockId, field, cardIndex}` กลับไปให้หน้าจอโฟกัสช่องนั้น
 * 2. `waiwai:drop-image` — ลากไฟล์ภาพมาวางบนภาพในพรีวิว ส่งไฟล์กลับไปให้หน้าจออัปโหลดแล้วเปลี่ยนภาพให้
 */

export const PREVIEW_MESSAGE = "waiwai:preview";
export const SELECT_MESSAGE = "waiwai:select";

/**
 * id พิเศษที่ส่งกลับเมื่อผู้ใช้ **คลิกที่ป้ายประกาศเข้าเว็บ** ในพรีวิว
 * (ป้ายเป็นส่วนกลางของเว็บ ไม่ใช่บล็อกในหน้า — ผู้ใช้สั่ง รอบที่ 45: "อยากให้คลิกเลือกป้ายในพรีวิวได้")
 */
export const NOTICE_SELECT_ID = "__notice__";

/** id พิเศษเมื่อคลิกถูก "แถบเมนู (navbar)" — ส่วนกลางของเว็บ (ผู้ใช้สั่ง รอบที่ 53) */
export const NAVBAR_SELECT_ID = "__navbar__";
export const DROP_IMAGE_MESSAGE = "waiwai:drop-image";

/**
 * ข้อความ "ค่าตั้งแถบเมนูที่กำลังแก้" (สองทาง: หน้าจอแก้ → ตัวสร้าง → พรีวิว)
 * ผู้ใช้สั่ง รอบที่ 54: *"วางภาพแล้วโลโก้บน navbar ต้องเปลี่ยนทันที"* (hot reload ในพรีวิว)
 */
export const NAVBAR_MESSAGE = "waiwai:navbar";

/** live update ของ "ป้ายประกาศ" (รอบที่ 161) — ส่งค่าที่กำลังแก้ (ยังไม่บันทึก) เข้า iframe พรีวิว */
export const MOURNING_MESSAGE = "waiwai:mourning";

/** ชื่อ CustomEvent ภายในหน้าแอดมิน: ตัวแก้ป้ายประกาศยิง → workspace จับแล้วส่งเข้า iframe */
export const MOURNING_LIVE_EVENT = "waiwai:mourning-live";

/** ข้อความ "ค่าตั้งท้ายเว็บที่กำลังแก้" (W3) — หน้าจอแก้ → ตัวสร้าง → พรีวิว */
export const FOOTER_MESSAGE = "waiwai:footer";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function closestAttribute(element: Element | null, attribute: string): string | null {
  const found = element?.closest(`[${attribute}]`);
  return found?.getAttribute(attribute) ?? null;
}

export function PreviewFrame({
  initialDocument,
  language,
  productData = null,
}: {
  readonly initialDocument: BlockDocument;
  readonly language: "th" | "en";
  /** ข้อมูลจริงของบล็อกไดนามิก — โหลดจากเซิร์ฟเวอร์ (ห้ามโหลดในนี้: พรีวิวเป็น client) */
  readonly productData?: ProductShowcaseData | null;
}) {
  const [document, setDocument] = useState<BlockDocument>(initialDocument);
  /** บล็อกที่กำลังเลือกในหลังบ้าน (ส่งมาจากตัวสร้าง) — ใช้ตีกรอบทึบในพรีวิว */
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  /* รับฉบับร่างจากหน้าจอหลังบ้าน (แก้ปุ๊บเห็นปุ๊บ ยังไม่ต้องบันทึก) */
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      /* รับเฉพาะข้อความจากโดเมนเดียวกัน (กันหน้าอื่นในเบราว์เซอร์ส่งเนื้อหาเข้ามา) */
      if (event.origin !== window.location.origin) return;

      const data: unknown = event.data;
      if (!isRecord(data) || data["type"] !== PREVIEW_MESSAGE) return;

      /* ข้อมูลจากหน้าจอหลังบ้านต้องผ่านการตรวจรูปทรงก่อนเรนเดอร์เสมอ */
      const parsed = parseBlockDocument(initialDocument.page, data["document"]);
      if (parsed.ok) setDocument(parsed.document);

      /* บอกว่ากำลังเลือกบล็อกไหนอยู่ → ตัวเรนเดอร์ตีกรอบทึบให้ (L1) */
      setSelectedBlockId(typeof data["selectedId"] === "string" ? data["selectedId"] : null);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [initialDocument.page]);

  /* ลากไฟล์ภาพมาวางในพรีวิว → หาว่าปล่อยบนส่วนไหน แล้วส่งไฟล์กลับไปให้หน้าจอ */
  useEffect(() => {
    function blockDrop(event: DragEvent) {
      event.preventDefault();
    }

    function onDrop(event: DragEvent) {
      event.preventDefault();

      const file = event.dataTransfer?.files?.item(0) ?? null;
      if (file === null || !file.type.startsWith("image/")) return;

      const element = window.document.elementFromPoint(event.clientX, event.clientY);
      const blockId = closestAttribute(element, "data-block-id");
      if (blockId === null || blockId === "") return;

      const cardIndexAttr = closestAttribute(element, "data-card-index");
      const cardIndex = cardIndexAttr === null ? null : Number.parseInt(cardIndexAttr, 10);

      if (window.parent === window) return;
      window.parent.postMessage(
        { type: DROP_IMAGE_MESSAGE, blockId, cardIndex: Number.isNaN(cardIndex ?? Number.NaN) ? null : cardIndex, file },
        window.location.origin,
      );
    }

    window.addEventListener("dragover", blockDrop);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", blockDrop);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return (
    <div
      onClick={(event) => {
        if (window.parent === window) return;
        const target = event.target as HTMLElement | null;

        /* คลิกถูก "ป้ายประกาศเข้าเว็บ" → บอกหลังบ้านให้เปิดเมนูป้าย (ไม่ใช่บล็อกในหน้า) */
        if (target?.closest("[data-navbar]") != null) {
          window.parent.postMessage({ type: SELECT_MESSAGE, blockId: NAVBAR_SELECT_ID, field: null, cardIndex: null }, window.location.origin);
          return;
        }

        if (target?.closest("[data-mourning-notice]") != null) {
          window.parent.postMessage({ type: SELECT_MESSAGE, blockId: NOTICE_SELECT_ID, field: null, cardIndex: null }, window.location.origin);
          return;
        }

        const blockId = closestAttribute(target, "data-block-id");
        if (blockId === null || blockId === "") return;

        /* สิ่งที่คลิกอาจเป็นการ์ด (มี data-card-index) หรือฟิลด์ข้อความ (มี data-field) */
        const cardIndexAttr = closestAttribute(target, "data-card-index");
        const cardIndex = cardIndexAttr === null ? null : Number.parseInt(cardIndexAttr, 10);
        const field = closestAttribute(target, "data-field");

        window.parent.postMessage(
          {
            type: SELECT_MESSAGE,
            blockId,
            field,
            cardIndex: cardIndex !== null && !Number.isNaN(cardIndex) ? cardIndex : null,
          },
          window.location.origin,
        );
      }}
    >
      {/* editable = ติดป้าย data-field/data-card-index ให้คลิกแก้ได้ตรงส่วน */}
      <BlockDocumentView document={document} language={language} editable selectedBlockId={selectedBlockId} productData={productData} />
    </div>
  );
}
