import type { Category } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { categoryName } from "@/lib/categories";

/** 文末に句点がなければ付ける */
function sentence(s: string): string {
  const t = s.trim();
  return /[。!?!?]$/.test(t) ? t : `${t}。`;
}

/**
 * カテゴリーページの meta description。
 * 「{name}最新新聞列表。{管理画面で設定した説明}環島新聞網即時更新{name}相關報導。」
 * 説明が未設定ならカテゴリー名入りの定型文で補う(どのカテゴリーでも一意になる)。
 */
export async function categoryDescription(category: Category, locale: string): Promise<string> {
  const t = await getTranslations({ locale, namespace: "meta" });
  const name = categoryName(category, locale);
  const description = sentence(
    category.description?.trim() || t("categoryFallback", { name })
  );
  return t("category", { name, description });
}
