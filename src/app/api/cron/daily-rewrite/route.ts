import { NextResponse } from "next/server";
import { runDailyRewrite } from "@/lib/daily-rewrite";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 毎朝のAI記事化ジョブ: Vercel Cron から 23:00 UTC (= 8:00 JST) に呼び出される。
 * 各カテゴリー最大5件のRSS下書きをAIで独自記事化し、8:30〜9:30 JST の
 * ランダムな時刻に予約公開。プレスリリースは別枠で最大5件を適切な
 * カテゴリーへ記事化する。
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const summary = await runDailyRewrite();
  return NextResponse.json(summary);
}
