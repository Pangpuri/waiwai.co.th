import type { NextConfig } from "next";

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
    ── ความปลอดภัยพื้นฐานของเว็บสาธารณะ ─────────────────────────────────────────
    ย้ายมาจาก `netlify.toml` (รอบที่ 21) เพราะผู้ใช้ย้ายไป deploy บน **Vercel** ซึ่งอ่านไฟล์นั้นไม่ได้
    → ถ้าปล่อยไว้ เว็บจริงจะไม่มี header เหล่านี้เลย · วางที่นี่แล้วทำงานกับทุกโฮสต์ที่รัน Next
    (Vercel · Netlify · self-host) และมีเทสต์กันถอยหลังที่ scripts/test-deploy-config.ts

    เว็บนี้ไม่ใช้กล้อง/ไมโครโฟน และไม่เรียก Geolocation API เลย → ปิดสิทธิ์ไว้ล่วงหน้า

    ⚠️ จงใจ **ไม่ตั้ง Content-Security-Policy** เพราะเว็บนี้ใช้สคริปต์ inline ก่อน paint
    (ธีม/สถานะป๊อปอัพ/การ์ด — ดู features/shell/ui/inline-script.tsx) CSP ที่เข้มจะบล็อกสคริปต์เหล่านั้น
    ทำให้หน้าวาบ · ถ้าจะทำ CSP ต้องใช้ nonce ซึ่งกระทบเรื่อง static rendering → เป็นงานแยกที่ต้องคุยกันก่อน
  */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
