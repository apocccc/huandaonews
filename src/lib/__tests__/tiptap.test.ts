import { describe, expect, it } from "vitest";
import { docFromParagraphs, extractText, renderArticleHtml } from "@/lib/tiptap";

describe("renderArticleHtml", () => {
  it("renders paragraphs and headings to semantic HTML", () => {
    const doc = docFromParagraphs(["第一段", { heading: "小標" }, "第二段"]);
    const html = renderArticleHtml(doc);
    expect(html).toContain("<p>第一段</p>");
    expect(html).toContain("<h2>小標</h2>");
  });

  it("returns empty string for invalid input", () => {
    expect(renderArticleHtml(null)).toBe("");
    expect(renderArticleHtml("not a doc")).toBe("");
  });
});

describe("extractText", () => {
  it("concatenates text nodes", () => {
    const doc = docFromParagraphs(["你好", "世界"]);
    expect(extractText(doc)).toBe("你好世界");
  });
});
