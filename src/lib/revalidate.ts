import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { articlePath } from "@/lib/site";
import { pingIndexNow } from "@/lib/indexnow";

/**
 * 記事の公開/更新/取り下げ時に関連ページを即時再検証し、IndexNow に通知する。
 * Nextのリクエストコンテキスト外(スクリプト実行等)では再検証は no-op。
 */
export function revalidateArticle(categorySlug: string, articleSlug: string) {
  try {
    revalidateArticleInner(categorySlug, articleSlug);
  } catch {
    // ISR (revalidate) が期限内に反映するため無視してよい
  }

  const path = articlePath(categorySlug, articleSlug);
  try {
    // レスポンス返却後に送信(公開操作を待たせない。サーバーレスでも打ち切られない)
    after(() => pingIndexNow([path]));
  } catch {
    // リクエストコンテキスト外(cron 以外のスクリプト等)
    void pingIndexNow([path]);
  }
}

function revalidateArticleInner(categorySlug: string, articleSlug: string) {
  revalidatePath(articlePath(categorySlug, articleSlug));
  revalidatePath(`/category/${categorySlug}`);
  revalidatePath("/category/latest");
  revalidatePath("/");
  revalidatePath("/rss.xml");
  revalidatePath(`/rss/${categorySlug}.xml`);
  revalidatePath("/atom.xml");
  revalidatePath("/feed.json");
  revalidatePath("/news-sitemap.xml");
  revalidatePath("/sitemap.xml");
}
