import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // 公開サイトは繁体字のみ(英語UIは廃止)
  locales: ["zh-Hant"],
  defaultLocale: "zh-Hant",
  localePrefix: "never",
  localeDetection: false,
});

export type SiteLocale = (typeof routing.locales)[number];
