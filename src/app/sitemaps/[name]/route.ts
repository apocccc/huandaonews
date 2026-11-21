import { notFound } from "next/navigation";
import {
  CATEGORY_INDEX_MIN_ARTICLES,
  getAllPublishedForSitemap,
  getCategoryArticleCounts,
  getVisibleCategories,
} from "@/lib/data";
import { absoluteUrl, articlePath } from "@/lib/site";
import {
  groupByMonth,
  SITEMAP_HEADERS,
  STATIC_PAGES,
  urlset,
  type SitemapUrl,
} from "@/lib/sitemap";

export const revalidate = 300;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  if (name === "pages.xml") {
    const [allCategories, articles, counts] = await Promise.all([
      getVisibleCategories(),
      getAllPublishedForSitemap(),
      getCategoryArticleCounts(),
    ]);
    // noindex にしている記事の少ないカテゴリーはサイトマップにも載せない
    const categories = allCategories.filter(
      (c) => (counts[c.slug] ?? 0) >= CATEGORY_INDEX_MIN_ARTICLES
    );
    const newest = articles.reduce<Date | undefined>(
      (max, a) => (!max || a.updatedAt > max ? a.updatedAt : max),
      undefined
    );
    const urls: SitemapUrl[] = [
      { loc: absoluteUrl("/"), lastmod: newest, changefreq: "hourly", priority: "1.0" },
      ...categories.map((c) => ({
        loc: absoluteUrl(`/category/${c.slug}`),
        changefreq: "hourly",
        priority: "0.8",
      })),
      ...STATIC_PAGES.map((p) => ({
        loc: absoluteUrl(p),
        changefreq: "monthly",
        priority: "0.3",
      })),
    ];
    return xml(urlset(urls));
  }

  // 公開月ごとの記事サイトマップ
  const month = name.match(/^articles-(\d{4}-\d{2})\.xml$/);
  if (month) {
    const group = groupByMonth(await getAllPublishedForSitemap()).find(
      (g) => g.month === month[1]
    );
    if (!group) notFound();
    return xml(urlset(group.articles.map(toUrl)));
  }

  // 旧形式 articles-{n}.xml(Search Console が既に知っているURL)。全記事を返す
  if (/^articles-\d+\.xml$/.test(name)) {
    return xml(urlset((await getAllPublishedForSitemap()).map(toUrl)));
  }

  notFound();
}

function toUrl(a: {
  slug: string;
  updatedAt: Date;
  category: { slug: string };
}): SitemapUrl {
  // lastmod は記事の実際の更新日時(dateModified と一致)
  return {
    loc: absoluteUrl(articlePath(a.category.slug, a.slug)),
    lastmod: a.updatedAt,
    priority: "0.7",
  };
}

function xml(body: string) {
  return new Response(body, { headers: SITEMAP_HEADERS });
}
