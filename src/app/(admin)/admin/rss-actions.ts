"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth, canEditArticle } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { importFeed } from "@/lib/rss-import";
import {
  buildRewrittenBody,
  extractSource,
  RewriteError,
  rewriteWithOpenAI,
} from "@/lib/rewrite";
import { revalidateArticle } from "@/lib/revalidate";

async function requireFeedManager() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "admin" && session.user.role !== "editor") {
    redirect("/admin");
  }
  return session.user;
}

const INTERVAL_OPTIONS = [10, 30, 60, 180, 360, 720, 1440] as const;

const feedSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url().max(500),
  categoryId: z.string().min(1),
  autoPublish: z.boolean(),
  fetchLimit: z.coerce.number().int().min(1).max(30),
  fetchIntervalMinutes: z.coerce
    .number()
    .int()
    .refine((v) => (INTERVAL_OPTIONS as readonly number[]).includes(v)),
});

export async function createFeedAction(formData: FormData) {
  await requireFeedManager();
  const parsed = feedSchema.parse({
    name: formData.get("name"),
    url: formData.get("url"),
    categoryId: formData.get("categoryId"),
    autoPublish: formData.get("autoPublish") === "on",
    fetchLimit: formData.get("fetchLimit") || 10,
    fetchIntervalMinutes: formData.get("fetchIntervalMinutes") || 60,
  });
  await prisma.rssFeed.create({
    data: { ...parsed, isEnabled: formData.get("isEnabled") === "on" },
  });
  revalidatePath("/admin/rss");
}

export async function updateFeedAction(formData: FormData) {
  await requireFeedManager();
  const id = formData.get("id") as string;
  const parsed = feedSchema
    .omit({ url: true })
    .extend({ isEnabled: z.boolean() })
    .parse({
      name: formData.get("name"),
      categoryId: formData.get("categoryId"),
      autoPublish: formData.get("autoPublish") === "on",
      isEnabled: formData.get("isEnabled") === "on",
      fetchLimit: formData.get("fetchLimit") || 10,
      fetchIntervalMinutes: formData.get("fetchIntervalMinutes") || 60,
    });
  await prisma.rssFeed.update({ where: { id }, data: parsed });
  revalidatePath("/admin/rss");
}

export async function deleteFeedAction(formData: FormData) {
  await requireFeedManager();
  const id = formData.get("id") as string;
  await prisma.rssFeed.delete({ where: { id } });
  revalidatePath("/admin/rss");
}

/** 「今すぐ取得」ボタン */
export async function fetchFeedNowAction(formData: FormData) {
  await requireFeedManager();
  const id = formData.get("id") as string;
  const feed = await prisma.rssFeed.findUnique({ where: { id } });
  if (!feed) return;
  try {
    await importFeed(feed);
  } catch (e) {
    console.error("[rss] manual fetch failed:", e);
  }
  revalidatePath("/admin/rss");
  revalidatePath("/admin/articles");
}

/** 毎朝のAI記事化ジョブを手動実行する(ローカル検証・臨時実行用) */
export async function runDailyRewriteAction(): Promise<void> {
  await requireFeedManager();
  const { runDailyRewrite } = await import("@/lib/daily-rewrite");
  const summary = await runDailyRewrite();
  console.log("[daily-rewrite] manual run:", summary);
  revalidatePath("/admin/rss");
  revalidatePath("/admin/articles");
}

/**
 * RSS取り込み記事をOpenAIで独自記事化する(ワンクリック)。
 * 成功すると本文・タイトル・リードが書き換わり、isRewritten=true になる
 * (公開面では転載元の本文表記が外れ、画像出典のみ残る)。
 */
export async function rewriteArticleAction(
  articleId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { category: true },
  });
  if (!article) return { ok: false, error: "not found" };
  if (!canEditArticle(session.user, article)) {
    return { ok: false, error: "forbidden" };
  }
  if (!article.sourceFeedId && !article.sourceName) {
    return { ok: false, error: "not an RSS-imported article" };
  }
  // 1つのRSS記事に対して独自化記事は1つだけ:
  // 既に本体が独自化済み、または別記事として独自化コピーが存在する場合は対象外
  if (article.isRewritten) {
    return { ok: false, error: "already rewritten" };
  }
  if (article.sourceGuid) {
    const existingCopy = await prisma.article.findUnique({
      where: { sourceGuid: `${article.sourceGuid}#rewrite` },
      select: { id: true },
    });
    if (existingCopy) {
      return {
        ok: false,
        error: "この記事の独自化記事は既に作成済みです (already rewritten as a separate article)",
      };
    }
  }

  try {
    const { text, images } = extractSource(
      article.body as Parameters<typeof extractSource>[0]
    );
    const output = await rewriteWithOpenAI({
      title: article.title,
      lead: article.lead,
      sourceText: text,
      categoryName: article.category.nameZh,
    });
    const body = buildRewrittenBody(output.paragraphs, images);

    await prisma.article.update({
      where: { id: article.id },
      data: {
        title: output.title,
        lead: (output.lead ?? "").slice(0, 300),
        body,
        isRewritten: true,
      },
    });
    await prisma.revision.create({
      data: {
        articleId: article.id,
        editedBy: session.user.id,
        snapshot: {
          title: output.title,
          lead: output.lead,
          body,
          note: "AI rewrite",
        },
      },
    });

    if (article.status === "published") {
      revalidateArticle(article.category.slug, article.slug);
    }
    revalidatePath(`/admin/articles/${article.id}`);
    return { ok: true };
  } catch (e) {
    const msg =
      e instanceof RewriteError
        ? e.message
        : e instanceof Error
          ? e.message
          : "rewrite failed";
    console.error("[rewrite] failed:", e);
    return { ok: false, error: msg };
  }
}
