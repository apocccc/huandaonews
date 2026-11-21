import { describe, expect, it } from "vitest";
import { isDisplayableHero, isLogoLike, isRichResultImage } from "@/lib/images";
import { groupByMonth, monthKey } from "@/lib/sitemap";

describe("hero image rules", () => {
  it("treats small or small-square images as logos", () => {
    expect(isLogoLike({ width: 250, height: 250 })).toBe(true);
    expect(isLogoLike({ width: 640, height: 640 })).toBe(true);
    expect(isLogoLike({ width: 400, height: 225 })).toBe(true);
    expect(isLogoLike({ width: 1200, height: 675 })).toBe(false);
    expect(isLogoLike({ width: 800, height: 450 })).toBe(false);
    // サイズ不明(ホットリンク)はロゴ扱いしない
    expect(isLogoLike({ width: 0, height: 0 })).toBe(false);
  });

  it("requires 1200px width for rich results", () => {
    expect(isRichResultImage({ width: 1200, height: 675 })).toBe(true);
    expect(isRichResultImage({ width: 1000, height: 563 })).toBe(false);
    expect(isRichResultImage(null)).toBe(false);
    expect(isDisplayableHero({ width: 1000, height: 563 })).toBe(true);
    expect(isDisplayableHero({ width: 250, height: 250 })).toBe(false);
  });
});

describe("monthly sitemaps", () => {
  it("uses Taipei time for the month key", () => {
    // 2026-10-31 17:00 UTC = 2026-11-01 01:00 台北
    expect(monthKey(new Date("2026-10-31T17:00:00Z"))).toBe("2026-11");
    expect(monthKey(new Date("2026-10-31T15:00:00Z"))).toBe("2026-10");
  });

  it("groups newest month first with lastmod = max updatedAt", () => {
    const a = (pub: string, upd: string) => ({
      slug: pub,
      publishedAt: new Date(pub),
      updatedAt: new Date(upd),
      category: { slug: "politics" },
    });
    const groups = groupByMonth([
      a("2026-10-05T00:00:00Z", "2026-10-05T00:00:00Z"),
      a("2026-11-02T00:00:00Z", "2026-11-03T00:00:00Z"),
      a("2026-10-20T00:00:00Z", "2026-11-10T00:00:00Z"),
    ]);
    expect(groups.map((g) => g.month)).toEqual(["2026-11", "2026-10"]);
    expect(groups[1].articles).toHaveLength(2);
    expect(groups[1].lastmod.toISOString()).toBe("2026-11-10T00:00:00.000Z");
  });
});
