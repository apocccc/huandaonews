import Parser from "rss-parser";
import { createHash } from "crypto";
import { generateJSON } from "@tiptap/html";
import type { JSONContent } from "@tiptap/core";
import { prisma } from "@/lib/prisma";
import { bodyExtensions, extractText } from "@/lib/tiptap";
import { storeRemoteImage } from "@/lib/media-store";
import { dateStamp } from "@/lib/slug";
import { revalidateArticle } from "@/lib/revalidate";
import type { RssFeed } from "@prisma/client";

const MAX_ITEMS_PER_FETCH = 30;
const MAX_INLINE_IMAGES = 10;

type FeedItem = {
  title?: string;
  link?: string;
  guid?: string;
  isoDate?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  "content:encoded"?: string;
  enclosure?: { url?: string; type?: string };
  mediaContent?: { $?: { url?: string } }[];
};

const parser: Parser<object, FeedItem> = new Parser({
  timeout: 20_000,
  headers: { "User-Agent": "HuandaoNewsBot/1.0 (+https://huandaonews.com)" },
  customFields: {
    item: [
      ["content:encoded", "content:encoded"],
      ["media:content", "mediaContent", { keepArray: true }],
    ],
  },
});

export type ImportResult = {
  imported: number;
  skipped: number;
  errors: number;
  articleIds: string[];
};

/** RSS取り込み記事の著者(システムユーザー)。編集部アカウントを優先 */
async function getImportUser() {
  const editorial =
    (await prisma.user.findUnique({ where: { slug: "editorial" } })) ??
    (await prisma.user.findFirst({ where: { role: "admin" } }));
  if (editorial) return editorial;
  throw new Error("No admin user found for RSS import");
}

function guidOf(item: FeedItem): string | null {
  const raw = item.guid || item.link;
  return raw ? raw.trim() : null;
}

function hash8(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 8);
}

/** HTML本文から <img> の src を列挙する */
function extractImgSrcs(html: string): string[] {
  const srcs: string[] = [];
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[1].startsWith("http")) srcs.push(m[1]);
  }
  return [...new Set(srcs)];
}

function firstParagraphText(html: string, fallback: string): string {
  const stripped = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (stripped || fallback).slice(0, 160);
}

function resolveHeroCandidate(item: FeedItem, html: string): string | null {
  if (item.enclosure?.url && (item.enclosure.type ?? "image/").startsWith("image/")) {
    return item.enclosure.url;
  }
  const media = item.mediaContent?.find((mc) => mc.$?.url)?.$?.url;
  if (media) return media;
  return extractImgSrcs(html)[0] ?? null;
}

/** 1フィードを取り込む。重複(guid/URL/タイトル)は先着優先でスキップ */
export async function importFeed(
  feed: RssFeed,
  opts: { maxItems?: number } = {}
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: 0, articleIds: [] };
  const importUser = await getImportUser();

  let parsed;
  try {
    parsed = await parser.parseURL(feed.url);
  } catch (e) {
    await prisma.rssFeed.update({
      where: { id: feed.id },
      data: {
        lastFetchedAt: new Date(),
        lastError: e instanceof Error ? e.message.slice(0, 500) : "fetch failed",
      },
    });
    throw e;
  }

  const items = (parsed.items ?? []).slice(
    0,
    Math.min(opts.maxItems ?? MAX_ITEMS_PER_FETCH, MAX_ITEMS_PER_FETCH)
  );

  for (const item of items) {
    try {
      const guid = guidOf(item);
      const title = item.title?.trim();
      if (!guid || !title) {
        result.skipped++;
        continue;
      }

      // 重複チェック(先に入ってきたものを優先)
      const dup = await prisma.article.findFirst({
        where: {
          OR: [
            { sourceGuid: guid },
            ...(item.link ? [{ sourceUrl: item.link }] : []),
            { title },
          ],
        },
        select: { id: true },
      });
      if (dup) {
        result.skipped++;
        continue;
      }

      const rawHtml =
        item["content:encoded"] || item.content || item.contentSnippet || "";
      const publishedAt = item.isoDate
        ? new Date(item.isoDate)
        : item.pubDate
          ? new Date(item.pubDate)
          : new Date();

      // 画像を自社ストレージへ保存(アイキャッチ+本文内画像)
      const heroCandidate = resolveHeroCandidate(item, rawHtml);
      const hero = heroCandidate
        ? await storeRemoteImage(heroCandidate, title, importUser.id)
        : null;

      let html = rawHtml;
      const inlineSrcs = extractImgSrcs(rawHtml).slice(0, MAX_INLINE_IMAGES);
      for (const src of inlineSrcs) {
        if (src === heroCandidate) {
          // アイキャッチと同じ画像は本文から重複表示しない
          html = html.split(src).join(hero?.url ?? src);
          continue;
        }
        const stored = await storeRemoteImage(src, title, importUser.id);
        if (stored) html = html.split(src).join(stored.url);
      }

      // Tiptap JSON 化(対応ノード以外は落ちるため、実質サニタイズを兼ねる)
      let body: JSONContent;
      try {
        body = generateJSON(html || `<p>${title}</p>`, bodyExtensions);
      } catch {
        body = {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: firstParagraphText(rawHtml, title) }],
            },
          ],
        };
      }
      if (!extractText(body).trim()) {
        body = {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: firstParagraphText(rawHtml, title) }],
            },
          ],
        };
      }

      const slug = `${dateStamp(publishedAt)}-rss-${hash8(guid)}`;
      const status = feed.autoPublish ? ("published" as const) : ("review" as const);

      const article = await prisma.article.create({
        data: {
          slug,
          title,
          lead: firstParagraphText(item.contentSnippet ?? rawHtml, title),
          body,
          status,
          publishedAt: feed.autoPublish ? publishedAt : null,
          categoryId: feed.categoryId,
          authorId: importUser.id,
          heroImageId: hero?.id ?? null,
          sourceFeedId: feed.id,
          sourceName: feed.name,
          sourceUrl: item.link ?? null,
          sourceGuid: guid,
        },
        include: { category: true },
      });

      if (article.status === "published") {
        revalidateArticle(article.category.slug, article.slug);
      }
      result.imported++;
      result.articleIds.push(article.id);
    } catch (e) {
      console.error(`[rss-import] item failed (${feed.name}):`, e);
      result.errors++;
    }
  }

  await prisma.rssFeed.update({
    where: { id: feed.id },
    data: {
      lastFetchedAt: new Date(),
      lastError: result.errors > 0 ? `${result.errors} item(s) failed` : null,
      lastImportedCount: result.imported,
    },
  });

  return result;
}

/** 有効な全フィードを取り込む(cron用) */
export async function importAllFeeds(): Promise<Record<string, ImportResult>> {
  const feeds = await prisma.rssFeed.findMany({ where: { isEnabled: true } });
  const results: Record<string, ImportResult> = {};
  for (const feed of feeds) {
    try {
      results[feed.name] = await importFeed(feed);
    } catch {
      results[feed.name] = { imported: 0, skipped: 0, errors: 1, articleIds: [] };
    }
  }
  return results;
}
