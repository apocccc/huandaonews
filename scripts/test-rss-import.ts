/** RSS取り込みの動作確認用スクリプト(開発用): pnpm tsx scripts/test-rss-import.ts <feedUrl> <categorySlug> <name> */
import { PrismaClient } from "@prisma/client";
import { importFeed } from "../src/lib/rss-import";

const prisma = new PrismaClient();

async function main() {
  const [url, categorySlug, name] = process.argv.slice(2);
  if (!url || !categorySlug) {
    console.error("usage: tsx scripts/test-rss-import.ts <feedUrl> <categorySlug> [name]");
    process.exit(1);
  }
  const category = await prisma.category.findUniqueOrThrow({
    where: { slug: categorySlug },
  });
  const feed = await prisma.rssFeed.upsert({
    where: { url },
    create: {
      url,
      name: name ?? "測試新聞網",
      categoryId: category.id,
      autoPublish: true,
    },
    update: {},
  });
  const result = await importFeed(feed);
  console.log("result:", result);

  const imported = await prisma.article.findMany({
    where: { sourceFeedId: feed.id },
    include: { heroImage: true },
  });
  for (const a of imported) {
    console.log("---");
    console.log("slug:", a.slug);
    console.log("title:", a.title);
    console.log("status:", a.status, "| source:", a.sourceName, "| guid:", a.sourceGuid);
    console.log("hero:", a.heroImage?.url);
    console.log("body:", JSON.stringify(a.body).slice(0, 400));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
