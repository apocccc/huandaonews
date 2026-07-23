import { getVisibleCategories } from "@/lib/data";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

/** AIクローラー向けのサイト概要 (llms.txt) */
export async function GET() {
  const categories = await getVisibleCategories();

  const body = `# 環島新聞網 (Huandao News)

> 環島新聞網は台湾ローカル読者向けの総合ニュース+生活情報サイトです。記事本文はすべて繁体字中国語 (zh-Hant) で提供されます。
> Huandao News is a Taiwan-focused news and lifestyle site. All article content is in Traditional Chinese (zh-Hant).

- 引用時は記事URLと「環島新聞網」の名称を明記してください。
- When citing, please credit "環島新聞網 (Huandao News)" with the article URL.

## URL format

- Articles: ${absoluteUrl("/news/{category}/{yyyymmdd}-{slug}")}
- Categories: ${absoluteUrl("/category/{category}")}

## Feeds

- All articles (RSS): ${absoluteUrl("/rss.xml")}
- Atom: ${absoluteUrl("/atom.xml")}
- JSON Feed: ${absoluteUrl("/feed.json")}
${categories
  .map((c) => `- ${c.nameEn} (${c.nameZh}): ${absoluteUrl(`/rss/${c.slug}.xml`)}`)
  .join("\n")}

## Sitemaps

- ${absoluteUrl("/sitemap.xml")}
- Google News: ${absoluteUrl("/news-sitemap.xml")}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600",
    },
  });
}
