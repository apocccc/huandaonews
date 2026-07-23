import { buildFeedItems, FEED_CACHE_HEADERS, feedTitle, renderAtom } from "@/lib/feeds";

export const revalidate = 300;

export async function GET() {
  const items = await buildFeedItems(undefined, 50);
  const xml = renderAtom(items, { title: feedTitle(), selfPath: "/atom.xml" });
  return new Response(xml, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      ...FEED_CACHE_HEADERS,
    },
  });
}
