import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AboutHero } from "@/features/about/ui/about-hero";
import { CompanyAwards } from "@/features/about/ui/company-awards";
import { CompanyDirection } from "@/features/about/ui/company-direction";
import { CompanyDistribution } from "@/features/about/ui/company-distribution";
import { CompanyExplore } from "@/features/about/ui/company-explore";
import { CompanyFacilities } from "@/features/about/ui/company-facilities";
import { CompanyPeople } from "@/features/about/ui/company-people";
import { CompanyProducts } from "@/features/about/ui/company-products";
import { CompanyResearch } from "@/features/about/ui/company-research";
import { CompanyStory } from "@/features/about/ui/company-story";
import { buildAlternates, isLocale } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/about">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};

  const messages = await getMessagesFor(lang);

  return {
    // ชื่อหน้ามีคำว่า "เกี่ยวกับไวไว" อยู่แล้ว จึงใช้ absolute เพื่อไม่ให้ต่อท้ายด้วยชื่อเว็บซ้ำ
    title: { absolute: messages.about.meta.title },
    description: messages.about.meta.description,
    alternates: buildAlternates(lang, "/about"),
    openGraph: {
      title: messages.about.meta.title,
      description: messages.about.meta.description,
    },
  };
}

export default async function AboutPage({ params }: PageProps<"/[lang]/about">) {
  const { lang } = await params;

  // ภาษาที่ไม่รองรับ → 404 (ไม่ใช่ 500) เหมือนหน้าแรก
  if (!isLocale(lang)) notFound();
  const messages = await getMessages(lang);

  return (
    <>
      <AboutHero locale={lang} messages={messages} />
      <CompanyStory locale={lang} messages={messages} />
      <CompanyFacilities messages={messages} />
      <CompanyDirection messages={messages} />
      <CompanyResearch messages={messages} />
      <CompanyProducts messages={messages} />
      <CompanyDistribution messages={messages} />
      <CompanyPeople messages={messages} />
      <CompanyAwards locale={lang} messages={messages} />
      <CompanyExplore locale={lang} messages={messages} />
    </>
  );
}
