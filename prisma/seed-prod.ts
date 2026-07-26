/**
 * 本番用の初期データ投入(サンプル記事なし)。
 * - カテゴリー13種
 * - 管理者アカウント(SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
 *
 * 実行: SEED_ADMIN_PASSWORD=... pnpm db:seed:prod
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CATEGORIES = [
  { slug: "latest", nameZh: "即時", nameEn: "Latest", order: 0 },
  { slug: "politics", nameZh: "政治", nameEn: "Politics", order: 1 },
  { slug: "society", nameZh: "社會", nameEn: "Society", order: 2 },
  { slug: "local", nameZh: "地方", nameEn: "Local", order: 3 },
  { slug: "world", nameZh: "國際", nameEn: "World", order: 4 },
  { slug: "business", nameZh: "財經", nameEn: "Business", order: 5 },
  { slug: "tech", nameZh: "科技", nameEn: "Tech", order: 6 },
  { slug: "life", nameZh: "生活", nameEn: "Life", order: 7 },
  { slug: "entertainment", nameZh: "娛樂", nameEn: "Entertainment", order: 8 },
  { slug: "sports", nameZh: "體育", nameEn: "Sports", order: 9 },
  { slug: "health", nameZh: "健康", nameEn: "Health", order: 10 },
  { slug: "travel", nameZh: "旅遊", nameEn: "Travel", order: 11 },
  { slug: "press-release", nameZh: "新聞稿", nameEn: "Press Releases", order: 12 },
];

async function main() {
  console.log("Seeding categories...");
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: { ...c, isVisible: true },
      update: { nameZh: c.nameZh, nameEn: c.nameEn, order: c.order },
    });
  }

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error(
      "✗ SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD を環境変数で指定してください"
    );
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("✗ 本番の管理者パスワードは12文字以上にしてください");
    process.exit(1);
  }

  console.log(`Seeding admin user (${email})...`);
  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    create: {
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      name: "編輯部",
      slug: "editorial",
      role: "admin",
      bio: "環島新聞網編輯部",
    },
    update: {},
  });

  console.log("Production seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
