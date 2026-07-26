/**
 * 同一のRSS元記事から2件以上AI独自化記事が作られている場合、
 * 最初の1件(作成が最も古いもの)を残して残りを削除する。
 *
 * 使い方:
 *   pnpm tsx scripts/dedupe-rewrites.ts           # ドライラン(削除対象の表示のみ)
 *   pnpm tsx scripts/dedupe-rewrites.ts --apply   # 実際に削除
 *
 * 本番DBに対して実行する場合は DATABASE_URL / DIRECT_DATABASE_URL を
 * 環境変数で指定して実行する。
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

/** #rewrite / #orig サフィックスを除いた「元記事の識別子」 */
function baseGuid(sourceGuid: string): string {
  return sourceGuid.replace(/#(rewrite|orig)$/, "");
}

async function main() {
  const apply = process.argv.includes("--apply");

  const rewritten = await prisma.article.findMany({
    where: { isRewritten: true, sourceGuid: { not: null } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      createdAt: true,
      sourceGuid: true,
    },
  });

  const groups = new Map<string, typeof rewritten>();
  for (const a of rewritten) {
    const key = baseGuid(a.sourceGuid!);
    const g = groups.get(key) ?? [];
    g.push(a);
    groups.set(key, g);
  }

  let deleteCount = 0;
  for (const [key, group] of groups) {
    if (group.length <= 1) continue;
    const [keep, ...dupes] = group; // createdAt 昇順 → 最初の1件を残す
    console.log(`\n■ 元記事: ${key}`);
    console.log(`  残す: [${keep.status}] ${keep.slug} (${keep.createdAt.toISOString()})`);
    for (const d of dupes) {
      console.log(`  削除: [${d.status}] ${d.slug} — ${d.title.slice(0, 40)}`);
      deleteCount++;
      if (apply) {
        await prisma.article.delete({ where: { id: d.id } });
      }
    }
  }

  if (deleteCount === 0) {
    console.log("重複する独自化記事はありません。");
  } else if (apply) {
    console.log(`\n${deleteCount} 件の重複を削除しました。`);
  } else {
    console.log(
      `\n${deleteCount} 件の重複があります(ドライラン)。削除するには --apply を付けて再実行してください。`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
