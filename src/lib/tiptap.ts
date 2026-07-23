import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Youtube from "@tiptap/extension-youtube";
import type { JSONContent } from "@tiptap/core";

/**
 * 本文(Tiptap JSON)をサーバーサイドでセマンティックなHTMLへ変換する。
 * 記事本文は必ず初期HTMLに含める(クライアントfetch禁止)という方針の中核。
 */
export const bodyExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
  }),
  Image.configure({
    HTMLAttributes: { loading: "lazy" },
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { rel: "noopener" },
  }),
  Table,
  TableRow,
  TableCell,
  TableHeader,
  Youtube.configure({ nocookie: true }),
];

export function renderArticleHtml(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  try {
    return generateHTML(body as JSONContent, bodyExtensions);
  } catch (e) {
    console.error("[tiptap] failed to render body:", e);
    return "";
  }
}

/** 検索・文字数用のプレーンテキスト抽出 */
export function extractText(body: unknown): string {
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as JSONContent;
    if (n.type === "text" && typeof n.text === "string") parts.push(n.text);
    n.content?.forEach(walk);
  };
  walk(body);
  return parts.join("");
}

/** 段落テキストの配列から Tiptap doc を組み立てる(seed用) */
export function docFromParagraphs(
  paragraphs: (string | { heading: string })[]
): JSONContent {
  return {
    type: "doc",
    content: paragraphs.map((p) =>
      typeof p === "string"
        ? { type: "paragraph", content: [{ type: "text", text: p }] }
        : {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: p.heading }],
          }
    ),
  };
}
