# 環島新聞網 本番デプロイ手順 (huandaonews.tw)

インフラ4サービスと役割:

| サービス | 役割 |
|---|---|
| Supabase | マネージド Postgres としてのみ使用(supabase-js / Data API / RLS / Supabase Auth は不使用) |
| Cloudflare R2 | 公開画像(`img.huandaonews.tw` カスタムドメイン配信) |
| Cloudflare DNS | ゾーン管理(apex/www→Vercel: DNS only、img→R2: Proxied) |
| Resend | メール送信(将来のニュースレター等。現時点で送信機能は未実装、キーのみ用意) |
| Vercel | ホスティング。Build Command `npx prisma migrate deploy && next build` |

ドメイン: `huandaonews.tw`(お名前.comで取得 → ネームサーバーをCloudflareへ変更)

---

## 1. Supabase (Postgres)

1. 新規プロジェクト作成。リージョンは **ap-northeast-2 (Seoul)** で作成済み
   (Vercel の関数リージョンを `icn1`(ソウル)に合わせてあるため、東京で作り直す必要はない)
2. Settings → Data API を **OFF**(DBとしてのみ使う)
3. DBパスワードは**英数字のみ**にする(記号を使う場合は接続文字列でURLエンコード必須)
4. 接続文字列を2種類控える(Connect → 接続方式で切替):
   - **Transaction pooler (ポート6543)** → `DATABASE_URL` 用。末尾に必ず
     `?pgbouncer=true&connection_limit=10&sslmode=require` を付ける
     - ⚠ `connection_limit=1` はビルドの並列静的生成で pool timeout する → **10**
     - ⚠ 直結 `db.<ref>.supabase.co` は **IPv6専用で Vercel から繋がらない** → 必ず pooler
   - **Session pooler (ポート5432)** → `DIRECT_DATABASE_URL` 用(マイグレーション実行用)

## 2. Cloudflare R2

1. バケット作成: `huandaonews-public`(公開画像用)
2. バケット → Settings → Custom Domains に `img.huandaonews.tw` を追加
   (ゾーン追加後。DNSレコードは自動作成され **Proxied** になる)
3. R2 API トークン作成(Object Read & Write)→ `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`
4. アプリ側は S3 互換クライアントで `forcePathStyle: true`、公開画像は
   `ContentDisposition: inline` で保存する実装済み(`src/lib/media-store.ts`)

## 3. Cloudflare DNS(お名前.com からの移管)

1. Cloudflare にサイト(ゾーン)追加 → `huandaonews.tw`
2. 表示された2つのネームサーバーを**お名前.com側で設定**
   (お名前.com Navi → ドメイン → ネームサーバー設定 → 「その他のネームサーバーを使う」)
3. ゾーンが **Active** になるのを待つ(数分〜最大72時間、通常1時間以内)
4. Active 後にレコード追加:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` | `76.76.21.21` (Vercel) | **DNS only(グレー雲)** |
| CNAME | `www` | `cname.vercel-dns.com` | **DNS only(グレー雲)** |
| CNAME | `img` | (R2カスタムドメイン設定が自動作成) | **Proxied(オレンジ雲)** |

- ⚠ apex/www を Proxied にすると Vercel の証明書発行に失敗する → **必ず DNS only**
- ⚠「画像はアップできるのに表示されない」= img ドメインが未接続(DNS/カスタムドメインの有効化待ち)なだけ。R2側の Custom Domain が Active になれば直る

## 4. Resend

1. ドメイン追加(送信用は別ドメイン運用でも可)→ 表示される DKIM/SPF レコードを
   Cloudflare DNS に追加 → Verify
2. API キーを `RESEND_API_KEY` に(現時点では送信機能未実装のため設定のみ)

## 5. Vercel

1. New Project → GitHub リポジトリを Import
2. **Build Command**: `npx prisma migrate deploy && next build`(`vercel.json` に設定済み)
3. **Production Branch**: `main`
4. 環境変数(Production / Preview 共通。`.env.example` 参照):

```
DATABASE_URL          = postgresql://postgres.<ref>:<pw>@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10&sslmode=require
DIRECT_DATABASE_URL   = postgresql://postgres.<ref>:<pw>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require
NEXT_PUBLIC_SITE_URL  = https://huandaonews.tw
NEXT_PUBLIC_IMG_HOST  = img.huandaonews.tw
AUTH_SECRET           = (openssl rand -base64 32)
PREVIEW_SECRET        = (openssl rand -hex 16)
R2_ENDPOINT           = https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID      = ...
R2_SECRET_ACCESS_KEY  = ...
R2_BUCKET             = huandaonews-public
R2_PUBLIC_BASE_URL    = https://img.huandaonews.tw
OPENAI_API_KEY        = sk-...
CRON_SECRET           = (openssl rand -hex 16)
RESEND_API_KEY        = re_...
```

5. Domains: `huandaonews.tw` と `www.huandaonews.tw` を追加(www→apex リダイレクト推奨)
6. ⚠ **Preview デプロイも本番DBに `migrate deploy` する**点に注意
   (スキーマ変更を含むPRのプレビューは本番DBを先にマイグレーションする)

## 6. 初期化

デプロイ成功後(マイグレーションは Build Command で適用済み):

```bash
# ローカルから本番DBへカテゴリー+管理者を投入(サンプル記事は入らない)
DATABASE_URL="<transaction poolerのURL>" \
DIRECT_DATABASE_URL="<session poolerのURL>" \
SEED_ADMIN_EMAIL="admin@huandaonews.tw" \
SEED_ADMIN_PASSWORD="<12文字以上の強いパスワード>" \
pnpm db:seed:prod
```

その後:

1. `https://huandaonews.tw/admin` にログイン
2. RSS 來源にフィードを登録(自動公開/頻度/件数を設定)
3. cron はデプロイと同時に有効:
   - 毎分: 予約公開リリース
   - 10分おき: RSS自動取得
   - 23:00 UTC (= 8:00 JST): AI記事化ジョブ(8:30〜9:30 JST にランダム公開)
4. Google Search Console にプロパティ追加 → `sitemap.xml` / `news-sitemap.xml` を送信

## 落とし穴チェックリスト(再掲)

- [ ] Supabase は pooler 接続(直結はIPv6専用で Vercel 不可)
- [ ] `connection_limit=10`(1だと並列ビルドで pool timeout)
- [ ] DBパスワードの記号は URL エンコード(または英数字のみ)
- [ ] apex/www は DNS only(グレー雲)、img(R2) は Proxied
- [ ] 画像がアップできるのに表示されない → img カスタムドメインの有効化待ちなだけ
- [ ] R2 は `forcePathStyle: true` + 公開画像 `ContentDisposition: inline`(実装済み)
- [ ] Build Command に `prisma migrate deploy`(実装済み)/ Preview も本番DBを触る
