import { prisma } from "@/lib/prisma";
import {
  buildRewrittenBody,
  extractSource,
  rewriteWithOpenAI,
} from "@/lib/rewrite";
import type { JSONContent } from "@tiptap/core";

/**
 * 毎朝 8:00 JST に実行されるAI記事化ジョブ。
 *
 * 1. 一般カテゴリー: RSS取り込みで draft 保持中の記事を、カテゴリーごとに
 *    最大5件AIで書き換え、8:30〜9:30 JST のランダムな時刻に予約公開する。
 * 2. プレスリリース: 新聞稿として公開済みのRSS記事のうち未記事化のものを
 *    最大5件書き直し、AIが選んだ適切なカテゴリーの新規記事として
 *    同じ時間窓で予約公開する(引用元の本文表記なし・画像出典のみ)。
 *
 * 実際のリリースは毎分の publish cron が publishAt 到達時に行う。
 */

const PER_CATEGORY_LIMIT = 2;
const PR_COPY_LIMIT = 2;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WINDOW_START_MIN = 8 * 60 + 30; // 8:30 JST
const WINDOW_LENGTH_MIN = 60; // 〜9:30 JST
const TIME_BUDGET_MS = 270_000; // Vercel maxDuration 300s に対する安全マージン

/**
 * 次の 8:30 JST 以降のリリース窓内でランダムな時刻を返す。
 * now が当日 8:30 JST より前ならその日の窓、過ぎていれば翌日の窓。
 */
export function computeReleaseTime(now: Date, random = Math.random()): Date {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const windowStartJst = new Date(
    Date.UTC(
      jst.getUTCFullYear(),
      jst.getUTCMonth(),
      jst.getUTCDate(),
      0,
      WINDOW_START_MIN,
      0,
      0
    )
  );
  let windowStartUtc = windowStartJst.getTime() - JST_OFFSET_MS;
  if (windowStartUtc < now.getTime()) {
    windowStartUtc += 24 * 60 * 60 * 1000;
  }
  const offsetMs = Math.floor(random * WINDOW_LENGTH_MIN * 60 * 1000);
  return new Date(windowStartUtc + offsetMs);
}

export type DailyRewriteSummary = {
  rewritten: number;
  prCopies: number;
  failed: number;
  truncated: boolean;
  skippedNoKey: boolean;
  details: string[];
};

export async function runDailyRewrite(now = new Date()): Promise<DailyRewriteSummary> {
  const summary: DailyRewriteSummary = {
    rewritten: 0,
    prCopies: 0,
    failed: 0,
    truncated: false,
    skippedNoKey: false,
    details: [],
  };

  if (!process.env.OPENAI_API_KEY) {
    summary.skippedNoKey = true;
    summary.details.push("OPENAI_API_KEY is not set — job skipped");
    return summary;
  }

  const deadline = Date.now() + TIME_BUDGET_MS;
  const categories = await prisma.category.findMany({
    where: { isVisible: true, slug: { notIn: ["latest", "press-release"] } },
    orderBy: { order: "asc" },
  });
  const categoryChoices = categories.map((c) => ({ slug: c.slug, name: c.nameZh }));

  /* ---- 1. 一般カテゴリー: draft 保持中のRSS記事を書き換えて予約公開 ---- */
  for (const category of categories) {
    const drafts = await prisma.article.findMany({
      where: {
        categoryId: category.id,
        status: "draft",
        sourceFeedId: { not: null },
        isRewritten: false,
        // サムネイルが確保できていない記事は公開対象にしない
        heroImageId: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: PER_CATEGORY_LIMIT,
      include: { sourceFeed: true },
    });

    for (const article of drafts) {
      if (Date.now() > deadline) {
        summary.truncated = true;
        return summary;
      }
      try {
        const { text, images } = extractSource(article.body as JSONContent);
        const output = await rewriteWithOpenAI({
          title: article.title,
          lead: article.lead,
          sourceText: text,
          categoryName: category.nameZh,
          sourceUrl: article.sourceUrl,
        });
        const body = buildRewrittenBody(output.paragraphs, images);
        const autoPublish = article.sourceFeed?.autoPublish ?? true;
        const publishAt = computeReleaseTime(now);

        await prisma.article.update({
          where: { id: article.id },
          data: {
            title: output.title,
            lead: (output.lead ?? "").slice(0, 300),
            body,
            isRewritten: true,
            status: autoPublish ? "scheduled" : "review",
            publishAt: autoPublish ? publishAt : null,
          },
        });
        summary.rewritten++;
        summary.details.push(
          `[${category.slug}] ${output.title} → ${autoPublish ? publishAt.toISOString() : "review"}`
        );
      } catch (e) {
        summary.failed++;
        summary.details.push(
          `[${category.slug}] FAILED ${article.slug}: ${e instanceof Error ? e.message : e}`
        );
      }
    }
  }

  /* ---- 2. プレスリリース: 未記事化のものを別記事として独自化 ---- */
  const prCategory = await prisma.category.findUnique({
    where: { slug: "press-release" },
  });
  if (prCategory) {
    const candidates = await prisma.article.findMany({
      where: {
        categoryId: prCategory.id,
        sourceFeedId: { not: null },
        status: "published",
        sourceGuid: { not: null },
        // サムネイルが確保できていない新聞稿は記事化の対象にしない
        heroImageId: { not: null },
        // 手動ボタン等で既に本体が独自化済みの場合は複製を作らない
        // (1つのRSS記事に対して独自化記事は1つだけ)
        isRewritten: false,
      },
      orderBy: { publishedAt: "desc" },
      take: 20,
      include: { sourceFeed: true },
    });

    for (const pr of candidates) {
      if (summary.prCopies >= PR_COPY_LIMIT) break;
      if (Date.now() > deadline) {
        summary.truncated = true;
        break;
      }
      const copyGuid = `${pr.sourceGuid}#rewrite`;
      const exists = await prisma.article.findUnique({
        where: { sourceGuid: copyGuid },
        select: { id: true },
      });
      if (exists) continue;

      try {
        const { text, images } = extractSource(pr.body as JSONContent);
        const output = await rewriteWithOpenAI({
          title: pr.title,
          lead: pr.lead,
          sourceText: text,
          categoryName: prCategory.nameZh,
          sourceUrl: pr.sourceUrl,
          categories: categoryChoices,
        });
        const body = buildRewrittenBody(output.paragraphs, images);
        const target =
          categories.find((c) => c.slug === output.category) ??
          categories.find((c) => c.slug === "business") ??
          categories[0];
        const autoPublish = pr.sourceFeed?.autoPublish ?? true;
        const publishAt = computeReleaseTime(now);

        const copy = await prisma.article.create({
          data: {
            slug: `${pr.slug}-r`,
            title: output.title,
            lead: (output.lead ?? "").slice(0, 300),
            body,
            status: autoPublish ? "scheduled" : "review",
            publishAt: autoPublish ? publishAt : null,
            categoryId: target.id,
            authorId: pr.authorId,
            heroImageId: pr.heroImageId,
            sourceFeedId: pr.sourceFeedId,
            sourceName: pr.sourceName,
            sourceUrl: pr.sourceUrl,
            sourceGuid: copyGuid,
            isRewritten: true,
          },
        });
        summary.prCopies++;
        summary.details.push(
          `[pr→${target.slug}] ${copy.title} → ${autoPublish ? publishAt.toISOString() : "review"}`
        );
      } catch (e) {
        summary.failed++;
        summary.details.push(
          `[pr] FAILED ${pr.slug}: ${e instanceof Error ? e.message : e}`
        );
      }
    }
  }

  return summary;
}
