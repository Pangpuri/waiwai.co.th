# waiwai.com — เว็บองค์กรไทย/อังกฤษ

เว็บไซต์องค์กรแบบ static สำหรับแบรนด์ไวไว · Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4
ทุกหน้า prerender เป็น static และรองรับสองภาษา (`/th` และ `/en`)

> A bilingual (Thai/English) corporate website. Every page is statically prerendered.

## เริ่มใช้งาน

```bash
npm install
npm run dev     # http://localhost:3000
```

## คำสั่งที่ใช้บ่อย

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | dev server (พอร์ต 3000) |
| `npm run build` | production build — ดูรายการ route ที่เป็น static |
| `npm test` | unit test (`node --test` ผ่าน import hook เล็ก ๆ ไม่ได้เพิ่ม dependency) |
| `npm run typecheck` | TypeScript (`strict`) |
| `npm run lint` | ESLint |
| `npm run check:dark` | ห้ามคลาสสีดิบ/hex นอก `app/globals.css` (กันโหมดมืดพัง) |
| `npm run check:i18n` | คีย์สองภาษาตรงกัน · ไม่มีข้อความไทยฝังใน `.tsx` · ขนาดพจนานุกรมไม่เกินเพดานรายพื้นที่ |

**ตรวจด้วยตา/วัดค่าจริงในเบราว์เซอร์** (ไม่ใช่หนึ่งใน DoD — ใช้เมื่อสงสัยว่า "หน้าตา/ขนาด" เพี้ยน
เช่นเคยเจอเคสที่ CSS ไปโดน `<html>` แล้วซ่อนทั้งเว็บ ซึ่งด่านทุกข้อมองไม่เห็น):

```bash
npm run build && npm run start -- -p 3100   # อีกหน้าต่าง
node scripts/measure-page.mjs http://localhost:3100/th out.png 1440 1000
```

จะพิมพ์พิกัด/ขนาดจริงของ hero · ภาพสไลด์ · การ์ดประกาศ (พร้อมค่า `scrollbarGutter`, attributes บน `<html>`)
และบันทึกภาพหน้าจอไว้ดู — ตั้ง `CHROME_PATH` ได้ถ้าเครื่องไม่ได้ติด Chrome ไว้ที่ default

## โครงสร้าง

```
app/[lang]/…            หน้าทั้งหมด (ไทย/อังกฤษ) — หน้าละ 1 โฟลเดอร์
features/<area>/        ตรรกะ + คอมโพเนนต์แยกตามพื้นที่
  ├── content.ts / catalog.ts / jobs.ts / slides.ts …  = pure module ที่ unit test ตรวจได้ (ไม่มี JSX)
  └── ui/                คอมโพเนนต์ของพื้นที่นั้น
features/shell/ui/      คอมโพเนนต์กลาง (header · footer · breadcrumb · ช่องภาพตัวอย่าง · แถบคุกกี้ · ประกาศไว้อาลัย)
lib/i18n/messages/      พจนานุกรม — แยกเป็นรายพื้นที่ใน areas/<locale>/
lib/slideshow.ts        ตรรกะการเลื่อนภาพ (วนรอบ/ซ่อนปุ่มเมื่อมีภาพเดียว) — ใช้ทั้ง hero และประกาศไว้อาลัย
scripts/                สคริปต์ด่าน (check:*) และ unit test (test-*.ts)
public/                 ภาพที่ใช้จริง (ใบรับรองมาตรฐาน · คณะผู้บริหาร · ผลิตภัณฑ์ · แผนที่ · สไลด์ · ประกาศไว้อาลัย)
```

## Deploy ขึ้น Netlify

ตั้งค่าไว้ใน `netlify.toml` แล้ว — build ด้วย `npm run build` บน Node 22

- **ไม่ต้องเพิ่ม `@netlify/plugin-nextjs`** — Netlify ตรวจพบ Next.js และติดตั้ง Next.js Runtime ให้เองตอน build
- ต้องเป็น runtime รุ่นล่าสุด (v5.10+) จึงรองรับ `proxy.ts` ของ Next 16 (ตัวที่ทำ locale redirect)
- ตรวจหลัง deploy ครั้งแรก: เปิด `/` แล้วต้องเด้งไป `/th`

## หมายเหตุ

- **ไฟล์ข้อมูลต้นทางของบริษัท และเอกสารภายใน** (บรีฟ · roadmap · กฎการเขียนโค้ด) ถูก `.gitignore` ไว้โดยตั้งใจ
  repo นี้จึงมีทุกอย่างที่ต้องใช้ build แต่ไม่มีเอกสารต้นทาง — สำเนาภาพที่ใช้จริงอยู่ใน `public/` แล้ว
- หน้า `/products` · `/recipes` · `/news` เป็น **หน้าตัวอย่าง (mockup)** และฟอร์มในหน้า `/contact` ยังไม่เปิดใช้งาน
  (ปุ่มส่งถูกปิดไว้ + มีข้อความแจ้งบนหน้า) — ตั้งใจไม่ทำปุ่มที่กดแล้วไม่มีปลายทาง
- หน้าแรกมี **สไลด์ภาพฉากหลัง** (จางข้ามภาพ + ซูมช้า ๆ วนไป) และมี **ปุ่มหยุด/เล่นต่อ** กำกับ
  เพราะเนื้อหาที่เลื่อนเองต้องหยุดได้ (WCAG 2.2.2) — ภาพชุดนี้เป็นภาพตัวอย่างรอการตลาดอนุมัติ
  - **ไม่มีฉากมืดทับภาพ** โดยตั้งใจ (ภาพต้องสว่างเต็มที่) ความอ่านออกของข้อความจึงใช้ `text-shadow-photo`
    — ถ้าอ่านยากบนภาพสว่างจัด ให้ดูทางเลือกใน `PRODUCT_ROADMAP.md` § 9
  - ความสูงของแถบ hero ปรับที่ `min-h-[…]` ใน `features/home/ui/hero.tsx` · ภาพ/alt ปรับที่
    `features/home/slides.ts` + `lib/i18n/messages/areas/<locale>/home.ts` (`hero.slides`)
  - ไฟล์ภาพทุกไฟล์ใน `public/slide/` **ต้องถูกอ้างใน `HERO_SLIDES`** (มีเทสต์เตือนเรื่องไฟล์ค้าง)
- **ประกาศไว้อาลัย** เด้ง **ทุกครั้งที่โหลดหน้า** (ค่าเริ่มต้น) และมีเช็คบ็อก "ไม่แสดงอีกในวันนี้" ตอนกดปิด
  → ติ๊กแล้วเก็บ "วันที่ที่ปิด" ไว้เทียบกับวันที่ของเครื่องผู้ใช้ (เวลาท้องถิ่น) พอขึ้นวันใหม่หน้าต่างกลับมาเอง
  - ปุ่มหลักไล่ให้ดูครบทุกภาพก่อน: ยังไม่ถึงภาพสุดท้าย = "ดูภาพต่อไป" (จางข้ามภาพ) · ภาพสุดท้าย = "ปิดหน้าต่างนี้"
    (ตอนนี้มี 2 ภาพ: กดปุ่มหนึ่งครั้ง = ไปภาพที่ 2 · กดอีกครั้ง = ปิดจริง)
  - เพิ่มภาพใน `public/rip/` แล้วขึ้นทะเบียนที่ `features/shell/mourning.ts` + alt 2 ภาษา (`mourning.images.<id>.alt`)
    ลำดับการแสดง = ลำดับใน `MOURNING_IMAGES` · มีเทสต์กันไฟล์ค้างใน `public/slide/` และ `public/rip/`
  - ปิดได้ 3 ทาง: ปุ่มปิด · `Esc` · และจะจางออกก่อนหายไปทุกครั้ง
  - กลไก "โชว์/ไม่โชว์" อยู่ใน `lib/mourning-notice.ts` + สคริปต์ก่อน paint เพื่อไม่ให้จอวาบ
    (สคริปต์นี้มี unit test ที่ **รันจริงใน `node:vm`** พร้อม localStorage/วันที่ปลอม — ดู `scripts/test-mourning-notice.ts`)
- **การ์ดประกาศบน hero** (แปะมุมขวาล่าง · จอเล็กอยู่ในเนื้อเรื่องใต้ปุ่ม CTA) — เอาไว้ "โชว์อะไรเล็ก ๆ น้อย ๆ"
  - แก้ข้อความที่ `lib/i18n/messages/areas/<locale>/home.ts` → `hero.card` · ลิงก์ที่ `HERO_CARD_HREF`
  - เปลี่ยนภาพ: วางไฟล์ใน `public/promo/` + แก้ `HERO_CARD_IMAGE` ใน `features/home/hero-card.ts` (ขนาดจริง + ธงลายน้ำ)
  - กติกา: แสดงทุกครั้งที่โหลดหน้า · ✕ = ปิดรอบนี้ · ติ๊ก "ไม่แสดงอีกในวันนี้" = เงียบถึงสิ้นวันนี้ (พรุ่งนี้กลับมา)
    ตรรกะวันอยู่ที่ `lib/day-mute.ts` (ใช้ร่วมกับประกาศไว้อาลัย) · สถานะอยู่ที่ `lib/hero-card.ts`
  - การ์ด "ยิก" เรียกความสนใจทุก 2 วินาที — CSS ล้วน ไม่มี JS (`HERO_CARD_WIGGLE_MS` + `@keyframes hero-card-wiggle`)
    · หยุดยิกเองตอน hover/โฟกัส/กำลังปิด · ผู้ใช้ที่ขอ reduced-motion จะเห็นการ์ดนิ่ง
    · ปรับความแรงที่ keyframes (amplitude) · จังหวะที่ `HERO_CARD_WIGGLE_MS` · มุมเอียงตั้งต้นที่ `--hero-card-tilt`
- เนื้อหาที่เป็นข้อมูลจริง (บริษัท · ใบรับรอง · คณะผู้บริหาร · รับสมัครงาน · ติดต่อ) แก้ที่
  `features/*/…` หรือ `lib/i18n/messages/areas/<locale>/…` แล้วรัน `npm test` + `npm run check:i18n`
