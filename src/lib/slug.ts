import { TAIPEI_TZ } from "@/lib/site";

/** 台北時間基準の yyyymmdd */
export function dateStamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TAIPEI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return parts.replace(/-/g, "");
}

/** 英数字ベースの短いスラッグへ正規化(小文字・ハイフン区切り、中文は除去) */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** `{yyyymmdd}-{slug}` 形式の記事スラッグを生成 */
export function articleSlug(base: string, date = new Date()): string {
  const s = slugify(base);
  return `${dateStamp(date)}-${s || "article"}`;
}

/** スラッグ形式のバリデーション */
export function isValidArticleSlug(slug: string): boolean {
  return /^\d{8}-[a-z0-9][a-z0-9-]*$/.test(slug);
}
