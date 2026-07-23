import { NextResponse } from "next/server";
import { importAllFeeds } from "@/lib/rss-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** RSS自動取り込み: Vercel Cron から10分おきに呼び出される */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const results = await importAllFeeds();
  return NextResponse.json({ results });
}
