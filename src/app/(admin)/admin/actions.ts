"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { auth, canEditArticle, canPublish, signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { articleSlug, isValidArticleSlug, slugify } from "@/lib/slug";
import { revalidateArticle } from "@/lib/revalidate";
import { articlePath } from "@/lib/site";
import type { ArticleStatus } from "@prisma/client";

async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  return session.user;
}

async function requireArticleAccess(articleId: string) {
  const user = await requireUser();
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { category: true },
  });
  if (!article) throw new Error("Article not found");
  if (!canEditArticle(user, article)) throw new Error("Forbidden");
  return { user, article };
}

/* ---------- ログイン ---------- */

export async function loginAction(
  _prev: { error: boolean },
  formData: FormData
): Promise<{ error: boolean }> {
  const email = formData.get("email");
  try {
    await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirect: false,
    });
  } catch {
    return { error: true };
  }

  // 管理画面の表示言語(プロフィール設定)をクッキーへ同期
  if (typeof email === "string") {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { adminLocale: true },
    });
    if (user) {
      const store = await cookies();
      store.set(
        "ADMIN_LOCALE",
        user.adminLocale === "zh_Hant" ? "zh-Hant" : user.adminLocale,
        { path: "/admin" }
      );
    }
  }
  redirect("/admin");
}

export async function logoutAction() {
  await signOut({ redirect: false });
  redirect("/admin/login");
}

export async function setAdminLocaleAction(locale: string) {
  const user = await requireUser();
  const parsed = z.enum(["zh_Hant", "en", "ja"]).safeParse(locale);
  if (!parsed.success) return;
  await prisma.user.update({
    where: { id: user.id },
    data: { adminLocale: parsed.data },
  });
  const store = await cookies();
  store.set(
    "ADMIN_LOCALE",
    parsed.data === "zh_Hant" ? "zh-Hant" : parsed.data,
    { path: "/admin" }
  );
  revalidatePath("/admin", "layout");
}

/* ---------- 記事 ---------- */

export async function createArticleAction() {
  const user = await requireUser();
  const latest = await prisma.category.findFirst({
    where: { isVisible: true, slug: { not: "latest" } },
    orderBy: { order: "asc" },
  });
  if (!latest) throw new Error("No category available");

  const article = await prisma.article.create({
    data: {
      title: "",
      slug: articleSlug(`draft-${Date.now().toString(36)}`),
      body: { type: "doc", content: [{ type: "paragraph" }] },
      status: "draft",
      categoryId: latest.id,
      authorId: user.id,
    },
  });
  redirect(`/admin/articles/${article.id}`);
}

const saveSchema = z.object({
  id: z.string(),
  title: z.string().max(300),
  lead: z.string().max(500),
  slug: z.string(),
  body: z.any(),
  categoryId: z.string(),
  tags: z.string(),
  isBreaking: z.boolean(),
  isPinned: z.boolean(),
  prSourceName: z.string().max(200).nullable(),
  heroImageId: z.string().nullable(),
  publishAt: z.string().nullable(),
});

export type SaveArticleInput = z.infer<typeof saveSchema>;

export async function saveArticleAction(input: SaveArticleInput) {
  const parsed = saveSchema.parse(input);
  const { user, article } = await requireArticleAccess(parsed.id);

  // 公開済み記事のスラッグは変更不可(変更された場合は301リダイレクトを自動登録)
  let slug = article.slug;
  if (parsed.slug !== article.slug) {
    const requested = isValidArticleSlug(parsed.slug)
      ? parsed.slug
      : articleSlug(slugify(parsed.slug) || article.slug.slice(9));
    if (article.status === "published") {
      const category = await prisma.category.findUnique({
        where: { id: parsed.categoryId },
      });
      await prisma.redirect.upsert({
        where: { fromPath: articlePath(article.category.slug, article.slug) },
        create: {
          fromPath: articlePath(article.category.slug, article.slug),
          toPath: articlePath(category?.slug ?? article.category.slug, requested),
        },
        update: {
          toPath: articlePath(category?.slug ?? article.category.slug, requested),
        },
      });
    }
    slug = requested;
  }

  // カテゴリー移動時も旧URLから301
  if (
    article.status === "published" &&
    parsed.categoryId !== article.categoryId
  ) {
    const newCategory = await prisma.category.findUnique({
      where: { id: parsed.categoryId },
    });
    if (newCategory) {
      await prisma.redirect.upsert({
        where: { fromPath: articlePath(article.category.slug, article.slug) },
        create: {
          fromPath: articlePath(article.category.slug, article.slug),
          toPath: articlePath(newCategory.slug, slug),
        },
        update: { toPath: articlePath(newCategory.slug, slug) },
      });
    }
  }

  // タグ: カンマ区切り文字列を upsert して張り替え
  const tagNames = parsed.tags
    .split(/[,、,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  const tagIds: string[] = [];
  for (const name of tagNames) {
    const tagSlug = slugify(name) || `tag-${Buffer.from(name).toString("hex").slice(0, 12)}`;
    const tag = await prisma.tag.upsert({
      where: { slug: tagSlug },
      create: { slug: tagSlug, nameZh: name },
      update: { nameZh: name },
    });
    tagIds.push(tag.id);
  }

  const updated = await prisma.article.update({
    where: { id: parsed.id },
    data: {
      title: parsed.title,
      lead: parsed.lead,
      slug,
      body: parsed.body,
      categoryId: parsed.categoryId,
      isBreaking: parsed.isBreaking,
      isPinned: parsed.isPinned,
      prSourceName: parsed.prSourceName || null,
      heroImageId: parsed.heroImageId || null,
      publishAt: parsed.publishAt ? new Date(parsed.publishAt) : null,
      tags: {
        deleteMany: {},
        create: tagIds.map((tagId) => ({ tagId })),
      },
    },
    include: { category: true },
  });

  // リビジョン(保存ごとのスナップショット)
  await prisma.revision.create({
    data: {
      articleId: updated.id,
      editedBy: user.id,
      snapshot: {
        title: parsed.title,
        lead: parsed.lead,
        body: parsed.body,
      },
    },
  });

  if (updated.status === "published") {
    revalidateArticle(updated.category.slug, updated.slug);
  }

  return { ok: true, slug: updated.slug };
}

export async function changeStatusAction(
  articleId: string,
  status: ArticleStatus
) {
  const { user, article } = await requireArticleAccess(articleId);

  if ((status === "published" || status === "archived") && !canPublish(user)) {
    throw new Error("Forbidden");
  }

  const data: {
    status: ArticleStatus;
    publishedAt?: Date;
    publishAt?: null;
  } = { status };
  if (status === "published" && !article.publishedAt) {
    data.publishedAt = new Date();
  }
  if (status === "published") {
    data.publishAt = null;
  }

  const updated = await prisma.article.update({
    where: { id: articleId },
    data,
    include: { category: true },
  });

  revalidateArticle(updated.category.slug, updated.slug);
  revalidatePath("/admin/articles");
  return { ok: true, status: updated.status };
}

/**
 * 記事一覧の一括操作。選択した記事のステータスをまとめて変更する。
 * publish: 下書き・レビュー待ち・予約公開を即時公開する
 */
export async function bulkStatusAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  const user = session.user;

  const ids = formData.getAll("ids").map(String).filter(Boolean).slice(0, 100);
  const action = z
    .enum(["publish", "draft", "archive"])
    .parse(formData.get("bulkAction"));
  if (ids.length === 0) return;

  if ((action === "publish" || action === "archive") && !canPublish(user)) {
    throw new Error("Forbidden");
  }

  const articles = await prisma.article.findMany({
    where: {
      id: { in: ids },
      // author/contributor は自分の記事のみ対象
      ...(user.role === "admin" || user.role === "editor"
        ? {}
        : { authorId: user.id }),
    },
    include: { category: true },
  });

  for (const article of articles) {
    if (action === "publish") {
      if (article.status === "published") continue;
      await prisma.article.update({
        where: { id: article.id },
        data: {
          status: "published",
          publishedAt: article.publishedAt ?? new Date(),
          publishAt: null,
        },
      });
      revalidateArticle(article.category.slug, article.slug);
    } else if (action === "draft") {
      if (article.status === "draft") continue;
      await prisma.article.update({
        where: { id: article.id },
        data: { status: "draft", publishAt: null },
      });
      if (article.status === "published") {
        revalidateArticle(article.category.slug, article.slug);
      }
    } else {
      if (article.status === "archived") continue;
      await prisma.article.update({
        where: { id: article.id },
        data: { status: "archived", publishAt: null },
      });
      if (article.status === "published") {
        revalidateArticle(article.category.slug, article.slug);
      }
    }
  }

  revalidatePath("/admin/articles");
}

export async function deleteArticleAction(articleId: string) {
  const { article } = await requireArticleAccess(articleId);
  await prisma.article.delete({ where: { id: articleId } });
  if (article.status === "published") {
    revalidateArticle(article.category.slug, article.slug);
  }
  redirect("/admin/articles");
}

export async function restoreRevisionAction(revisionId: string) {
  const revision = await prisma.revision.findUnique({
    where: { id: revisionId },
  });
  if (!revision) throw new Error("Revision not found");
  await requireArticleAccess(revision.articleId);

  const snapshot = revision.snapshot as {
    title?: string;
    lead?: string;
    body?: unknown;
  };
  await prisma.article.update({
    where: { id: revision.articleId },
    data: {
      title: snapshot.title ?? "",
      lead: snapshot.lead ?? "",
      body: (snapshot.body ?? { type: "doc" }) as object,
    },
  });
  revalidatePath(`/admin/articles/${revision.articleId}`);
}

/* ---------- カテゴリー ---------- */

const categorySchema = z.object({
  id: z.string().optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .max(50),
  nameZh: z.string().min(1).max(50),
  nameEn: z.string().min(1).max(50),
  order: z.coerce.number().int(),
  isVisible: z.boolean(),
});

export async function saveCategoryAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "editor") {
    throw new Error("Forbidden");
  }
  const parsed = categorySchema.parse({
    id: (formData.get("id") as string) || undefined,
    slug: formData.get("slug"),
    nameZh: formData.get("nameZh"),
    nameEn: formData.get("nameEn"),
    order: formData.get("order"),
    isVisible: formData.get("isVisible") === "on",
  });

  if (parsed.id) {
    await prisma.category.update({
      where: { id: parsed.id },
      data: {
        nameZh: parsed.nameZh,
        nameEn: parsed.nameEn,
        order: parsed.order,
        isVisible: parsed.isVisible,
      },
    });
  } else {
    await prisma.category.create({
      data: {
        slug: parsed.slug,
        nameZh: parsed.nameZh,
        nameEn: parsed.nameEn,
        order: parsed.order,
        isVisible: parsed.isVisible,
      },
    });
  }
  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
}
