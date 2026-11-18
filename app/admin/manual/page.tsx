import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/dal";
import { can, permissionsOf, type AdminPermission } from "@/lib/auth/roles";
import { roleLabelOf } from "@/features/admin/rbac-labels";
import { getMessagesFor } from "@/lib/i18n/dictionaries";

/**
 * หน้าคู่มือการใช้งานระบบหลังบ้าน (Backend User Manual & RBAC Guide)
 * ออกแบบตามสถิติและขอบเขตการทำงานจริงจาก PRODUCT_ROADMAP.md และ PRODUCTROADMAP.md_Corporate_CMS_Backend_.md
 */
export default async function AdminManualPage() {
  const user = await requireAdminUser("manual");
  const messages = await getMessagesFor("th");
  const strings = messages.admin;

  const userRoleLabel = roleLabelOf(user.role, strings);
  const userPermissions = permissionsOf(user.role);

  const quickLinks: readonly {
    readonly label: string;
    readonly href: string;
    readonly perm: AdminPermission;
  }[] = [
    { label: "ภาพรวมหลังบ้าน (Dashboard)", href: "/admin", perm: "content" },
    { label: "แก้เนื้อหาหน้าแรก", href: "/admin/builder/home", perm: "presets" },
    { label: "จัดการสินค้าและหมวดหมู่", href: "/admin/products", perm: "content" },
    { label: "คลังภาพ (Media Library)", href: "/admin/media", perm: "media" },
    { label: "กล่องข้อความติดต่อลูกค้า (Inbox)", href: "/admin/inbox", perm: "inbox" },
    { label: "ถังขยะและกู้คืนข้อมูล (Trash)", href: "/admin/trash", perm: "trash" },
    { label: "ประกาศรับสมัครงาน (Careers)", href: "/admin/careers", perm: "careers" },
    { label: "ตั้งค่าระบบและองค์กร (Settings)", href: "/admin/settings", perm: "settings" },
    { label: "จัดการบัญชีผู้ดูแล (Users & RBAC)", href: "/admin/users", perm: "users" },
  ];

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10">
      {/* ส่วนหัวหน้าคู่มือ */}
      <header className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-fg-muted text-xs font-semibold tracking-wide uppercase">
              {strings.brand} · ระบบจัดการเว็บไซต์องค์กร
            </p>
            <h1 className="text-fg text-2xl font-bold sm:text-3xl">คู่มือการใช้งานหลังบ้านและสิทธิ์การเข้าถึง</h1>
          </div>
          <Link
            href="/admin"
            className="border-line bg-surface-hover text-fg rounded-xl border px-4 py-2 text-sm font-medium transition"
          >
            ← กลับหน้าภาพรวมหลังบ้าน
          </Link>
        </div>
        <p className="text-fg-muted text-sm leading-relaxed">
          คู่มือนี้จัดทำขึ้นเพื่ออธิบายสถาปัตยกรรม ขอบเขตการทำงาน และคู่มือการใช้งานระบบหลังบ้านแยกตามสิทธิ์ของผู้ใช้งาน
          โดยอ้างอิงจากแผนงานและกฎระเบียบของระบบ (Product Roadmap & RBAC Guidelines)
        </p>

        {/* ข้อมูลสิทธิ์ของผู้ใช้งานปัจจุบัน */}
        <div className="border-line bg-bg-muted mt-2 flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-fg-muted text-xs">บัญชีของคุณปัจจุบัน:</span>
            <span className="text-fg text-sm font-semibold">{user.email}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-fg-muted text-xs">บทบาท (Role):</span>
            <span className="text-primary text-sm font-bold">{userRoleLabel}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-fg-muted text-xs">สถานะสิทธิ์ในระบบ:</span>
            <span className="text-fg text-sm font-medium">เข้าถึงได้ {userPermissions.length} สิทธิ์</span>
          </div>
        </div>
      </header>

      {/* ส่วนที่ 1: ภาพรวมสถาปัตยกรรมและหลักการทำงานหลังบ้าน */}
      <section className="border-line bg-surface flex flex-col gap-4 rounded-2xl border p-6 shadow-sm">
        <h2 className="text-fg text-xl font-bold flex items-center gap-2">
          <span className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold">1</span>
          สถาปัตยกรรมหลังบ้านและแนวคิดหลัก (Core Architecture)
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="border-line bg-bg-muted/50 rounded-xl border p-4">
            <h3 className="text-fg font-semibold mb-1">1. Draft & Published Separation</h3>
            <p className="text-fg-muted text-xs leading-relaxed">
              การแก้ไขเนื้อหาทุกหน้าจะทำบน "ฉบับร่าง (Draft)" ก่อนเสมอ การเปลี่ยนแปลงจะไม่กระทบหน้าเว็บสาธารณะทันที จนกว่าจะกดปุ่มเผยแพร่ (Publish Explicitly) ป้องกันความผิดพลาดบนหน้าเว็บจริง
            </p>
          </div>
          <div className="border-line bg-bg-muted/50 rounded-xl border p-4">
            <h3 className="text-fg font-semibold mb-1">2. Revision History & Restore</h3>
            <p className="text-fg-muted text-xs leading-relaxed">
              ทุกครั้งที่มีการกดเผยแพร่ ระบบจะบันทึกภาพถ่าย (Snapshot) ของเนื้อหา ผู้ดูแลสามารถเปิดดูประวัติการแก้ไข ย้อนกลับ หรือเปรียบเทียบข้อความได้ตลอดเวลา
            </p>
          </div>
          <div className="border-line bg-bg-muted/50 rounded-xl border p-4">
            <h3 className="text-fg font-semibold mb-1">3. Secure Preview Tokens</h3>
            <p className="text-fg-muted text-xs leading-relaxed">
              สร้างลิงก์พรีวิวชั่วคราว (`/preview/[token]`) เพื่อให้ผู้บริหารหรือทีมงานตรวจสอบหน้าเว็บฉบับร่างได้โดยไม่ต้องมีบัญชีหลังบ้าน ลิงก์มีอายุจำกัดและไม่ถูกจัดเก็บบนเครื่องมือค้นหา
            </p>
          </div>
          <div className="border-line bg-bg-muted/50 rounded-xl border p-4">
            <h3 className="text-fg font-semibold mb-1">4. PDPA & Data Retention</h3>
            <p className="text-fg-muted text-xs leading-relaxed">
              กล่องข้อความติดต่อและประวัติการใช้งานถูกจัดการตามกฎหมายคุ้มครองข้อมูลส่วนบุคคล (PDPA) มีระบบลบข้อมูลอัตโนมัติและการลบตามคำขอ (Retention & Erasure) พร้อมประวัติการทำงาน (Audit Trail)
            </p>
          </div>
        </div>
      </section>

      {/* ส่วนที่ 2: คู่มือการใช้งานแยกตามสิทธิ์และบทบาท (Role-based Guide) */}
      <section className="border-line bg-surface flex flex-col gap-6 rounded-2xl border p-6 shadow-sm">
        <h2 className="text-fg text-xl font-bold flex items-center gap-2">
          <span className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold">2</span>
          คู่มือการใช้งานแยกตามบทบาทและสิทธิ์ (Role-Based Operational Scope)
        </h2>
        <p className="text-fg-muted text-sm">
          ระบบแบ่งบทบาทผู้ดูแลหลังบ้านออกเป็น 4 ระดับ เพื่อความปลอดภัยและการแบ่งแยกหน้าที่อย่างชัดเจน
        </p>

        <div className="flex flex-col gap-6">
          {/* Editor */}
          <div className="border-line bg-bg-muted/30 rounded-xl border p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-md text-xs font-bold uppercase">
                  Editor (บรรณาธิการเนื้อหา)
                </span>
                <span className="text-fg-muted text-xs">จัดการเนื้อหาและหน้าเว็บทั้งหมด</span>
              </div>
              <span className="text-xs font-semibold bg-surface border border-line px-2.5 py-1 rounded">
                สิทธิ์: content, careers, media, presets, preview, account, manual
              </span>
            </div>
            <p className="text-fg text-sm mb-3">
              <b>ขอบเขตการทำงาน:</b> เหมาะสำหรับทีม Content / Marketing ที่ทำหน้าที่สร้างและแก้ไขข้อความ รูปภาพ สินค้า ข่าวสาร เมนูอาหาร คณะผู้บริหาร และประกาศรับสมัครงาน
            </p>
            <div className="grid gap-2 sm:grid-cols-2 text-xs text-fg-muted">
              <div className="bg-surface border border-line p-2.5 rounded-lg">
                ✓ สร้าง/แก้ไขหน้าแรก บริษัท ผู้บริหาร สินค้า ข่าวสาร เมนู และส่วนกลาง
              </div>
              <div className="bg-surface border border-line p-2.5 rounded-lg">
                ✓ จัดการคลังภาพ (อัปโหลด ปรับแต่งขนาด และใส่คำบรรยาย)
              </div>
              <div className="bg-surface border border-line p-2.5 rounded-lg">
                ✓ สร้างลิงก์พรีวิวชั่วคราวให้ผู้บริหารตรวจสอบ
              </div>
              <div className="bg-surface border border-line p-2.5 rounded-lg">
                ✗ มองไม่เห็นกล่องข้อความลูกค้า (Inbox) และถังขยะส่วนกลาง
              </div>
            </div>
          </div>

          {/* Publisher */}
          <div className="border-line bg-bg-muted/30 rounded-xl border p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2.5 py-1 rounded-md text-xs font-bold uppercase">
                  Publisher (ผู้เผยแพร่)
                </span>
                <span className="text-fg-muted text-xs">Editor + ข้อมูลลูกค้า & SEO & ถังขยะ</span>
              </div>
              <span className="text-xs font-semibold bg-surface border border-line px-2.5 py-1 rounded">
                สิทธิ์: Editor ทุกสิทธิ์ + inbox, seo, trash, manual
              </span>
            </div>
            <p className="text-fg text-sm mb-3">
              <b>ขอบเขตการทำงาน:</b> มีสิทธิ์เทียบเท่า Editor แต่เพิ่มความสามารถในการจัดการกล่องข้อความติดต่อจากลูกค้า (Inbox) ตั้งค่า SEO ภาพรวมของเว็บไซต์ และกู้คืนหรือลบข้อมูลในถังขยะ
            </p>
            <div className="grid gap-2 sm:grid-cols-2 text-xs text-fg-muted">
              <div className="bg-surface border border-line p-2.5 rounded-lg">
                ✓ เปิดดูและจัดการข้อความติดต่อจากลูกค้า (คุ้มครองข้อมูล PDPA)
              </div>
              <div className="bg-surface border border-line p-2.5 rounded-lg">
                ✓ ตั้งค่า SEO ส่วนกลางและเมตาแท็กของเว็บ
              </div>
              <div className="bg-surface border border-line p-2.5 rounded-lg">
                ✓ จัดการถังขยะ (กู้คืนเนื้อหาที่ลบไป หรือลบถาวร)
              </div>
              <div className="bg-surface border border-line p-2.5 rounded-lg">
                ✗ ไม่สามารถสร้าง/บล็อกบัญชีผู้ดูแลอื่น หรือตั้งค่าระบบโครงสร้างเซิร์ฟเวอร์
              </div>
            </div>
          </div>

          {/* Admin */}
          <div className="border-line bg-bg-muted/30 rounded-xl border p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-md text-xs font-bold uppercase">
                  Admin (ผู้ดูแลระบบสูงสุด)
                </span>
                <span className="text-fg-muted text-xs">สิทธิ์สูงสุดทุกฟังก์ชัน</span>
              </div>
              <span className="text-xs font-semibold bg-surface border border-line px-2.5 py-1 rounded">
                สิทธิ์: ทุกสิทธิ์ในระบบ (15 สิทธิ์)
              </span>
            </div>
            <p className="text-fg text-sm mb-3">
              <b>ขอบเขตการทำงาน:</b> ควบคุมระบบทั้งหมด รวมถึงการจัดการบัญชีผู้ดูแล (สร้างบัญชี กำหนดบทบาท ปิด/เปิดบัญชี) ตั้งค่าข้อมูลองค์กร ระยะเวลาเก็บข้อมูล PDPA โหมดปิดปรับปรุง และดูรายงานสถิติการใช้งาน
            </p>
            <div className="grid gap-2 sm:grid-cols-2 text-xs text-fg-muted">
              <div className="bg-surface border border-line p-2.5 rounded-lg">
                ✓ จัดการบัญชีผู้ดูแลหลังบ้านและกำหนดบทบาท (Users & RBAC)
              </div>
              <div className="bg-surface border border-line p-2.5 rounded-lg">
                ✓ ตั้งค่าข้อมูลองค์กรและการเก็บรักษาข้อมูล PDPA / Retention
              </div>
              <div className="bg-surface border border-line p-2.5 rounded-lg">
                ✓ ควบคุมโหมดปิดปรับปรุงเว็บไซต์ (Maintenance Mode)
              </div>
              <div className="bg-surface border border-line p-2.5 rounded-lg">
                ✓ ดูรายงานสถิติการเข้าชมและคลิกเว็บไซต์ (Analytics)
              </div>
            </div>
          </div>

          {/* HR */}
          <div className="border-line bg-bg-muted/30 rounded-xl border p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-md text-xs font-bold uppercase">
                  HR (ฝ่ายทรัพยากรบุคคล)
                </span>
                <span className="text-fg-muted text-xs">เฉพาะประกาศงาน & บัญชีตัวเอง</span>
              </div>
              <span className="text-xs font-semibold bg-surface border border-line px-2.5 py-1 rounded">
                สิทธิ์: careers, account, manual
              </span>
            </div>
            <p className="text-fg text-sm mb-3">
              <b>ขอบเขตการทำงาน:</b> บทบาทเฉพาะทางสำหรับเจ้าหน้าที่ฝ่ายบุคคล สามารถจัดการประกาศรับสมัครงาน แก้ไขตำแหน่งงานว่าง และเปลี่ยนรหัสผ่านของบัญชีตัวเองได้เท่านั้น โดยไม่มีสิทธิ์แตะต้องเนื้อหาหน้าเว็บส่วนอื่น
            </p>
            <div className="grid gap-2 sm:grid-cols-2 text-xs text-fg-muted">
              <div className="bg-surface border border-line p-2.5 rounded-lg">
                ✓ เพิ่ม/แก้ไข/ปิดประกาศรับสมัครงาน (Careers)
              </div>
              <div className="bg-surface border border-line p-2.5 rounded-lg">
                ✓ เปลี่ยนรหัสผ่านและอีเมลของบัญชีตัวเอง
              </div>
              <div className="bg-surface border border-line p-2.5 rounded-lg">
                ✗ มองไม่เห็นเมนูหน้าเว็บอื่นๆ (สินค้า ข่าวสาร เมนู หน้าแรก ฯลฯ)
              </div>
              <div className="bg-surface border border-line p-2.5 rounded-lg">
                ✗ ไม่สามารถจัดการบัญชีผู้ดูแลคนอื่นได้
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ส่วนที่ 3: ลิงก์อ้างอิงและทางลัดตั้งค่าหลังบ้าน (แสดงเฉพาะลิงก์ที่ผู้ใช้มีสิทธิ์ตามรหัส can) */}
      <section className="border-line bg-surface flex flex-col gap-4 rounded-2xl border p-6 shadow-sm">
        <h2 className="text-fg text-xl font-bold flex items-center gap-2">
          <span className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold">3</span>
          ลิงก์อ้างอิงและเส้นทางลัดในหลังบ้าน (Quick Links & Navigation)
        </h2>
        <p className="text-fg-muted text-sm">
          คุณสามารถคลิกที่ลิงก์ด้านล่างเพื่อไปยังหน้าจอตั้งค่าหรือจัดการส่วนต่าง ๆ ของเว็บไซต์ได้ทันที (แสดงเฉพาะโมดูลที่บทบาทของคุณมีสิทธิ์เข้าถึง)
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-line border-b text-xs text-fg-muted uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3">ชื่อโมดูล / ส่วนงาน</th>
                <th className="py-3 px-3">เส้นทาง (URL)</th>
                <th className="py-3 px-3">สิทธิ์ที่ใช้</th>
                <th className="py-3 px-3 text-right">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y text-xs sm:text-sm">
              {quickLinks
                .filter((item) => can(user.role, item.perm))
                .map((item) => (
                  <tr key={item.href}>
                    <td className="py-3 px-3 font-semibold">{item.label}</td>
                    <td className="py-3 px-3 font-mono text-fg-muted">{item.href}</td>
                    <td className="py-3 px-3">{item.perm}</td>
                    <td className="py-3 px-3 text-right">
                      <Link href={item.href} className="text-primary hover:underline font-medium">
                        เปิดใช้งาน →
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
