import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { bulkStatusAction, createArticleAction } from "../../actions";
import { SelectAllCheckbox } from "@/components/admin/SelectAllCheckbox";
import type { ArticleStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUSES: ArticleStatus[] = [
  "draft",
  "review",
  "scheduled",
  "published",
  "archived",
];

const STATUS_STYLES: Record<ArticleStatus, string> = {
  draft: "bg-bg-sub text-gray",
  review: "bg-amber-100 text-amber-800",
  scheduled: "bg-blue-100 text-blue-800",
  published: "bg-green-100 text-green-800",
  archived: "bg-gray-200 text-gray-600",
};

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string; page?: string }>;
}) {
  const session = await auth();
  const t = await getTranslations("admin");
  const { status, category, q, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const perPage = 25;

  const where: Prisma.ArticleWhereInput = {
    ...(status && STATUSES.includes(status as ArticleStatus)
      ? { status: status as ArticleStatus }
      : {}),
    ...(category ? { category: { is: { slug: category } } } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    // contributor/author は自分の記事のみ
    ...(session?.user.role === "admin" || session?.user.role === "editor"
      ? {}
      : { authorId: session?.user.id }),
  };

  const [articles, total, categories] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        category: true,
        author: { select: { name: true } },
      },
    }),
    prisma.article.count({ where }),
    prisma.category.findMany({ orderBy: { order: "asc" } }),
  ]);

  const fmt = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">{t("articles.title")}</h1>
        <form action={createArticleAction}>
          <button
            type="submit"
            className="rounded bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark"
          >
            + {t("articles.new")}
          </button>
        </form>
      </div>

      <form
        method="get"
        className="mt-5 flex flex-wrap items-center gap-2 text-sm"
      >
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded border border-line bg-bg px-2 py-1.5"
        >
          <option value="">
            {t("articles.filterStatus")}: {t("articles.all")}
          </option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
        <select
          name="category"
          defaultValue={category ?? ""}
          className="rounded border border-line bg-bg px-2 py-1.5"
        >
          <option value="">
            {t("articles.filterCategory")}: {t("articles.all")}
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.nameZh}
            </option>
          ))}
        </select>
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={t("articles.searchPlaceholder")}
          className="rounded border border-line bg-bg px-3 py-1.5"
        />
        <button
          type="submit"
          className="rounded border border-line bg-bg px-3 py-1.5 font-medium hover:border-primary hover:text-primary"
        >
          →
        </button>
      </form>

      <form action={bulkStatusAction}>
        {/* 一括操作バー */}
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2 text-sm">
          <span className="text-xs font-bold text-gray">{t("bulk.label")}</span>
          <select
            name="bulkAction"
            defaultValue="publish"
            className="rounded border border-line bg-bg px-2 py-1.5"
          >
            <option value="publish">{t("bulk.publish")}</option>
            <option value="draft">{t("bulk.toDraft")}</option>
            <option value="archive">{t("bulk.archive")}</option>
          </select>
          <button
            type="submit"
            className="rounded bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-dark"
          >
            {t("bulk.apply")}
          </button>
          <span className="text-xs text-gray">{t("bulk.hint")}</span>
        </div>

        <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-bg">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line bg-bg-sub text-left text-xs text-gray">
                <th className="w-8 px-3 py-2.5">
                  <SelectAllCheckbox label={t("bulk.selectAll")} />
                </th>
                <th className="px-4 py-2.5 font-medium">{t("articles.columns.title")}</th>
              <th className="px-4 py-2.5 font-medium">{t("articles.columns.status")}</th>
              <th className="px-4 py-2.5 font-medium">{t("articles.columns.category")}</th>
              <th className="px-4 py-2.5 font-medium">{t("articles.columns.author")}</th>
              <th className="px-4 py-2.5 font-medium">{t("articles.columns.updatedAt")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {articles.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray">
                  {t("articles.empty")}
                </td>
              </tr>
            ) : (
              articles.map((a) => (
                <tr key={a.id} className="hover:bg-bg-sub/60">
                  <td className="px-3 py-2.5">
                    <input type="checkbox" name="ids" value={a.id} aria-label={a.title} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/articles/${a.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {a.sourceFeedId || a.sourceName ? (
                        <span
                          className="mr-1.5 inline-block rounded-sm bg-amber-100 px-1.5 py-0.5 align-middle text-[10px] font-black text-amber-800"
                          title={a.sourceName ?? undefined}
                        >
                          {t("rewrite.rssBadge")}
                        </span>
                      ) : null}
                      {a.isRewritten ? (
                        <span className="mr-1.5 inline-block rounded-sm bg-green-100 px-1.5 py-0.5 align-middle text-[10px] font-black text-green-800">
                          {t("rewrite.rewrittenBadge")}
                        </span>
                      ) : null}
                      {a.title || t("articles.untitled")}
                    </Link>
                    {a.sourceName ? (
                      <span className="ml-1.5 text-xs text-gray">
                        {a.sourceName}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[a.status]}`}
                    >
                      {t(`status.${a.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray">{a.category.nameZh}</td>
                  <td className="px-4 py-2.5 text-gray">{a.author.name}</td>
                  <td className="px-4 py-2.5 text-gray">{fmt.format(a.updatedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </form>

      {total > perPage ? (
        <div className="mt-4 flex justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link
              href={`?${new URLSearchParams({ ...(status ? { status } : {}), ...(category ? { category } : {}), ...(q ? { q } : {}), page: String(page - 1) })}`}
              className="rounded border border-line px-3 py-1.5 hover:border-primary"
            >
              ←
            </Link>
          ) : null}
          <span className="py-1.5 text-gray">
            {page} / {Math.ceil(total / perPage)}
          </span>
          {page < Math.ceil(total / perPage) ? (
            <Link
              href={`?${new URLSearchParams({ ...(status ? { status } : {}), ...(category ? { category } : {}), ...(q ? { q } : {}), page: String(page + 1) })}`}
              className="rounded border border-line px-3 py-1.5 hover:border-primary"
            >
              →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
