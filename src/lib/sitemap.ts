import { xmlEscape } from "@/lib/seo";
import { TAIPEI_TZ } from "@/lib/site";

/**
 * すべてのサイトマップの共通キャッシュ方針。
 * ブラウザにはキャッシュさせず、CDN は最大5分で再検証する(新着の発見を遅らせない)。
 */
export const SITEMAP_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=60",
};

/** サイトマップに載せる静的ページ */
export const STATIC_PAGES = [
  "/about",
  "/editorial-policy",
  "/corrections",
  "/contact",
  "/terms",
  "/privacy",
];

export type SitemapUrl = {
  loc: string;
  lastmod?: Date;
  changefreq?: string;
  priority?: string;
};

export function urlset(urls: SitemapUrl[]): string {
  const body = urls
    .map((u) =>
      [
        "  <url>",
        `    <loc>${xmlEscape(u.loc)}</loc>`,
        u.lastmod ? `    <lastmod>${u.lastmod.toISOString()}</lastmod>` : null,
        u.changefreq ? `    <changefreq>${u.changefreq}</changefreq>` : null,
        u.priority ? `    <priority>${u.priority}</priority>` : null,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

export function sitemapIndex(entries: { loc: string; lastmod?: Date }[]): string {
  const body = entries
    .map((e) =>
      [
        "  <sitemap>",
        `    <loc>${xmlEscape(e.loc)}</loc>`,
        e.lastmod ? `    <lastmod>${e.lastmod.toISOString()}</lastmod>` : null,
        "  </sitemap>",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>
`;
}

/** 公開日時の年月(台北時間)を "YYYY-MM" で返す */
export function monthKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TAIPEI_TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return `${y}-${m}`;
}

type SitemapArticle = {
  slug: string;
  updatedAt: Date;
  publishedAt: Date | null;
  category: { slug: string };
};

/**
 * 記事を公開月ごとにまとめる。各月の lastmod はその月の記事の最終更新日時。
 * 記事の更新があった月だけ lastmod が動くため、Google が差分だけ再取得できる。
 */
export function groupByMonth<T extends SitemapArticle>(
  articles: T[]
): { month: string; articles: T[]; lastmod: Date }[] {
  const map = new Map<string, T[]>();
  for (const a of articles) {
    const key = monthKey(a.publishedAt ?? a.updatedAt);
    const list = map.get(key) ?? [];
    list.push(a);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([month, list]) => ({
      month,
      articles: list,
      lastmod: new Date(Math.max(...list.map((a) => a.updatedAt.getTime()))),
    }));
}
