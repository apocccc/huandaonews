import { SITE_URL } from "@/lib/site";

/**
 * IndexNow(Bing / Yandex / Seznam 等)への URL 通知。
 * キーは公開前提の値で、`public/{INDEXNOW_KEY}.txt` に同じ文字列を置いている。
 * Google は IndexNow 非対応のため、Google 向けはサイトマップの鮮度で対応する。
 */
export const INDEXNOW_KEY = "3cc5f8e00523affa5273db9ce43af3f6";
const ENDPOINT = "https://api.indexnow.org/indexnow";

export async function pingIndexNow(paths: string[]): Promise<void> {
  // 本番ドメイン以外(ローカル・プレビュー)からは送らない
  if (!/^https:\/\/(www\.)?huandaonews\.tw$/.test(SITE_URL) || process.env.VERCEL_ENV === "preview") {
    return;
  }
  const host = new URL(SITE_URL).host;
  const urlList = [...new Set(paths)].map((p) => `${SITE_URL}${p}`);
  if (urlList.length === 0) return;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    console.log(`[indexnow] ${res.status} ${urlList.join(", ")}`);
  } catch (e) {
    console.error("[indexnow] failed:", e instanceof Error ? e.message : e);
  }
}
