import { NextResponse } from "next/server";
import { backfillMissingThumbnails, importAllFeeds } from "@/lib/rss-import";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** RSS自動取り込み: Vercel Cron から10分おきに呼び出される */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results = await importAllFeeds();
  // 過去に取り込んだサムネイル欠落記事を毎回少しずつ補完する
  const backfilled = await backfillMissingThumbnails(10);
  return NextResponse.json({ results, backfilled });
}
