import { revalidatePath } from "next/cache";
import { articlePath } from "@/lib/site";

/** 記事の公開/更新時に関連ページを即時再検証する */
export function revalidateArticle(categorySlug: string, articleSlug: string) {
  for (const locale of ["", "/en"]) {
    revalidatePath(`${locale}${articlePath(categorySlug, articleSlug)}`);
    revalidatePath(`${locale}/category/${categorySlug}`);
    revalidatePath(`${locale}/category/latest`);
    revalidatePath(`${locale}/`);
  }
  revalidatePath("/rss.xml");
  revalidatePath(`/rss/${categorySlug}.xml`);
  revalidatePath("/atom.xml");
  revalidatePath("/feed.json");
  revalidatePath("/news-sitemap.xml");
  revalidatePath("/sitemap.xml");
}
