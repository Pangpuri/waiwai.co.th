import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ค่า SEO เริ่มต้นของแต่ละหน้า — ใช้ **เฉพาะการ์ดตัวอย่างในหลังบ้าน**
 *
 * ⚠️ ต้องตรงกับ `generateMetadata()` ของหน้าเว็บจริง (เช่น `app/[lang]/about/page.tsx`)
 *    ถ้าแก้ข้อความเริ่มต้นที่นั่น ให้แก้ที่นี่ด้วย ไม่งั้นการ์ดตัวอย่างจะไม่ตรงกับของจริง
 * ⚠️ หน้ารายละเอียดสินค้า/หน้าที่ไม่มีในทะเบียน = คืนค่าว่าง แล้ว UI จะ fallback เป็นชื่อหน้า
 */
export function pageSeoExample(
  pageId: string,
  messages: Messages,
): { readonly title: string; readonly description: string } {
  switch (pageId) {
    case "home":
      return { title: messages.meta.homeTitle, description: messages.meta.homeDescription };
    case "about":
      return { title: messages.about.meta.title, description: messages.about.meta.description };
    case "certifications":
      return {
        title: messages.about.certifications.meta.title,
        description: messages.about.certifications.meta.description,
      };
    case "executives":
      return {
        title: messages.about.executives.meta.title,
        description: messages.about.executives.meta.description,
      };
    case "contact":
      return { title: messages.contactPage.meta.title, description: messages.contactPage.meta.description };
    case "careers":
      return { title: messages.careersPage.meta.title, description: messages.careersPage.meta.description };
    case "products":
      return { title: messages.productsPage.meta.title, description: messages.productsPage.meta.description };
    case "recipes":
      return { title: messages.recipesPage.meta.title, description: messages.recipesPage.meta.description };
    case "news":
      return { title: messages.newsPage.meta.title, description: messages.newsPage.meta.description };
    default:
      return { title: "", description: "" };
  }
}
