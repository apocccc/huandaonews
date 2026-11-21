import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  CATEGORY_INDEX_MIN_ARTICLES,
  getArticlesByCategory,
  getCategoryArticleCounts,
  getCategoryBySlug,
} from "@/lib/data";
import { ArticleCard } from "@/components/site/ArticleCard";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Pagination } from "@/components/site/Pagination";
import { SectionHeading } from "@/components/site/SectionHeading";
import { categoryName } from "@/lib/categories";
import { JsonLd } from "@/components/JsonLd";
import { categoryDescription } from "@/lib/category-meta";
import { collectionPageJsonLd, pageMetadata } from "@/lib/seo";

export const revalidate = 300;

const PER_PAGE = 20;

type Params = { locale: string; category: string };

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { locale, category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return {};
  const page = Math.max(1, parseInt((await searchParams).page ?? "1", 10) || 1);
  const t = await getTranslations({ locale });
  const name = categoryName(category, locale);
  const counts = await getCategoryArticleCounts();
  const base = `/category/${slug}`;
  const pageLabel = page > 1 ? ` ${t("labels.page", { page })}` : "";
  return pageMetadata({
    title: `${name}${pageLabel}`,
    description: `${await categoryDescription(category, locale)}${pageLabel}`,
    // 2ページ目以降は自己参照 canonical
    path: page > 1 ? `${base}?page=${page}` : base,
    // 記事が少ないカテゴリーは薄いページとして noindex(リンクはたどらせる)
    noindex: (counts[slug] ?? 0) < CATEGORY_INDEX_MIN_ARTICLES,
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, category: slug } = await params;
  setRequestLocale(locale);

  const category = await getCategoryBySlug(slug);
  if (!category || !category.isVisible) notFound();

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const t = await getTranslations();
  const { items, total } = await getArticlesByCategory(slug, page, PER_PAGE);
  const name = categoryName(category, locale);
  const description = await categoryDescription(category, locale);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <JsonLd
        data={collectionPageJsonLd({
          name,
          description,
          path: page > 1 ? `/category/${slug}?page=${page}` : `/category/${slug}`,
          articles: items,
        })}
      />
      <Breadcrumbs
        crumbs={[
          { name: t("nav.home"), path: "/" },
          { name, path: `/category/${slug}` },
        ]}
      />
      <div className="mt-4 flex items-baseline justify-between">
        <SectionHeading as="h1">{name}</SectionHeading>
        <p className="text-sm text-gray">
          {t("labels.articleCount", { count: total })}
        </p>
      </div>

      {category.description ? (
        <p className="mt-2 text-[14px] leading-relaxed text-gray">{category.description}</p>
      ) : null}

      {items.length === 0 ? (
        <p className="py-20 text-center text-gray">{t("labels.noArticles")}</p>
      ) : (
        <div className="mt-6 flex flex-col gap-7">
          {items.map((a) => (
            <ArticleCard
              key={a.id}
              article={a}
              locale={locale}
              showCategory={slug === "latest"}
            />
          ))}
        </div>
      )}

      <Pagination
        basePath={`/category/${slug}`}
        page={page}
        total={total}
        perPage={PER_PAGE}
      />
    </div>
  );
}
