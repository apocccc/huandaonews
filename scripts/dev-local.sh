#!/usr/bin/env bash
# プロジェクト専用の PostgreSQL を空きポートで起動し、
# .env 設定 → スキーマ反映 → シード → 開発サーバー起動までワンコマンドで行う。
# 使い方: ./scripts/dev-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# --- PostgreSQL バイナリを探す (Homebrew / Linux) ---
PGBIN=""
CANDIDATES=""
if command -v brew >/dev/null 2>&1; then
  for pkg in postgresql@16 postgresql@17 postgresql; do
    prefix=$(brew --prefix "$pkg" 2>/dev/null || true)
    [ -n "$prefix" ] && CANDIDATES="$CANDIDATES $prefix/bin"
  done
fi
CANDIDATES="$CANDIDATES /opt/homebrew/opt/postgresql@16/bin /usr/local/opt/postgresql@16/bin /usr/lib/postgresql/16/bin"
for cand in $CANDIDATES; do
  if [ -x "$cand/initdb" ]; then PGBIN="$cand"; break; fi
done
if [ -z "$PGBIN" ] && command -v initdb >/dev/null 2>&1; then
  PGBIN="$(dirname "$(command -v initdb)")"
fi
if [ -z "$PGBIN" ]; then
  echo "✗ PostgreSQL が見つかりません。'brew install postgresql@16' を実行してください" >&2
  exit 1
fi
echo "▶ using PostgreSQL binaries: $PGBIN"

DATA_DIR="$PWD/.pgdata"
SOCKET_DIR="$DATA_DIR/sock"
mkdir -p "$SOCKET_DIR"

# --- 初回のみ initdb (trust認証・プロジェクト内に閉じたDB) ---
if [ ! -f "$DATA_DIR/PG_VERSION" ]; then
  echo "▶ initializing project database..."
  "$PGBIN/initdb" -D "$DATA_DIR" -U postgres --auth=trust -E UTF8 >/dev/null
fi

port_in_use() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && { exec 3>&- 3<&-; return 0; } || return 1
}

# --- 既に起動済みならそのポートを再利用、なければ空きポートで起動 ---
if [ -f "$DATA_DIR/postmaster.pid" ] && "$PGBIN/pg_ctl" -D "$DATA_DIR" status >/dev/null 2>&1; then
  PORT=$(sed -n '4p' "$DATA_DIR/postmaster.pid")
  echo "▶ project database already running on port $PORT"
else
  rm -f "$DATA_DIR/postmaster.pid"
  PORT=5438
  while port_in_use "$PORT"; do
    echo "▶ port $PORT is in use, trying $((PORT + 1)) ..."
    PORT=$((PORT + 1))
  done
  echo "▶ starting project database on port $PORT ..."
  "$PGBIN/pg_ctl" -D "$DATA_DIR" -l "$DATA_DIR/server.log" \
    -o "-p $PORT -k \"$SOCKET_DIR\" -c listen_addresses=127.0.0.1" start >/dev/null
fi

"$PGBIN/createdb" -h 127.0.0.1 -p "$PORT" -U postgres huandaonews 2>/dev/null || true
echo "▶ database 'huandaonews' ready"

# --- .env の DATABASE_URL をこのDBに向ける(他の行は保持) ---
URL="postgresql://postgres@127.0.0.1:${PORT}/huandaonews"
if [ ! -f .env ]; then
  AUTH_SECRET=$(openssl rand -base64 32)
  PREVIEW_SECRET=$(openssl rand -hex 16)
  cat > .env <<EOF
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
AUTH_SECRET="${AUTH_SECRET}"
PREVIEW_SECRET="${PREVIEW_SECRET}"
EOF
fi
grep -v '^DATABASE_URL=' .env > .env.new || true
printf 'DATABASE_URL="%s"\n' "$URL" | cat - .env.new > .env
rm -f .env.new
echo "▶ DATABASE_URL = $URL"

# --- 依存・スキーマ・シード ---
if [ ! -d node_modules ]; then
  echo "▶ pnpm install..."
  pnpm install
fi
echo "▶ pushing schema..."
pnpm prisma db push
echo "▶ seeding sample data..."
pnpm db:seed

echo ""
echo "════════════════════════════════════════════════════════"
echo "  ✅ Open:  http://localhost:3000"
echo "     (ポートが使用中の場合は下に表示される Local: の URL)"
echo "     管理画面: /admin (admin@huandaonews.com / admin1234)"
echo "     DB停止:   $PGBIN/pg_ctl -D .pgdata stop"
echo "════════════════════════════════════════════════════════"
echo ""

exec pnpm dev
