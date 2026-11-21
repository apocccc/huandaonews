import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import site from "../../../messages/zh-Hant/site.json";

/**
 * meta description の一意性(SEO修正指示書 P1-5)。
 * 静的ページ・トップ・カテゴリーのテンプレート展開結果が互いに重複しないこと。
 */

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function sentence(s: string): string {
  const t = s.trim();
  return /[。!?!?]$/.test(t) ? t : `${t}。`;
}

/** シードのカテゴリー初期説明(prisma/seed.ts の CATEGORY_DESCRIPTIONS) */
function seedCategories(): { slug: string; nameZh: string; description: string }[] {
  const src = readFileSync(path.join(__dirname, "../../../prisma/seed.ts"), "utf8");
  const names = [...src.matchAll(/\{ slug: "([a-z-]+)", nameZh: "([^"]+)"/g)].map((m) => ({
    slug: m[1],
    nameZh: m[2],
  }));
  const descs = Object.fromEntries(
    [...src.matchAll(/^\s+"([a-z-]+)": "([^"]+)",$/gm)].map((m) => [m[1], m[2]])
  );
  return names.map((n) => ({ ...n, description: descs[n.slug] ?? "" }));
}

describe("meta descriptions", () => {
  const pageKeys = Object.keys(site.pages) as (keyof typeof site.pages)[];

  it("every static page has a non-empty description", () => {
    for (const k of pageKeys) {
      expect(site.pages[k].description.length, k).toBeGreaterThan(30);
    }
  });

  it("descriptions are unique across home, static, category, tag, author and search pages", () => {
    const cats = seedCategories();
    expect(cats.length).toBeGreaterThanOrEqual(13);
    const all = [
      site.site.description,
      ...pageKeys.map((k) => site.pages[k].description),
      ...cats.map((c) =>
        fill(site.meta.category, { name: c.nameZh, description: sentence(c.description) })
      ),
      // 説明未設定時のフォールバックもカテゴリー名で一意になる
      ...cats.map((c) =>
        fill(site.meta.category, {
          name: c.nameZh,
          description: sentence(fill(site.meta.categoryFallback, { name: c.nameZh })),
        }) + "#fallback"
      ),
      fill(site.meta.tag, { tag: "台積電" }),
      fill(site.meta.author, { name: "編輯部" }),
      site.meta.search,
    ];
    expect(new Set(all).size).toBe(all.length);
  });
});
