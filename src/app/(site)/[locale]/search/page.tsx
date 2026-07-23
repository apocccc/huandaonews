import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { searchArticles } from "@/lib/data";
import { ArticleCard } from "@/components/site/ArticleCard";
import { Pagination } from "@/components/site/Pagination";
import { SectionHeading } from "@/components/site/SectionHeading";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "search" });
  return { title: t("title"), robots: { index: false } };
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q = "", page: pageParam } = await searchParams;
  const query = q.trim();
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const t = await getTranslations();

  const { items, total } = query
    ? await searchArticles(query, page, PER_PAGE)
    : { items: [], total: 0 };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-black">
        <SectionHeading>
          {query ? t("search.resultsFor", { query }) : t("search.title")}
        </SectionHeading>
      </h1>

      <form action="" method="get" role="search" className="mt-5 flex max-w-md">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={t("search.placeholder")}
          className="flex-1 rounded-l-md border border-line bg-bg-sub px-4 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          className="rounded-r-md bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark"
        >
          {t("search.button")}
        </button>
      </form>

      {query && items.length === 0 ? (
        <p className="py-20 text-center text-gray">
          {t("search.noResults", { query })}
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-7">
          {items.map((a) => (
            <ArticleCard key={a.id} article={a} locale={locale} />
          ))}
        </div>
      )}

      {query ? (
        <Pagination
          basePath="/search"
          page={page}
          total={total}
          perPage={PER_PAGE}
          extraQuery={{ q: query }}
        />
      ) : null}
    </div>
  );
}
