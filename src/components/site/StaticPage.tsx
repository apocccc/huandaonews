import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionHeading } from "@/components/site/SectionHeading";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd, CONTACT_EMAIL, pageMetadata } from "@/lib/seo";

export type StaticPageKey =
  | "about"
  | "contact"
  | "privacy"
  | "editorialPolicy"
  | "corrections"
  | "terms";

type Section = { heading: string; body: string };

export async function staticPageMetadata(
  locale: string,
  key: StaticPageKey,
  path: string
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: `pages.${key}` });
  return pageMetadata({ title: t("title"), description: t("description"), path });
}

/** 本文中の連絡先メールアドレスを mailto リンクにする */
function withMailto(text: string) {
  const parts = text.split(CONTACT_EMAIL);
  return parts.flatMap((p, i) =>
    i === 0
      ? [p]
      : [
          <a
            key={i}
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-medium text-primary underline underline-offset-4 hover:text-primary-dark"
          >
            {CONTACT_EMAIL}
          </a>,
          p,
        ]
  );
}

/** about / contact / privacy / 編集方針 / 訂正 / 利用規約 の共通レイアウト */
export async function StaticPage({
  locale,
  pageKey,
  path,
}: {
  locale: string;
  pageKey: StaticPageKey;
  path: string;
}) {
  setRequestLocale(locale);
  const t = await getTranslations("pages");
  const tNav = await getTranslations("nav");
  const title = t(`${pageKey}.title`);
  const sections = t.raw(`${pageKey}.sections`) as Section[];

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: tNav("home"), path: "/" },
          { name: title, path },
        ])}
      />
      <SectionHeading as="h1">{title}</SectionHeading>
      <p className="mt-4 text-[15px] leading-[1.8] text-gray">{t(`${pageKey}.description`)}</p>
      {sections.map((s) => (
        <section key={s.heading} className="mt-8">
          <h2 className="text-lg font-bold">{s.heading}</h2>
          <p className="mt-2 text-[17px] leading-[1.8]">{withMailto(s.body)}</p>
        </section>
      ))}
    </article>
  );
}
