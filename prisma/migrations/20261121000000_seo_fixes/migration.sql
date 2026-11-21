-- ===== スキーマ追加 =====
ALTER TABLE "Category" ADD COLUMN "description" TEXT;
ALTER TABLE "Media" ADD COLUMN "sha1" TEXT;
CREATE INDEX "Media_sha1_idx" ON "Media"("sha1");

-- ===== データ修復1: updatedAt の汚染を解消 =====
-- 閲覧数カウンターの更新で @updatedAt が毎回上書きされ、全記事の更新日時が
-- 「最近」になっていた。実際の最終更新 = max(公開日時, 最後のリビジョン保存) に戻す。
UPDATE "Article" a
SET "updatedAt" = GREATEST(
  COALESCE(a."publishedAt", a."createdAt"),
  COALESCE((SELECT MAX(r."createdAt") FROM "Revision" r WHERE r."articleId" = a."id"), a."createdAt")
);

-- ===== データ修復2: 新聞稿の二重公開を解消(リライト版に一本化) =====
-- 原文 (/news/press-release/{slug}) とリライト版 (/news/{cat}/{slug}-r) が両方公開されて
-- いた。原文を非公開にし、原文URL → リライト版URLへ恒久リダイレクトを登録する。
-- あわせてリライト版スラッグ末尾の内部サフィックス "-r" を外す。
CREATE TEMP TABLE pr_pairs AS
SELECT
  o."id"   AS orig_id,
  o."slug" AS orig_slug,
  oc."slug" AS orig_cat,
  c."id"   AS copy_id,
  c."slug" AS copy_slug,
  cc."slug" AS copy_cat,
  regexp_replace(c."slug", '-r$', '') AS new_slug
FROM "Article" o
JOIN "Category" oc ON oc."id" = o."categoryId"
JOIN "Article" c ON c."sourceGuid" = o."sourceGuid" || '#rewrite'
JOIN "Category" cc ON cc."id" = c."categoryId"
WHERE oc."slug" = 'press-release'
  AND o."status" = 'published'
  AND c."status" = 'published';

-- 原文を非公開化し、スラッグを退避(リライト版が元のスラッグを名乗れるように)
UPDATE "Article" a SET "status" = 'archived', "slug" = p.orig_slug || '-src'
FROM pr_pairs p WHERE a."id" = p.orig_id
  AND NOT EXISTS (SELECT 1 FROM "Article" x WHERE x."slug" = p.orig_slug || '-src');

-- リライト版の "-r" を外す(衝突する場合は据え置き)
UPDATE "Article" a SET "slug" = p.new_slug
FROM pr_pairs p WHERE a."id" = p.copy_id
  AND p.new_slug <> p.copy_slug
  AND NOT EXISTS (SELECT 1 FROM "Article" x WHERE x."slug" = p.new_slug AND x."id" <> p.copy_id);

-- 最終的なリライト版のパス
CREATE TEMP TABLE pr_final AS
SELECT p.*, '/news/' || p.copy_cat || '/' || a."slug" AS final_path
FROM pr_pairs p JOIN "Article" a ON a."id" = p.copy_id;

-- 原文URL → リライト版
INSERT INTO "Redirect" ("id", "fromPath", "toPath", "statusCode", "createdAt")
SELECT gen_random_uuid()::text, '/news/' || orig_cat || '/' || orig_slug, final_path, 301, NOW()
FROM pr_final
ON CONFLICT ("fromPath") DO UPDATE SET "toPath" = EXCLUDED."toPath";

-- 旧 "-r" 付きURL → 新URL
INSERT INTO "Redirect" ("id", "fromPath", "toPath", "statusCode", "createdAt")
SELECT gen_random_uuid()::text, '/news/' || copy_cat || '/' || copy_slug, final_path, 301, NOW()
FROM pr_final WHERE '/news/' || copy_cat || '/' || copy_slug <> final_path
ON CONFLICT ("fromPath") DO UPDATE SET "toPath" = EXCLUDED."toPath";

-- 既存リダイレクトが旧 "-r" URL を指していたら直接新URLへ(多段転送を防ぐ)
UPDATE "Redirect" r SET "toPath" = f.final_path
FROM pr_final f
WHERE r."toPath" = '/news/' || f.copy_cat || '/' || f.copy_slug
  AND r."toPath" <> f.final_path;

DROP TABLE pr_final;
DROP TABLE pr_pairs;

-- カテゴリー説明の初期値(未設定のものだけ。管理画面から編集可能)
UPDATE "Category" SET "description" = v.description
FROM (VALUES
  ('latest', '彙整各分類的最新新聞,隨時掌握台灣與國際的即時動態'),
  ('politics', '總統府、行政院、立法院與各政黨動態,以及選舉與兩岸政策的最新消息'),
  ('society', '社會事件、司法、交通、教育與公共安全等貼近日常的新聞'),
  ('local', '台灣各縣市的地方新聞、市政建設與在地生活資訊'),
  ('world', '國際政治、經濟與重大事件,以及與台灣相關的國際動向'),
  ('business', '台股、產業、企業動態、房市與總體經濟等財經新聞'),
  ('tech', '半導體、AI、手機、網路服務與新創產業的科技新聞'),
  ('life', '消費、天氣、美食、交通與生活實用資訊'),
  ('entertainment', '影視、音樂、綜藝與明星動態等娛樂新聞'),
  ('sports', '棒球、籃球、足球與國際賽事等體育新聞'),
  ('health', '醫療、疾病預防、飲食與健康生活資訊'),
  ('travel', '國內外旅遊景點、交通、住宿與活動資訊'),
  ('press-release', '企業與機構發布的新聞稿,內容由提供單位負責')
) AS v(slug, description)
WHERE "Category"."slug" = v.slug AND "Category"."description" IS NULL;
