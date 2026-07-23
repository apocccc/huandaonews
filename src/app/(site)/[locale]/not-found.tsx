import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFoundPage() {
  const t = await getTranslations("notFound");

  return (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <p className="text-6xl font-black text-primary">404</p>
      <h1 className="mt-4 text-2xl font-black">{t("title")}</h1>
      <p className="mt-2 text-gray">{t("description")}</p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-md bg-primary px-6 py-2.5 text-sm font-bold text-white hover:bg-primary-dark"
      >
        {t("backHome")}
      </Link>
    </div>
  );
}
