import {
  assessHomePage,
  assessNewsArticlePage,
  assessNewsListPage,
  isVercelProtectionPage,
  pooledEndpointWarning,
} from "@/lib/deploy/verify";

/**
 * `npm run check:deploy -- --url=https://…` (รอบที่ 117)
 *
 * ตรวจ **หน้าเว็บที่ deploy แล้วจริง** ว่าดึงข้อมูลจากฐานข้อมูลคลาวด์ได้ ไม่ใช่ "200 แต่ไม่มีข้อมูล"
 * (อาการที่อันตรายที่สุดของเดโม เพราะหน้าเว็บไม่พัง — แค่เงียบ)
 *
 * ตรวจอะไร
 * 1. `/th` และ `/en` — ต้องมีลิงก์หมวดสินค้า 6 ใบ · จำนวนสินค้า > 0 · ลิงก์ข่าวจริง 3 ใบ · ไม่มีข้อความทดสอบ
 * 2. `/th/news` — ต้องบอกจำนวนข่าวทั้งหมด > 0
 * 3. ลิงก์ข่าว 1 ใบที่เจอบนหน้ารวม → เปิดจริงได้ (และมีเนื้อหา)
 * 4. รูปจากคลาวด์: หา `/media/<id>` จากหน้าที่เปิดมา แล้วยิงจริง 1 รูป
 *
 * ไม่แตะฐานข้อมูลเลย (ตรวจจาก HTTP เท่านั้น) ⇒ ใช้ตรวจได้ทุกที่ รวมถึงตรวจจากเครื่องอื่น
 * ตัวเลือก: `--url=` (จำเป็น) · `--json`
 */

type Options = { readonly baseUrl: string; readonly json: boolean };

function parseArgs(argv: readonly string[]): Options {
  let baseUrl = "";
  let json = false;

  for (const arg of argv) {
    if (arg.startsWith("--url=")) baseUrl = arg.slice("--url=".length).trim();
    else if (arg === "--json") json = true;
    else if (arg.trim() !== "") throw new Error(`ไม่รู้จักตัวเลือก: ${arg}`);
  }

  if (baseUrl === "") {
    throw new Error("ต้องระบุ --url=https://โดเมนของเว็บที่ deploy แล้ว (เช่น --url=https://waiwai-demo.vercel.app)");
  }

  return { baseUrl: baseUrl.replace(/\/$/, ""), json };
}

async function fetchText(url: string): Promise<{ readonly status: number; readonly body: string }> {
  const response = await fetch(url, { redirect: "follow", headers: { "user-agent": "waiwai-check-deploy" } });
  return { status: response.status, body: await response.text() };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pooledWarning = pooledEndpointWarning(process.env["DATABASE_URL"] ?? "");
  const failures: string[] = [];

  const results: string[] = [];

  for (const locale of ["th", "en"] as const) {
    const { status, body } = await fetchText(`${options.baseUrl}/${locale}`);

    /*
      ⚠️ เคสจริง 2026-10-05: deployment เปิด Deployment Protection อยู่ ⇒ คำขอจากคนที่ไม่ได้ล็อกอิน
      ได้หน้า "Protected by Vercel Authentication" (HTTP 200 · ~263 ไบต์) ไม่ใช่เว็บของเรา
      ถ้าไม่จับก่อน เครื่องมือจะวินิจฉัยผิดว่า "หน้าเว็บว่างเพราะฐานข้อมูลไม่ถูกตั้งค่า" (ผิดคน)
    */
    if (isVercelProtectionPage(body)) {
      process.stderr.write(
        `\n✗ ${options.baseUrl} ถูกป้องกันด้วย **Vercel Authentication** (Deployment Protection)\n` +
          "   ⇒ คนภายนอก (เช่น การตลาด) เปิดดูไม่ได้ และตรวจเนื้อหาไม่ได้เลย\n" +
          "   วิธีแก้: Vercel → โปรเจกต์ → Settings → Deployment Protection → Vercel Authentication = Disabled\n" +
          "   หรือใช้โดเมน production (เช่น <project>.vercel.app) แทน URL ของ deployment ที่มี hash\n",
      );
      process.exit(1);
    }

    const assessment = assessHomePage(body);
    results.push(`/${locale} (HTTP ${status}) — ${assessment.summary}`);
    if (status !== 200) failures.push(`/${locale} ตอบ HTTP ${status}`);
    for (const issue of assessment.issues) failures.push(`/${locale}: ${issue.message}`);
  }

  {
    const { status, body } = await fetchText(`${options.baseUrl}/th/news`);
    if (isVercelProtectionPage(body)) {
      process.stderr.write("\n✗ /th/news ก็ถูกป้องกันด้วย Vercel Authentication (ตรวจเนื้อหาไม่ได้)\n");
      process.exit(1);
    }
    const news = assessNewsListPage(body);
    results.push(`/th/news (HTTP ${status}) — จำนวนข่าวทั้งหมด: ${news.total === null ? "อ่านไม่ได้" : String(news.total)}`);
    if (status !== 200) failures.push(`/th/news ตอบ HTTP ${status}`);
    if (!news.ok) failures.push("/th/news: อ่านจำนวนข่าวไม่ได้/เป็น 0 (ฐานข้อมูลน่าจะไม่ถูกตั้งค่า)");
  }

  /* ลิงก์ข่าวรายชิ้น: เปิดจริง 1 ใบ */
  {
    const { body: listHtml } = await fetchText(`${options.baseUrl}/th/news`);
    const first = listHtml.match(/\/th\/news\/(\d+)/)?.[0];
    if (first === undefined) {
      failures.push("หาลิงก์ข่าวรายชิ้นบนหน้ารวมไม่เจอ — หน้ารวมอาจว่าง");
    } else {
      const { status, body } = await fetchText(`${options.baseUrl}${first}`);
      /* ⚠️ ห้ามตัดสินจากข้อความในพจนานุกรม — ข้อความหน้า 404 อยู่ใน RSC payload ของทุกหน้า (false positive รอบ 117)
         ตัวชี้วัดจริง: HTTP 200 + มี <h1> (ชื่อข่าว) + ขนาดเนื้อหาเพียงพอ */
      const article = assessNewsArticlePage({ status, html: body });
      results.push(
        `${first} (HTTP ${status}) — ${article.ok ? "มีเนื้อหาจริง ✓" : `ผิดปกติ: ${article.reason ?? ""}`}`,
      );
      if (!article.ok) failures.push(`${first}: เปิดหน้าข่าวรายชิ้นไม่สำเร็จ (${article.reason ?? ""})`);
    }
  }

  /* รูปจากฐานข้อมูลคลาวด์: หา /media/<id> จากหน้าแรกแล้วยิงจริง */
  {
    const { body } = await fetchText(`${options.baseUrl}/th`);
    const mediaMatch =
      body.match(/\/_next\/image\?url=%2Fmedia%2F([A-Za-z0-9_-]+)/) ?? body.match(/\/media\/([A-Za-z0-9_-]{6,})/);
    const mediaId = mediaMatch?.[1];
    if (mediaId === undefined) {
      failures.push("ไม่พบรูปจากคลัง (/media/<id>) บนหน้าแรก — ภาพอาจไม่ขึ้น");
    } else {
      const response = await fetch(`${options.baseUrl}/media/${mediaId}`, { headers: { "user-agent": "waiwai-check-deploy" } });
      const type = response.headers.get("content-type") ?? "?";
      results.push(`/media/${mediaId} (HTTP ${response.status}) — ${type}`);
      if (response.status !== 200 || !type.startsWith("image/")) {
        failures.push(`/media/${mediaId}: เสิร์ฟรูปไม่สำเร็จ (HTTP ${response.status} · ${type})`);
      }
    }
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ ok: failures.length === 0, results, failures }, null, 2)}\n`);
  } else {
    process.stdout.write(`\nตรวจเว็บที่ deploy แล้ว: ${options.baseUrl}\n`);
    for (const line of results) process.stdout.write(`  · ${line}\n`);
    if (pooledWarning !== null) process.stdout.write(`\n⚠️ ${pooledWarning}\n`);
    if (failures.length > 0) {
      process.stdout.write(`\n✗ พบ ${failures.length} ปัญหา:\n`);
      for (const line of failures) process.stdout.write(`    ${line}\n`);
    } else {
      process.stdout.write("\n✓ ผ่านทั้งหมด — หน้าเว็บดึงข้อมูลจริงจากฐานข้อมูลได้ (พร้อมให้การตลาดดู)\n");
    }
  }

  if (failures.length > 0) process.exit(1);
}

await main();
