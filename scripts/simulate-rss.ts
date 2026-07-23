/**
 * RSS取り込み〜AI独自記事化のシミュレーション。
 *
 * 1. 指定RSSの最新3件を「新聞稿 (press-release)」カテゴリーへ取り込む(画像含む)
 * 2. 同じ3件を別カテゴリーへも複製する
 * 3. 複製した3件を OpenAI で独自記事化する(タイトル・本文を書き直し、画像は保持)
 *    → 合計6記事が出来上がる
 *
 * 使い方:
 *   pnpm simulate:rss                                  # 既定: apocwire.com / business
 *   pnpm simulate:rss <feedUrl> <secondCategorySlug>   # 例: ... https://example.com/rss.xml tech
 *   オプション: --no-rewrite (OpenAIを呼ばず複製まで行う)
 */
import { readFileSync } from "fs";
import path from "path";
import Parser from "rss-parser";
import { PrismaClient } from "@prisma/client";

// tsx は .env を自動で読まないため手動でロード(既存の環境変数を優先)
function loadDotEnv() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {
    /* .env なしでも続行 */
  }
}
loadDotEnv();

const prisma = new PrismaClient();

const DEFAULT_FEED = "https://apocwire.com/tw/rss.xml";
const ITEM_COUNT = 3;

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const skipRewrite = process.argv.includes("--no-rewrite");
  const feedUrl = args[0] ?? DEFAULT_FEED;
  const secondCategorySlug = args[1] ?? "business";

  const { importFeed } = await import("../src/lib/rss-import");
  const { extractSource, buildRewrittenBody, rewriteWithOpenAI } = await import(
    "../src/lib/rewrite"
  );

  const prCategory = await prisma.category.findUniqueOrThrow({
    where: { slug: "press-release" },
  });
  const secondCategory = await prisma.category.findUniqueOrThrow({
    where: { slug: secondCategorySlug },
  });

  // --- フィード名はチャンネルタイトルから取得 ---
  console.log(`\n■ フィード確認: ${feedUrl}`);
  const parser = new Parser({ timeout: 20_000 });
  const channel = await parser.parseURL(feedUrl);
  const sourceName = (channel.title ?? "APOC Wire").trim();
  console.log(`  タイトル: ${sourceName} / 記事数: ${channel.items?.length ?? 0}`);

  // --- Step 1: 新聞稿カテゴリーへ最新3件を取り込み ---
  console.log(`\n■ Step 1: 最新${ITEM_COUNT}件を「${prCategory.nameZh}」へ取り込み`);
  const feed = await prisma.rssFeed.upsert({
    where: { url: feedUrl },
    create: {
      url: feedUrl,
      name: sourceName,
      categoryId: prCategory.id,
      autoPublish: true,
    },
    update: { name: sourceName, categoryId: prCategory.id },
  });
  const result = await importFeed(feed, { maxItems: ITEM_COUNT });
  console.log(
    `  取り込み ${result.imported} 件 / スキップ ${result.skipped} 件 / エラー ${result.errors} 件`
  );

  // 既に取り込み済みで imported=0 の場合は既存のものを使う
  const prArticles =
    result.articleIds.length > 0
      ? await prisma.article.findMany({
          where: { id: { in: result.articleIds } },
          orderBy: { publishedAt: "desc" },
        })
      : await prisma.article.findMany({
          where: { sourceFeedId: feed.id, categoryId: prCategory.id },
          orderBy: { publishedAt: "desc" },
          take: ITEM_COUNT,
        });

  if (prArticles.length === 0) {
    console.error("✗ 取り込めた記事がありません。フィード内容を確認してください。");
    process.exit(1);
  }
  for (const a of prArticles) {
    console.log(`  - [新聞稿] ${a.title}`);
    console.log(`      /news/press-release/${a.slug}`);
  }

  // --- Step 2: 同じ3件を別カテゴリーへ複製 ---
  console.log(
    `\n■ Step 2: 同じ${prArticles.length}件を「${secondCategory.nameZh}」へ複製`
  );
  const copies = [];
  for (const src of prArticles) {
    const copySlug = `${src.slug}-orig`;
    const existing = await prisma.article.findUnique({ where: { slug: copySlug } });
    if (existing) {
      console.log(`  - (既存) ${existing.title}`);
      copies.push(existing);
      continue;
    }
    const copy = await prisma.article.create({
      data: {
        slug: copySlug,
        title: src.title,
        lead: src.lead,
        body: src.body as object,
        status: "published",
        publishedAt: src.publishedAt,
        categoryId: secondCategory.id,
        authorId: src.authorId,
        heroImageId: src.heroImageId,
        sourceFeedId: feed.id,
        sourceName: src.sourceName,
        sourceUrl: src.sourceUrl,
        sourceGuid: src.sourceGuid ? `${src.sourceGuid}#orig` : null,
      },
    });
    console.log(`  - [複製] ${copy.title}`);
    copies.push(copy);
  }

  // --- Step 3: 複製をAIで独自記事化 ---
  if (skipRewrite) {
    console.log("\n■ Step 3: --no-rewrite 指定のためAI独自記事化はスキップ");
  } else if (!process.env.OPENAI_API_KEY) {
    console.error(
      "\n✗ OPENAI_API_KEY が .env にありません。キーを記入してから再実行してください。"
    );
    process.exit(1);
  } else {
    console.log(`\n■ Step 3: ${copies.length}件を OpenAI で独自記事化`);
    for (const copy of copies) {
      if (copy.isRewritten) {
        console.log(`  - (独自化済み) ${copy.title}`);
        continue;
      }
      process.stdout.write(`  - 書き直し中: ${copy.title.slice(0, 30)}… `);
      try {
        const { text, images } = extractSource(
          copy.body as Parameters<typeof extractSource>[0]
        );
        const output = await rewriteWithOpenAI({
          title: copy.title,
          lead: copy.lead,
          sourceText: text,
          categoryName: secondCategory.nameZh,
        });
        const body = buildRewrittenBody(output.paragraphs, images);
        await prisma.article.update({
          where: { id: copy.id },
          data: {
            title: output.title,
            lead: (output.lead ?? "").slice(0, 300),
            body,
            isRewritten: true,
          },
        });
        console.log(`✓`);
        console.log(`      新タイトル: ${output.title}`);
      } catch (e) {
        console.log(`✗ ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  // --- 結果サマリー ---
  const all = await prisma.article.findMany({
    where: { sourceFeedId: feed.id },
    include: { category: true, heroImage: true },
    orderBy: [{ categoryId: "asc" }, { publishedAt: "desc" }],
  });
  console.log(`\n■ 完成: ${all.length} 記事`);
  for (const a of all) {
    console.log(
      `  [${a.category.nameZh}]${a.isRewritten ? "[独自化済]" : ""} ${a.title}`
    );
    console.log(
      `      /news/${a.category.slug}/${a.slug}  ${a.heroImage ? "(サムネあり)" : "(サムネなし)"}`
    );
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
