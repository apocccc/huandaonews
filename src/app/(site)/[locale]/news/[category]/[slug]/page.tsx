import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect as nextRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  findRedirect,
  getArticleBySlug,
  getLatestArticles,
  getPopularArticles,
  getRelatedArticles,
  incrementViewCount,
} from "@/lib/data";
import { renderArticleHtml } from "@/lib/tiptap";
import { articleJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ArticleCard } from "@/components/site/ArticleCard";
import { HeadlineList } from "@/components/site/HeadlineList";
import { RankingList } from "@/components/site/RankingList";
import { SectionHeading } from "@/components/site/SectionHeading";
import { ShareButtons } from "@/components/site/ShareButtons";
import { categoryName } from "@/lib/categories";
import { absoluteUrl, articlePath, formatTaipei } from "@/lib/site";

export const revalidate = 300;

export function generateStaticParams() {
  // ビルド時は生成せず、初回アクセス時に ISR で生成する
  return [];
}

type Params = { locale: string; category: string; slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { category, slug } = await params;
  const article = await getArticleBySlug(category, slug);
  if (!article) return {};

  const path = articlePath(category, slug);
  return {
    title: article.title,
    description: article.lead,
    alternates: {
      // 記事本文は言語間で同一のため、canonical は常にプレフィックスなしURL
      canonical: absoluteUrl(path),
    },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.lead,
      url: absoluteUrl(path),
      publishedTime: (article.publishedAt ?? article.createdAt).toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      section: article.category.nameZh,
      authors: [absoluteUrl(`/author/${article.author.slug}`)],
      ...(article.heroImage
        ? {
            images: [
              {
                url: article.heroImage.url,
                width: article.heroImage.width,
                height: article.heroImage.height,
                alt: article.heroImage.alt,
              },
            ],
          }
        : {}),
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, category, slug } = await params;
  setRequestLocale(locale);

  const article = await getArticleBySlug(category, slug);
  if (!article) {
    // スラッグ変更・カテゴリー移動時の301リダイレクト
    const r = await findRedirect(articlePath(category, slug));
    if (r) nextRedirect(r.toPath);
    notFound();
  }

  incrementViewCount(article.id);

  const t = await getTranslations();
  const [related, popular, latestSide] = await Promise.all([
    getRelatedArticles(article.id, article.categoryId, 4),
    getPopularArticles(8),
    getLatestArticles(8),
  ]);
  const bodyHtml = renderArticleHtml(article.body);
  const isPressRelease = article.category.slug === "press-release";
  const publishedAt = article.publishedAt ?? article.createdAt;
  const wasUpdated =
    article.updatedAt.getTime() - publishedAt.getTime() > 60 * 1000;
  const canonicalUrl = absoluteUrl(articlePath(category, slug));

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <Breadcrumbs
        crumbs={[
          { name: t("nav.home"), path: "/" },
          {
            name: categoryName(article.category, locale),
            path: `/category/${article.category.slug}`,
          },
          { name: article.title, path: articlePath(category, slug) },
        ]}
      />

      <div className="mt-3 grid gap-8 lg:grid-cols-[1fr_300px]">
        {/* メイン: 記事本文 */}
        <div className="min-w-0 max-w-3xl">
          <article>
            <JsonLd data={articleJsonLd(article)} />

            <header>
              <div className="flex flex-wrap items-center gap-2">
                {article.isBreaking ? (
                  <span className="rounded-sm bg-breaking px-2 py-0.5 text-xs font-bold text-white">
                    {t("labels.breaking")}
                  </span>
                ) : null}
                <Link
                  href={`/category/${article.category.slug}`}
                  className="rounded-sm bg-primary-light px-2 py-0.5 text-xs font-bold text-primary-dark hover:bg-primary hover:text-white transition-colors"
                >
                  {categoryName(article.category, locale)}
                </Link>
                {isPressRelease ? (
                  <span className="rounded-sm border border-line px-2 py-0.5 text-xs font-bold text-gray">
                    {t("labels.pressRelease")}
                  </span>
                ) : null}
              </div>

              {/* 新聞稿: 引用元メディアをタイトル上に目立つ形で表示 */}
              {isPressRelease && article.sourceName ? (
                <div className="mt-3 flex items-center gap-3 rounded-md border-l-4 border-primary bg-primary-light px-4 py-2.5">
                  <span className="shrink-0 text-xs font-bold text-primary-dark">
                    {t("labels.prProvidedBy")}
                  </span>
                  <span className="text-lg font-black text-primary-dark">
                    {article.sourceName}
                  </span>
                </div>
              ) : null}

              <h1 className="mt-3 text-[26px] font-black leading-snug sm:text-[30px]">
                {article.title}
              </h1>

              {/* 日付・著者を本文冒頭で機械可読に明示(AI/検索の出典特定用) */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-line py-2.5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-gray">
                  <span>
                    {t("labels.byAuthor")}{" "}
                    <Link
                      href={`/author/${article.author.slug}`}
                      rel="author"
                      className="font-medium text-ink hover:text-primary"
                    >
                      {article.author.name}
                    </Link>
                  </span>
                  <span>
                    {t("labels.publishedAt")}{" "}
                    <time dateTime={publishedAt.toISOString()}>
                      {formatTaipei(publishedAt, locale)}
                    </time>
                  </span>
                  {wasUpdated ? (
                    <span>
                      {t("labels.updatedAt")}{" "}
                      <time dateTime={article.updatedAt.toISOString()}>
                        {formatTaipei(article.updatedAt, locale)}
                      </time>
                    </span>
                  ) : null}
                </div>
                <ShareButtons url={canonicalUrl} title={article.title} />
              </div>

              {isPressRelease ? (
                <div className="mt-4 rounded-md bg-bg-sub px-4 py-3 text-sm text-gray">
                  <p>{t("labels.pressReleaseNotice")}</p>
                  {article.prSourceName ? (
                    <p className="mt-1 font-medium text-ink">
                      {t("labels.prSource")}:{article.prSourceName}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {article.lead ? (
                <p className="mt-5 border-l-4 border-primary-light pl-3 text-[16px] font-medium leading-relaxed text-ink">
                  {article.lead}
                </p>
              ) : null}

              {article.heroImage ? (
                <figure className="mt-5">
                  <div className="relative aspect-[16/9] overflow-hidden rounded-md">
                    <Image
                      src={article.heroImage.url}
                      alt={article.heroImage.alt}
                      fill
                      priority
                      sizes="(min-width: 768px) 768px, 100vw"
                      className="object-cover"
                    />
                  </div>
                  {article.heroImage.alt || article.sourceName ? (
                    <figcaption className="mt-2 text-xs text-gray">
                      {article.heroImage.alt}
                      {/* 転載画像の出典は独自記事化後も常に表示する */}
                      {article.sourceName
                        ? `${article.heroImage.alt ? " " : ""}(${t("labels.imageSource")}:${article.sourceName})`
                        : ""}
                    </figcaption>
                  ) : null}
                </figure>
              ) : null}
            </header>

            <div
              className="article-body mt-7"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />

            {/* RSS転載記事の出典表記(AIで独自記事化済みの場合は非表示) */}
            {article.sourceName && !article.isRewritten ? (
              <div className="mt-8 rounded-md bg-bg-sub px-4 py-3 text-sm text-gray">
                {t("labels.sourceFrom")}
                <span className="font-medium text-ink">
                  《{article.sourceName}》
                </span>
                {article.sourceUrl ? (
                  <>
                    {" · "}
                    <a
                      href={article.sourceUrl}
                      target="_blank"
                      rel="noopener nofollow"
                      className="text-primary underline underline-offset-2 hover:text-primary-dark"
                    >
                      {t("labels.originalArticle")}
                    </a>
                  </>
                ) : null}
              </div>
            ) : null}

            <footer className="mt-8 border-t border-line pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {article.tags.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {article.tags.map(({ tag }) => (
                      <li key={tag.id}>
                        <Link
                          href={`/tag/${tag.slug}`}
                          className="inline-block rounded-full border border-line px-3 py-1 text-[13px] text-gray hover:border-primary hover:text-primary"
                        >
                          #{tag.nameZh}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span />
                )}
                <ShareButtons url={canonicalUrl} title={article.title} />
              </div>
            </footer>
          </article>

          {related.length > 0 ? (
            <section className="mt-10" aria-label={t("labels.relatedArticles")}>
              <div className="border-t-2 border-ink pt-2.5">
                <SectionHeading>{t("labels.relatedArticles")}</SectionHeading>
              </div>
              <div className="mt-4 flex flex-col gap-5">
                {related.map((a) => (
                  <ArticleCard
                    key={a.id}
                    article={a}
                    locale={locale}
                    showCategory={false}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {/* サイドバー */}
        <aside className="flex flex-col gap-6">
          <section aria-label={t("labels.ranking")}>
            <div className="border-t-2 border-primary pt-2.5">
              <SectionHeading>{t("labels.ranking")}</SectionHeading>
            </div>
            <div className="mt-1">
              <RankingList articles={popular} />
            </div>
          </section>

          <section aria-label={t("labels.latestNews")}>
            <div className="flex items-baseline justify-between border-t-2 border-ink pt-2.5">
              <SectionHeading>{t("labels.latestNews")}</SectionHeading>
              <Link
                href="/category/latest"
                className="text-[11.5px] font-medium text-gray hover:text-primary"
              >
                {t("labels.viewAll")} →
              </Link>
            </div>
            <div className="mt-1">
              <HeadlineList
                articles={latestSide.filter((a) => a.id !== article.id)}
                locale={locale}
                showCategory={false}
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
