import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type SiteLocale } from "@/i18n/routing";
import { inter, notoSansTC } from "@/lib/fonts";
import { getVisibleCategories } from "@/lib/data";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GoogleAnalytics } from "@/components/site/GoogleAnalytics";
import { JsonLd } from "@/components/JsonLd";
import { organizationJsonLd, pageMetadata, webSiteJsonLd } from "@/lib/seo";
import { absoluteUrl, SITE_URL } from "@/lib/site";
import "../../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t("name"),
      template: `%s | ${t("name")}`,
    },
    // 既定値(各ページが pageMetadata で canonical / OGP / description を上書きする)
    ...pageMetadata({ description: t("description"), path: "/" }),
    manifest: "/manifest.webmanifest",
    alternates: {
      types: {
        "application/rss+xml": [
          { url: absoluteUrl("/rss.xml"), title: t("name") },
        ],
      },
    },
  };
}

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as SiteLocale)) {
    notFound();
  }
  setRequestLocale(locale);

  const categories = await getVisibleCategories();

  return (
    <html lang="zh-Hant">
      <body
        className={`${notoSansTC.variable} ${inter.variable} font-sans bg-bg text-ink min-h-screen flex flex-col`}
      >
        <JsonLd data={[organizationJsonLd(), webSiteJsonLd()]} />
        {/* 公開サイトのみ計測(管理画面は別レイアウトのため対象外) */}
        {process.env.NEXT_PUBLIC_GA_ID ? (
          <GoogleAnalytics id={process.env.NEXT_PUBLIC_GA_ID} />
        ) : null}
        <NextIntlClientProvider>
          <SiteHeader categories={categories} locale={locale} />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
