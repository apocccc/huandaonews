import type { Metadata } from "next";
import { StaticPage, staticPageMetadata } from "@/components/site/StaticPage";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return staticPageMetadata(locale, "about", "/about");
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  return <StaticPage locale={locale} pageKey="about" path="/about" />;
}
