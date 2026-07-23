import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * 公開サイト用のデータ取得層。
 * ビルド時にDBへ到達できない環境でもビルドが失敗しないよう、
 * 読み取りクエリは safe() でラップして空データへフォールバックする。
 */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[data] query failed:", e);
    }
    return fallback;
  }
}

export const articleListInclude = {
  category: true,
  author: { select: { name: true, slug: true, avatarUrl: true } },
  heroImage: true,
} satisfies Prisma.ArticleInclude;

export type ArticleListItem = Prisma.ArticleGetPayload<{
  include: typeof articleListInclude;
}>;

export type ArticleFull = Prisma.ArticleGetPayload<{
  include: {
    category: true;
    author: { select: { name: true; slug: true; avatarUrl: true; bio: true } };
    heroImage: true;
    tags: { include: { tag: true } };
  };
}>;

const publishedWhere = { status: "published" as const };

export function getVisibleCategories() {
  return safe(
    () =>
      prisma.category.findMany({
        where: { isVisible: true },
        orderBy: { order: "asc" },
      }),
    []
  );
}

export function getCategoryBySlug(slug: string) {
  return safe(() => prisma.category.findUnique({ where: { slug } }), null);
}

/** トップ・「即時」用: 全カテゴリー横断の最新記事(press-release除く) */
export function getLatestArticles(limit = 20, excludePressRelease = true) {
  return safe(
    () =>
      prisma.article.findMany({
        where: {
          ...publishedWhere,
          ...(excludePressRelease
            ? { category: { isNot: { slug: "press-release" } } }
            : {}),
        },
        orderBy: { publishedAt: "desc" },
        take: limit,
        include: articleListInclude,
      }),
    []
  );
}

export function getPinnedArticles(limit = 5) {
  return safe(
    () =>
      prisma.article.findMany({
        where: {
          ...publishedWhere,
          isPinned: true,
          category: { isNot: { slug: "press-release" } },
        },
        orderBy: { publishedAt: "desc" },
        take: limit,
        include: articleListInclude,
      }),
    []
  );
}

export function getBreakingArticles(limit = 3) {
  return safe(
    () =>
      prisma.article.findMany({
        where: { ...publishedWhere, isBreaking: true },
        orderBy: { publishedAt: "desc" },
        take: limit,
        include: articleListInclude,
      }),
    []
  );
}

export function getArticlesByCategory(
  categorySlug: string,
  page = 1,
  perPage = 20
) {
  return safe(
    async () => {
      const where =
        categorySlug === "latest"
          ? { ...publishedWhere, category: { isNot: { slug: "press-release" } } }
          : { ...publishedWhere, category: { is: { slug: categorySlug } } };
      const [items, total] = await Promise.all([
        prisma.article.findMany({
          where,
          orderBy: { publishedAt: "desc" },
          skip: (page - 1) * perPage,
          take: perPage,
          include: articleListInclude,
        }),
        prisma.article.count({ where }),
      ]);
      return { items, total };
    },
    { items: [] as ArticleListItem[], total: 0 }
  );
}

/** 閲覧数ランキング(サイドバー用) */
export function getPopularArticles(limit = 10) {
  return safe(
    () =>
      prisma.article.findMany({
        where: {
          ...publishedWhere,
          category: { isNot: { slug: "press-release" } },
        },
        orderBy: { viewCount: "desc" },
        take: limit,
        include: articleListInclude,
      }),
    []
  );
}

/** カテゴリー別ダイジェスト(トップのセクション群用) */
export function getCategoryDigests(perCategory = 4) {
  return safe(
    async () => {
      const categories = await prisma.category.findMany({
        where: {
          isVisible: true,
          slug: { notIn: ["latest", "press-release"] },
        },
        orderBy: { order: "asc" },
      });
      const digests = await Promise.all(
        categories.map(async (category) => ({
          category,
          articles: await prisma.article.findMany({
            where: { ...publishedWhere, categoryId: category.id },
            orderBy: { publishedAt: "desc" },
            take: perCategory,
            include: articleListInclude,
          }),
        }))
      );
      return digests.filter((d) => d.articles.length > 0);
    },
    [] as {
      category: Prisma.CategoryGetPayload<object>;
      articles: ArticleListItem[];
    }[]
  );
}

export function getPressReleases(limit = 6) {
  return safe(
    () =>
      prisma.article.findMany({
        where: { ...publishedWhere, category: { is: { slug: "press-release" } } },
        orderBy: { publishedAt: "desc" },
        take: limit,
        include: articleListInclude,
      }),
    []
  );
}

export function getArticleBySlug(categorySlug: string, articleSlug: string) {
  return safe<ArticleFull | null>(
    () =>
      prisma.article.findFirst({
        where: {
          slug: articleSlug,
          status: "published",
          category: { is: { slug: categorySlug } },
        },
        include: {
          category: true,
          author: {
            select: { name: true, slug: true, avatarUrl: true, bio: true },
          },
          heroImage: true,
          tags: { include: { tag: true } },
        },
      }),
    null
  );
}

export function getRelatedArticles(
  articleId: string,
  categoryId: string,
  limit = 4
) {
  return safe(
    () =>
      prisma.article.findMany({
        where: {
          ...publishedWhere,
          categoryId,
          id: { not: articleId },
        },
        orderBy: { publishedAt: "desc" },
        take: limit,
        include: articleListInclude,
      }),
    []
  );
}

export function getArticlesByTag(tagSlug: string, page = 1, perPage = 20) {
  return safe(
    async () => {
      const tag = await prisma.tag.findUnique({ where: { slug: tagSlug } });
      if (!tag) return { tag: null, items: [] as ArticleListItem[], total: 0 };
      const where = {
        ...publishedWhere,
        tags: { some: { tagId: tag.id } },
      };
      const [items, total] = await Promise.all([
        prisma.article.findMany({
          where,
          orderBy: { publishedAt: "desc" },
          skip: (page - 1) * perPage,
          take: perPage,
          include: articleListInclude,
        }),
        prisma.article.count({ where }),
      ]);
      return { tag, items, total };
    },
    { tag: null, items: [] as ArticleListItem[], total: 0 }
  );
}

export function getAuthorWithArticles(slug: string, page = 1, perPage = 20) {
  return safe(
    async () => {
      const author = await prisma.user.findUnique({
        where: { slug },
        select: { id: true, name: true, slug: true, avatarUrl: true, bio: true },
      });
      if (!author)
        return { author: null, items: [] as ArticleListItem[], total: 0 };
      const where = { ...publishedWhere, authorId: author.id };
      const [items, total] = await Promise.all([
        prisma.article.findMany({
          where,
          orderBy: { publishedAt: "desc" },
          skip: (page - 1) * perPage,
          take: perPage,
          include: articleListInclude,
        }),
        prisma.article.count({ where }),
      ]);
      return { author, items, total };
    },
    { author: null, items: [] as ArticleListItem[], total: 0 }
  );
}

export function searchArticles(query: string, page = 1, perPage = 20) {
  return safe(
    async () => {
      const where: Prisma.ArticleWhereInput = {
        ...publishedWhere,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { lead: { contains: query, mode: "insensitive" } },
        ],
      };
      const [items, total] = await Promise.all([
        prisma.article.findMany({
          where,
          orderBy: { publishedAt: "desc" },
          skip: (page - 1) * perPage,
          take: perPage,
          include: articleListInclude,
        }),
        prisma.article.count({ where }),
      ]);
      return { items, total };
    },
    { items: [] as ArticleListItem[], total: 0 }
  );
}

/** RSS / sitemap 用 */
export function getFeedArticles(categorySlug?: string, limit = 50) {
  return safe(
    () =>
      prisma.article.findMany({
        where: {
          ...publishedWhere,
          ...(categorySlug
            ? { category: { is: { slug: categorySlug } } }
            : {}),
        },
        orderBy: { publishedAt: "desc" },
        take: limit,
        include: articleListInclude,
      }),
    []
  );
}

export function getAllPublishedForSitemap() {
  return safe(
    () =>
      prisma.article.findMany({
        where: publishedWhere,
        orderBy: { publishedAt: "desc" },
        select: {
          slug: true,
          updatedAt: true,
          publishedAt: true,
          category: { select: { slug: true } },
        },
      }),
    []
  );
}

/** Googleニュース用: 直近48時間 */
export function getNewsSitemapArticles() {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  return safe(
    () =>
      prisma.article.findMany({
        where: { ...publishedWhere, publishedAt: { gte: cutoff } },
        orderBy: { publishedAt: "desc" },
        take: 1000,
        select: {
          slug: true,
          title: true,
          publishedAt: true,
          category: { select: { slug: true } },
        },
      }),
    []
  );
}

export function findRedirect(fromPath: string) {
  return safe(
    () => prisma.redirect.findUnique({ where: { fromPath } }),
    null
  );
}

export function incrementViewCount(articleId: string) {
  // fire-and-forget。失敗しても表示へ影響させない
  prisma.article
    .update({ where: { id: articleId }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});
}
