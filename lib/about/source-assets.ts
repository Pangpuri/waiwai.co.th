/**
 * **ไฟล์ต้นทางที่ต้องเตรียมไว้ล่วงหน้า** ของหน้าบริษัท (/about) — รอบที่ 255 · หนี้ D-253-1
 *
 * ## ทำไมต้องมี
 * ตัวนำเข้า (`npm run about:import`) ดึงรูปจากหน้าต้นทางเข้าคลังภาพ แต่คลังภาพของเรา
 * **รับเฉพาะ PNG/JPEG/WebP** (`lib/media/image-info.ts` — เป็นด่านความปลอดภัย ไม่ใช่ข้อจำกัดชั่วคราว)
 * ขณะที่แบนเนอร์หัวหน้าของต้นทางเป็น **GIF**
 * ⇒ เราแปลงไฟล์นั้นเป็น PNG **ครั้งเดียว** แล้วเก็บไว้ในโปรเจกต์ + จำ `sha256` ไว้
 *    ตัวนำเข้าจะหยิบไฟล์ในเครื่องแทนการดาวน์โหลด (และทดสอบได้ว่าไฟล์ไม่ถูกเปลี่ยน — เหมือน `about-media`)
 *
 * ## วิธีเตรียมไฟล์ใหม่ (ถ้าต้นทางเปลี่ยน)
 * ```powershell
 * Add-Type -AssemblyName System.Drawing
 * $img = [System.Drawing.Image]::FromFile('banner.gif')
 * $img.Save('public/about/banner.png', [System.Drawing.Imaging.ImageFormat]::Png)
 * ```
 * แล้วอัปเดต `sha256` ในตารางนี้ (คำนวณจากไฟล์จริง: `sha256sum public/about/banner.png`)
 *
 * ⚠️ ไฟล์ต้นทาง (GIF) **ไม่ถูก commit** — มีแต่ไฟล์ที่แปลงแล้วใน `public/about/`
 * ⚠️ ถ้าต้นทางเปลี่ยนภาพ ตัวทดสอบ `scripts/test-about-import.ts` จะฟ้องว่า sha256 ไม่ตรง ⇒ ต้องแปลงใหม่
 */

export type AboutSourceAsset = {
  /** คีย์ที่โค้ดอ้างถึง */
  readonly key: string;
  /** URL ต้นทาง — ใช้จับคู่ตอนแกะหน้า (ค่าตรงกับ `<img src>` ของต้นทางเป๊ะ) */
  readonly sourceUrl: string;
  /** ไฟล์ที่เตรียมไว้ในโปรเจกต์ (พาธใต้ `public/`) */
  readonly publicPath: string;
  /** ลายนิ้วมือของไฟล์ที่แปลงแล้ว — ตัวทดสอบเทียบกับไฟล์จริงเสมอ */
  readonly sha256: string;
  /** เหตุผลที่ต้องเตรียมล่วงหน้า (ตรวจย้อนหลังได้) */
  readonly reason: string;
};

export const ABOUT_SOURCE_ASSETS: readonly AboutSourceAsset[] = [
  {
    key: "banner",
    sourceUrl: "https://cdn.igetweb.com/uploads/5052/filemanager/ecedfd19be18ca061efb2ef5b1ef1146.gif",
    publicPath: "/about/banner.png",
    sha256: "060b2d17d40be85191be76e3df7e08eebd2a576a28650812caced9a14f0e624b",
    reason: "ต้นทางเป็น GIF89a 800×367 (คลังภาพรับ PNG/JPEG/WebP) ⇒ แปลงเป็น PNG ล่วงหน้าด้วย System.Drawing",
  },
];

/** หาไฟล์ที่เตรียมไว้ล่วงหน้าจาก URL ต้นทาง — ไม่มี = ให้ดาวน์โหลดจากเครือข่ายตามปกติ */
export function aboutSourceAssetOf(url: string): AboutSourceAsset | null {
  return ABOUT_SOURCE_ASSETS.find((asset) => asset.sourceUrl === url) ?? null;
}
