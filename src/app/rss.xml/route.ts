import { buildFeedItems, FEED_CACHE_HEADERS, feedTitle, renderRss2 } from "@/lib/feeds";

export const revalidate = 300;

export async function GET() {
  const items = await buildFeedItems(undefined, 50);
  const xml = renderRss2(items, { title: feedTitle(), selfPath: "/rss.xml" });
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      ...FEED_CACHE_HEADERS,
    },
  });
}
