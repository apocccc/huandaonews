import { describe, expect, it } from "vitest";
import { articleSlug, dateStamp, isValidArticleSlug, slugify } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Taipei MRT Fare!")).toBe("taipei-mrt-fare");
  });

  it("strips non-ascii (Chinese) characters", () => {
    expect(slugify("台北捷運 fare")).toBe("fare");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
  });
});

describe("articleSlug", () => {
  it("prefixes yyyymmdd (Taipei time)", () => {
    const date = new Date("2026-07-23T00:00:00+08:00");
    expect(articleSlug("taipei mrt fare", date)).toBe(
      `${dateStamp(date)}-taipei-mrt-fare`
    );
    expect(dateStamp(date)).toBe("20260723");
  });

  it("falls back to 'article' when base is empty", () => {
    const slug = articleSlug("台北");
    expect(slug.endsWith("-article")).toBe(true);
  });
});

describe("isValidArticleSlug", () => {
  it("accepts date-prefixed slugs", () => {
    expect(isValidArticleSlug("20260723-taipei-mrt-fare")).toBe(true);
  });

  it("rejects slugs without date prefix", () => {
    expect(isValidArticleSlug("taipei-mrt-fare")).toBe(false);
    expect(isValidArticleSlug("2026-taipei")).toBe(false);
  });
});
