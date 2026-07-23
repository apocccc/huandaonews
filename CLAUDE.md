# 環島新聞網 — 開発仕様書 (CLAUDE.md)

台湾ローカル向けの総合ニュース+情報サイト「**環島新聞網**」の開発仕様。
このファイルはリポジトリのルートに置き、Claude Code が開発時に常に参照する前提で書かれている。

---

## 1. プロジェクト概要

- **メディア名**: 環島新聞網(正式名)。英語表記は未定のため、当面 `Huandao News` を仮表記として使う。
- **ドメイン**: `huandaonews.com`(決定済み)。コード内では環境変数 `NEXT_PUBLIC_SITE_URL` を必ず参照し、ドメインをハードコードしない(`src/lib/site.ts` の `SITE_URL` が唯一の参照点。未設定時のフォールバックは `https://huandaonews.com`)。
- **ポジション**: 台湾ローカル読者向けの総合ニュースメディア。速報だけでなく生活情報・ガイド的な記事も扱う「ニュース+情報サイト」。
- **ターゲット**: 台湾のデジタル世代。モダンで軽快なUI。
- **最重要の設計思想**: Google・Googleニュース・各種検索・AI(LLMクローラー)に「引用されやすい」構造を最優先する。記事本文は常に**初期HTMLに完全な形で含まれる**こと(クライアントサイドfetchで本文を後読みしない)。

## 2. 技術スタック

| 領域 | 採用技術 | 備考 |
|---|---|---|
| フレームワーク | Next.js (App Router, TypeScript) | 公開サイトと管理画面を1アプリに統合 |
| ホスティング | Vercel | ISR / On-demand Revalidation を活用 |
| DB | PostgreSQL (Vercel Postgres / Neon) + Prisma | |
| 認証 | Auth.js (NextAuth v5) | メール+パスワード。管理系ユーザーのみ。一般読者のログインは当面なし |
| エディター | Tiptap | WYSIWYG。本文はJSON(Tiptap doc)で保存し、HTMLへサーバーサイドで変換 |
| i18n | next-intl | ロケール: `zh-Hant`(既定) / `en` / 管理画面のみ `ja` も |
| 画像 | Vercel Blob + next/image | アップロード時にWebP変換・リサイズ |
| スタイル | Tailwind CSS | デザイントークンは §3 に従う |
| RSS/サイトマップ | 自前実装 (Route Handlers) | §7 参照 |

### レンダリング方針(重要)

- 記事ページ・カテゴリーページ・トップは **SSG + ISR**。公開/更新時に On-demand Revalidation (`revalidatePath` / `revalidateTag`) で即時反映。
- 記事本文・見出し・日時・著者などのコンテンツは必ずサーバーレンダリングし、JSが無効でも全文が読めること(AIクローラー・検索エンジン対策の根幹)。
- 管理画面 `/admin` 配下のみ動的レンダリング(SSR/CSR混在可)。`noindex` とし、sitemapにも含めない。

## 3. ブランド / デザイン

**赤を基調としたカラーリング。** ニュースメディアらしい信頼感と、デジタル世代向けの軽さを両立させる。

```css
:root {
  --color-primary: #D7263D;        /* メインの赤。ロゴ・ヘッダー・リンクアクセント */
  --color-primary-dark: #A61B2E;   /* hover・強調 */
  --color-primary-light: #FBEAEC;  /* 淡い背景(タグ・選択状態) */
  --color-breaking: #B3001B;       /* 速報バッジ用のより深い赤 */
  --color-ink: #1A1A1A;            /* 本文テキスト */
  --color-gray: #6B7280;           /* 日時・補足 */
  --color-bg: #FFFFFF;
  --color-bg-sub: #F7F7F8;
  --color-border: #E5E7EB;
}
```

- フォント: 繁体字は `Noto Sans TC`、欧文は `Inter`。本文 17px / 行間 1.8 目安。
- 赤は面で塗りすぎない。基本は白背景+黒テキストで、赤はロゴ・カテゴリーラベル・速報バッジ・アクセント線に絞る(蘋果日報のようなドギツさではなく、モダンで抑制的な赤)。
- ダークモードは初期リリースでは対象外(将来対応を妨げない実装にする)。

## 4. 多言語仕様

### 公開サイト: `zh-Hant`(既定) / `en`

- **記事本文は翻訳しない。常に繁体字のみ。**
- 言語切替で変わるのは**UIクローム側だけ**: ナビゲーション、カテゴリー名、日付表記、フッター、「関連記事」「最新ニュース」等のラベル。
- URL 設計:
  - 繁体字(既定): プレフィックスなし → `/news/politics/xxxx`
  - 英語UI: `/en/...` プレフィックス → `/en/news/politics/xxxx`
  - **記事ページの canonical は常にプレフィックスなしのURL**に向ける(本文が同一のため、重複コンテンツ扱いを避ける)。`/en/` 側の記事ページには `hreflang` を張らない(翻訳ではないため)。カテゴリー・トップ等の一覧ページのみ `hreflang="zh-Hant"` / `hreflang="en"` を相互に設定する。
- 言語切替UIはヘッダー右上。選択はCookieに保存。

### 管理画面: `zh-Hant` / `en` / `ja` の3言語

- 管理画面のすべてのUI文字列を3言語対応(next-intlのメッセージカタログを `messages/{locale}/admin.json` に分離)。
- ユーザーごとに表示言語を設定でき、プロフィールに保存される。既定は `zh-Hant`。
- 翻訳キーの追加漏れをCIで検知する(3ロケールのキー差分チェックスクリプトを用意)。

## 5. URL / ルーティング設計

SEO・AI引用を最優先した、安定的で意味の読めるURL。

```
/                                  トップ
/news/{category}/{slug}            記事ページ ★
/category/{category}               カテゴリー一覧(ページングは ?page=2)
/tag/{tag}                         タグ一覧
/author/{authorSlug}               著者ページ
/about, /contact, /privacy         静的ページ
/search?q=                         検索
/en/...                            上記の英語UI版
/admin/...                         管理画面(noindex)
/rss.xml, /rss/{category}.xml      RSS (§7)
/sitemap.xml, /news-sitemap.xml    サイトマップ (§8)
```

### 記事URLのルール ★

- 形式: `/news/{categorySlug}/{articleSlug}`
- `articleSlug` は `{yyyymmdd}-{英語ベースの短いスラッグ}` 形式。例: `/news/politics/20260723-taipei-mrt-fare`
  - 日付が入ることでニュースとしての鮮度がURLから判別でき、Googleニュース系のクローラーとの相性が良い。スラッグ重複も事実上防げる。
  - スラッグは編集画面で自動生成(タイトルから英訳/ローマ字化)しつつ手動編集可能。**公開後は変更不可**(変更が必要な場合は301リダイレクトを自動登録)。
- 記事を別カテゴリーへ移動した場合も旧URLから301リダイレクト(`redirects` テーブルで管理)。
- URLは全て小文字・ハイフン区切り。中文をURLに含めない。

## 6. 機能仕様

### 6.1 記事管理(WordPressライクなCMS)

**ロール(4段階):**

| ロール | 権限 |
|---|---|
| `admin` | 全権限。ユーザー管理・サイト設定・カテゴリー管理 |
| `editor` | 全記事の編集・公開・却下。カテゴリー/タグ管理 |
| `author` | 自分の記事の作成・編集・公開 |
| `contributor` | 自分の記事の作成・編集。公開は不可(レビュー依頼まで) |

**記事のステータスフロー:**

```
draft(下書き) → review(レビュー待ち) → published(公開) → archived(非公開化)
                                   ↘ scheduled(予約公開: publishAt 指定)
```

**記事が持つフィールド:**
タイトル / スラッグ / 本文(Tiptap JSON) / リード文(meta description兼用、160字目安) / アイキャッチ画像+altテキスト / カテゴリー(1つ必須) / タグ(複数) / 著者 / ステータス / 公開日時 / 更新日時 / 速報フラグ / トップ固定(ピン)フラグ / プレスリリース元企業名(press-releaseカテゴリーのみ)

**その他の必須機能:**

- リビジョン履歴(保存ごとにスナップショット、差分表示、任意の版へ復元)
- 自動保存(30秒間隔+離脱時)
- プレビュー(未公開記事を署名付きURLで確認可能。社外共有も可)
- 予約公開(Vercel Cron で毎分チェック、`publishAt` 到達で公開+revalidate)
- 記事一覧: ステータス/カテゴリー/著者/期間での絞り込み、全文検索、一括操作

### 6.2 エディター(使いやすさ最優先)

- Tiptapベースの WYSIWYG。Notion風の `/` コマンドでブロック挿入。
- 対応ブロック: 見出し(H2/H3)、段落、リスト、引用、画像(キャプション+alt必須)、テーブル、区切り線、埋め込み(YouTube / X / Instagram / Facebook / Threads)、関連記事カード(記事URL貼り付けで自動カード化)。
- 画像はドラッグ&ドロップとペーストでアップロード。自動でWebP化・幅制限。
- 文字数カウント表示。`Cmd/Ctrl+S` で即時保存。
- 本文HTML出力はセマンティックに保つ(`<figure><img><figcaption>`、`<blockquote>` 等)。装飾目的のdiv散乱を禁止。

### 6.3 カテゴリー

初期データ(seed)として以下を投入。表示名は公開サイトの言語切替に追従する。

| slug | 繁体字 | English |
|---|---|---|
| `latest` | 即時 | Latest |
| `politics` | 政治 | Politics |
| `society` | 社會 | Society |
| `local` | 地方 | Local |
| `world` | 國際 | World |
| `business` | 財經 | Business |
| `tech` | 科技 | Tech |
| `life` | 生活 | Life |
| `entertainment` | 娛樂 | Entertainment |
| `sports` | 體育 | Sports |
| `health` | 健康 | Health |
| `travel` | 旅遊 | Travel |
| `press-release` | 新聞稿 | Press Releases |

- `latest` は実カテゴリーではなく「全カテゴリー横断の最新記事」を表示する仮想カテゴリーとして実装。
- **`press-release`(プレスリリース枠)**: 通常記事と同じ仕組みで管理するが、(1) 記事ページに「新聞稿」であることを示すラベルを常時表示、(2) 配信元企業名フィールドを表示、(3) JSON-LD を `NewsArticle` ではなく `Article` にする、(4) トップの主要ニュース面には混ぜない(専用枠のみ)。
- カテゴリーは管理画面から追加・並び替え・非表示化が可能。

### 6.4 RSS配信

- `/rss.xml` — サイト全体(最新50件)
- `/rss/{categorySlug}.xml` — カテゴリー別(press-release含む)
- 形式は RSS 2.0。`<content:encoded>` に本文全文HTML、`<media:content>` にアイキャッチ、`<dc:creator>` に著者名を含める。
- Atom (`/atom.xml`) と JSON Feed (`/feed.json`) も同じデータソースから生成。
- HTMLの `<head>` に `<link rel="alternate" type="application/rss+xml">` を出力(トップは全体フィード、カテゴリーページは当該カテゴリーのフィード)。
- キャッシュ: ISRで5分。記事公開時はrevalidate。

## 7. SEO / AI引用基盤(このプロジェクトの生命線)

### 7.1 静的HTML配信

- 記事ページは初期HTMLに本文全文・メタデータが揃っていること。Lighthouse の SEO スコア 100 / Performance 90+ を維持。
- JS無効環境で記事が完全に読めることをE2Eテストで担保する(Playwright で JS off のテストケースを用意)。

### 7.2 構造化データ(JSON-LD)

- 記事: `NewsArticle`(press-releaseは `Article`)— `headline`, `datePublished`, `dateModified`, `author`(→ `Person` + 著者ページURL), `publisher`(→ Organization + ロゴ), `image`, `articleSection`, `inLanguage: "zh-Hant"`, `mainEntityOfPage`
- 全ページ: `BreadcrumbList`
- サイト: `Organization` + `WebSite`(sitelinks searchbox)

### 7.3 サイトマップ

- `/sitemap.xml` — 全公開記事+一覧ページ。5万件超に備えてインデックスサイトマップ形式で実装。
- `/news-sitemap.xml` — **Googleニュース用**。直近48時間の記事のみ、`<news:news>` 拡張(publication name = 環島新聞網, language = zh-tw)付き。
- 記事公開時に Google へ ping(IndexNow も送信)。

### 7.4 AIクローラー対応

- `robots.txt`: 主要AIクローラー(GPTBot, ClaudeBot, Claude-Web, PerplexityBot, Google-Extended, CCBot, Applebot-Extended)を**明示的に許可**する。引用される露出を優先する方針。`/admin` と preview URL は全クローラー禁止。
- `/llms.txt` を配信: サイト概要・主要カテゴリーのフィードURL・記事URL形式を記載。
- OGP / Twitter Card を全ページに完備。記事は `og:type=article`, `article:published_time`, `article:section` まで出す。
- `<time datetime="...">`、`<article>`、`<h1>` 1つ等、セマンティックHTMLを厳守。
- 日付・著者・出典が本文冒頭で機械可読に明示されるレイアウトにする(AIが出典特定しやすい)。

## 8. データモデル(Prisma概要)

```
User        id, email, passwordHash, name, role, adminLocale(zh-Hant|en|ja), avatarUrl, bio, slug
Article     id, slug, title, lead, body(Json), status, publishAt, publishedAt, updatedAt,
            categoryId, authorId, heroImageId, isBreaking, isPinned, prSourceName?, viewCount
Revision    id, articleId, snapshot(Json), editedBy, createdAt
Category    id, slug, nameZh, nameEn, order, isVisible
Tag         id, slug, nameZh
ArticleTag  articleId, tagId
Media       id, url, width, height, alt, mimeType, uploadedBy, createdAt
Redirect    id, fromPath, toPath, statusCode(301)
Setting     key, value(Json)   — サイト名・SNSリンク・解析タグ等
```

## 9. 管理画面 (`/admin`)

- ダッシュボード: 本日/週間の公開本数、PV上位記事(簡易解析)、レビュー待ち一覧、下書き一覧
- 記事管理(§6.1) / メディアライブラリ(検索・alt編集・使用箇所表示) / カテゴリー・タグ管理 / ユーザー管理(admin のみ) / リダイレクト管理 / サイト設定
- UIは3言語対応(§4)。shadcn/ui ベースで構築。モバイルでも記事の作成・修正ができるレスポンシブ対応。

## 10. 開発ガイドライン

- パッケージマネージャ: pnpm。Node 20+。
- `pnpm dev` / `pnpm build` / `pnpm lint` / `pnpm test`(Vitest)/ `pnpm test:e2e`(Playwright)
- コミット前に lint + typecheck を通すこと。
- 秘密情報は `.env.local`(コミット禁止)。必要な環境変数は `.env.example` に列挙: `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `AUTH_SECRET`, `BLOB_READ_WRITE_TOKEN` 等。
- テキストのハードコード禁止。公開側・管理側ともすべて next-intl のメッセージカタログを経由する。
- 日時はDBにUTC保存、表示は台北時間(Asia/Taipei)固定。

### 実装フェーズ(推奨順)

1. **Phase 1 — 基盤**: Next.js + Prisma + Auth.js セットアップ、データモデル、カテゴリーseed
2. **Phase 2 — CMS**: 管理画面(記事CRUD、Tiptapエディター、メディア、ステータスフロー、3言語UI)
3. **Phase 3 — 公開サイト**: トップ/記事/カテゴリー/著者ページ、zh-Hant/en切替、赤基調デザイン
4. **Phase 4 — 配信基盤**: RSS/Atom/JSON Feed、sitemap + news-sitemap、JSON-LD、robots.txt/llms.txt、OGP
5. **Phase 5 — 仕上げ**: 予約公開cron、リビジョン、検索、リダイレクト、E2Eテスト(JS無効テスト含む)、パフォーマンスチューニング

### 将来スコープ(初期リリースに含めない)

ニュースレター配信 / 読者アカウント・コメント / ダークモード / アプリ / 広告管理 / 記事の多言語翻訳
