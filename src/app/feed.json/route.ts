import { buildFeedItems, FEED_CACHE_HEADERS, feedTitle, renderJsonFeed } from "@/lib/feeds";

export const revalidate = 300;

export async function GET() {
  const items = await buildFeedItems(undefined, 50);
  const json = renderJsonFeed(items, {
    title: feedTitle(),
    selfPath: "/feed.json",
  });
  return new Response(json, {
    headers: {
      "Content-Type": "application/feed+json; charset=utf-8",
      ...FEED_CACHE_HEADERS,
    },
  });
}
