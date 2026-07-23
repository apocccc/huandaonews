import type { Metadata } from "next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { auth } from "@/lib/auth";
import { inter, notoSansTC } from "@/lib/fonts";
import "../../globals.css";

export const metadata: Metadata = {
  title: "環島新聞網 Admin",
  robots: { index: false, follow: false },
};

function toIntlLocale(value?: string): "zh-Hant" | "en" | "ja" {
  if (value === "en" || value === "ja") return value;
  return "zh-Hant";
}

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // クッキー(ログイン時・言語変更時に同期)優先、なければセッションのプロフィール設定
  const store = await cookies();
  const session = await auth();
  const cookieLocale = store.get("ADMIN_LOCALE")?.value;
  const dbLocale =
    session?.user?.adminLocale === "zh_Hant"
      ? "zh-Hant"
      : session?.user?.adminLocale;
  const locale = toIntlLocale(cookieLocale ?? dbLocale);
  const messages = (await import(`../../../../messages/${locale}/admin.json`))
    .default;

  return (
    <html lang={locale === "zh-Hant" ? "zh-Hant" : locale}>
      <body
        className={`${notoSansTC.variable} ${inter.variable} font-sans bg-bg-sub text-ink min-h-screen`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
