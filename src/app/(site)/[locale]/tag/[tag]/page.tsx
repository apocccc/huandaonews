import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getArticlesByTag } from "@/lib/data";
import { ArticleCard } from "@/components/site/ArticleCard";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Pagination } from "@/components/site/Pagination";
import { SectionHeading } from "@/components/site/SectionHeading";

export const revalidate = 300;

const PER_PAGE = 20;

type Params = { locale: string; tag: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { tag: tagSlug } = await params;
  const { tag } = await getArticlesByTag(tagSlug, 1, 1);
  if (!tag) return {};
  return { title: `#${tag.nameZh}` };
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
      <div className="mt-4">
        <h1 className="text-2xl font-black">
          <SectionHeading>
            {t("tag.articlesTagged", { tag: tag.nameZh })}
          </SectionHeading>
        </h1>
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
