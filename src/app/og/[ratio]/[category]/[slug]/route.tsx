import { ImageResponse } from "next/og";
import { getArticleBySlug } from "@/lib/data";
import { OG_SIZES, type OgRatio } from "@/lib/images";
import { SITE_NAME_ZH } from "@/lib/site";

export const runtime = "nodejs";

/**
 * Google Fonts から、描画する文字だけを含む Noto Sans TC のサブセットを取得する。
 * (CJKフォント全体を同梱すると数MBになるため)
 */
async function loadFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@700&text=${encodeURIComponent(text)}`,
        { signal: AbortSignal.timeout(8000) }
      )
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url, { signal: AbortSignal.timeout(8000) })).arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * 記事の自動生成OGP画像(幅1200px)。元画像が小さい・ロゴの記事でも
 * og:image と NewsArticle.image の幅1200px要件を満たすためのもの。
 * /og/{og|16x9|4x3|1x1}/{category}/{slug}
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ratio: string; category: string; slug: string }> }
) {
  const { ratio, category, slug } = await params;
  if (!(ratio in OG_SIZES)) return new Response("Not found", { status: 404 });
  const size = OG_SIZES[ratio as OgRatio];

  const article = await getArticleBySlug(category, slug);
  if (!article) return new Response("Not found", { status: 404 });

  const title = article.title;
  const label = article.category.nameZh;
  const brandEn = "HUANDAO NEWS";
  const font = await loadFont(`${title}${label}${SITE_NAME_ZH}`);
  const tall = size.height >= 900;
  const titleSize = tall ? 76 : 60;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#FFFFFF",
          borderTop: "18px solid #D7263D",
          padding: tall ? "80px 80px 72px" : "56px 72px 52px",
          fontFamily: font ? "NotoSansTC" : "sans-serif",
        }}
      >
        <div style={{ display: "flex" }}>
          <div
            style={{
              display: "flex",
              background: "#FBEAEC",
              color: "#A61B2E",
              fontSize: 34,
              fontWeight: 700,
              padding: "6px 22px",
              borderRadius: 6,
            }}
          >
            {label}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: titleSize,
            fontWeight: 700,
            lineHeight: 1.35,
            color: "#1A1A1A",
            // 長いタイトルは行数で切る
            maxHeight: titleSize * 1.35 * (tall ? 6 : 4),
            overflow: "hidden",
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 46, fontWeight: 700, color: "#D7263D" }}>
            {SITE_NAME_ZH}
          </div>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: "#6B7280" }}>
            {brandEn}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: "NotoSansTC", data: font, weight: 700, style: "normal" }] : [],
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    }
  );
}
