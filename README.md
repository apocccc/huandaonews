# 環島新聞網 (Huandao News)

台湾ローカル読者向けの総合ニュース+情報サイト。詳細仕様は [CLAUDE.md](./CLAUDE.md) を参照。

- 公開サイト: `https://huandaonews.com`(`NEXT_PUBLIC_SITE_URL` で設定)
- 技術スタック: Next.js (App Router) / Prisma + PostgreSQL / Auth.js v5 / next-intl / Tiptap / Tailwind CSS v4

## クイックスタート (Mac / ローカル確認)

前提: Node.js 20+、Docker Desktop(PostgreSQL用。なければ Homebrew の PostgreSQL でも可)。

```bash
git clone https://github.com/apocccc/huandaonews.git
cd huandaonews
git checkout claude/huandaonews-news-media-ykuvxt   # ブランチ未マージの間のみ
./scripts/setup-local.sh   # 依存・.env生成・DB起動・スキーマ反映・シードまで一括
pnpm dev
```

→ http://localhost:3000 (公開サイト) / http://localhost:3000/admin (管理画面)

DBの停止は `docker compose down`(データ削除は `docker compose down -v`)。

## 手動セットアップ

```bash
pnpm install
cp .env.example .env         # DATABASE_URL などを設定 (Prisma CLI は .env を読む)
docker compose up -d db      # または任意のPostgreSQLを用意
pnpm prisma db push          # スキーマ反映
pnpm db:seed                 # カテゴリー+サンプル記事+管理ユーザー投入
pnpm dev
```

シードで作成される管理ユーザー:

- `admin@huandaonews.com` / `admin1234`(`SEED_ADMIN_PASSWORD` で変更可)— role: admin
- `reporter@huandaonews.com` / 同上 — role: author

管理画面は `/admin`。

## 主要コマンド

| コマンド | 内容 |
|---|---|
| `pnpm dev` | 開発サーバー |
| `pnpm build` | 本番ビルド |
| `pnpm lint` / `pnpm typecheck` | Lint / 型チェック |
| `pnpm test` | ユニットテスト (Vitest) |
| `pnpm check:i18n` | 翻訳キーの差分チェック(3ロケール) |
| `pnpm db:seed` | シード投入 |

## URL 設計(抜粋)

```
/                                  トップ(zh-Hant 既定)
/en/...                            英語UI(記事本文は常に繁体字)
/news/{category}/{yyyymmdd}-{slug} 記事
/category/{category}               カテゴリー一覧(/category/latest は全カテゴリー横断)
/rss.xml, /rss/{category}.xml      RSS 2.0(全文入り)
/atom.xml, /feed.json              Atom / JSON Feed
/sitemap.xml, /news-sitemap.xml    サイトマップ / Googleニュース用
/robots.txt, /llms.txt             AIクローラー許可 + サイト概要
/admin                             管理画面(noindex, zh-Hant/en/ja)
```

## デプロイ (Vercel)

必要な環境変数は `.env.example` を参照。`vercel.json` の cron (`/api/cron/publish`, 毎分) が予約公開を処理する。
