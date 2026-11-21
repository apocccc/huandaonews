/**
 * 記事メイン画像の品質判定(SEO修正指示書 P1-1 / P1-2)。
 */

type Dim = { width: number; height: number };

/** Google の Article リッチリザルト/Discover の推奨: 幅 1200px 以上 */
export const RICH_RESULT_MIN_WIDTH = 1200;

/**
 * 他社ロゴ・RSS のデフォルトサムネイル等の「写真ではない」画像らしいか。
 * 例: 自由時報のロゴ 250×250。小さい画像、または小さめの正方形はロゴ扱い。
 */
export function isLogoLike({ width, height }: Dim): boolean {
  if (!width || !height) return false;
  if (width < 480) return true;
  const ratio = width / height;
  const squareish = ratio > 0.85 && ratio < 1.18;
  return squareish && width < 700;
}

/** 記事ページ・一覧のサムネイルとして表示してよいか */
export function isDisplayableHero(m: Dim | null | undefined): m is Dim {
  return !!m && !isLogoLike(m);
}

/** og:image / NewsArticle.image に採用してよいか(幅1200px以上) */
export function isRichResultImage(m: Dim | null | undefined): m is Dim {
  return !!m && m.width >= RICH_RESULT_MIN_WIDTH && !isLogoLike(m);
}

/** 自動生成OGP画像のサイズ(アスペクト比ごと) */
export const OG_SIZES = {
  og: { width: 1200, height: 630 },
  "16x9": { width: 1200, height: 675 },
  "4x3": { width: 1200, height: 900 },
  "1x1": { width: 1200, height: 1200 },
} as const;
export type OgRatio = keyof typeof OG_SIZES;

/** 記事の自動生成OGP画像のパス */
export function articleOgPath(ratio: OgRatio, categorySlug: string, slug: string): string {
  return `/og/${ratio}/${categorySlug}/${slug}`;
}

/** サイト共通のデフォルトOGP画像(public/og-default.png) */
export const DEFAULT_OG_IMAGE = {
  path: "/og-default.png",
  width: 1200,
  height: 630,
};
