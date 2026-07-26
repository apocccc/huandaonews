import { describe, expect, it } from "vitest";
import {
  docFromParagraphs,
  extractText,
  linkifyDoc,
  renderArticleHtml,
} from "@/lib/tiptap";

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

describe("linkifyDoc / URL自動リンク", () => {
  it("converts plain-text URLs into links when rendering", () => {
    const doc = docFromParagraphs([
      "官方網站: https://chinese01.huistenbosch.co.jp/ をご覧ください",
    ]);
    const html = renderArticleHtml(doc);
    expect(html).toContain(
      '<a target="_blank" rel="noopener" href="https://chinese01.huistenbosch.co.jp/">'
    );
    expect(html).toContain("をご覧ください");
  });

  it("does not double-link existing links", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "https://example.com",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
          ],
        },
      ],
    };
    const linked = linkifyDoc(doc);
    const textNode = linked.content?.[0].content?.[0];
    expect(textNode?.marks).toHaveLength(1);
  });

  it("excludes trailing punctuation and CJK brackets from URLs", () => {
    const doc = docFromParagraphs(["詳見 https://example.com/page。次の文。"]);
    const html = renderArticleHtml(doc);
    expect(html).toContain('href="https://example.com/page"');
  });
});

describe("extractText", () => {
  it("concatenates text nodes", () => {
    const doc = docFromParagraphs(["你好", "世界"]);
    expect(extractText(doc)).toBe("你好世界");
  });
});
