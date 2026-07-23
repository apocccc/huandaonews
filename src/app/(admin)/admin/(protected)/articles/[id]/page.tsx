import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth, canEditArticle, canPublish } from "@/lib/auth";
import { ArticleEditor } from "@/components/admin/ArticleEditor";
import { previewToken } from "@/lib/preview";

export const dynamic = "force-dynamic";

export default async function ArticleEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  const { id } = await params;

  const [article, categories, revisions] = await Promise.all([
    prisma.article.findUnique({
      where: { id },
      include: {
        category: true,
        heroImage: true,
        tags: { include: { tag: true } },
      },
    }),
    prisma.category.findMany({
      where: { slug: { not: "latest" } },
      orderBy: { order: "asc" },
    }),
    prisma.revision.findMany({
      where: { articleId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { editor: { select: { name: true } } },
    }),
  ]);

  if (!article) notFound();
  if (!canEditArticle(session.user, article)) redirect("/admin/articles");

  return (
    <ArticleEditor
      article={{
        id: article.id,
        title: article.title,
        lead: article.lead,
        slug: article.slug,
        body: article.body,
        status: article.status,
        categoryId: article.categoryId,
        categorySlug: article.category.slug,
        tags: article.tags.map((t) => t.tag.nameZh).join(", "),
        isBreaking: article.isBreaking,
        isPinned: article.isPinned,
        prSourceName: article.prSourceName,
        heroImageId: article.heroImageId,
        heroImageUrl: article.heroImage?.url ?? null,
        publishAt: article.publishAt?.toISOString() ?? null,
      }}
      categories={categories.map((c) => ({
        id: c.id,
        slug: c.slug,
        nameZh: c.nameZh,
      }))}
      revisions={revisions.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        editorName: r.editor.name,
      }))}
      canPublish={canPublish(session.user)}
      previewToken={previewToken(article.id)}
    />
  );
}
