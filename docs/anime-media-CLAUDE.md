# アニメメディア — 開発仕様書 (CLAUDE.md)

日本のアニメ・IP情報を多言語(英語 / 韓国語 / 繁体字 / タイ語 / 簡体字)で配信するアニメ専門メディアの開発仕様。
**サーバー構成・SEO基盤・CMSの土台は `apocccc/huandaonews`(環島新聞網)と同一**にし、アニメメディア固有の機能(多言語翻訳・固有名詞辞書・ファン投稿・プレスリリース受付・週次プライズ)を上乗せする。
このファイルは新リポジトリのルートに `CLAUDE.md` として置き、Claude Code が常に参照する前提で書かれている。

---

## 0. 立ち上げ方式(最重要)

**ゼロから作らない。** `apocccc/huandaonews` をテンプレートとして複製し、本書の差分と追加サブシステムを適用する。

```
1. huandaonews を新リポジトリへ複製(git clone → remote 差し替え → main へ push)
2. §2 の差分(言語・タイムゾーン・カテゴリー・ブランド)を適用
3. §3〜§8 の追加サブシステムを実装(ここが本プロジェクトの主作業)
4. §11 のインフラを新規に用意 → デプロイ(手順は複製された docs/DEPLOY.md と同じ流れ)
```

huandaonews で実装済みの以下はそのまま使う(再実装禁止):

記事CMS(Tiptap・リビジョン・自動保存・プレビュー署名URL)/ RSS自動取り込み(画像保存・og:imageフォールバック・サムネ必須・重複は先着優先)/ AI独自記事化(件数上限・ランダム時刻公開・1ソース1記事保証)/ 予約公開cron / 一括操作・種別フィルター / 転載元表記ルール / RSS・Atom・JSON Feed / sitemap + news-sitemap / JSON-LD / robots.txt・llms.txt / 課金・不正利用対策(cron認証 fail-closed、画像は unoptimized + R2 直配信)/ Supabase pooler 構成 / Auth.js v5 + 4ロール

**ただし本プロジェクトは「タイ語版(docs/thai-media-CLAUDE.md)のような単純な地域差し替え」ではない。**
記事本文を全言語に翻訳する時点でデータモデル(`Article` の1言語1レコード前提)が変わるため、§4 のスキーマ変更は避けられない。差分適用ではなく「土台を継承した新規開発」として見積もること。

---

## 1. プロジェクト概要

- **メディア名**: `{{SITE_NAME}}`(※別途指示。ロケールごとの表記も併せて決定)
- **ドメイン**: `{{DOMAIN}}`(※別途指示)。コード内では `NEXT_PUBLIC_SITE_URL` を必ず参照しハードコードしない(`src/lib/site.ts` が唯一の参照点)。公開画像は `img.{{DOMAIN}}`(Cloudflare R2 カスタムドメイン)
- **ポジション**: 日本のアニメ・IP情報を、海外ファンの母語で最速・正確に届けるニュース+ファンコミュニティメディア
- **コンテンツの3本柱**:
  1. **AI自動記事**(日本語ソースを収集 → 独自記事化 → 全5言語で公開)
  2. **プレスリリース**(事業者が自ら投稿・配信できる枠)
  3. **ファン投稿**(作品ごとに紹介。週次でベスト投稿にプライズ)
- **ターゲット**: 英語圏・韓国・台湾/香港・タイ・中国語圏のアニメファン
- **設計思想**: Google・Googleニュース・AI(LLMクローラー)に引用されやすい構造を最優先。記事本文は常に初期HTMLに完全な形で含める(クライアントfetchで本文を後読みしない)
- **固有名詞の一貫性がこのメディアの信頼性そのもの**。作品名・キャラ名・スタジオ名の表記揺れは「翻訳の質」ではなく「不具合」として扱う(§5)

---

## 2. huandaonews からの基本差分

### 2.1 ロケール

| 項目 | huandaonews | 本プロジェクト |
|---|---|---|
| 記事本文 | 繁体字のみ(翻訳しない) | **5言語すべてに翻訳して公開**(§4) |
| 公開サイトlocale | `zh-Hant` / `en` | **`en`(既定・pivot)/ `ko` / `zh-Hant` / `th` / `zh-Hans`** |
| 内部編集用locale | — | **`ja`(非公開・翻訳の原文マスター)** |
| 管理画面UI | zh-Hant / en / ja | **`ja`(既定)/ `en`** |
| localePrefix | `as-needed` | **`always`**(全ロケールにプレフィックス) |
| 表示タイムゾーン | Asia/Taipei | **Asia/Tokyo**(運用が日本のため。表示は各ロケールの日付書式に従う) |

- `localePrefix: "always"` にする理由: 本文が翻訳されるため各ロケールが対等な独立ページになる。既定ロケールだけプレフィックスなしにすると canonical/hreflang の実装が非対称になり事故る。`/` は Cookie → `Accept-Language` → `en` の順で判定して 307 リダイレクト
- `zh-Hant` の主ターゲットは**台湾**(香港向け語彙は将来分割の余地を残す)
- `zh-Hans` を `zh-Hant` からの機械変換(OpenCC等)で作ることを**禁止**する。語彙が違う(網路/网络、影片/视频、動畫瘋/哔哩哔哩 等)。`ja` から独立して翻訳する
- 変更対象: `src/i18n/routing.ts` / `messages/{locale}/` / `src/lib/site.ts` / `src/lib/seo.ts` / `src/lib/feeds.ts` / `src/app/news-sitemap.xml/route.ts` / 各 layout の `lang` 属性

### 2.2 カテゴリー初期データ(seed差し替え)

カテゴリー表示名は5言語分必要になるため、`Category.nameZh/nameEn` の2カラム構成を **`CategoryTranslation`(categoryId, locale, name)** に変更する。

| slug | 用途 |
|---|---|
| `latest` | 全カテゴリー横断の最新(仮想カテゴリー) |
| `news` | 一般ニュース(制作決定・放送情報・スタッフ/キャスト) |
| `anime` | 作品情報・放送/配信スケジュール |
| `manga` | 原作・コミックス |
| `game` | アニメ/IP関連ゲーム |
| `movie` | 劇場作品 |
| `event` | イベント・上映会・コラボカフェ |
| `merch` | グッズ・フィギュア・コラボ商品 |
| `music` | 主題歌・声優アーティスト・ライブ |
| `interview` | インタビュー・特集 |
| `industry` | 業界・ビジネス(ライセンス・興行・決算) |
| `press-release` | プレスリリース(§7) |
| `fan` | ファン投稿ハブ(§8) |

- `latest` / `fan` は仮想カテゴリー、`press-release` の特別扱い(PRラベル・提供元表示・`Article` 型JSON-LD・トップ主要面に混ぜない)は huandaonews と同一
- サンプル記事seed(`prisma/seed.ts`)は使わない。本番は `prisma/seed-prod.ts`(カテゴリー+管理者+ロケール)を上表で書き換えて使用

### 2.3 ブランド・フォント

| 項目 | 内容 |
|---|---|
| 基調色 | `{{BRAND_COLOR}}`(※別途指示。未指示の間は huandaonews の赤系トークンを維持) |
| ロゴ/ファビコン | `{{LOGO}}`(※別途指示。未指示の間はテキストロゴ+仮ファビコン) |
| フォント | `Inter`(欧文)/ `Noto Sans KR` / `Noto Sans TC` / `Noto Sans SC` / `Noto Sans Thai` をロケール単位で出し分け(`src/lib/fonts.ts`)。全部を常時読み込まない |
| 行間 | 既定1.8。**タイ語のみ1.95**(声調記号が潰れるため) |

- デザイントークン(`globals.css` の `@theme`)の構造は維持し、色値のみ差し替える
- ダークモードは初期リリース対象外(将来対応を妨げない実装にする)

### 2.4 URL / ルーティング

```
/{locale}                                  トップ
/{locale}/news/{category}/{slug}           記事ページ ★
/{locale}/anime/{seriesSlug}               作品ページ(ニュース+ファン投稿+基本情報)★
/{locale}/anime/{seriesSlug}/fans          作品別ファン投稿一覧
/{locale}/category/{category}              カテゴリー一覧(?page=2)
/{locale}/tag/{tag}                        タグ一覧
/{locale}/author/{authorSlug}              著者ページ
/{locale}/fans                             ファン投稿ハブ(新着・人気)
/{locale}/fans/{postId}                    投稿詳細
/{locale}/prize                            今週のプライズ・過去の受賞者・規約
/{locale}/creators/{handle}                投稿者(インフルエンサー)ページ
/{locale}/press/{companySlug}              企業ページ(その企業のPR一覧)
/{locale}/search?q=
/my/...                                    会員マイページ(noindex)
/partner/...                               事業者ポータル(noindex)
/admin/...                                 管理画面(noindex)
/rss/{locale}.xml, /rss/{locale}/{category}.xml
/sitemap.xml(index), /sitemaps/{locale}-{n}.xml, /news-sitemap-{locale}.xml
```

**記事URLのルール ★**

- 形式: `/{locale}/news/{categorySlug}/{yyyymmdd}-{英語ベースの短いスラッグ}`
- **スラッグはロケール非依存**(全言語で同一)。英語版タイトルから生成する。これにより hreflang のURL対応が単純な文字列置換で完結し、翻訳追加時にURLが揺れない
- スラッグに翻訳語・非ASCII文字・由来情報(rss等)を含めない。全て小文字・ハイフン区切り
- 日付部分は Asia/Tokyo 基準の公開日
- 公開後のスラッグ変更不可。変更時は全ロケール分の 301 を `Redirect` に自動登録
- 作品スラッグ `seriesSlug` はローマ字(ヘボン式・マクロン無し)。例: `sousou-no-frieren`

---

## 3. 技術スタック

huandaonews から変更なし。追加分のみ記載。

| 領域 | 採用技術 | 備考 |
|---|---|---|
| フレームワーク | Next.js (App Router, TypeScript) | 公開/管理/事業者ポータルを1アプリに統合 |
| ホスティング | Vercel | ISR / On-demand Revalidation。Cron は Pro プラン前提(分単位) |
| DB | Supabase PostgreSQL + Prisma | `directUrl` 構成(migrate は session pooler 5432) |
| 認証 | Auth.js v5 | **スタッフ=メール+パスワード / 会員=OAuth(Google・X・Discord)+メール**。単一 `User` テーブルをロールで分岐(§4.6) |
| エディター | Tiptap | 本文は Tiptap JSON で保存 → サーバーでHTML化 |
| i18n | next-intl | `localePrefix: "always"` |
| AI | provider抽象(`src/lib/ai/`) | 収集要約・記事化・翻訳・モデレーションで役割別にモデルを選べる構成。既存 `OPENAI_*` を継承しつつ `AI_PROVIDER` で切替可能に |
| 画像 | Cloudflare R2 + カスタムドメイン直配信 | `next/image` は `unoptimized`(Vercel画像最適化の従量課金回避) |
| スパム対策 | Cloudflare Turnstile | 会員登録・投稿・PR送信フォーム |
| スタイル | Tailwind CSS v4 | |

### レンダリング方針(重要)

- トップ / 記事 / カテゴリー / 作品ページ / ファン投稿一覧は **SSG + ISR**。公開・更新時に `revalidateTag` で即時反映
- 記事本文・見出し・日時・著者・出典は必ずサーバーレンダリング。**JS無効でも全文が読めること**を Playwright の JS off テストで担保
- 投票・投稿フォーム等の動的部分のみクライアント(Server Actions)。一覧そのものは常にサーバーレンダリング
- `/admin` `/partner` `/my` は動的レンダリング + `noindex`、sitemap 除外、robots 禁止

---

## 4. 多言語記事のデータモデル(本プロジェクトの中核)

### 4.1 方針

- **原文マスターは `ja`(内部専用・非公開)**。日本語ソースから AI が日本語で独自記事を書き、日本語話者(編集者)が事実確認できる状態を作ってから、`ja → 各ロケール` に**並列**翻訳する
- **英語を経由した多段翻訳(ja→en→ko 等)を禁止**する。誤訳・固有名詞の揺れが増幅するため
- 公開ロケールは `en` / `ko` / `zh-Hant` / `th` / `zh-Hans` の5つ。`ja` は `/admin` でのみ閲覧可能で、sitemap・feed・hreflang に一切出さない
- 翻訳は**ブロック単位でハッシュ管理**し、変更されたブロックだけ再翻訳する(修正時のコストとブレを抑える)

### 4.2 スキーマ変更

`Article` から言語依存フィールドを分離する。

```prisma
enum Locale { ja en ko zh_Hant th zh_Hans }
enum TranslationStatus { pending machine needs_review approved failed excluded }

model Article {
  id, slug(unique), status, publishAt, publishedAt, createdAt, updatedAt,
  categoryId, authorId, heroImageId, isBreaking, isPinned, viewCount,
  kind          ArticleKind   // editorial | ai_generated | press_release
  masterLocale  Locale        // 既定 ja。PRは投稿言語がマスターになる
  seriesLinks   ArticleSeries[]
  sources       ArticleSource[]   // 出典(複数)
  translations  ArticleTranslation[]
}

model ArticleTranslation {
  id, articleId, locale, title, lead, body(Json),
  status TranslationStatus, translatedBy(ai|human), model, sourceHash,
  reviewedById?, reviewedAt?, publishedAt?, updatedAt
  @@unique([articleId, locale])
}

model ArticleSource {
  id, articleId, name, url, publishedAt?, isPrimary
}

model ArticleSeries { articleId, seriesId, isPrimary }  // 複合PK
```

- 公開判定は `Article.status === published` **かつ** そのロケールの `ArticleTranslation.status ∈ {approved, machine}`。`excluded`(§7 の翻訳オプトアウト)のロケールでは**その記事を存在しないものとして扱う**(一覧・sitemap・feed から除外、直リンクは 302 で `en` へ)
- `Revision` は `ArticleTranslation` 単位でスナップショットを取る

### 4.3 翻訳パイプライン

```
[ja マスター確定]
   → ブロック分割(Tiptap JSON の block 単位に sourceHash)
   → 固有名詞抽出 → 用語辞書と突合(§5)
   → 未登録語があれば Glossary に pending 登録 → 閾値未満なら人手レビュー待ちで停止
   → ロケールごとに並列翻訳(辞書の確定表記を「必ずこの表記を使う」制約としてプロンプトに注入)
   → 出力検証(§5.3)→ NG なら1回だけ自動リペア → なお NG は needs_review
   → approved/machine で公開キューへ
```

- 翻訳は `Job` テーブル(DBキュー)経由で cron が drain する。外部キューは使わない
- `Job`: `id, type, payload(Json), status(queued|running|done|failed), attempts, runAfter, idempotencyKey(unique), lastError`。指数バックオフで最大5回、超過は dead-letter として管理画面に表示
- 翻訳対象は**テキストノードのみ**。画像・埋め込み・リンク先URL・`[IMAGE_n]` マーカーは不変で通す
- 翻訳しないもの: 作品ロゴ画像、公式スタッフクレジット表記の原語併記部分、引用ツイート本文(原文のまま+訳を注釈で添える)

### 4.4 UI文字列

- 公開サイト: `messages/{locale}/site.json`(5言語)。管理画面: `messages/{locale}/admin.json`(ja/en)
- **テキストのハードコード禁止**。`pnpm check:i18n` でロケール間のキー差分を検出し、CIで落とす

---

## 5. 固有名詞辞書(Glossary)— 表記揺れ防止

**このメディアで最も壊れてはいけない部分。** AI 翻訳は同じ語を毎回違う表記にする前提で設計する。

### 5.1 データモデル

```prisma
enum TermType { series character person studio company event product music term }
enum TermStatus { pending verified locked deprecated }

model Term {
  id, type TermType, status TermStatus,
  nameJa      String           // 正規表記(日本語)
  readingJa   String?          // かな
  romaji      String           // ヘボン式・マクロン無し
  seriesId    String?          // キャラ・楽曲などの所属作品
  notes       String?          // 同名別作品の区別、公式の但し書き
  sourceUrl   String?          // 公式サイト等の一次情報
  doNotTranslate Boolean       // 原語のまま出す(ロゴ表記など)
  createdAt, updatedAt
  forms   TermForm[]
  aliases TermAlias[]
}

model TermForm {   // ロケールごとの確定表記
  id, termId, locale, value, isOfficial Boolean, sourceUrl String?, verifiedById?, verifiedAt?
  @@unique([termId, locale])
}

model TermAlias { // 表記揺れ・略称・誤記(検出用)
  id, termId, locale?, value, kind(alias|abbrev|misspelling|romaji)
  @@index([value])
}
```

### 5.2 表記の決定ルール(優先順)

1. **公式が出している当該言語の表記**(公式サイト、公式SNS、ライセンシーの配信ページ)→ `isOfficial: true` + `sourceUrl` 必須
2. 主要配信プラットフォームの表記(en: Crunchyroll / Netflix、ko: Laftel / Netflix、zh-Hant: 巴哈姆特動畫瘋 / Netflix、zh-Hans: 哔哩哔哩、th: Netflix / Bilibili TH)
3. 上記が無い場合の機械的ルール:
   - `en`: ヘボン式・マクロン無し(`Yuki` / `Tokyo`)。語順は「名 姓」ではなく**公式が使う順**に従い、無ければ「姓 名」で統一
   - `ko`: 국립국어원 외래어 표기법(일본어)に従う
   - `zh-Hant` / `zh-Hans`: 漢字表記はそのまま流用可(ただし簡繁変換は行い、**台湾/大陸で慣用が違う語は別々に登録**)。かな部分は音訳
   - `th`: ราชบัณฑิตยสภา の日本語転写規則に準拠
4. 決まらない場合は `pending` のまま人手判断。**推測で確定しない**

### 5.3 パイプラインへの組み込み

- **前処理**: マスター(ja)本文から固有名詞候補を抽出 → `Term.nameJa` / `TermAlias` と突合。ヒットしたものは翻訳プロンプトに「用語表(ロケールの確定表記)」として注入し、"この表記以外を使わないこと" を制約として与える
- **後処理(検証)**: 出力に含まれるべき用語が確定表記どおりに現れているかを**文字列で機械検証**する。AIの自己申告に頼らない
  - 不一致 → 差分を添えて1回だけリペア指示 → それでも不一致なら `needs_review` にして管理画面のキューへ
- **未登録語の扱い**: AI が新規固有名詞を検出したら `pending` で自動登録し、各ロケールの候補表記+根拠URLを提案する。`type ∈ {series, character, person, studio}` の pending がある記事は**自動公開しない**(設定で「フラグ付きで公開」も選べるが既定はブロック)
- **表記変更の波及**: `TermForm` を更新したら、その用語を含む公開済み記事を一覧化して一括再翻訳(該当ブロックのみ)をかけるジョブを走らせる。過去記事の揺れを放置しない
- **`locked`**: 一度確定してレビュー済みの表記は `locked` にし、AI からの自動上書きを禁止する

### 5.4 管理画面

`/admin/glossary`: 検索(日/ロケール/エイリアス横断)、pending キュー、一括承認、使用箇所(記事数)表示、CSVインポート/エクスポート、変更履歴。

---

## 6. 情報収集 → 自動記事化パイプライン

### 6.1 収集ソース

- 公式RSS/Atom(アニメ公式サイト、制作会社、出版社、配信プラットフォームのニュース欄)
- 企業のプレスリリースページ / PR配信サービスの公開フィード
- 公式SNSの公開フィード(取得可能なもののみ)
- イベント・放送スケジュール(公式発表ベース)

**遵守事項(必須)**: `robots.txt` を尊重し、取得間隔を空け、User-Agent は `{{SITE_NAME}}Bot/1.0 (+https://{{DOMAIN}}/about)` を名乗る。**全文転載はしない**。AI 記事は一次情報を要約・再構成した独自記事とし、本文末に出典名+原文リンク、画像には出典を明記する。ソース側が転載禁止を明示している場合は要約すら載せず、リンクのみとする。

### 6.2 フロー

```
1. cron 10分毎: 有効フィードを取得(頻度・件数上限はフィード単位で設定)
   - サムネイル(フィード内 → og:image)をDL検証できない記事は取り込まない
   - sourceGuid で重複排除(先着優先)
2. クラスタリング: 同一トピックの複数ソースを1記事にまとめ、ArticleSource を複数ぶら下げる
3. エンティティ抽出: 作品・キャラ・人物・企業を検出 → Series / Term に紐付け(§5)
4. cron(1日3回 + 手動実行): 下書きから AI が日本語マスター記事を生成
   - カテゴリー上限あり / 1ソース1記事保証 / 速報性の高いものを優先
5. 翻訳キュー投入(§4.3)→ 5言語そろったら公開キューへ
6. cron 毎分: publishAt 到達分を公開 + revalidate + IndexNow/Google ping
```

### 6.3 AI記事化の要件

- ペルソナ: 「日本のアニメ業界に詳しいニュース編集者」。出力は**日本語のマスター原稿**
- 事実・数字・固有名詞・日付の捏造禁止。確認できない情報は書かない。**放送日・話数・キャスト・スタッフは一次情報に無ければ書かない**
- 分量: 読了2〜4分(日本語 1,000〜2,000字)、小見出し(`## `)2〜4個、リード文160字目安
- 憶測・ネタバレの扱い: 未放送話のネタバレは見出し・リード・OGPに出さない。本文中は `spoiler` ブロックで畳む
- `[IMAGE_n]` マーカー保持、JSON出力形式、カテゴリー自動選択(§2.2 の slug 一覧を渡す)は huandaonews の実装を踏襲
- 生成物は必ず `draft`。**編集者承認なしに翻訳・公開へ進めない**設定を既定にする(自動公開はフィード単位でオプトイン)

---

## 7. プレスリリース(受付 + 配信)

### 7.1 受付(事業者ポータル `/partner`)

- 事業者アカウント登録 → **管理者による審査・承認後**に投稿可能(企業ドメインのメール確認+担当者情報)
- `Organization` に紐づく `partner` ロールのユーザーが複数所属できる
- 投稿フォーム項目: タイトル / 本文 / 画像(複数・alt必須) / 関連作品(Series) / カテゴリー希望 / 解禁日時(embargo) / 問い合わせ先 / 配信元企業名 / 原文言語 / **翻訳オプション**
- **翻訳オプション(必須要件)**:
  - 既定 = 「AI翻訳して全言語で配信」
  - 「翻訳不要」= **投稿された言語のみで公開**し、他ロケールでは記事を存在させない(`ArticleTranslation.status = excluded`)。勝手に翻訳しない
  - 言語ごとの個別選択も可(例: en/ko だけ翻訳、zh は自社原稿を別途入稿)
  - 事業者自身が翻訳原稿を直接入稿することも可(その言語は `translatedBy: human` として AI 翻訳をスキップ)
- 承認フロー: `submitted → (編集部レビュー) → scheduled/published`。信頼済み事業者は `autoApprove` で即時公開可
- 送信時は Turnstile + レート制限。添付画像はウイルス/NSFWチェック後にR2へ

### 7.2 表示・SEO

- 記事ページ上部に**常時「PR / プレスリリース」ラベル**(全ロケールで明示)と配信元企業名・企業ページへのリンク
- JSON-LD は `NewsArticle` ではなく **`Article`**
- 企業サイトへの外部リンクは `rel="sponsored nofollow"`
- トップの主要ニュース面には混ぜない(専用枠と `press-release` カテゴリーのみ)
- 企業ページ `/{locale}/press/{companySlug}`: その企業のPR一覧+プロフィール

### 7.3 配信(アウトバウンド)

- `/rss/{locale}/press-release.xml`(RSS 2.0 / Atom / JSON Feed)
- 提携先向けに `GET /api/public/press-releases?locale=&since=&limit=`(APIキー・レート制限つき、公開済みのみ)
- Webhook 通知(登録先URLへ公開時POST、HMAC署名)は将来スコープ

---

## 8. ファン投稿(UGC)

### 8.1 投稿種別と権限

| ロール | できること |
|---|---|
| `reader` | 閲覧・投票・(承認制で)投稿 |
| `influencer` | 審査を通った投稿者。プロフィールページ `/creators/{handle}`、投稿の自動承認、SNSリンク掲載 |
| `partner` | §7 のプレスリリース投稿 |

- 投稿は**作品(Series)への紐付けを必須**とする。作品未登録の場合は候補を提案して pending 登録 → 承認後に公開
- 投稿タイプ: `illustration`(自作イラスト)/ `cosplay` / `photo`(グッズ・聖地巡礼)/ `text`(感想・考察)/ `embed`(X・Instagram・TikTok・YouTube の公開投稿の埋め込み)
- 入力: 本文(任意言語)/ 画像 or 埋め込みURL / 作品 / タグ / 規約同意

### 8.2 モデレーション

- **全投稿が公開前レビューを通る**(`influencer` の投稿のみ自動承認+事後監査)
- 一次: AI スクリーニング(NSFW・暴力・ヘイト・個人情報・明らかな無断転載の検出)→ スコアで自動却下 / 保留 / 通過
- 二次: 管理画面 `/admin/moderation` で人手承認。却下理由はテンプレ+自由記述で投稿者に通知
- 権利: 投稿時に「自作であること/第三者の権利を侵害しないこと」への同意を必須化。掲載許諾(非独占・改変不可・出典表示)を利用規約で取得。**公式画像・アニメ本編スクショの投稿は禁止**(埋め込みを除く)
- 通報導線(各投稿に "Report")+ 削除申立(DMCA相当)窓口を `/contact` に明記。`ModerationLog` に全操作を監査記録
- 未成年保護: 年齢確認(生年月入力)と、規約上の最低年齢設定

### 8.3 表示・SEO

- `/{locale}/anime/{seriesSlug}` = 作品ページ。ニュース / ファン投稿 / 基本情報(放送情報・スタッフ・公式リンク)をタブで束ねる。JSON-LD は `TVSeries`(劇場は `Movie`)+ `BreadcrumbList`
- `/{locale}/fans` = 新着・人気・作品別の横断ハブ
- 投稿本文(キャプション)は AI で各ロケールに翻訳して表示。**原文は常に併記**(トグル)。翻訳は投稿の付加情報であり、原文を置き換えない
- 薄いコンテンツ対策: 個別投稿ページは本文が一定文字数未満なら `noindex, follow`。作品別ギャラリーと投稿者ページは index 対象
- ユーザー由来の外部リンクは `rel="ugc nofollow"`
- ファン投稿は `news-sitemap` に含めない(Googleニュース対象外)

### 8.4 データモデル

```prisma
enum FanPostType { illustration cosplay photo text embed }
enum FanPostStatus { pending approved rejected hidden }

model FanPost {
  id, authorId(User), seriesId, type, status,
  bodyOriginal String, originalLocale Locale,
  mediaIds String[], embedUrl String?, embedProvider String?,
  score Int, voteCount Int, viewCount Int,
  aiModerationScore Json?, reviewedById?, reviewedAt?, publishedAt?, createdAt
  translations FanPostTranslation[]   // locale, body, translatedBy
  votes        FanPostVote[]          // @@unique([postId, userId, cycleId])
}
```

---

## 9. 週次プライズ

### 9.1 仕組み

- サイクル: 月曜 00:00 〜 日曜 23:59(Asia/Tokyo)。`PrizeCycle(id, startAt, endAt, region, status, winnerPostId?)`
- 集計: 読者投票(1ユーザー1投稿1票 / サイクル内の総投票数に上限)+ 編集部スコア
- **最終決定は編集部の審査**とする(単純な投票数1位の自動確定にしない)。理由は §9.3
- 発表: 毎週月曜に `/{locale}/prize` を更新+受賞記事を自動生成(全ロケール翻訳)+受賞者へ通知メール
- 賞品: Amazon ギフト券(**受賞者の地域で使えるもの**)。`PrizeAward(id, cycleId, postId, userId, region, provider, amount, currency, code?, sentAt?, status)`

### 9.2 「ローカルで使えるギフト券」の注意 ⚠

**韓国・台湾・タイには Amazon のローカルストアが存在しない。** そのため「地域ごとに Amazon ギフト券」をそのまま実装できない地域がある。賞品はハードコードせず、**地域→賞品のマッピングをDB(`RewardCatalog`)で持つ**設計にする。

```
RewardCatalog(id, region, provider, productName, amount, currency, isActive, notes)
```

- `en`(US/その他): Amazon.com ギフトカード
- `zh-Hant`(TW)/ `ko`(KR)/ `th`(TH): Amazon のローカルストアが無いため、**代替の指定が必要**(Amazon.com/.co.jp ギフト券をそのまま渡す・地域のギフト券サービスを使う・デジタルコード配布業者を使う 等)→ **§13 の別途指示待ち項目**
- 初期リリースは**管理画面から手動でコード発行・送付**し、`PrizeAward` に発行記録と監査ログを残す(自動購入APIの連携は将来スコープ)

### 9.3 コンプライアンス ⚠

賞品を伴う企画は各国の景品規制・懸賞規制の対象になりうる。以下を前提に実装する。

- **抽選(運)ではなく審査(実力・作品性)で選ぶ**建て付けにする。ランダム抽選は規制が厳しくなる国があるため既定では実装しない
- ロケールごとの**公式ルール(応募資格・年齢・除外地域・賞品内容・選考方法・税の扱い・個人情報の取扱い)を `/prize/rules` に多言語で掲示**し、応募時に同意を取る
- 参加を禁止/制限する地域を `isEligible` フラグで管理できるようにする(従業員・関係者の除外も含む)
- **公開前に各対象国の法務確認を必ず行うこと。**本書は法的助言ではなく、実装が法務判断を差し込めるようデータ駆動にしてあるだけである

---

## 10. SEO / AI引用基盤

huandaonews の実装を多言語へ拡張する。

- **hreflang**: 全ページで5ロケール相互 + `x-default = en`。翻訳が存在しない(`excluded`)ロケールは hreflang から外す
- **canonical**: 各ロケールが自分自身を指す(本文が翻訳されているため。huandaonews の「常に既定ロケール」ルールとは異なる)
- **JSON-LD**: 記事 = `NewsArticle`(PRは `Article`)、`inLanguage` は当該ロケール、`author`(Person + 著者ページ)、`publisher`(NewsMediaOrganization + ロゴ)、`image`、`articleSection`、`mainEntityOfPage`。作品ページ = `TVSeries` / `Movie`、投稿者ページ = `Person`、全ページ `BreadcrumbList`、サイト = `Organization` + `WebSite`(searchbox)
- **sitemap**: `/sitemap.xml` をインデックスにし、`/sitemaps/{locale}-{n}.xml` へ分割(5万件/ファイル上限)。各URLに `xhtml:link` で hreflang を出力
- **news-sitemap**: ロケール別 `/news-sitemap-{locale}.xml`(直近48時間、`<news:news>` 拡張、publication language は各ロケール)
- **robots.txt**: 主要AIクローラー(GPTBot, ClaudeBot, Claude-Web, PerplexityBot, Google-Extended, CCBot, Applebot-Extended)を**明示許可**。`/admin` `/partner` `/my` `/preview` `/search` は全クローラー禁止
- **llms.txt**: サイト概要・ロケール一覧・カテゴリー別フィードURL・記事URL形式・引用時のクレジット指定
- **OGP / Twitter Card** 全ページ完備。記事は `og:type=article` + `article:published_time` + `article:section` + `og:locale` / `og:locale:alternate`
- セマンティックHTML厳守(`<article>` / `<h1>` は1つ / `<time datetime>`)。日付・著者・出典を本文冒頭で機械可読に明示
- Lighthouse: SEO 100 / Performance 90+ を維持。**JS無効での本文読解**を E2E で担保

---

## 11. インフラ / 運用

| サービス | 設定 |
|---|---|
| **Supabase** | 新規プロジェクト。リージョン **ap-northeast-1 (Tokyo)**。Data API OFF(DBとしてのみ使用)。DBパスワードは英数字のみ。`DATABASE_URL` = Transaction pooler(6543, `?pgbouncer=true&connection_limit=10&sslmode=require`)、`DIRECT_DATABASE_URL` = Session pooler(5432)。直結ホストはIPv6専用のため使用しない |
| **Vercel** | Production Branch = `main`、Build Command は `vercel.json` の `npx prisma migrate deploy && next build`、`regions: ["hnd1"]`。Cron を分単位で使うため **Pro プラン**前提。Preview も本番DBを触る点に注意 |
| **Cloudflare** | ゾーン追加 → レジストラでNS変更 → apex/www = Vercel(**DNS only**)、img = R2カスタムドメイン(**Proxied**)。Turnstile もここ |
| **R2** | バケット `{{PROJECT_SLUG}}-public`、カスタムドメイン `img.{{DOMAIN}}`、APIトークン(Object Read & Write・当該バケット限定) |
| **Resend** | 会員登録確認・受賞通知・PR承認通知の送信。ドメイン検証(DKIM/SPF) |
| **AI** | `AI_PROVIDER` + 役割別モデル設定。翻訳は品質重視の上位モデル、モデレーション・分類は軽量モデルでコストを分ける |

### Cron 一覧(`vercel.json`)

| path | schedule | 内容 |
|---|---|---|
| `/api/cron/publish` | `* * * * *` | 予約公開のリリース |
| `/api/cron/ingest` | `*/10 * * * *` | ソース収集(RSS等) |
| `/api/cron/generate` | `0 0,6,12 * * *` (JST 9/15/21時) | 日本語マスター記事の生成 |
| `/api/cron/jobs` | `*/2 * * * *` | ジョブキュー drain(翻訳・再翻訳・モデレーション) |
| `/api/cron/glossary-audit` | `0 18 * * *` | 公開記事の用語表記監査、揺れ検出 |
| `/api/cron/prize` | `0 15 * * 0` (JST 月曜0時) | 週次集計 → 受賞候補を編集部へ提示 |

- cron は `CRON_SECRET` による認証を **fail-closed**(未設定なら実行しない)で保護。huandaonews の `src/lib/cron-auth.ts` を踏襲
- 監視: ジョブ失敗数・翻訳 `needs_review` 滞留数・pending 用語数をダッシュボードに常時表示

### 環境変数(`.env.example` に追記)

既存(`DATABASE_URL` / `DIRECT_DATABASE_URL` / `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_IMG_HOST` / `AUTH_SECRET` / `PREVIEW_SECRET` / `R2_*` / `BLOB_READ_WRITE_TOKEN` / `OPENAI_*` / `CRON_SECRET` / `NEXT_PUBLIC_GA_ID` / `RESEND_API_KEY` / `SEED_ADMIN_*`)に加えて:

```
AI_PROVIDER=                 # openai | anthropic 等
AI_MODEL_WRITE=              # 記事生成
AI_MODEL_TRANSLATE=          # 翻訳(品質重視)
AI_MODEL_MODERATE=           # モデレーション・分類(軽量)
ANTHROPIC_API_KEY=
AUTH_GOOGLE_ID= / AUTH_GOOGLE_SECRET=
AUTH_DISCORD_ID= / AUTH_DISCORD_SECRET=
AUTH_TWITTER_ID= / AUTH_TWITTER_SECRET=
TURNSTILE_SITE_KEY= / TURNSTILE_SECRET_KEY=
INDEXNOW_KEY=
PRIZE_TIMEZONE=Asia/Tokyo
UPLOAD_MAX_MB=
```

---

## 12. 管理画面 (`/admin`)

- **ダッシュボード**: 公開本数(日/週・ロケール別)、翻訳キュー滞留、`needs_review` 一覧、pending 用語、モデレーション待ち、PR承認待ち、ジョブ失敗
- **記事**: 一覧(ステータス/カテゴリー/種別/作品/期間/ロケール絞り込み・全文検索・一括操作)、編集画面は**マスター(ja)と各ロケールをタブ切替**、翻訳の再実行・差分表示・承認
- **用語辞書**(§5.4)/ **作品(Series)管理**(別名・公式リンク・放送情報)/ **ソース管理**(フィード登録・手動取得・生成ジョブ即時実行)
- **モデレーション**(§8.2)/ **プライズ**(サイクル・候補・受賞確定・コード発行記録)/ **事業者**(審査・信頼フラグ)/ **メディアライブラリ** / **ユーザー** / **リダイレクト** / **サイト設定**
- UIは ja / en の2言語。shadcn/ui ベース。モバイルでも記事の確認・承認ができるレスポンシブ対応

---

## 13. 開発ガイドライン

- pnpm / Node 20+。`pnpm dev` / `build` / `lint` / `typecheck` / `test`(Vitest)/ `test:e2e`(Playwright)/ `check:i18n`
- コミット前に lint + typecheck を通す。秘密情報は `.env.local`(コミット禁止)
- テキストのハードコード禁止(公開側・管理側とも next-intl 経由)
- 日時はDBにUTC保存。運用基準は Asia/Tokyo、表示は各ロケールの書式
- ローカル開発は `./scripts/dev-local.sh`(専用ローカルPostgres自動構築)を踏襲
- **必須テスト**: 用語辞書の適用と検証(§5.3)/ スラッグ生成 / 翻訳のブロック差分 / `excluded` ロケールの除外(一覧・sitemap・feed・直リンク)/ JS無効での記事表示 / cron 認証 fail-closed

### 実装フェーズ(推奨順)

1. **Phase 1 — 土台移植**: リポジトリ複製、5ロケール化(`localePrefix: always`)、カテゴリー多言語化、ブランド仮適用、デプロイ疎通
2. **Phase 2 — 多言語記事基盤**: `ArticleTranslation` 分離、ジョブキュー、翻訳パイプライン、hreflang/canonical/sitemap/feed の多言語化
3. **Phase 3 — 固有名詞辞書**: `Term`/`TermForm`/`TermAlias`、抽出・注入・検証・pending キュー、管理UI、既存記事の監査ジョブ
4. **Phase 4 — 収集と自動記事化**: ソース管理、クラスタリング、日本語マスター生成、作品(Series)紐付け、作品ページ
5. **Phase 5 — プレスリリース**: 事業者ポータル、審査フロー、翻訳オプトアウト、PR表示ルール、配信フィード/API
6. **Phase 6 — ファン投稿**: 会員認証、投稿・モデレーション、作品別ギャラリー、投稿者ページ
7. **Phase 7 — プライズ**: 投票、週次サイクル、受賞発表、賞品カタログと発行記録、多言語ルールページ
8. **Phase 8 — 仕上げ**: パフォーマンス、E2E(JS無効含む)、監視ダッシュボード、IndexNow/Search Console

### 将来スコープ(初期リリースに含めない)

ニュースレター / コメント欄 / ダークモード / モバイルアプリ / 広告管理 / 賞品の自動購入API / Webhook配信 / 香港向け zh-Hant 分割 / 日本語版の一般公開

---

## 別途指示待ちの項目

- `{{SITE_NAME}}`(各ロケール表記)/ `{{DOMAIN}}` / `{{PROJECT_SLUG}}` / `{{BRAND_COLOR}}` / `{{LOGO}}`
- **プライズの賞品**: 韓国・台湾・タイは Amazon ローカルストアが無いため、地域ごとの賞品を確定する必要がある(§9.2)
- **プライズの法務確認**: 対象各国の景品・懸賞規制、応募資格と除外地域(§9.3)
- 収集対象ソース(公式サイト・フィードURL、カテゴリー割り当て、自動公開のオンオフ)
- 事業者(プレスリリース)の初期パートナー一覧と審査基準
- 利用規約・プライバシーポリシー・投稿ガイドラインの原文(5言語展開はAI翻訳+人手確認)
