import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { verifyPreviewToken } from "@/lib/preview";
import { renderArticleHtml } from "@/lib/tiptap";
import { categoryName } from "@/lib/categories";
import { formatTaipei } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** 署名付きURLでの未公開記事プレビュー(社外共有可) */
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  if (!token || !verifyPreviewToken(id, token)) notFound();

  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      category: true,
      author: { select: { name: true, slug: true } },
      heroImage: true,
    },
  });
  if (!article) notFound();

  const t = await getTranslations();
  const bodyHtml = renderArticleHtml(article.body);
  const date = article.publishedAt ?? article.updatedAt;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <p className="rounded-md bg-amber-100 px-4 py-2 text-sm font-bold text-amber-800">
        PREVIEW — {t(`labels.publishedAt`)}: {formatTaipei(date, locale)}
      </p>
      <article className="mt-6">
        <span className="rounded-sm bg-primary-light px-2 py-0.5 text-xs font-bold text-primary-dark">
          {categoryName(article.category, locale)}
        </span>
        <h1 className="mt-3 text-[28px] font-black leading-snug sm:text-[32px]">
          {article.title}
        </h1>
        <p className="mt-3 border-y border-line py-3 text-sm text-gray">
          {t("labels.byAuthor")} {article.author.name}
        </p>
        {article.lead ? (
          <p className="mt-5 text-[17px] font-medium leading-relaxed">
            {article.lead}
          </p>
        ) : null}
        {article.heroImage ? (
          <figure className="mt-5">
            <div className="relative aspect-[16/9] overflow-hidden rounded-lg">
              <Image
                src={article.heroImage.url}
                alt={article.heroImage.alt}
                fill
                sizes="(min-width: 768px) 768px, 100vw"
                className="object-cover"
              />
            </div>
          </figure>
        ) : null}
        <div
          className="article-body mt-8"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </article>
    </div>
  );
}
