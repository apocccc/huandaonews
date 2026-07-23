import { getNewsSitemapArticles } from "@/lib/data";
import { absoluteUrl, articlePath, SITE_NAME_ZH } from "@/lib/site";
import { xmlEscape } from "@/lib/seo";

export const revalidate = 300;

/** Googleニュース用サイトマップ。直近48時間の記事のみ。 */
export async function GET() {
  const articles = await getNewsSitemapArticles();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${articles
  .map(
    (a) => `  <url>
    <loc>${xmlEscape(absoluteUrl(articlePath(a.category.slug, a.slug)))}</loc>
    <news:news>
      <news:publication>
        <news:name>${xmlEscape(SITE_NAME_ZH)}</news:name>
        <news:language>zh-tw</news:language>
      </news:publication>
      <news:publication_date>${(a.publishedAt ?? new Date()).toISOString()}</news:publication_date>
      <news:title>${xmlEscape(a.title)}</news:title>
    </news:news>
  </url>`
  )
  .join("\n")}
</urlset>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
