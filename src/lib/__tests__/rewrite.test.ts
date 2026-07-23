import { describe, expect, it } from "vitest";
import { buildRewrittenBody, extractSource } from "@/lib/rewrite";
import type { JSONContent } from "@tiptap/core";

const sampleBody: JSONContent = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "第一段。" }] },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "小標" }],
    },
    { type: "image", attrs: { src: "/uploads/rss/a.webp", alt: "圖" } },
    { type: "paragraph", content: [{ type: "text", text: "第二段。" }] },
  ],
};

describe("extractSource", () => {
  it("converts doc to text with image markers", () => {
    const { text, images } = extractSource(sampleBody);
    expect(text).toBe("第一段。\n\n## 小標\n\n[IMAGE_1]\n\n第二段。");
    expect(images).toHaveLength(1);
    expect(images[0].attrs?.src).toBe("/uploads/rss/a.webp");
  });
});

describe("buildRewrittenBody", () => {
  it("rebuilds doc preserving images at markers", () => {
    const { images } = extractSource(sampleBody);
    const doc = buildRewrittenBody(
      ["改寫後的第一段。", "## 新小標", "[IMAGE_1]", "改寫後的第二段。"],
      images
    );
    expect(doc.content?.map((n) => n.type)).toEqual([
      "paragraph",
      "heading",
      "image",
      "paragraph",
    ]);
    expect(doc.content?.[2].attrs?.src).toBe("/uploads/rss/a.webp");
  });

  it("splits inline image markers out of paragraphs", () => {
    const { images } = extractSource(sampleBody);
    const doc = buildRewrittenBody(["文字[IMAGE_1]之後"], images);
    expect(doc.content?.map((n) => n.type)).toEqual([
      "paragraph",
      "image",
      "paragraph",
    ]);
  });

  it("throws when result would be empty", () => {
    expect(() => buildRewrittenBody([], [])).toThrow();
  });
});
