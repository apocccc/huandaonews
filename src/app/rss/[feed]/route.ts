import { notFound } from "next/navigation";
import { getCategoryBySlug } from "@/lib/data";
import { buildFeedItems, FEED_CACHE_HEADERS, feedTitle, renderRss2 } from "@/lib/feeds";

export const revalidate = 300;

/** /rss/{categorySlug}.xml — カテゴリー別RSS(press-release含む) */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ feed: string }> }
) {
  const { feed } = await params;
  if (!feed.endsWith(".xml")) notFound();
  const slug = feed.slice(0, -4);

  const category = await getCategoryBySlug(slug);
  if (!category && slug !== "latest") notFound();

  const items = await buildFeedItems(
    slug === "latest" ? undefined : slug,
    50
  );
  const xml = renderRss2(items, {
    title: feedTitle(category?.nameZh),
    selfPath: `/rss/${feed}`,
  });
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      ...FEED_CACHE_HEADERS,
    },
  });
}
