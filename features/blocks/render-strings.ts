import type { CareerFieldStrings, ContactFieldStrings } from "@/features/forms/ui/form-fields";
import type { SubmitFormStrings } from "@/features/forms/ui/submit-form";
import type { NewsletterFormLabels } from "@/features/home/ui/newsletter-form";
import { actions as coreTh } from "@/lib/i18n/messages/areas/th/core";
import { newsletter as newsletterTh } from "@/lib/i18n/messages/areas/th/home";
import { contactPage as contactTh } from "@/lib/i18n/messages/areas/th/contact";
import { careersPage as careersTh } from "@/lib/i18n/messages/areas/th/careers";
import { blocks as blocksTh } from "@/lib/i18n/messages/areas/th/blocks";
import { actions as coreEn } from "@/lib/i18n/messages/areas/en/core";
import { newsletter as newsletterEn } from "@/lib/i18n/messages/areas/en/home";
import { contactPage as contactEn } from "@/lib/i18n/messages/areas/en/contact";
import { careersPage as careersEn } from "@/lib/i18n/messages/areas/en/careers";
import { blocks as blocksEn } from "@/lib/i18n/messages/areas/en/blocks";

/**
 * ข้อความที่ "ตัวเรนเดอร์บล็อก" ต้องใช้ (รอบที่ 86) — **แหล่งเดียวสำหรับทั้ง server และ client**
 *
 * ทำไมต้องมีไฟล์นี้
 * - ตัวเรนเดอร์บล็อกถูกใช้ **ทั้งหน้าเว็บจริง (server)** และ **พรีวิวหลังบ้าน (client)** ⇒ import
 *   `lib/i18n/dictionaries.ts` ไม่ได้ (ไฟล์นั้น server-only)
 * - บล็อก "ฟอร์ม" ต้องใช้ **ข้อความของฟอร์มจริง** (ป้ายช่อง · ข้อความยินยอม · สถานะ) ⇒ ดึงจาก
 *   พื้นที่พจนานุกรมเดิมโดยตรง (ไม่พิมพ์ข้อความซ้ำ — ต้นทางเดียว)
 * - บล็อก "แกลเลอรี" ใช้ข้อความของ lightbox จากพื้นที่ใหม่ `blocks`
 *
 * ⚠️ ไฟล์นี้เป็น **ข้อมูลล้วน** (ไม่แตะ DOM/DB/Next) ⇒ ปลอดภัยทั้งสองฝั่ง และทดสอบได้ด้วย `node --test`
 */

export type GalleryStrings = {
  readonly open: string;
  readonly close: string;
  readonly dialog: string;
};

/** ข้อความของบล็อก "กระดานรับสมัครงาน" — ยืมป้ายจากพื้นที่ `careers` (ต้นทางเดียว ไม่พิมพ์ซ้ำ) */
export type JobBoardStrings = {
  readonly openingsUnit: string;
  readonly departmentLabel: string;
  readonly qualificationsLabel: string;
  readonly experienceLabel: string;
};

export type FormBlockStrings = {
  readonly contact: {
    readonly fields: ContactFieldStrings;
    readonly submit: SubmitFormStrings;
    readonly notice: string;
  };
  readonly newsletter: NewsletterFormLabels;
  readonly careers: {
    readonly fields: CareerFieldStrings;
    readonly submit: SubmitFormStrings;
  };
};

/** ข้อความของ "เลย์เอาต์หน้า" (X1.8) */
export type LayoutStrings = {
  /** ป้ายของสารบัญด้านข้าง (เลย์เอาต์ `sidebar`) */
  readonly tocLabel: string;
};

/** ข้อความของ "เมนูอาหาร" (รอบที่ 101) — ป้ายที่ตัวเรนเดอร์แสดง (ไม่ใช่เนื้อหาที่แก้จากหลังบ้าน) */
export type RecipeStrings = {
  readonly detailsLabel: string;
  readonly ingredientsLabel: string;
  readonly stepsLabel: string;
};

export type BlockRenderStrings = {
  readonly gallery: GalleryStrings;
  readonly form: FormBlockStrings;
  readonly jobBoard: JobBoardStrings;
  readonly recipe: RecipeStrings;
  readonly layout: LayoutStrings;
};

type CareersMessages = typeof careersTh;
type ContactMessages = typeof contactTh;
type NewsletterMessages = typeof newsletterTh;
type CoreMessages = typeof coreTh;
type BlocksMessages = typeof blocksTh;

function contactStringsOf(contact: ContactMessages): FormBlockStrings["contact"] {
  return {
    fields: {
      topicLabel: contact.topicLabel,
      topicPlaceholder: contact.topicPlaceholder,
      topics: contact.topics,
      nameLabel: contact.nameLabel,
      namePlaceholder: contact.namePlaceholder,
      emailLabel: contact.emailLabel,
      emailPlaceholder: contact.emailPlaceholder,
      phoneLabel: contact.phoneFieldLabel,
      phonePlaceholder: contact.phonePlaceholder,
      subjectLabel: contact.subjectLabel,
      subjectPlaceholder: contact.subjectPlaceholder,
      detailsLabel: contact.detailsLabel,
      detailsPlaceholder: contact.detailsPlaceholder,
      requiredNote: contact.requiredNote,
    },
    submit: {
      submit: contact.submit,
      submitting: contact.formSubmitting,
      consent: contact.consent,
      sent: contact.formSent,
      invalid: contact.formInvalid,
      rateLimited: contact.formRateLimited,
      unavailable: contact.formUnavailable,
      consentRequired: contact.formConsentRequired,
    },
    notice: contact.note,
  };
}

function careersStringsOf(careers: CareersMessages): FormBlockStrings["careers"] {
  return {
    fields: {
      positionLabel: careers.applyPositionLabel,
      positionPlaceholder: careers.applyPositionPlaceholder,
      jobTitle: (id) => careers.jobs[id].title,
      nameLabel: careers.applyNameLabel,
      phoneLabel: careers.applyPhoneLabel2,
      emailLabel: careers.applyEmailLabel2,
      resumeLabel: careers.applyResumeLabel,
      resumeHint: careers.applyResumeHint,
      messageLabel: careers.applyMessageLabel,
    },
    submit: {
      submit: careers.applySubmit,
      submitting: careers.applySubmitting,
      consent: careers.applyConsent,
      sent: careers.applySent,
      invalid: careers.applyInvalid,
      rateLimited: careers.applyRateLimited,
      unavailable: careers.applyUnavailable,
      consentRequired: careers.applyConsentRequired,
      fileInvalid: careers.applyResumeError,
    },
  };
}

function newsletterStringsOf(newsletter: NewsletterMessages, core: CoreMessages): NewsletterFormLabels {
  return {
    emailLabel: newsletter.emailLabel,
    emailPlaceholder: newsletter.emailPlaceholder,
    invalidEmail: newsletter.invalidEmail,
    consent: newsletter.consent,
    submit: core.subscribe,
    note: newsletter.note,
    submitting: newsletter.submitting,
    sent: newsletter.successMessage,
    rateLimited: newsletter.rateLimited,
    unavailable: newsletter.unavailable,
    consentRequired: newsletter.consentRequired,
  };
}

function galleryStringsOf(area: BlocksMessages): GalleryStrings {
  return { open: area.galleryOpen, close: area.galleryClose, dialog: area.galleryDialog };
}

function jobBoardStringsOf(careers: CareersMessages): JobBoardStrings {
  return {
    openingsUnit: careers.openingsUnit,
    departmentLabel: careers.stats.departments,
    qualificationsLabel: careers.fields.qualifications,
    experienceLabel: careers.fields.experience,
  };
}

function recipeStringsOf(area: BlocksMessages): RecipeStrings {
  return {
    detailsLabel: area.recipeDetailsLabel,
    ingredientsLabel: area.recipeIngredientsLabel,
    stepsLabel: area.recipeStepsLabel,
  };
}

/** ข้อความทั้งหมดที่ตัวเรนเดอร์บล็อกใช้ — แยกตามภาษา (ทั้งสองภาษาเป็นข้อมูลล้วน) */
export function blockRenderStringsFor(language: "th" | "en"): BlockRenderStrings {
  if (language === "en") {
    return {
      gallery: galleryStringsOf(blocksEn),
      jobBoard: jobBoardStringsOf(careersEn),
      recipe: recipeStringsOf(blocksEn),
      layout: { tocLabel: blocksEn.layoutTocLabel },
      form: {
        contact: contactStringsOf(contactEn),
        newsletter: newsletterStringsOf(newsletterEn, coreEn),
        careers: careersStringsOf(careersEn),
      },
    };
  }

  return {
    gallery: galleryStringsOf(blocksTh),
    jobBoard: jobBoardStringsOf(careersTh),
    recipe: recipeStringsOf(blocksTh),
    layout: { tocLabel: blocksTh.layoutTocLabel },
    form: {
      contact: contactStringsOf(contactTh),
      newsletter: newsletterStringsOf(newsletterTh, coreTh),
      careers: careersStringsOf(careersTh),
    },
  };
}
