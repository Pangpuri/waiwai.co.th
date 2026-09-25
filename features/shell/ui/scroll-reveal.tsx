"use client";

import { useEffect } from "react";

import {
  REVEAL_READY,
  REVEAL_ROOT_MARGIN,
  REVEALED_ATTRIBUTE,
  REVEAL_ATTRIBUTE,
  shouldRevealOnScroll,
} from "@/lib/scroll-reveal";

/**
 * section ที่จะจางเข้า (ตรงกับ selector เดียวกันใน app/globals.css)
 * section แรก (hero/หัวหน้าเพจ) ยกเว้น — ต้องเห็นทันทีตั้งแต่เฟรมแรก
 */
const SELECTOR = "main > section:not(:first-of-type)";

/** ปุ่ม/เนื้อหาที่มี section อยู่ข้างในไหม — ใช้กรอง MutationObserver ไม่ให้สแกนมั่ว */
function containsSection(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const element = node as Element;
  return element.matches("section") || element.querySelector("section") !== null;
}

/**
 * ผูก IntersectionObserver ให้เนื้อหาจางเข้าตอนเลื่อนลงมาถึง
 *
 * - เนื้อหาถูกซ่อนไว้ตั้งแต่ก่อน paint โดยสคริปต์ใน <head> (lib/scroll-reveal.ts)
 *   คอมโพเนนต์นี้แค่ "เปิด" ให้จางเข้าเมื่อเข้ามาในจอ
 * - พอเนื้อหาออกนอกจอ จะถอด attribute ออก → เลื่อนกลับมาจะจางเข้าอีกครั้ง (ใช้ได้ทั้งขึ้นและลง)
 * - ⚠️ ต้องเฝ้า DOM ด้วย: กดลิงก์ไปหน้าอื่นเป็นการเปลี่ยนหน้าแบบ client-side
 *   layout (และคอมโพเนนต์นี้) ไม่ถูก mount ใหม่ → ถ้าสแกนครั้งเดียวตอน mount
 *   section ของหน้าถัดไปจะไม่มีใคร observe เลย → ค้างที่ opacity 0 แล้วเจอจอว่าง (บั๊กที่เจอจริง)
 *   MutationObserver จึงสแกนซ้ำเมื่อมี section ใหม่เข้ามา (ครอบทั้งการเปลี่ยนหน้าและ streaming)
 */
export function ScrollReveal() {
  useEffect(() => {
    const enabled = shouldRevealOnScroll({
      hasIntersectionObserver: typeof IntersectionObserver !== "undefined",
      prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });

    // สคริปต์ก่อน paint เป็นคนตัดสินใจหลัก ถ้ามันไม่เปิด (หรือปิดไปแล้ว) ก็ไม่ต้องทำอะไร
    if (!enabled || document.documentElement.getAttribute(REVEAL_ATTRIBUTE) !== REVEAL_READY) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const section = entry.target;
          if (entry.isIntersecting) {
            section.setAttribute(REVEALED_ATTRIBUTE, "");
          } else {
            // ถอดออกเมื่อพ้นจอไปแล้วเท่านั้น → ตอนกำลังอ่านอยู่ไม่จาง
            section.removeAttribute(REVEALED_ATTRIBUTE);
          }
        }
      },
      {
        // ย่อขอบล่างของพื้นที่ตรวจจับ 12% → เนื้อหาจางเข้า "ก่อน" ถึงกลางจอ
        rootMargin: REVEAL_ROOT_MARGIN,
      },
    );

    // observe ซ้ำตัวเดิมไม่ทำให้เกิดอะไรขึ้น (IntersectionObserver ข้ามตัวที่ observe อยู่แล้ว)
    const scan = () => {
      for (const section of document.querySelectorAll<HTMLElement>(SELECTOR)) {
        observer.observe(section);
      }
    };

    scan();

    let frame = 0;
    const mutation = new MutationObserver((records) => {
      const hasNewSection = records.some((record) =>
        [...record.addedNodes].some((node) => containsSection(node)),
      );
      if (!hasNewSection) return;

      // รวมหลาย mutation ในเฟรมเดียวพอ
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        scan();
      });
    });

    const main = document.querySelector("main");
    mutation.observe(main ?? document.body, { childList: true, subtree: true });

    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      mutation.disconnect();
      observer.disconnect();
    };
  }, []);

  return null;
}
