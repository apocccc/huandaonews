import { absoluteUrl, articlePath, SITE_NAME_ZH, SITE_URL } from "@/lib/site";
import type { ArticleFull } from "@/lib/data";

/**
 * JSON-LD ビルダー群。記事は NewsArticle(press-release のみ Article)。
 */

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

export function articleJsonLd(article: ArticleFull) {
  const isPressRelease = article.category.slug === "press-release";
  const url = absoluteUrl(articlePath(article.category.slug, article.slug));
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
    ...(article.heroImage
      ? {
          image: {
            "@type": "ImageObject",
            url: article.heroImage.url,
            width: article.heroImage.width,
            height: article.heroImage.height,
          },
        }
      : {}),
    articleSection: article.category.nameZh,
    inLanguage: "zh-Hant",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(isPressRelease && article.prSourceName
      ? { sourceOrganization: { "@type": "Organization", name: article.prSourceName } }
      : {}),
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
