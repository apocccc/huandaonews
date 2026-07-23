import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  getBreakingArticles,
  getLatestArticles,
  getPinnedArticles,
  getPressReleases,
} from "@/lib/data";
import {
  ArticleCard,
  CompactCard,
  HeroCard,
} from "@/components/site/ArticleCard";
import { SectionHeading } from "@/components/site/SectionHeading";
import { articlePath } from "@/lib/site";

export const revalidate = 300;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const [pinned, latest, breaking, pressReleases] = await Promise.all([
    getPinnedArticles(5),
    getLatestArticles(24),
    getBreakingArticles(3),
    getPressReleases(4),
  ]);

  const hero = pinned[0] ?? latest[0];
  const subTop = (pinned.length > 1 ? pinned.slice(1, 5) : latest.slice(1, 5)).filter(
    (a) => a.id !== hero?.id
  );
  const heroIds = new Set([hero?.id, ...subTop.map((a) => a.id)]);
  const rest = latest.filter((a) => !heroIds.has(a.id));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* 速報ティッカー */}
      {breaking.length > 0 ? (
        <div className="mb-6 flex items-center gap-3 overflow-hidden rounded-md border border-primary-light bg-primary-light/60 px-3 py-2">
          <span className="shrink-0 rounded-sm bg-breaking px-2 py-0.5 text-xs font-bold text-white">
            {t("labels.breaking")}
          </span>
          <ul className="flex gap-6 overflow-x-auto text-sm font-medium whitespace-nowrap">
            {breaking.map((a) => (
              <li key={a.id}>
                <Link
                  href={articlePath(a.category.slug, a.slug)}
                  className="hover:text-primary-dark"
                >
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hero ? (
        <section aria-label={t("labels.topStories")}>
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <HeroCard article={hero} locale={locale} />
            </div>
            <div className="flex flex-col gap-5 lg:border-l lg:border-line lg:pl-6">
              {subTop.map((a) => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  locale={locale}
                  showCategory
                />
              ))}
            </div>
          </div>
        </section>
      ) : (
        <p className="py-20 text-center text-gray">{t("labels.noArticles")}</p>
      )}

      {rest.length > 0 ? (
        <section className="mt-12" aria-label={t("labels.latestNews")}>
          <div className="flex items-center justify-between">
            <SectionHeading>{t("labels.latestNews")}</SectionHeading>
            <Link
              href="/category/latest"
              className="text-sm font-medium text-primary hover:text-primary-dark"
            >
              {t("labels.viewAll")} →
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {rest.slice(0, 12).map((a) => (
              <CompactCard key={a.id} article={a} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}

      {/* プレスリリース専用枠(主要ニュース面とは分離) */}
      {pressReleases.length > 0 ? (
        <section className="mt-12" aria-label={t("labels.pressRelease")}>
          <div className="flex items-center justify-between">
            <SectionHeading>{t("labels.pressRelease")}</SectionHeading>
            <Link
              href="/category/press-release"
              className="text-sm font-medium text-primary hover:text-primary-dark"
            >
              {t("labels.viewAll")} →
            </Link>
          </div>
          <div className="mt-5 grid gap-4 rounded-lg bg-bg-sub p-5 sm:grid-cols-2">
            {pressReleases.map((a) => (
              <article key={a.id}>
                <Link
                  href={articlePath(a.category.slug, a.slug)}
                  className="group block"
                >
                  <span className="mr-2 inline-block rounded-sm border border-line bg-bg px-1.5 py-0.5 align-middle text-[11px] font-bold text-gray">
                    {t("labels.pressRelease")}
                  </span>
                  <span className="align-middle text-[15px] font-bold leading-snug group-hover:text-primary">
                    {a.title}
                  </span>
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
