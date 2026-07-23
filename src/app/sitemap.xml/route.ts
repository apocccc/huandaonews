import { getAllPublishedForSitemap } from "@/lib/data";
import { absoluteUrl } from "@/lib/site";
import { xmlEscape } from "@/lib/seo";

export const revalidate = 3600;

const SITEMAP_CHUNK_SIZE = 40000;

/**
 * インデックスサイトマップ。5万件超に備え、記事は4万件ごとに分割した
 * /sitemaps/articles-{n}.xml を参照する。
 */
export async function GET() {
  const articles = await getAllPublishedForSitemap();
  const chunks = Math.max(1, Math.ceil(articles.length / SITEMAP_CHUNK_SIZE));

  const sitemaps = [
    absoluteUrl("/sitemaps/pages.xml"),
    ...Array.from({ length: chunks }, (_, i) =>
      absoluteUrl(`/sitemaps/articles-${i + 1}.xml`)
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(
    (u) => `  <sitemap>
    <loc>${xmlEscape(u)}</loc>
  </sitemap>`
  )
  .join("\n")}
</sitemapindex>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
    },
  });
}
