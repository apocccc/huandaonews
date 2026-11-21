import type { Metadata } from "next";
import { StaticPage, staticPageMetadata } from "@/components/site/StaticPage";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return staticPageMetadata(locale, "contact", "/contact");
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  return <StaticPage locale={locale} pageKey="contact" path="/contact" />;
}
