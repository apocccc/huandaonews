export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://huandaonews.com"
).replace(/\/$/, "");

export const SITE_NAME_ZH = "環島新聞網";
export const SITE_NAME_EN = "Huandao News";

export const TAIPEI_TZ = "Asia/Taipei";

/** 絶対URLを生成する。path は必ず / 始まり */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

export function articlePath(categorySlug: string, articleSlug: string): string {
  return `/news/${categorySlug}/${articleSlug}`;
}

/** 台北時間で日時を表示する */
export function formatTaipei(
  date: Date,
  locale: string,
  opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }
): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-TW", {
    ...opts,
    timeZone: TAIPEI_TZ,
  }).format(date);
}
