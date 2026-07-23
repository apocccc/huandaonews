import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t-4 border-primary bg-ink text-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xl font-black text-white">環島新聞網</p>
            <p className="mt-1 text-sm text-white/60">{t("site.tagline")}</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/about" className="text-white/80 hover:text-white">
              {t("footer.about")}
            </Link>
            <Link href="/contact" className="text-white/80 hover:text-white">
              {t("footer.contact")}
            </Link>
            <Link href="/privacy" className="text-white/80 hover:text-white">
              {t("footer.privacy")}
            </Link>
            <a href="/rss.xml" className="text-white/80 hover:text-white">
              {t("footer.rss")}
            </a>
          </nav>
        </div>
        <p className="mt-8 text-xs text-white/50">
          {t("footer.copyright", { year })}
        </p>
      </div>
    </footer>
  );
}
