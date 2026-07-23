import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const session = await auth();
  const t = await getTranslations("admin.dashboard");

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [publishedToday, publishedThisWeek, inReview, drafts, topArticles, reviewQueue, recentDrafts] =
    await Promise.all([
      prisma.article.count({
        where: { status: "published", publishedAt: { gte: startOfDay } },
      }),
      prisma.article.count({
        where: { status: "published", publishedAt: { gte: startOfWeek } },
      }),
      prisma.article.count({ where: { status: "review" } }),
      prisma.article.count({ where: { status: "draft" } }),
      prisma.article.findMany({
        where: { status: "published" },
        orderBy: { viewCount: "desc" },
        take: 5,
        select: { id: true, title: true, viewCount: true },
      }),
      prisma.article.findMany({
        where: { status: "review" },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, title: true, author: { select: { name: true } } },
      }),
      prisma.article.findMany({
        where: {
          status: "draft",
          ...(session?.user.role === "admin" || session?.user.role === "editor"
            ? {}
            : { authorId: session?.user.id }),
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, title: true, updatedAt: true },
      }),
    ]);

  const stats = [
    { label: t("publishedToday"), value: publishedToday },
    { label: t("publishedThisWeek"), value: publishedThisWeek },
    { label: t("inReview"), value: inReview },
    { label: t("drafts"), value: drafts },
  ];

  return (
    <div>
      <h1 className="text-2xl font-black">{t("title")}</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-line bg-bg p-4">
            <p className="text-xs font-medium text-gray">{s.label}</p>
            <p className="mt-1 text-3xl font-black text-primary">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Panel title={t("topArticles")}>
          {topArticles.length === 0 ? (
            <Empty label={t("empty")} />
          ) : (
            <ul className="divide-y divide-line">
              {topArticles.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                  <Link
                    href={`/admin/articles/${a.id}`}
                    className="line-clamp-1 text-sm font-medium hover:text-primary"
                  >
                    {a.title || "—"}
                  </Link>
                  <span className="shrink-0 text-xs text-gray">
                    {a.viewCount.toLocaleString()} {t("views")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={t("reviewQueue")}>
          {reviewQueue.length === 0 ? (
            <Empty label={t("empty")} />
          ) : (
            <ul className="divide-y divide-line">
              {reviewQueue.map((a) => (
                <li key={a.id} className="py-2">
                  <Link
                    href={`/admin/articles/${a.id}`}
                    className="line-clamp-1 text-sm font-medium hover:text-primary"
                  >
                    {a.title || "—"}
                  </Link>
                  <p className="text-xs text-gray">{a.author.name}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={t("recentDrafts")}>
          {recentDrafts.length === 0 ? (
            <Empty label={t("empty")} />
          ) : (
            <ul className="divide-y divide-line">
              {recentDrafts.map((a) => (
                <li key={a.id} className="py-2">
                  <Link
                    href={`/admin/articles/${a.id}`}
                    className="line-clamp-1 text-sm font-medium hover:text-primary"
                  >
                    {a.title || "—"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-bg p-4">
      <h2 className="text-sm font-bold">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="py-4 text-center text-sm text-gray">{label}</p>;
}
