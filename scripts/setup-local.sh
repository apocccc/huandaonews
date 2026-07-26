#!/usr/bin/env bash
# ローカル開発環境のセットアップ (macOS / Linux)
# 使い方: ./scripts/setup-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> 環島新聞網 ローカルセットアップ"

# --- 前提チェック ---
if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js が見つかりません。Node 20+ をインストールしてください (https://nodejs.org)" >&2
  exit 1
fi

NODE_MAJOR=$(node -e 'console.log(process.versions.node.split(".")[0])')
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "✗ Node.js 20 以上が必要です (現在: $(node -v))" >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "==> pnpm が見つからないため corepack で有効化します"
  corepack enable && corepack prepare pnpm@latest --activate || {
    echo "✗ pnpm を用意できませんでした。'npm install -g pnpm' を実行してください" >&2
    exit 1
  }
fi

# --- 依存インストール ---
echo "==> pnpm install"
pnpm install

# --- .env 生成 (Prisma CLI と Next.js の両方が読む) ---
if [ ! -f .env ]; then
  echo "==> .env を生成します"
  AUTH_SECRET=$(openssl rand -base64 32)
  PREVIEW_SECRET=$(openssl rand -hex 16)
  cat > .env <<EOF
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/huandaonews"
DIRECT_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/huandaonews"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
AUTH_SECRET="${AUTH_SECRET}"
PREVIEW_SECRET="${PREVIEW_SECRET}"
EOF
else
  echo "==> .env は既に存在するためそのまま使います"
fi

# --- PostgreSQL (Docker) ---
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "==> Docker で PostgreSQL を起動します"
  docker compose up -d db
  echo "==> PostgreSQL の起動を待機中..."
  for i in $(seq 1 30); do
    if docker compose exec -T db pg_isready -U postgres -d huandaonews >/dev/null 2>&1; then
      break
    fi
    sleep 1
    if [ "$i" -eq 30 ]; then
      echo "✗ PostgreSQL が起動しませんでした。'docker compose logs db' を確認してください" >&2
      exit 1
    fi
  done
else
  echo "⚠ Docker が使えないため PostgreSQL の起動をスキップします。"
  echo "  Homebrew の場合: brew install postgresql@16 && brew services start postgresql@16"
  echo "  その後 'createdb huandaonews' を実行し、.env の DATABASE_URL を環境に合わせてください。"
  echo "  (例: postgresql://$(whoami)@localhost:5432/huandaonews)"
  read -r -p "PostgreSQL が起動済みなら Enter で続行します..." _
fi

# --- スキーマ反映 + シード ---
echo "==> Prisma スキーマを反映します"
pnpm prisma db push

echo "==> シードデータ(カテゴリー+サンプル記事+管理ユーザー)を投入します"
pnpm db:seed

echo ""
echo "✅ セットアップ完了!"
echo ""
echo "  開発サーバー:  pnpm dev"
echo "  公開サイト:    http://localhost:3000"
echo "  管理画面:      http://localhost:3000/admin"
echo "                 (admin@huandaonews.com / admin1234)"
echo ""
