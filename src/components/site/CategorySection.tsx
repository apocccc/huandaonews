import Image from "next/image";
import type { Category } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import type { ArticleListItem } from "@/lib/data";
import { categoryName } from "@/lib/categories";
import { articlePath, formatTaipeiShort } from "@/lib/site";

/** トップのカテゴリー別ブロック: リード記事(サムネ付き)+見出しリスト */
export function CategorySection({
  category,
  articles,
  locale,
  moreLabel,
}: {
  category: Category;
  articles: ArticleListItem[];
  locale: string;
  moreLabel: string;
}) {
  const [lead, ...rest] = articles;
  if (!lead) return null;

  return (
    <section className="border-t-2 border-ink pt-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-black">
          <Link
            href={`/category/${category.slug}`}
            className="hover:text-primary"
          >
            {categoryName(category, locale)}
          </Link>
        </h3>
        <Link
          href={`/category/${category.slug}`}
          className="text-[11.5px] font-medium text-gray hover:text-primary"
        >
          {moreLabel} →
        </Link>
      </div>

      <Link
        href={articlePath(lead.category.slug, lead.slug)}
        className="group mt-2.5 flex gap-3"
      >
        <div className="relative aspect-[3/2] w-24 shrink-0 overflow-hidden rounded-sm bg-bg-sub">
          {lead.heroImage ? (
            <Image
              src={lead.heroImage.url}
              alt={lead.heroImage.alt}
              fill
              sizes="96px"
              className="object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-full w-full items-center justify-center text-xl font-black text-line select-none"
            >
              環
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="line-clamp-3 text-[14px] font-bold leading-snug group-hover:text-primary">
            {lead.title}
          </p>
          <time
            dateTime={(lead.publishedAt ?? lead.createdAt).toISOString()}
            className="mt-1 block font-mono text-[11px] text-gray"
          >
            {formatTaipeiShort(lead.publishedAt ?? lead.createdAt, locale)}
          </time>
        </div>
      </Link>

      {rest.length > 0 ? (
        <ul className="mt-2 divide-y divide-line border-t border-line">
          {rest.map((a) => (
            <li key={a.id}>
              <Link
                href={articlePath(a.category.slug, a.slug)}
                className="group block py-1.5"
              >
                <span className="line-clamp-2 text-[13px] font-medium leading-snug group-hover:text-primary">
                  {a.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
