import { getAllPublishedForSitemap, getNewsSitemapArticles } from "@/lib/data";
import { absoluteUrl } from "@/lib/site";
import { groupByMonth, SITEMAP_HEADERS, sitemapIndex } from "@/lib/sitemap";

export const revalidate = 300;

/**
 * インデックスサイトマップ。
 * - pages.xml(トップ・カテゴリー・静的ページ)
 * - news-sitemap.xml(Googleニュース用・直近48時間)
 * - articles-YYYY-MM.xml(公開月ごと。lastmod はその月の最終更新日時)
 */
export async function GET() {
  const [articles, news] = await Promise.all([
    getAllPublishedForSitemap(),
    getNewsSitemapArticles(),
  ]);
  const months = groupByMonth(articles);
  const newest = months[0]?.lastmod;
  const newsLastmod = news[0]?.publishedAt ?? newest;

  const xml = sitemapIndex([
    { loc: absoluteUrl("/sitemaps/pages.xml"), lastmod: newest },
    { loc: absoluteUrl("/news-sitemap.xml"), lastmod: newsLastmod ?? undefined },
    ...months.map((m) => ({
      loc: absoluteUrl(`/sitemaps/articles-${m.month}.xml`),
      lastmod: m.lastmod,
    })),
  ]);

  return new Response(xml, { headers: SITEMAP_HEADERS });
}
