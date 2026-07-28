# タイ語ニュースメディア — 開発仕様書 (CLAUDE.md)

タイローカル読者向けの総合ニュース+情報サイトの開発仕様。
**環島新聞網(huandaonews)と完全に同一の構成**で、言語・地域だけをタイ向けに差し替えて立ち上げる。
このファイルは新リポジトリのルートに `CLAUDE.md` として置き、Claude Code が常に参照する前提で書かれている。

---

## 0. 立ち上げ方式(最重要)

**ゼロから作らない。** `apocccc/huandaonews` リポジトリをテンプレートとして複製し、本書の「§2 差分一覧」だけを適用する。

```
1. huandaonews を新リポジトリへ複製(git clone → remote 差し替え → main へ push)
2. §2 の差分(言語・タイムゾーン・カテゴリー・プロンプト・ブランド)を適用
3. §8 のインフラを新規に用意(コードと同名の環境変数を設定)
4. デプロイ(手順は複製された docs/DEPLOY.md と同じ流れ。リージョンのみ §8 に従う)
```

huandaonews で実装済みの以下はすべてそのまま使う(再実装禁止):
記事CMS(Tiptap)/RSS自動取り込み(画像保存・og:imageフォールバック・サムネ必須・重複は先着優先)/毎朝のAI独自記事化(件数上限・ランダム時刻公開・1ソース1記事保証)/一括操作・種別フィルター/転載元表記のルール/RSS・Atom・JSON Feed/sitemap+news-sitemap/JSON-LD/robots.txt・llms.txt/課金・不正利用対策(cron認証 fail-closed、画像は unoptimized+R2直配信 等)

## 1. プロジェクト概要

- **メディア名**: `{{SITE_NAME_TH}}`(タイ語正式名)。英語表記 `{{SITE_NAME_EN}}`。※別途指示
- **ドメイン**: `{{DOMAIN}}`(※別途指示。お名前.com取得→Cloudflare DNS管理)。コード内では `NEXT_PUBLIC_SITE_URL` を必ず参照しハードコードしない。公開画像は `img.{{DOMAIN}}`
- **ポジション**: タイローカル読者向けの総合ニュースメディア。運用方針は環島新聞網と同一 —— 他メディアRSSからの自動取り込みを起点に、**タイ語のAI独自記事**として毎朝自動公開する
- **ターゲット**: タイのデジタル世代。モダンで軽快なUI
- **設計思想**: Google・Googleニュース・AI(LLMクローラー)に引用されやすい構造を最優先。記事本文は常に初期HTMLに完全な形で含める

## 2. huandaonews からの差分一覧(これだけを変更する)

### 2.1 言語・ロケール

| 項目 | huandaonews | 本プロジェクト |
|---|---|---|
| 記事本文の言語 | 繁体字中国語のみ | **タイ語のみ** |
| 公開サイトUI | `zh-Hant`(既定)/ `en` | **`th`(既定)/ `en`** |
| 管理画面UI | zh-Hant / en / ja | **th / en / ja** |
| HTML lang | `zh-Hant` | `th` |
| JSON-LD inLanguage | `zh-Hant` | `th` |
| news-sitemap language | `zh-tw` | `th` |
| RSS `<language>` | `zh-tw` | `th` |

変更対象: `src/i18n/routing.ts`(locales)/ `messages/` 配下(`zh-Hant/` → `th/` として site.json・admin.json を全キー翻訳。ja/admin.json は維持、en は流用)/ `src/lib/site.ts` / `src/lib/seo.ts` / `src/app/news-sitemap.xml/route.ts` / `src/lib/feeds.ts` / 各layout の lang 属性

### 2.2 タイムゾーン・自動公開スケジュール

| 項目 | huandaonews | 本プロジェクト |
|---|---|---|
| 表示タイムゾーン | Asia/Taipei | **Asia/Bangkok (ICT, UTC+7)** |
| AI記事化ジョブ | 8:00 JST = cron `0 23 * * *` | **8:00 ICT = cron `0 1 * * *`** |
| ランダム公開窓 | 8:30〜9:30 JST | **8:30〜9:30 ICT** |

変更対象: `src/lib/site.ts`(TAIPEI_TZ→`BANGKOK_TZ = "Asia/Bangkok"`、formatは `th-TH` ロケール)/ `src/lib/slug.ts`(dateStampのTZ)/ `src/lib/daily-rewrite.ts`(`JST_OFFSET_MS` → `ICT_OFFSET_MS = 7*60*60*1000`)/ `vercel.json`(daily-rewrite を `0 1 * * *`)/ 管理画面の日時表示

### 2.3 カテゴリー初期データ(seed差し替え)

| slug | タイ語 | English |
|---|---|---|
| `latest` | ล่าสุด | Latest |
| `politics` | การเมือง | Politics |
| `society` | สังคม | Society |
| `local` | ท้องถิ่น | Local |
| `world` | ต่างประเทศ | World |
| `business` | เศรษฐกิจ | Business |
| `tech` | เทคโนโลยี | Tech |
| `life` | ไลฟ์สไตล์ | Life |
| `entertainment` | บันเทิง | Entertainment |
| `sports` | กีฬา | Sports |
| `health` | สุขภาพ | Health |
| `travel` | ท่องเที่ยว | Travel |
| `press-release` | ข่าวประชาสัมพันธ์ | Press Releases |

- DBスキーマの `nameZh` カラム名は互換のため**変更しない**(タイ語名を格納する。リネームはマイグレーション負債になるだけ)
- `latest` は仮想カテゴリー、`press-release` の特別扱い(転載ラベル・提供元表示・Article型JSON-LD・独自化枠)は同一
- サンプル記事seed(`prisma/seed.ts` の記事データ)は**使わない**。本番は `prisma/seed-prod.ts`(カテゴリー+管理者のみ)を上表で書き換えて使用

### 2.4 AI記事化プロンプト(`src/lib/rewrite.ts`)

システムプロンプトをタイ語メディア向けに差し替える。要件は同一:

- ペルソナ:「タイのニュースサイト `{{SITE_NAME_TH}}` のベテラン記者兼編集者」
- **出力はタイの標準的な報道文体のタイ語**
- 事実・数字・固有名詞・日付の捏造禁止/確認できない情報は書かない/Webサーチで背景補強
- 分量: **読了3〜5分**(タイ語で概ね 600〜1,200語 / 4,000〜8,000文字目安。実測して調整)、段落10以上、小見出し(`## `)3〜5個
- `[IMAGE_n]` マーカー保持、JSON出力形式、カテゴリー自動選択(§2.3のslug一覧を渡す)は同一実装のまま

### 2.5 フォント・ブランド

| 項目 | huandaonews | 本プロジェクト |
|---|---|---|
| 本文フォント | Noto Sans TC + Inter | **Noto Sans Thai + Inter**(`src/lib/fonts.ts`) |
| 基調色 | 赤 `#D7263D` 系 | `{{BRAND_COLOR}}`(※別途指示。未指示の間は現状の赤系トークンを維持) |
| ロゴ・ファビコン | 台湾シルエット | `{{LOGO}}`(※別途指示。未指示の間はテキストロゴ+仮ファビコン) |

- タイ文字は行間が潰れやすいため、本文 `line-height: 1.9〜2.0` で調整(現行1.8から微増)
- デザイントークン(`globals.css` の `@theme`)の構造は維持し、色値のみ差し替え

### 2.6 サイト定数・その他

- `src/lib/site.ts`: `SITE_NAME_ZH`→`SITE_NAME_TH`(値は `{{SITE_NAME_TH}}`)、`SITE_URL` フォールバック=`https://{{DOMAIN}}`、`NEXT_PUBLIC_IMG_HOST` 既定=`img.{{DOMAIN}}`
- `next.config.ts`: 変更不要(unoptimized運用のまま)
- 静的ページ(about/contact/privacy)の文面をタイ語で書き直し(messages経由)
- User-Agent文字列(`HuandaoNewsBot`)を新メディア名のBotへ(`src/lib/media-store.ts` / `rss-import.ts` / `rewrite.ts`)
- README / docs/DEPLOY.md 内のドメイン・リージョン記述を更新

## 3. 技術スタック(変更なし)

Next.js (App Router, TypeScript) / Vercel / PostgreSQL (Supabase) + Prisma(migrate運用・directUrl構成)/ Auth.js v5(メール+パスワード、4ロール)/ Tiptap / next-intl / Cloudflare R2 + カスタムドメイン直配信(next/image は unoptimized)/ Tailwind CSS v4 / RSS・sitemap自前実装

レンダリング方針・URL設計(`/news/{category}/{yyyymmdd}-{hash}`、**スラッグにrss等の由来情報を含めない**)・記事ステータスフロー・権限も huandaonews と同一。

## 4. RSS取り込み+AI記事化パイプライン(変更なし・言語だけタイ語)

1. 管理画面でフィード登録(取得元名/カテゴリー/自動公開/取得件数/自動取り込み頻度)
2. cron 10分おき: 頻度到達フィードを取得。**サムネイル(フィード内→og:image)をダウンロード検証できない記事は取り込まない**。一般カテゴリーは下書き保持、新聞稿(ข่าวประชาสัมพันธ์)は件数無制限で即転載公開
3. cron 毎朝8:00 ICT: 下書きを**各カテゴリー最大2件**AI独自化(+新聞稿枠2件はAIがカテゴリー自動選択)→ 8:30〜9:30 ICT のランダム時刻に予約公開 → 毎分cronがリリース
4. 表記: 転載記事は本文末に出典+原文リンク、画像に出典。**独自化済みは画像出典のみ**
5. ガード: 未加工RSS記事は一括操作でも公開されない/1ソース1独自記事/重複は先着優先

## 5. SEO / AI引用基盤(変更なし・言語属性のみ `th`)

JSON-LD(NewsArticle/Article・BreadcrumbList・NewsMediaOrganization・WebSite)/ インデックスsitemap+**Googleニュースsitemap(直近48時間・language=th)**/ robots.txt(GPTBot・ClaudeBot等のAIクローラー明示許可、/admin・/preview・/search禁止)/ llms.txt / OGP・Twitter Card / canonical は常に既定ロケールURL・一覧のみhreflang(`th`/`en`)

## 6. 管理画面(変更なし)

ダッシュボード/記事(種別フィルター:独自化済み・RSS未加工・自社記事+一括操作)/RSSソース管理(手動取得・AI記事化ジョブ即時実行ボタン)/カテゴリー/ユーザー。UIは **th / en / ja** の3言語(`messages/{locale}/admin.json`、キー差分は `pnpm check:i18n` でCIチェック)。

## 7. データモデル(変更なし)

`prisma/schema.prisma` をそのまま使用(User / Article / Revision / Category / Tag / ArticleTag / Media / RssFeed / Redirect / Setting)。`0_init` マイグレーションから `prisma migrate deploy` で構築。

## 8. インフラ(構成同一・リージョンのみタイ向け)

| サービス | 設定 |
|---|---|
| **Supabase** | 新規プロジェクト。リージョン **ap-southeast-1 (Singapore)**。Data API OFF。DBパスワードは英数字のみ。接続は Transaction pooler(6543, `?pgbouncer=true&connection_limit=10&sslmode=require`)+ Session pooler(5432)。直結ホストはIPv6専用のため使用しない |
| **Vercel** | Import、Production Branch=`main`、Build Command は `vercel.json` の `npx prisma migrate deploy && next build`。**`regions` を `["sin1"]`(シンガポール)へ変更**(§2差分に含める)。Preview も本番DBを触る点に注意 |
| **Cloudflare** | ゾーン追加→お名前.comでNS変更→ apex/www=Vercel(**DNS only**)、img=R2カスタムドメイン(**Proxied**)。旧レジストラ由来のNS/MX等の残骸レコード(特にwwwへのNS委任)は削除 |
| **R2** | バケット `{{PROJECT_SLUG}}-public`、カスタムドメイン `img.{{DOMAIN}}`、APIトークン(Object Read & Write・当該バケット限定) |
| **Resend** | ドメイン検証+APIキー(送信機能は未実装のまま) |
| **OpenAI** | `OPENAI_API_KEY`。モデル既定 gpt-4o-mini、Webサーチ有効(不要なら `OPENAI_WEB_SEARCH=false`) |

環境変数一覧は `.env.example` と同一(値のみ本プロジェクト用)。`AUTH_SECRET`/`PREVIEW_SECRET`/`CRON_SECRET` は新規生成。GA4測定IDは `NEXT_PUBLIC_GA_ID`。

## 9. 立ち上げチェックリスト

1. [ ] リポジトリ複製 → §2 差分適用 → `pnpm check:i18n` / `typecheck` / `lint` / `test` / `build` 全通過
2. [ ] Supabase(sin)作成 → Vercel Import+環境変数+`regions:["sin1"]` → デプロイ成功(migrate含む)
3. [ ] Cloudflare ゾーン+DNS(apex/www/img)+R2カスタムドメイン Active
4. [ ] `pnpm db:seed:prod`(タイ語カテゴリー+管理者)→ `/admin` ログイン確認
5. [ ] RSSソース登録 → 「今すぐ取得」で取り込み・画像・転載表記を確認
6. [ ] 「AI記事化ジョブを今すぐ実行」でタイ語独自記事の品質・分量(3〜5分)を確認 → プロンプト微調整
7. [ ] GA4 / Search Console(DNS TXT)/ sitemap.xml + news-sitemap.xml 送信
8. [ ] ファビコン・ロゴ差し替え(指示受領後)

## 10. 開発ガイドライン(変更なし)

pnpm / Node 20+。コミット前に lint + typecheck。テキストのハードコード禁止(next-intl経由)。日時はDBにUTC、表示は Asia/Bangkok 固定。ローカル開発は `./scripts/dev-local.sh`(専用ローカルPostgres自動構築)。

## 別途指示待ちの項目

- `{{SITE_NAME_TH}}` / `{{SITE_NAME_EN}}` / `{{DOMAIN}}` / `{{PROJECT_SLUG}}`(リポジトリ・バケット名用)
- `{{BRAND_COLOR}}`(基調色)と `{{LOGO}}`(ロゴ・ファビコン)
- 取り込み対象のRSSフィードURL(カテゴリー割り当てと自動公開設定)
