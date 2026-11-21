import type { Metadata } from "next";
import { StaticPage, staticPageMetadata } from "@/components/site/StaticPage";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return staticPageMetadata(locale, "editorialPolicy", "/editorial-policy");
}

export default async function EditorialPolicyPage({ params }: Props) {
  const { locale } = await params;
  return <StaticPage locale={locale} pageKey="editorialPolicy" path="/editorial-policy" />;
}
