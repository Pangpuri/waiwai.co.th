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
};

export default nextConfig;
