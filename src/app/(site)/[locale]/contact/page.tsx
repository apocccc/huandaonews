import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionHeading } from "@/components/site/SectionHeading";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.contact" });
  return { title: t("title") };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.contact");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-black">
        <SectionHeading>{t("title")}</SectionHeading>
      </h1>
      <p className="mt-6 text-[17px] leading-[1.8]">{t("body")}</p>
      <p className="mt-4 text-[17px]">
        {t("email")}:{" "}
        <a
          href="mailto:contact@huandaonews.com"
          className="font-medium text-primary underline underline-offset-4 hover:text-primary-dark"
        >
          contact@huandaonews.com
        </a>
      </p>
    </div>
  );
}
