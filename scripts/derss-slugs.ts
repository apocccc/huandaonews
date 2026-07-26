/**
 * 既存記事のスラッグから "-rss-" を除去し、公開済み記事には
 * 旧URL→新URLの恒久リダイレクトを自動登録する。
 *
 * 使い方:
 *   pnpm tsx scripts/derss-slugs.ts           # ドライラン(変更内容の表示のみ)
 *   pnpm tsx scripts/derss-slugs.ts --apply   # 実際に変更
 *
 * 本番DBに対しては DATABASE_URL を環境変数で指定して実行する。
 */
import { readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

function loadDotEnv() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {
    /* noop */
  }
}
loadDotEnv();

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");

  const articles = await prisma.article.findMany({
    where: { slug: { contains: "-rss-" } },
    include: { category: { select: { slug: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (articles.length === 0) {
    console.log("対象記事はありません。");
    return;
  }

  let renamed = 0;
  for (const a of articles) {
    const newSlug = a.slug.replace("-rss-", "-");
    const conflict = await prisma.article.findUnique({
      where: { slug: newSlug },
      select: { id: true },
    });
    if (conflict) {
      console.log(`スキップ(重複): ${a.slug} → ${newSlug}`);
      continue;
    }
    console.log(
      `[${a.status}] ${a.slug} → ${newSlug}${a.status === "published" ? " (+308リダイレクト)" : ""}`
    );
    if (apply) {
      await prisma.article.update({
        where: { id: a.id },
        data: { slug: newSlug },
      });
      if (a.status === "published") {
        const fromPath = `/news/${a.category.slug}/${a.slug}`;
        const toPath = `/news/${a.category.slug}/${newSlug}`;
        await prisma.redirect.upsert({
          where: { fromPath },
          create: { fromPath, toPath },
          update: { toPath },
        });
      }
    }
    renamed++;
  }

  console.log(
    apply
      ? `\n${renamed} 件のスラッグを変更しました(公開ページはISRで5分以内に反映)。`
      : `\n${renamed} 件が対象です(ドライラン)。変更するには --apply を付けて再実行してください。`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
