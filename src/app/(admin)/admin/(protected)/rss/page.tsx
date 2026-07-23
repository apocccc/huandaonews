import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  createFeedAction,
  deleteFeedAction,
  fetchFeedNowAction,
  updateFeedAction,
} from "../../rss-actions";

export const dynamic = "force-dynamic";

export default async function RssFeedsPage() {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "admin" && session.user.role !== "editor")
  ) {
    redirect("/admin");
  }
  const t = await getTranslations("admin.rss");

  const [feeds, categories] = await Promise.all([
    prisma.rssFeed.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        category: true,
        _count: { select: { articles: true } },
      },
    }),
    prisma.category.findMany({
      where: { slug: { not: "latest" } },
      orderBy: { order: "asc" },
    }),
  ]);

  const fmt = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-black">{t("title")}</h1>
      <p className="mt-1 text-sm text-gray">{t("description")}</p>

      <div className="mt-6 flex flex-col gap-4">
        {feeds.length === 0 ? (
          <p className="rounded-lg border border-line bg-bg p-6 text-center text-sm text-gray">
            {t("empty")}
          </p>
        ) : (
          feeds.map((feed) => (
            <div key={feed.id} className="rounded-lg border border-line bg-bg p-4">
              <form
                action={updateFeedAction}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <input type="hidden" name="id" value={feed.id} />
                <input
                  name="name"
                  defaultValue={feed.name}
                  aria-label={t("name")}
                  className="w-36 rounded border border-line px-2 py-1.5 font-medium"
                />
                <select
                  name="categoryId"
                  defaultValue={feed.categoryId}
                  aria-label={t("category")}
                  className="rounded border border-line bg-bg px-2 py-1.5"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameZh}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5">
                  {t("fetchLimit")}
                  <input
                    type="number"
                    name="fetchLimit"
                    min={1}
                    max={30}
                    defaultValue={feed.fetchLimit}
                    className="w-16 rounded border border-line px-2 py-1.5"
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    name="autoPublish"
                    defaultChecked={feed.autoPublish}
                  />
                  {t("autoPublish")}
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    name="isEnabled"
                    defaultChecked={feed.isEnabled}
                  />
                  {t("enabled")}
                </label>
                <button
                  type="submit"
                  className="rounded border border-line px-3 py-1.5 text-xs font-bold hover:border-primary hover:text-primary"
                >
                  {t("save")}
                </button>
              </form>

              <p className="mt-2 break-all font-mono text-xs text-gray">{feed.url}</p>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray">
                <span>
                  {t("importedTotal")}: {feed._count.articles}
                </span>
                <span>
                  {t("lastFetched")}:{" "}
                  {feed.lastFetchedAt ? fmt.format(feed.lastFetchedAt) : "—"}
                  {feed.lastFetchedAt ? ` (+${feed.lastImportedCount})` : ""}
                </span>
                {feed.lastError ? (
                  <span className="text-breaking">
                    {t("error")}: {feed.lastError}
                  </span>
                ) : null}
                <span className="ml-auto flex gap-2">
                  <form action={fetchFeedNowAction}>
                    <input type="hidden" name="id" value={feed.id} />
                    <button
                      type="submit"
                      className="rounded bg-primary px-3 py-1 text-xs font-bold text-white hover:bg-primary-dark"
                    >
                      {t("fetchNow")}
                    </button>
                  </form>
                  <form action={deleteFeedAction}>
                    <input type="hidden" name="id" value={feed.id} />
                    <button
                      type="submit"
                      className="rounded border border-line px-3 py-1 text-xs text-gray hover:border-breaking hover:text-breaking"
                    >
                      {t("delete")}
                    </button>
                  </form>
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <h2 className="mt-8 text-lg font-bold">{t("add")}</h2>
      <form
        action={createFeedAction}
        className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-bg p-4 text-sm"
      >
        <input
          name="name"
          placeholder={t("namePlaceholder")}
          required
          className="w-40 rounded border border-line px-2 py-1.5"
        />
        <input
          name="url"
          type="url"
          placeholder="https://example.com/rss.xml"
          required
          className="min-w-64 flex-1 rounded border border-line px-2 py-1.5 font-mono text-xs"
        />
        <select
          name="categoryId"
          required
          className="rounded border border-line bg-bg px-2 py-1.5"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameZh}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5">
          {t("fetchLimit")}
          <input
            type="number"
            name="fetchLimit"
            min={1}
            max={30}
            defaultValue={10}
            className="w-16 rounded border border-line px-2 py-1.5"
          />
        </label>
        <label className="flex items-center gap-1.5" title={t("autoPublishHint")}>
          <input type="checkbox" name="autoPublish" defaultChecked />
          {t("autoPublish")}
        </label>
        <button
          type="submit"
          className="rounded bg-primary px-4 py-1.5 text-xs font-bold text-white hover:bg-primary-dark"
        >
          {t("add")}
        </button>
        <p className="w-full text-xs text-gray">{t("autoPublishHint")}</p>
      </form>
    </div>
  );
}
