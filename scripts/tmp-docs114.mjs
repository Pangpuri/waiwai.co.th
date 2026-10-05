import { readFileSync, writeFileSync } from "node:fs";

/* ── PRODUCT_ROADMAP §10: รอบที่ 114 ───────────────────────────────────────── */
const roadmap = "C:/Users/user/waiwai_demo/PRODUCT_ROADMAP.md";
let r = readFileSync(roadmap, "utf8");

const entry = `
### รอบที่ 114 — เตรียมฐานข้อมูลเดโมขึ้นคลาวด์ (เลือกเจ้า · พิสูจน์ข้อมูล · เครื่องมือดันขึ้น) — 2026-10-05

> **ไม่มีการเปลี่ยนสคีมา · ไม่มี dependency ใหม่**
> คำสั่งเจ้าของ: *"ช่วยเลือกก่อนว่า จะเอาข้อมูลขึ้น database เจ้าไหนดี เพราะทางการตลาดขอดูตัวอย่างข้อมูลหน้าบ้านที่เราเพิ่งทำไป"* · *"เอาฐานข้อมูลขึ้นคลาวด์ก่อนครับ"*
> มติเจ้าของ: **Neon (สิงคโปร์)** · **ใช้บัญชีที่มีอยู่แล้ว**
> **สถานะ: เตรียมครบ + พิสูจน์แล้ว รอ connection string จากเจ้าของเพื่อรันคำสั่งเดียว** (ยังไม่มี commit ของรอบนี้ — งานโค้ดรอ commit พร้อมกัน)

**ทำไมเลือก Neon (วัดจากของจริง)**
| เกณฑ์ | ข้อมูลจริงของเรา | Neon free |
|---|---|---|
| ขนาดข้อมูล | **146 MB** (ภาพใน DB 129 MB · เนื้อหา ~17 MB) | 0.5 GB ⇒ เหลือ headroom ~3.4 เท่า |
| ส่วนขยายที่ต้องมี | **ไม่มีเลย** (SQL มาตรฐานล้วน · ไม่มี \`create extension\`) | ไม่ต้องเปิดอะไรเพิ่ม |
| เวอร์ชัน | Postgres 17 (ในเครื่อง) | Neon ให้ PG 17 ⇒ พฤติกรรมตรงกัน |
| SSL | \`pg\` อ่าน \`sslmode=require\` จาก URL ได้ (มีเทสต์ยืนยันการแยกค่า) | URL ของ Neon แนบ \`?sslmode=require\` มาให้แล้ว |
| Serverless (Vercel) | เว็บจะรันบน Vercel (ฟังก์ชันอายุสั้น) | มี **pooled connection** (\`-pooler\`) ในตัว |
| หลับเมื่อไม่มีคนใช้ | การตลาดอาจเปิดดูช้า ๆ | **ไม่ pause** (แค่ scale-to-zero แล้วตื่นใน ~1 วิ) — ต่างจาก Supabase ที่ pause เมื่อ idle 7 วัน |

**สิ่งที่ทำเสร็จรอบนี้**
1. **พิสูจน์ฝั่งเราก่อนย้ายข้อมูล** (กติกา: "สำรองที่ไม่เคยทดสอบ = ไม่มีสำรอง")
   - \`npm run db:backup\` → \`backups/waiwai-20261005-063040.dump\` (**144.3 MB · 22 ตาราง**)
   - \`npm run check:restore\` **ผ่าน** — กู้คืนจริงบนฐานข้อมูลชั่วคราว 3 ตัว · ไฟล์ไบนารี (bytea) ตรงกับต้นฉบับทุกไบต์ (md5) · media 843 แถว (34.7 วิ)
2. **เครื่องมือดันข้อมูลขึ้นปลายทาง** — \`npm run db:push\` ใหม่ (\`scripts/db-push.ts\`)
   - ใช้ **เส้นทางที่ทดสอบแล้วทั้งคู่**: \`restoreFromFile()\` (pg_restore --no-owner --no-privileges) + \`npm run db:migrate\` (เช็คว่า schema ไม่ค้าง)
   - **ตรวจว่าได้ข้อมูลครบจริง** ด้วยตัวเทียบกลาง: \`readTableStats()\` + \`diffTables()\` เทียบกับ **manifest ของไฟล์สำรอง** (จำนวนแถว **และลายนิ้วมือเนื้อหา** md5 ต่อตาราง) + นับแถวซ้ำอีกชั้น
   - ตัวเลือก: \`--file=<path>\` · \`--allow-existing\` · \`--dry-run\` · \`--json\` · \`--allow-local\` (ทดสอบบนเครื่อง)
3. **การ์ดกันพลาด** — \`lib/db/target.ts\` (pure · มีเทสต์ 7 ข้อ)
   - ปฏิเสธถ้าไม่ได้ตั้ง \`TARGET_DATABASE_URL\` · **ซ้ำกับ \`DATABASE_URL\`** · เป็น **localhost/เครือข่ายภายใน** · รูปแบบ URL ผิด
   - \`redactUrl()\` — **ห้ามรหัสผ่านขึ้นจอ/log** (ทุกข้อความในสคริปต์ใช้ตัวนี้)
   - ปลายทางต้อง **ว่าง** (0 ตาราง) ยกเว้นสั่ง \`--allow-existing\` ⇒ กันเขียนทับของเดิมโดยไม่ตั้งใจ
   - ต้นทาง **ไม่ถูกแตะเลย** (ข้อมูลมาจากไฟล์สำรอง)

**พิสูจน์เส้นทางเต็มบนเครื่อง (ก่อนถึงวันจริง)**
\`\`\`
สร้างฐานข้อมูลเปล่า waiwai_push_test → TARGET_DATABASE_URL=…waiwai_push_test npm run db:push -- --dry-run --allow-local
  ปลายทาง : postgresql://waiwai:****@localhost:55432/waiwai_push_test   ← รหัสถูกซ่อน
  ไฟล์สำรอง: waiwai-20261005-063040.dump (144.3 MB · 22 ตาราง)
  ตารางที่มีอยู่แล้วบนปลายทาง: 0
  ✓ ตรวจทุกอย่างผ่านแล้ว (dry-run)
(แล้วรันจริงโดยไม่มี --dry-run — ผลอยู่ในบันทึกท้ายหัวข้อนี้)
\`\`\`

**คู่มือสำหรับเจ้าของ (Neon — บัญชีเดิม)**
1. เข้า Neon → **New Project** · ตั้งชื่อ \`waiwai-demo\` · **Region: Singapore (ap-southeast-1)** · Postgres 17
2. คัดลอก **connection string** — เลือกแบบ **Pooled connection** (โฮสต์มีคำว่า \`-pooler\`) เพราะเว็บจะรันบน Vercel
   (มี \`?sslmode=require\` ต่อท้ายมาให้แล้ว — อย่าลบ)
3. วางใน \`.env.local\` (ไฟล์นี้ gitignore — **ห้าม commit · ห้ามส่งค่าในแชท**) เป็นบรรทัดใหม่:
   \`\`\`
   TARGET_DATABASE_URL=postgresql://…ค่าที่คัดลอกมา…
   \`\`\`
4. บอกว่า "ใส่แล้ว" ⇒ ผมจะรัน \`npm run db:push\` แล้วรายงานผล (22 ตาราง · ลายนิ้วมือตรงทั้งหมด)
5. **ขั้นต่อไปเพื่อให้การตลาดเปิดดูได้**: deploy เว็บขึ้น Vercel แล้วตั้ง env \`DATABASE_URL\` = ค่าเดียวกับข้อ 3
   · ⚠️ รอบนี้ผมยังไม่ใส่ env ของ **หลังบ้าน** (\`SESSION_SECRET\` · \`ADMIN_EMAIL\` · \`ADMIN_PASSWORD_HASH\`) บน Vercel
     เพราะมติ D4 ยังไม่ให้เปิด \`/admin\` สู่อินเทอร์เน็ต ⇒ เดโม = ดูหน้าบ้านได้ แต่เข้าเครื่องมือจัดการไม่ได้

**ข้อควรระวังที่บันทึกไว้**
- Neon free = 0.5 GB ⇒ ปัจจุบันใช้ 146 MB · ถ้าการตลาดอัปโหลดภาพเพิ่มจำนวนมาก ต้องเฝ้าพื้นที่ (อัปเดตสคริปต์เตือนได้ถ้าจำเป็น)
- \`db:push\` อัปโหลด **ทั้งก้อน** (schema + ข้อมูล + ภาพ) ⇒ รันซ้ำ = เขียนทับ (ต้องสั่ง \`--allow-existing\` เท่านั้น)
- ยังไม่มี **ที่เก็บสำรองนอกเครื่อง** (หนี้เดิม § 10 รอบที่ 75) — เดโมนี้ทำให้มีสำเนาบนคลาวด์ด้วยในตัว
`;

r = `${r}\n${entry}`;
writeFileSync(roadmap, r);

/* ── AGENTS ───────────────────────────────────────────────────────────────── */
const agents = "C:/Users/user/waiwai_demo/AGENTS.md";
let a = readFileSync(agents, "utf8");

const bullet = [
  "  · **รอบที่ 114 — เตรียมฐานข้อมูลเดโมขึ้นคลาวด์ (Neon · สิงคโปร์):** เจ้าของแจ้งว่าการตลาดขอดูตัวอย่างข้อมูลหน้าบ้าน ⇒ ต้องย้ายข้อมูลขึ้นคลาวด์ ·",
  "มติเจ้าของ: **Neon (สิงคโปร์)** + **ใช้บัญชีที่มีอยู่** · วัดจริง: ข้อมูล **146 MB** (ภาพใน DB 129 MB) · ไม่ต้องใช้ส่วนขยายใด ๆ · PG 17 ตรงกับเครื่อง ·",
  "**พิสูจน์ฝั่งเราก่อนย้าย** — \`db:backup\` (144.3 MB · 22 ตาราง) + \`check:restore\` **ผ่าน** (ไบต์ภาพตรงทุกไบต์ · media 843) ·",
  "**เครื่องมือใหม่ \`npm run db:push\`** — กู้คืนขึ้นปลายทาง + เช็ค migration ไม่ค้าง + เทียบ **ลายนิ้วมือเนื้อหา** กับ manifest ทีละตาราง ·",
  "**การ์ดกันพลาด** \`lib/db/target.ts\` (เทสต์ 7): ปฏิเสธปลายทางซ้ำกับ dev · localhost/เครือข่ายภายใน · URL ผิด · ปลายทางต้องว่าง (ยกเว้น \`--allow-existing\`) · \`redactUrl()\` ซ่อนรหัสผ่านเสมอ ·",
  "⚠️ รอเจ้าของวาง \`TARGET_DATABASE_URL\` ใน \`.env.local\` แล้วรันคำสั่งเดียว (คู่มืออยู่ใน § 10 รอบที่ 114) · ยังไม่ใส่ env หลังบ้านบน Vercel (มติ D4)",
  "",
].join(" ");
const anchor2 = "  · **รอบที่ 113 — ย่อโลโก้ navbar";
if (!a.includes(anchor2)) throw new Error("ไม่พบจุดแทรกประวัติรอบ 114");
a = a.replace(anchor2, `${bullet}\n${anchor2}`);

/* ตาราง env หลังบ้าน: เพิ่ม TARGET_DATABASE_URL (ใช้เฉพาะสคริปต์ดันขึ้นคลาวด์) */
a = a.replace(
  "```bash\nnpm run admin:create -- --email=you@waiwai.co.th --password=... --write-env",
  "```bash\nnpm run admin:create -- --email=you@waiwai.co.th --password=... --write-env",
);
a = a.replace(
  "- ต้องมี: `ADMIN_EMAIL` · `ADMIN_PASSWORD_HASH` · `SESSION_SECRET` (≥32 ตัวอักษร) · `ADMIN_NAME`/`ADMIN_ROLE` ไม่บังคับ",
  "- ต้องมี: `ADMIN_EMAIL` · `ADMIN_PASSWORD_HASH` · `SESSION_SECRET` (≥32 ตัวอักษร) · `ADMIN_NAME`/`ADMIN_ROLE` ไม่บังคับ\n- `TARGET_DATABASE_URL` (รอบ 114) — ใช้เฉพาะ `npm run db:push` เพื่อดันข้อมูลขึ้นฐานข้อมูลปลายทาง (คลาวด์/เซิร์ฟเวอร์)** ห้าม commit",
);
writeFileSync(agents, a);

process.stdout.write("อัปเดตเอกสารรอบที่ 114 แล้ว\n");
