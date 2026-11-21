import type { Metadata } from "next";
import { absoluteUrl, articlePath, SITE_NAME_ZH, SITE_URL } from "@/lib/site";
import type { ArticleFull, ArticleListItem } from "@/lib/data";
import { extractText } from "@/lib/tiptap";
import {
  articleOgPath,
  DEFAULT_OG_IMAGE,
  isRichResultImage,
  OG_SIZES,
} from "@/lib/images";

/** 連絡先(サイト・構造化データ共通) */
export const CONTACT_EMAIL = "contact@huandaonews.tw";

/** 相対URL(ローカル保存画像)も絶対URLにする */
function toAbsolute(url: string): string {
  return url.startsWith("http") ? url : absoluteUrl(url);
}

/* ================= ページメタデータ ================= */

type PageImage = { url: string; width: number; height: number; alt?: string };

/**
 * 全ページ共通のメタデータ。canonical / og:url / og:image / twitter:image を必ず出す。
 * (Next.js は openGraph をページ単位で丸ごと置き換えるため、毎回すべて渡す)
 */
export function pageMetadata(opts: {
  title?: string;
  description: string;
  path: string;
  image?: PageImage;
  type?: "website" | "article" | "profile";
  noindex?: boolean;
}): Metadata {
  const url = absoluteUrl(opts.path);
  const image = opts.image ?? {
    url: absoluteUrl(DEFAULT_OG_IMAGE.path),
    width: DEFAULT_OG_IMAGE.width,
    height: DEFAULT_OG_IMAGE.height,
    alt: SITE_NAME_ZH,
  };
  return {
    ...(opts.title ? { title: opts.title } : {}),
    description: opts.description,
    alternates: { canonical: url },
    openGraph: {
      type: opts.type ?? "website",
      siteName: SITE_NAME_ZH,
      locale: "zh_TW",
      url,
      ...(opts.title ? { title: opts.title } : {}),
      description: opts.description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      ...(opts.title ? { title: opts.title } : {}),
      description: opts.description,
      images: [image.url],
    },
    ...(opts.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/**
 * 記事の代表画像(og:image 用)。元画像が幅1200px以上の写真ならそれを、
 * 小さい・ロゴ画像なら自動生成OGP(1200×630)を使う。
 */
export function articleOgImage(article: {
  title: string;
  slug: string;
  category: { slug: string };
  heroImage: { url: string; width: number; height: number; alt: string } | null;
}): PageImage {
  if (isRichResultImage(article.heroImage)) {
    return {
      url: toAbsolute(article.heroImage!.url),
      width: article.heroImage!.width,
      height: article.heroImage!.height,
      alt: article.heroImage!.alt || article.title,
    };
  }
  return {
    url: absoluteUrl(articleOgPath("og", article.category.slug, article.slug)),
    ...OG_SIZES.og,
    alt: article.title,
  };
}

/* ================= JSON-LD ================= */

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME_ZH,
    alternateName: "Huandao News",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/logo.png"),
      width: 512,
      height: 512,
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "editorial",
      email: CONTACT_EMAIL,
      availableLanguage: ["zh-Hant"],
    },
    publishingPrinciples: absoluteUrl("/editorial-policy"),
    ethicsPolicy: absoluteUrl("/editorial-policy"),
    correctionsPolicy: absoluteUrl("/corrections"),
    actionableFeedbackPolicy: absoluteUrl("/corrections"),
  };
}

export function webSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME_ZH,
    url: SITE_URL,
    inLanguage: "zh-Hant",
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** 出典ブロックを表示する記事か(独自化済みの記事は出典を表示しない方針) */
export function showsSource(article: {
  sourceName: string | null;
  isRewritten: boolean;
}): boolean {
  return !!article.sourceName && !article.isRewritten;
}

export function articleJsonLd(article: ArticleFull) {
  const isPressRelease = article.category.slug === "press-release";
  const url = absoluteUrl(articlePath(article.category.slug, article.slug));
  const text = extractText(article.body).trim();

  // 画像: 幅1200px以上の元画像 + 自動生成OGP(16:9 / 4:3 / 1:1)。Google の推奨どおり複数比率
  const images = [
    ...(isRichResultImage(article.heroImage)
      ? [
          {
            "@type": "ImageObject",
            url: toAbsolute(article.heroImage!.url),
            width: article.heroImage!.width,
            height: article.heroImage!.height,
          },
        ]
      : []),
    ...(["16x9", "4x3", "1x1"] as const).map((r) => ({
      "@type": "ImageObject",
      url: absoluteUrl(articleOgPath(r, article.category.slug, article.slug)),
      ...OG_SIZES[r],
    })),
  ];

  return {
    "@context": "https://schema.org",
    "@type": isPressRelease ? "Article" : "NewsArticle",
    headline: article.title,
    description: article.lead,
    datePublished: (article.publishedAt ?? article.createdAt).toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author: {
      "@type": "Person",
      name: article.author.name,
      url: absoluteUrl(`/author/${article.author.slug}`),
    },
    publisher: { "@id": `${SITE_URL}/#organization` },
    image: images,
    articleSection: article.category.nameZh,
    inLanguage: "zh-Hant",
    isAccessibleForFree: true,
    articleBody: text,
    // 中国語は単語区切りがないため、空白を除いた文字数を語数として扱う
    wordCount: text.replace(/\s+/g, "").length,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(showsSource(article)
      ? {
          citation: {
            "@type": "CreativeWork",
            name: article.sourceName,
            ...(article.sourceUrl ? { url: article.sourceUrl } : {}),
          },
        }
      : {}),
    ...(isPressRelease && article.prSourceName
      ? { sourceOrganization: { "@type": "Organization", name: article.prSourceName } }
      : {}),
  };
}

/** カテゴリー・タグ一覧ページ: CollectionPage + ItemList */
export function collectionPageJsonLd(opts: {
  name: string;
  description: string;
  path: string;
  articles: ArticleListItem[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    description: opts.description,
    url: absoluteUrl(opts.path),
    inLanguage: "zh-Hant",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: opts.articles.map((a, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absoluteUrl(articlePath(a.category.slug, a.slug)),
        name: a.title,
      })),
    },
  };
}

/** 著者ページ: ProfilePage + Person */
export function profilePageJsonLd(author: {
  name: string;
  slug: string;
  bio: string | null;
  avatarUrl: string | null;
}) {
  const url = absoluteUrl(`/author/${author.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url,
    mainEntity: {
      "@type": "Person",
      "@id": `${url}#person`,
      name: author.name,
      url,
      ...(author.bio ? { description: author.bio } : {}),
      ...(author.avatarUrl ? { image: toAbsolute(author.avatarUrl) } : {}),
      worksFor: { "@id": `${SITE_URL}/#organization` },
    },
  };
}

export type Crumb = { name: string; path: string };

export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

/** XML 出力用の最小限のエスケープ */
export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
