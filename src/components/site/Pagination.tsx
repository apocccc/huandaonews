import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function Pagination({
  basePath,
  page,
  total,
  perPage,
  extraQuery = {},
}: {
  basePath: string;
  page: number;
  total: number;
  perPage: number;
  extraQuery?: Record<string, string>;
}) {
  const t = await getTranslations();
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (totalPages <= 1) return null;

  const hrefFor = (p: number) => {
    const params = new URLSearchParams(extraQuery);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex items-center justify-center gap-4 text-sm font-medium"
    >
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          rel="prev"
          className="rounded border border-line px-4 py-2 hover:border-primary hover:text-primary"
        >
          ← {t("labels.prevPage")}
        </Link>
      ) : null}
      <span className="text-gray">
        {t("labels.page", { page })} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={hrefFor(page + 1)}
          rel="next"
          className="rounded border border-line px-4 py-2 hover:border-primary hover:text-primary"
        >
          {t("labels.nextPage")} →
        </Link>
      ) : null}
    </nav>
  );
}
