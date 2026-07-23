import type { JSONContent } from "@tiptap/core";

/**
 * RSS取り込み記事を OpenAI API で「自社の切り口の独自記事」へ書き直す。
 * - 事実関係は同一のまま、構成・表現を書き直す(繁体字)
 * - 本文内の画像はそのままの位置関係で保持する([IMAGE_n] マーカー方式)
 * - APIキーはローカルの .env の OPENAI_API_KEY から読む
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export class RewriteError extends Error {}

type RewriteOutput = {
  title: string;
  lead: string;
  paragraphs: string[];
};

/** Tiptap doc から「テキスト+画像マーカー」の素材と画像ノード一覧を抽出 */
export function extractSource(body: JSONContent): {
  text: string;
  images: JSONContent[];
} {
  const lines: string[] = [];
  const images: JSONContent[] = [];

  for (const node of body.content ?? []) {
    if (node.type === "image") {
      images.push(node);
      lines.push(`[IMAGE_${images.length}]`);
      continue;
    }
    const textOf = (n: JSONContent): string =>
      n.type === "text"
        ? (n.text ?? "")
        : (n.content ?? []).map(textOf).join("");
    const text = textOf(node).trim();
    if (!text) continue;
    if (node.type === "heading") {
      lines.push(`## ${text}`);
    } else {
      lines.push(text);
    }
  }
  return { text: lines.join("\n\n"), images };
}

/** 書き直し結果と保持画像から Tiptap doc を再構築 */
export function buildRewrittenBody(
  paragraphs: string[],
  images: JSONContent[]
): JSONContent {
  const content: JSONContent[] = [];
  for (const raw of paragraphs) {
    const p = raw.trim();
    if (!p) continue;
    const imageMatch = p.match(/^\[IMAGE_(\d+)\]$/);
    if (imageMatch) {
      const img = images[parseInt(imageMatch[1], 10) - 1];
      if (img) content.push(img);
      continue;
    }
    if (p.startsWith("## ")) {
      content.push({
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: p.slice(3).trim() }],
      });
      continue;
    }
    // 段落中に画像マーカーが混ざっている場合は分離する
    const parts = p.split(/(\[IMAGE_\d+\])/).filter((s) => s.trim());
    for (const part of parts) {
      const m = part.match(/^\[IMAGE_(\d+)\]$/);
      if (m) {
        const img = images[parseInt(m[1], 10) - 1];
        if (img) content.push(img);
      } else {
        content.push({
          type: "paragraph",
          content: [{ type: "text", text: part.trim() }],
        });
      }
    }
  }
  if (content.length === 0) {
    throw new RewriteError("Rewritten body is empty");
  }
  return { type: "doc", content };
}

export async function rewriteWithOpenAI(input: {
  title: string;
  lead: string;
  sourceText: string;
  categoryName: string;
}): Promise<RewriteOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new RewriteError(
      "OPENAI_API_KEY is not set. ローカルの .env に OPENAI_API_KEY を設定してください。"
    );
  }
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const system = [
    "你是台灣新聞網站「環島新聞網」的資深編輯。",
    "任務:將轉載的新聞稿改寫成本站原創報導。",
    "規則:",
    "1. 事實、數字、人名、日期必須與原文完全一致,不可捏造或省略關鍵資訊。",
    "2. 用不同的切入點、段落結構與措辭重寫,不可逐句抄襲原文。",
    "3. 全文使用台灣慣用的繁體中文,新聞報導語氣。",
    "4. 原文中的 [IMAGE_n] 標記代表圖片位置,改寫後必須原封不動保留這些標記(單獨成段),順序不可改變、不可刪除。",
    "5. 小標題以「## 」開頭,單獨成段。",
    '6. 回傳 JSON:{"title": "新標題", "lead": "150字以內的前言", "paragraphs": ["段落1", "## 小標", "[IMAGE_1]", "段落2", ...]}',
  ].join("\n");

  const user = `分類:${input.categoryName}\n原標題:${input.title}\n原前言:${input.lead}\n\n原文:\n${input.sourceText}`;

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new RewriteError(
      `OpenAI API error ${res.status}: ${detail.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new RewriteError("OpenAI API returned empty response");

  let parsed: RewriteOutput;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new RewriteError("OpenAI API returned invalid JSON");
  }
  if (
    !parsed.title ||
    !Array.isArray(parsed.paragraphs) ||
    parsed.paragraphs.length === 0
  ) {
    throw new RewriteError("OpenAI API response is missing title/paragraphs");
  }
  return parsed;
}
