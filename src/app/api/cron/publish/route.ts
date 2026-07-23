import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateArticle } from "@/lib/revalidate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 予約公開: Vercel Cron から毎分呼び出され、publishAt に到達した
 * scheduled 記事を公開して revalidate する。
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const due = await prisma.article.findMany({
    where: { status: "scheduled", publishAt: { lte: new Date() } },
    include: { category: true },
  });

  for (const article of due) {
    await prisma.article.update({
      where: { id: article.id },
      data: {
        status: "published",
        publishedAt: article.publishedAt ?? new Date(),
        publishAt: null,
      },
    });
    revalidateArticle(article.category.slug, article.slug);
  }

  return NextResponse.json({ published: due.length });
}
