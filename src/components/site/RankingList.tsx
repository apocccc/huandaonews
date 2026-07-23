import { Link } from "@/i18n/navigation";
import type { ArticleListItem } from "@/lib/data";
import { articlePath } from "@/lib/site";

/** サイドバー用の閲覧数ランキング(番号付き) */
export function RankingList({ articles }: { articles: ArticleListItem[] }) {
  return (
    <ol className="divide-y divide-line">
      {articles.map((a, i) => (
        <li key={a.id}>
          <Link
            href={articlePath(a.category.slug, a.slug)}
            className="group flex items-start gap-2.5 py-2.5"
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[12px] font-black ${
                i < 3 ? "bg-primary text-white" : "bg-bg-sub text-gray"
              }`}
            >
              {i + 1}
            </span>
            <span className="line-clamp-2 text-[13.5px] font-medium leading-snug group-hover:text-primary">
              {a.title}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
