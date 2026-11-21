import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CATEGORY_INDEX_MIN_ARTICLES, getArticlesByTag } from "@/lib/data";
import { JsonLd } from "@/components/JsonLd";
import { collectionPageJsonLd, pageMetadata } from "@/lib/seo";
import { ArticleCard } from "@/components/site/ArticleCard";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Pagination } from "@/components/site/Pagination";
import { SectionHeading } from "@/components/site/SectionHeading";

export const revalidate = 300;

const PER_PAGE = 20;

type Params = { locale: string; tag: string };

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { locale, tag: tagSlug } = await params;
  const { tag, total } = await getArticlesByTag(tagSlug, 1, 1);
  if (!tag) return {};
  const page = Math.max(1, parseInt((await searchParams).page ?? "1", 10) || 1);
  const t = await getTranslations({ locale });
  const pageLabel = page > 1 ? ` ${t("labels.page", { page })}` : "";
  const base = `/tag/${tagSlug}`;
  return pageMetadata({
    title: `#${tag.nameZh}${pageLabel}`,
    description: `${t("meta.tag", { tag: tag.nameZh })}${pageLabel}`,
    path: page > 1 ? `${base}?page=${page}` : base,
    // 記事の少ないタグページは薄いページとして noindex(リンクはたどらせる)
    noindex: total < CATEGORY_INDEX_MIN_ARTICLES,
  });
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, tag: tagSlug } = await params;
  setRequestLocale(locale);

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const { tag, items, total } = await getArticlesByTag(tagSlug, page, PER_PAGE);
  if (!tag) notFound();

  const t = await getTranslations();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Breadcrumbs
        crumbs={[
          { name: t("nav.home"), path: "/" },
          { name: `#${tag.nameZh}`, path: `/tag/${tagSlug}` },
        ]}
      />
      <JsonLd
        data={collectionPageJsonLd({
          name: `#${tag.nameZh}`,
          description: t("meta.tag", { tag: tag.nameZh }),
          path: page > 1 ? `/tag/${tagSlug}?page=${page}` : `/tag/${tagSlug}`,
          articles: items,
        })}
      />
      <div className="mt-4">
        <SectionHeading as="h1">
          {t("tag.articlesTagged", { tag: tag.nameZh })}
        </SectionHeading>
      </div>

      {items.length === 0 ? (
        <p className="py-20 text-center text-gray">{t("labels.noArticles")}</p>
      ) : (
        <div className="mt-6 flex flex-col gap-7">
          {items.map((a) => (
            <ArticleCard key={a.id} article={a} locale={locale} />
          ))}
        </div>
      )}

      <Pagination
        basePath={`/tag/${tagSlug}`}
        page={page}
        total={total}
        perPage={PER_PAGE}
      />
    </div>
  );
}
