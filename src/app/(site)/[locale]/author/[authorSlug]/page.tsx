import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAuthorWithArticles } from "@/lib/data";
import { ArticleCard } from "@/components/site/ArticleCard";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Pagination } from "@/components/site/Pagination";

export const revalidate = 300;

const PER_PAGE = 20;

type Params = { locale: string; authorSlug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { authorSlug } = await params;
  const { author } = await getAuthorWithArticles(authorSlug, 1, 1);
  if (!author) return {};
  return { title: author.name, description: author.bio ?? undefined };
}

export default async function AuthorPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, authorSlug } = await params;
  setRequestLocale(locale);

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const { author, items, total } = await getAuthorWithArticles(
    authorSlug,
    page,
    PER_PAGE
  );
  if (!author) notFound();

  const t = await getTranslations();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Breadcrumbs
        crumbs={[
          { name: t("nav.home"), path: "/" },
          { name: author.name, path: `/author/${authorSlug}` },
        ]}
      />

      <header className="mt-4 flex items-center gap-4 border-b border-line pb-6">
        {author.avatarUrl ? (
          <Image
            src={author.avatarUrl}
            alt={author.name}
            width={64}
            height={64}
            className="rounded-full"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light text-xl font-black text-primary"
          >
            {author.name.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-black">{author.name}</h1>
          {author.bio ? (
            <p className="mt-1 text-sm text-gray">{author.bio}</p>
          ) : null}
        </div>
      </header>

      <h2 className="mt-6 text-lg font-bold">
        {t("author.articlesBy", { name: author.name })}
      </h2>

      {items.length === 0 ? (
        <p className="py-20 text-center text-gray">{t("labels.noArticles")}</p>
      ) : (
        <div className="mt-5 flex flex-col gap-7">
          {items.map((a) => (
            <ArticleCard key={a.id} article={a} locale={locale} />
          ))}
        </div>
      )}

      <Pagination
        basePath={`/author/${authorSlug}`}
        page={page}
        total={total}
        perPage={PER_PAGE}
      />
    </div>
  );
}
