import { getTranslations } from "next-intl/server";
import type { Category } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { categoryName } from "@/lib/categories";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SearchForm } from "./SearchForm";

export async function SiteHeader({
  categories,
  locale,
}: {
  categories: Category[];
  locale: string;
}) {
  const t = await getTranslations();

  return (
    <header className="border-b border-line bg-bg sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center justify-between gap-4 py-3">
          <Link href="/" className="flex items-baseline gap-2 shrink-0">
            <span className="text-2xl font-black tracking-tight text-primary">
              環島新聞網
            </span>
            <span className="hidden sm:inline text-[11px] font-medium uppercase tracking-widest text-gray">
              Huandao News
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <SearchForm
              placeholder={t("search.placeholder")}
              buttonLabel={t("search.button")}
            />
            <LanguageSwitcher />
          </div>
        </div>
      </div>
      <nav
        aria-label={t("nav.allCategories")}
        className="border-t border-line bg-bg"
      >
        <div className="mx-auto max-w-6xl px-4">
          <ul className="flex items-center gap-1 overflow-x-auto text-[15px] font-medium whitespace-nowrap -mx-2">
            <li>
              <Link
                href="/"
                className="block px-3 py-2.5 hover:text-primary transition-colors"
              >
                {t("nav.home")}
              </Link>
            </li>
            {categories
              .filter((c) => c.slug !== "latest")
              .map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/category/${c.slug}`}
                    className="block px-3 py-2.5 hover:text-primary transition-colors"
                  >
                    {categoryName(c, locale)}
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      </nav>
    </header>
  );
}
