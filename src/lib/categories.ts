import type { Category } from "@prisma/client";

/** カテゴリー表示名はUI言語に追従する(記事本文は常に繁体字) */
export function categoryName(category: Category, locale: string): string {
  return locale === "en" ? category.nameEn : category.nameZh;
}
