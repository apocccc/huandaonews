import { notFound } from "next/navigation";
import { getAllPublishedForSitemap, getVisibleCategories } from "@/lib/data";
import { absoluteUrl, articlePath } from "@/lib/site";
import { xmlEscape } from "@/lib/seo";

export const revalidate = 3600;

const CHUNK_SIZE = 40000;

function urlset(
  urls: { loc: string; lastmod?: Date; changefreq?: string; priority?: string }[]
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${xmlEscape(u.loc)}</loc>
${u.lastmod ? `    <lastmod>${u.lastmod.toISOString()}</lastmod>` : ""}
${u.changefreq ? `    <changefreq>${u.changefreq}</changefreq>` : ""}
${u.priority ? `    <priority>${u.priority}</priority>` : ""}
  </url>`
  )
  .join("\n")}
</urlset>
`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  if (name === "pages.xml") {
    const categories = await getVisibleCategories();
    const urls = [
      { loc: absoluteUrl("/"), changefreq: "hourly", priority: "1.0" },
      { loc: absoluteUrl("/en"), changefreq: "hourly", priority: "0.8" },
      ...categories.map((c) => ({
        loc: absoluteUrl(`/category/${c.slug}`),
        changefreq: "hourly",
        priority: "0.8",
      })),
      ...categories.map((c) => ({
        loc: absoluteUrl(`/en/category/${c.slug}`),
        changefreq: "hourly",
        priority: "0.6",
      })),
      { loc: absoluteUrl("/about"), changefreq: "monthly", priority: "0.3" },
      { loc: absoluteUrl("/contact"), changefreq: "monthly", priority: "0.3" },
      { loc: absoluteUrl("/privacy"), changefreq: "monthly", priority: "0.3" },
    ];
    return xmlResponse(urlset(urls));
  }

  const m = name.match(/^articles-(\d+)\.xml$/);
  if (m) {
    const chunk = parseInt(m[1], 10);
    const articles = await getAllPublishedForSitemap();
    const start = (chunk - 1) * CHUNK_SIZE;
    if (chunk < 1 || (start > 0 && start >= articles.length)) notFound();
    const slice = articles.slice(start, start + CHUNK_SIZE);
    const urls = slice.map((a) => ({
      loc: absoluteUrl(articlePath(a.category.slug, a.slug)),
      lastmod: a.updatedAt,
      priority: "0.7",
    }));
    return xmlResponse(urlset(urls));
  }

  notFound();
}

function xmlResponse(xml: string) {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
    },
  });
}
