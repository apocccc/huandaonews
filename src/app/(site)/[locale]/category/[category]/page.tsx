import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getArticlesByCategory, getCategoryBySlug } from "@/lib/data";
import { ArticleCard } from "@/components/site/ArticleCard";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Pagination } from "@/components/site/Pagination";
import { SectionHeading } from "@/components/site/SectionHeading";
import { categoryName } from "@/lib/categories";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 300;

const PER_PAGE = 20;

type Params = { locale: string; category: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return {};
  const name = categoryName(category, locale);
  const path = `/category/${slug}`;
  return {
    title: name,
    alternates: {
      canonical: absoluteUrl(locale === "en" ? `/en${path}` : path),
      // 一覧ページはUI言語版同士を hreflang で相互リンク
      languages: {
        "zh-Hant": absoluteUrl(path),
        en: absoluteUrl(`/en${path}`),
      },
    },
    openGraph: {
      title: name,
      url: absoluteUrl(locale === "en" ? `/en${path}` : path),
    },
  };
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Breadcrumbs
        crumbs={[
          { name: t("nav.home"), path: "/" },
          { name, path: `/category/${slug}` },
        ]}
      />
      <div className="mt-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-black">
          <SectionHeading>{name}</SectionHeading>
        </h1>
        <p className="text-sm text-gray">
          {t("labels.articleCount", { count: total })}
        </p>
      </div>

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
