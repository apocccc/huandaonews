import type { JSONContent } from "@tiptap/core";

/**
 * RSS取り込み記事を OpenAI API で「自社の切り口の独自記事」へ書き直す。
 * - 事実関係は同一のまま、構成・表現を書き直す(繁体字)
 * - 本文内の画像はそのままの位置関係で保持する([IMAGE_n] マーカー方式)
 * - APIキーはローカルの .env の OPENAI_API_KEY から読む
 */

/** OPENAI_BASE_URL で互換エンドポイント(Azure等・検証用モック)へ差し替え可能 */
function openaiBase(): string {
  return (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
}

/**
 * OpenAI 呼び出し。まず Responses API + Webサーチツールを試み
 * (関連Webサイトの情報まで調査させるため)、非対応環境では
 * 通常の Chat Completions にフォールバックする。
 */
async function callOpenAI(
  apiKey: string,
  model: string,
  system: string,
  user: string
): Promise<string | null> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  // 1) Responses API + web_search(検索コストが少額発生。OPENAI_WEB_SEARCH=false で無効化)
  if (process.env.OPENAI_WEB_SEARCH !== "false") {
    for (const toolType of ["web_search", "web_search_preview"]) {
      try {
        const res = await fetch(`${openaiBase()}/responses`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model,
            tools: [{ type: toolType }],
            text: { format: { type: "json_object" } },
            input: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
          }),
          signal: AbortSignal.timeout(180_000),
        });
        if (!res.ok) continue;
        const data = (await res.json()) as {
          output?: {
            type?: string;
            content?: { type?: string; text?: string }[];
          }[];
        };
        const text = data.output
          ?.filter((o) => o.type === "message")
          .flatMap((o) => o.content ?? [])
          .filter((c) => c.type === "output_text")
          .map((c) => c.text)
          .join("");
        if (text) return text;
      } catch {
        // 次の手段へフォールバック
      }
    }
  }

  // 2) Chat Completions(Webサーチなし)
  const res = await fetch(`${openaiBase()}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(180_000),
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
  return data.choices?.[0]?.message?.content ?? null;
}

export class RewriteError extends Error {}

type RewriteOutput = {
  title: string;
  lead: string;
  paragraphs: string[];
  /** categories を渡した場合のみ: AIが選んだ最適カテゴリーの slug */
  category?: string;
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

/**
 * 元記事ページの本文テキストを取得する(RSS抜粋より情報量が多いことが
 * 多いため、書き直しの素材として渡す)。失敗時は null
 */
export async function fetchPageText(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "HuandaoNewsBot/1.0 (+https://huandaonews.tw)" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 100 ? text.slice(0, 8000) : null;
  } catch {
    return null;
  }
}

export async function rewriteWithOpenAI(input: {
  title: string;
  lead: string;
  sourceText: string;
  categoryName: string;
  /** 元記事URL(ページ全文の取得に使用) */
  sourceUrl?: string | null;
  /** 指定すると、この一覧から最適なカテゴリーをAIに選択させる */
  categories?: { slug: string; name: string }[];
}): Promise<RewriteOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new RewriteError(
      "OPENAI_API_KEY is not set. ローカルの .env に OPENAI_API_KEY を設定してください。"
    );
  }
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const rules = [
    "你是台灣新聞網站「環島新聞網」的資深記者兼編輯。",
    "任務:根據提供的轉載原文與補充資料,撰寫一篇本站原創的深度報導。",
    "規則:",
    "1. 事實、數字、人名、日期必須有依據:以原文與補充資料為準,並可透過網路搜尋補充相關背景(公司沿革、市場數據、業界動向、過往相關報導等)。絕不可捏造,無法確認的資訊不要寫。",
    "2. 用不同於原文的切入點、段落結構與措辭撰寫,不可逐句抄襲原文。",
    "3. 內容要有深度:除了原文重點外,應加入背景脈絡、業界或社會層面的意義、對台灣讀者的影響等面向,讓讀者讀完能理解「為什麼重要」。",
    "4. 全文 1,200〜2,500 字(繁體中文),閱讀時間約 3〜5 分鐘。段落 10 段以上,小標題(以「## 」開頭、單獨成段)3〜5 個。",
    "5. 原文中的 [IMAGE_n] 標記代表圖片位置,改寫後必須原封不動保留這些標記(單獨成段),順序不可改變、不可刪除。",
    "6. 全文使用台灣慣用的繁體中文,新聞報導語氣。",
    '7. 回傳 JSON:{"title": "新標題", "lead": "150字以內的前言", "paragraphs": ["段落1", "## 小標", "[IMAGE_1]", "段落2", ...]}',
  ];
  if (input.categories?.length) {
    rules.push(
      `8. 從下列分類中選出最適合本篇內容的一個,以 JSON 欄位 "category" 回傳其 slug:${input.categories
        .map((c) => `${c.slug}(${c.name})`)
        .join("、")}`
    );
  }
  const system = rules.join("\n");

  // 元記事ページの全文(RSS抜粋より詳しいことが多い)を補充資料として渡す
  const pageText = input.sourceUrl ? await fetchPageText(input.sourceUrl) : null;
  const user = [
    `分類:${input.categoryName}`,
    `原標題:${input.title}`,
    `原前言:${input.lead}`,
    "",
    `原文(RSS):\n${input.sourceText}`,
    ...(pageText ? ["", `補充資料(原文網頁全文擷取):\n${pageText}`] : []),
  ].join("\n");

  const content = await callOpenAI(apiKey, model, system, user);
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
