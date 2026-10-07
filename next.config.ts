import type { NextConfig } from "next";

import { legacyRedirectRules } from "@/lib/routing/redirects";
import { contentSecurityPolicy } from "@/lib/security/csp";

const nextConfig: NextConfig = {
  /*
    เปิดให้เครื่องอื่นในวงแลนด์เข้า dev server ได้
    Next 16 บล็อก dev resource ข้าม origin ไว้โดยปริยาย (กันคนนอกเข้าถึงไฟล์ dev)
    อาการถ้าไม่ตั้ง: เข้าจาก IP วงแลนด์แล้วหน้าเว็บพัง เพราะโหลด /_next/* ไม่ได้

    กติกาการเขียน (จากด็อกที่แถมมากับ Next 16)
    - เทียบเฉพาะ hostname ของ Origin → ห้ามใส่ scheme/port/path
    - `*` แทนได้ 1 label ของ hostname · `**` แทนได้ตั้งแต่ 1 label ขึ้นไป (ใช้ `**` ได้เฉพาะต้นแบบ)
    - localhost และ hostname ตอนเริ่มเซิร์ฟเวอร์ถูกอนุญาตอยู่แล้ว

    ⚠️ IP ของเครื่องอาจเปลี่ยนเมื่อรีสตาร์ตเราเตอร์/ย้ายที่ → wildcard ของ subnet ช่วยได้
       ถ้าย้ายวงแลนด์ใหม่ ให้เพิ่ม/แก้ entry ให้ตรงวงนั้น
  */
  allowedDevOrigins: [
    "192.168.10.141", // IP จริงของการ์ด Ethernet (วงแลนด์ที่ทีมใช้อยู่)
    "192.168.10.*", // เผื่อ IP ในวงเดียวกันเปลี่ยน
    "172.31.192.1", // Hyper-V Default Switch (IP ที่ `next dev` พิมพ์ให้ — คนละ adapter กับวงแลนด์)
  ],

  /*
    ⚠️ จำเป็นสำหรับ "อัปโหลดภาพ" (เจอจริง 2026-10-02)
    Server Action ถูกจำกัด body ไว้ 1MB โดยปริยาย → อัปโหลดภาพ 2MB ขึ้นไปล้มทั้งที่ validator อนุญาต 5MB
    (อาการที่เห็น: `Error: Body exceeded 1 MB limit` · ไม่มีข้อความบอกผู้ใช้)
    ⇒ ตั้ง 8MB (เพดานไฟล์จริง 5MB + เผื่อ multipart) · เผื่อไว้ให้ validator ของเราได้เป็นคนบอกผู้ใช้ว่า "ไฟล์ใหญ่เกิน 5MB"
    (ถ้าตั้งเท่าเพดานจริง ไฟล์เกินจะชนเพดาน transport ก่อน แล้วผู้ใช้เห็นแค่ 500)
    เอกสาร: node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md
  */
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },

  /*
    ── ความปลอดภัยพื้นฐานของเว็บสาธารณะ ─────────────────────────────────────────
    ย้ายมาจาก `netlify.toml` (รอบที่ 21) เพราะผู้ใช้ย้ายไป deploy บน **Vercel** ซึ่งอ่านไฟล์นั้นไม่ได้
    → ถ้าปล่อยไว้ เว็บจริงจะไม่มี header เหล่านี้เลย · วางที่นี่แล้วทำงานกับทุกโฮสต์ที่รัน Next
    (Vercel · Netlify · self-host) และมีเทสต์กันถอยหลังที่ scripts/test-deploy-config.ts

    เว็บนี้ไม่ใช้กล้อง/ไมโครโฟน และไม่เรียก Geolocation API เลย → ปิดสิทธิ์ไว้ล่วงหน้า

    ⚠️ **CSP (รอบที่ 170):** ใช้ **แบบไม่ใช้ nonce** เพื่อคง ISR/static (เอกสาร Next ยืนยันว่า nonce
    บังคับให้ทุกหน้าเป็น dynamic ⇒ ปิด ISR/CDN cache) ⇒ นโยบายยังต้องมี `'unsafe-inline'` สำหรับ
    สคริปต์ก่อน paint + สคริปต์ RSC ของ Next แต่ล็อกที่เหลือ (object/base/form/frame-ancestors/frame-src)
    · ตรรกะทั้งหมดอยู่ที่ `lib/security/csp.ts` (pure + มีเทสต์) · เหตุผลเต็มอยู่ในไฟล์นั้น
  */
  /*
    ── URL เก่า → 301 ──────────────────────────────────────────────────────────
    X2.7 ส่วนที่ 2 (รอบที่ 150) · รายการอยู่ใน  (ที่เดียว พร้อมที่มาของทุกกฎ)
    ⚠️ ต้องเป็นค่าคงที่ในโค้ด — proxy/middleware อ่านฐานข้อมูลไม่ได้ (เอกสาร Next + มีเทสต์สแกน)
  */
  async redirects() {
    return [...legacyRedirectRules()];
  },

  async headers() {
    return [
      {
        /*
          หน้าพรีวิว (ฉบับร่าง) — สั่งห้ามเครื่องค้นหาจัดทำดัชนี **ที่ระดับ header** ด้วย
          ⇒ ต่อให้หน้าลืมตั้ง metadata ก็ยังไม่ถูกเก็บ (X2.6: ลิงก์พรีวิวใช้เส้นทางนี้)
          ⚠️ ต้องวางก่อนกฎ catch-all เพื่อให้ส่วนหัวชุดนี้มีผลจริง
        */
        source: "/:lang(th|en)/preview/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          /*
            CSP (รอบที่ 170) — ค่ามาจาก `lib/security/csp.ts` (แหล่งความจริงเดียว · pure + มีเทสต์)
            ⚠️ ต้องเป็น `frame-ancestors 'self'` คู่กับ `X-Frame-Options: SAMEORIGIN`
            เพราะหลังบ้านฝัง iframe พรีวิวของตัวเอง (same-origin) — `'none'` จะทำให้พรีวิวพัง
          */
          { key: "Content-Security-Policy", value: contentSecurityPolicy({ isDev: process.env.NODE_ENV === "development" }) },
        ],
      },
    ];
  },
};

export default nextConfig;
