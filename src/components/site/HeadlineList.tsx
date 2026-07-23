import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { ArticleListItem } from "@/lib/data";
import { categoryName } from "@/lib/categories";
import { articlePath, formatTaipeiShort } from "@/lib/site";

/** 日時+カテゴリー+見出しの高密度テキストリスト */
export async function HeadlineList({
  articles,
  locale,
  showCategory = true,
}: {
  articles: ArticleListItem[];
  locale: string;
  showCategory?: boolean;
}) {
  const t = await getTranslations();
  return (
    <ul className="divide-y divide-line">
      {articles.map((a) => (
        <li key={a.id}>
          <Link
            href={articlePath(a.category.slug, a.slug)}
            className="group flex items-baseline gap-2 py-2"
          >
            <time
              dateTime={(a.publishedAt ?? a.createdAt).toISOString()}
              className="shrink-0 font-mono text-[11.5px] text-gray tabular-nums"
            >
              {formatTaipeiShort(a.publishedAt ?? a.createdAt, locale)}
            </time>
            {a.isBreaking ? (
              <span className="shrink-0 rounded-sm bg-breaking px-1 py-px text-[10px] font-bold text-white">
                {t("labels.breaking")}
              </span>
            ) : null}
            {showCategory ? (
              <span className="shrink-0 text-[11.5px] font-bold text-primary-dark">
                {categoryName(a.category, locale)}
              </span>
            ) : null}
            <span className="line-clamp-2 min-w-0 text-[14px] font-medium leading-snug group-hover:text-primary group-hover:underline underline-offset-2">
              {a.title}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
