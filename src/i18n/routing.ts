import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["zh-Hant", "en"],
  defaultLocale: "zh-Hant",
  // 繁体字はプレフィックスなし、英語UIのみ /en プレフィックス
  localePrefix: "as-needed",
  localeCookie: {
    name: "SITE_LOCALE",
  },
});

export type SiteLocale = (typeof routing.locales)[number];
