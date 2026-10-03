"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * คลังภาพสำหรับ "เลือกจากคลัง" ในหน้าแก้เนื้อหา (หนี้จากรอบที่ 81 · ปิดรอบที่ 93)
 *
 * ปัญหาเดิม: ช่องภาพทุกช่องอัปโหลดได้ หรือ "คัดลอกพาธไปวาง" (ต้องไปเปิด `/admin/media`
 * คัดลอก `/media/<id>` แล้วกลับมาวาง) ⇒ งานซ้ำและพิมพ์ผิดง่าย
 *
 * วิธีที่เลือก: **context** ไม่ใช่ prop
 * - `ImageDrop` ถูกใช้ ~7 จุดในตัวสร้างหน้าเว็บ (และอีกหลายจุดในตัวแก้ส่วนกลาง)
 *   ถ้าส่งเป็น prop ต้องแก้ทุกจุดและลืมง่าย ⇒ วางผู้ให้บริการครั้งเดียวที่หน้ารวม
 * - ค่าเริ่มต้น = ว่าง ⇒ ช่องภาพยังทำงานได้เหมือนเดิมทุกที่ที่ไม่มีคลัง (ไม่พังเพราะไม่มี provider)
 */

export type ImageLibraryItem = {
  readonly id: string;
  readonly filename: string;
  /** คำบรรยายภาพที่บันทึกไว้ในคลัง (ใช้เติม alt ให้ทันที) */
  readonly altTh: string;
  readonly altEn: string;
};

const ImageLibraryContext = createContext<readonly ImageLibraryItem[]>([]);

export function ImageLibraryProvider({
  items,
  children,
}: {
  readonly items: readonly ImageLibraryItem[];
  readonly children: ReactNode;
}) {
  return <ImageLibraryContext.Provider value={items}>{children}</ImageLibraryContext.Provider>;
}

/** รายการภาพในคลังที่ใช้เลือกได้ (ว่าง = ไม่มีคลังในบริบทนี้ ⇒ ซ่อนปุ่มเลือกจากคลัง) */
export function useImageLibrary(): readonly ImageLibraryItem[] {
  return useContext(ImageLibraryContext);
}
