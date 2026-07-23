import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import {
  getBreakingArticles,
  getCategoryDigests,
  getLatestArticles,
  getPinnedArticles,
  getPopularArticles,
  getPressReleases,
} from "@/lib/data";
import { HeroCard } from "@/components/site/ArticleCard";
import { HeadlineList } from "@/components/site/HeadlineList";
import { RankingList } from "@/components/site/RankingList";
import { CategorySection } from "@/components/site/CategorySection";
import { SectionHeading } from "@/components/site/SectionHeading";
import { articlePath, formatTaipeiShort } from "@/lib/site";

export const revalidate = 300;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const [pinned, latest, breaking, pressReleases, popular, digests] =
    await Promise.all([
      getPinnedArticles(5),
      getLatestArticles(30),
      getBreakingArticles(3),
      getPressReleases(6),
      getPopularArticles(10),
      getCategoryDigests(4),
    ]);

  const hero = pinned[0] ?? latest[0];
  // サブトップはピン留め記事を優先し、足りない分は最新記事で4件まで埋める
  const subTop: typeof latest = [];
  for (const a of [...pinned.slice(1), ...latest]) {
    if (subTop.length >= 4) break;
    if (a.id === hero?.id || subTop.some((s) => s.id === a.id)) continue;
    subTop.push(a);
  }
  const heroIds = new Set([hero?.id, ...subTop.map((a) => a.id)]);
  const rest = latest.filter((a) => !heroIds.has(a.id));

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      {/* 速報ティッカー */}
      {breaking.length > 0 ? (
        <div className="mb-4 flex items-center gap-3 overflow-hidden border-y-2 border-breaking/80 px-1 py-1.5">
          <span className="shrink-0 bg-breaking px-2 py-0.5 text-xs font-black text-white">
            {t("labels.breaking")}
          </span>
          <ul className="flex gap-6 overflow-x-auto text-[13.5px] font-bold whitespace-nowrap">
            {breaking.map((a) => (
              <li key={a.id}>
                <Link
                  href={articlePath(a.category.slug, a.slug)}
                  className="hover:text-breaking hover:underline underline-offset-2"
                >
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hero ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* メインカラム */}
          <div className="min-w-0">
            <section aria-label={t("labels.topStories")}>
              <div className="grid gap-5 md:grid-cols-5">
                <div className="md:col-span-3">
                  <HeroCard article={hero} locale={locale} />
                </div>
                <div className="md:col-span-2 md:border-l md:border-line md:pl-5">
                  <ul className="divide-y divide-line">
                    {subTop.map((a) => (
                      <li key={a.id}>
                        <Link
                          href={articlePath(a.category.slug, a.slug)}
                          className="group flex gap-2.5 py-2.5 first:pt-0"
                        >
                          <div className="relative aspect-[3/2] w-20 shrink-0 overflow-hidden rounded-sm bg-bg-sub">
                            {a.heroImage ? (
                              <Image
                                src={a.heroImage.url}
                                alt={a.heroImage.alt}
                                fill
                                sizes="80px"
                                className="object-cover"
                              />
                            ) : (
                              <span
                                aria-hidden="true"
                                className="flex h-full w-full items-center justify-center text-lg font-black text-line select-none"
                              >
                                環
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            {a.isBreaking ? (
                              <span className="mr-1 inline-block rounded-sm bg-breaking px-1 py-px align-[2px] text-[10px] font-bold text-white">
                                {t("labels.breaking")}
                              </span>
                            ) : null}
                            <span className="line-clamp-3 text-[13.5px] font-bold leading-snug group-hover:text-primary">
                              {a.title}
                            </span>
                            <time
                              dateTime={(a.publishedAt ?? a.createdAt).toISOString()}
                              className="mt-0.5 block font-mono text-[11px] text-gray"
                            >
                              {formatTaipeiShort(a.publishedAt ?? a.createdAt, locale)}
                            </time>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* 最新見出し(高密度リスト) */}
            {rest.length > 0 ? (
              <section className="mt-6" aria-label={t("labels.latestNews")}>
                <div className="flex items-center justify-between border-t-2 border-ink pt-2.5">
                  <SectionHeading>{t("labels.latestNews")}</SectionHeading>
                  <Link
                    href="/category/latest"
                    className="text-[12.5px] font-medium text-gray hover:text-primary"
                  >
                    {t("labels.viewAll")} →
                  </Link>
                </div>
                <div className="mt-1">
                  <HeadlineList articles={rest.slice(0, 14)} locale={locale} />
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

            {/* プレスリリース専用枠(主要ニュース面とは分離) */}
            {pressReleases.length > 0 ? (
              <section aria-label={t("labels.pressRelease")}>
                <div className="flex items-baseline justify-between border-t-2 border-ink pt-2.5">
                  <SectionHeading>{t("labels.pressRelease")}</SectionHeading>
                  <Link
                    href="/category/press-release"
                    className="text-[11.5px] font-medium text-gray hover:text-primary"
                  >
                    {t("labels.viewAll")} →
                  </Link>
                </div>
                <ul className="mt-1 divide-y divide-line">
                  {pressReleases.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={articlePath(a.category.slug, a.slug)}
                        className="group block py-2"
                      >
                        <span className="line-clamp-2 text-[13px] font-medium leading-snug group-hover:text-primary">
                          {a.title}
                        </span>
                        {a.prSourceName ? (
                          <span className="mt-0.5 block text-[11px] text-gray">
                            {a.prSourceName}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>
      ) : (
        <p className="py-20 text-center text-gray">{t("labels.noArticles")}</p>
      )}

      {/* カテゴリー別セクション群 */}
      {digests.length > 0 ? (
        <section className="mt-10">
          <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {digests.map(({ category, articles }) => (
              <CategorySection
                key={category.id}
                category={category}
                articles={articles}
                locale={locale}
                moreLabel={t("labels.viewAll")}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
