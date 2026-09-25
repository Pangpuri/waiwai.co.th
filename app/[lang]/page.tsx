import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BrandStory } from "@/features/home/ui/brand-story";
import { Hero } from "@/features/home/ui/hero";
import { NewsList } from "@/features/home/ui/news-list";
import { Newsletter } from "@/features/home/ui/newsletter";
import { ProductsShowcase } from "@/features/home/ui/products-showcase";
import { Recipes } from "@/features/home/ui/recipes";
import { Sustainability } from "@/features/home/ui/sustainability";
import { WhereToBuy } from "@/features/home/ui/where-to-buy";
import { buildAlternates, isLocale } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};

  const messages = await getMessagesFor(lang);

  return {
    // หน้าแรกไม่ต้องต่อท้ายด้วยชื่อเว็บ เพราะหัวข้อมีชื่อแบรนด์อยู่แล้ว
    title: { absolute: messages.meta.homeTitle },
    description: messages.meta.homeDescription,
    alternates: buildAlternates(lang),
  };
}

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;

  // ภาษาที่ไม่รองรับ → 404 (ไม่ใช่ 500)
  if (!isLocale(lang)) notFound();
  const messages = await getMessages(lang);

  return (
    <>
      <Hero locale={lang} messages={messages} />
      <ProductsShowcase locale={lang} messages={messages} />
      <BrandStory locale={lang} messages={messages} />
      <Sustainability messages={messages} />
      <Recipes locale={lang} messages={messages} />
      <NewsList locale={lang} messages={messages} />
      <WhereToBuy locale={lang} messages={messages} />
      <Newsletter messages={messages} />
    </>
  );
}
