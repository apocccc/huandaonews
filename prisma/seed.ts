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

function doc(paragraphs: (string | { h2: string })[]) {
  return {
    type: "doc",
    content: paragraphs.map((p) =>
      typeof p === "string"
        ? { type: "paragraph", content: [{ type: "text", text: p }] }
        : {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: p.h2 }],
          }
    ),
  };
}

function dateStamp(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .replace(/-/g, "");
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

type SeedArticle = {
  category: string;
  slugBase: string;
  title: string;
  lead: string;
  body: (string | { h2: string })[];
  publishedAt: Date;
  isBreaking?: boolean;
  isPinned?: boolean;
  prSourceName?: string;
  tags?: { slug: string; nameZh: string }[];
};

const ARTICLES: SeedArticle[] = [
  {
    category: "politics",
    slugBase: "taipei-mrt-fare-review",
    title: "北捷票價審議進入最後階段 明年可能微調 常客優惠方案同步檢討",
    lead: "台北捷運票價審議進入最後階段,市府表示將於年底前公布結論,常客優惠與定期票方案也將同步檢討,通勤族權益成為關注焦點。",
    body: [
      "台北捷運票價費率審議近期進入最後階段,台北市政府交通局表示,審議委員會已完成多輪討論,預計於年底前對外公布結論。",
      "官員指出,本次審議除基本費率外,也將常客優惠、定期票與轉乘優惠一併納入檢討,希望在營運成本與通勤族負擔之間取得平衡。",
      { h2: "通勤族最關心的三個問題" },
      "第一,基本票價是否調整;第二,現行常客優惠回饋級距會否改變;第三,公共運輸定期票的適用範圍是否擴大。",
      "多個通勤族團體表示,希望市府在做出決定前舉辦公聽會,充分聽取民意。交通局回應,將在結論公布前安排說明會,並於官網公開試算工具。",
      "本刊將持續追蹤審議進度,並在結論公布後第一時間整理對通勤族的實際影響。",
    ],
    publishedAt: hoursAgo(2),
    isBreaking: true,
    isPinned: true,
    tags: [
      { slug: "taipei-mrt", nameZh: "台北捷運" },
      { slug: "commute", nameZh: "通勤" },
    ],
  },
  {
    category: "business",
    slugBase: "semiconductor-export-record",
    title: "半導體出口再創新高 上半年成長逾兩成 供應鏈布局持續南移",
    lead: "台灣半導體出口上半年再創歷史新高,年增率超過兩成。業界指出,先進製程需求強勁,同時供應鏈布局持續向南部科學園區擴展。",
    body: [
      "根據最新統計,台灣半導體產品出口金額於上半年再創歷史新高,較去年同期成長逾兩成,占整體出口比重進一步提升。",
      "分析師指出,人工智慧應用帶動先進製程晶片需求強勁,高效能運算與車用晶片訂單同步成長,是推升出口的主要動力。",
      { h2: "南部科學園區成為新聚落" },
      "隨著主要晶圓廠在台南、高雄擴建新廠,封裝測試與材料供應商也加速南移,南部科學園區的就業人數與周邊房市備受關注。",
      "業界人士提醒,全球景氣與匯率波動仍是下半年變數,但整體而言,台灣在全球半導體供應鏈中的關鍵地位短期內難以撼動。",
    ],
    publishedAt: hoursAgo(5),
    isPinned: true,
    tags: [
      { slug: "semiconductor", nameZh: "半導體" },
      { slug: "export", nameZh: "出口" },
    ],
  },
  {
    category: "life",
    slugBase: "night-market-guide-2026",
    title: "2026 夜市攻略:從士林到六合 十大必吃攤位一次整理",
    lead: "夜市是台灣生活文化的縮影。本文整理北中南十大夜市的必吃攤位與交通方式,從士林夜市到高雄六合夜市,一篇看懂怎麼吃最道地。",
    body: [
      "夜市不只是觀光景點,更是台灣人日常生活的一部分。本文從北到南整理十大夜市的必吃攤位,並附上大眾運輸建議。",
      { h2: "台北:士林與饒河" },
      "士林夜市的豪大大雞排與大餅包小餅是經典入門款;饒河街夜市則以胡椒餅聞名,捷運松山站出站即達,動線單純適合初訪者。",
      { h2: "台中:逢甲商圈" },
      "逢甲夜市以創新小吃著稱,近年多家排隊名店從這裡發跡。建議平日傍晚前往,避開週末人潮。",
      { h2: "高雄:六合與瑞豐" },
      "六合夜市鄰近捷運美麗島站,以海鮮粥與木瓜牛奶聞名;在地人則更常去瑞豐夜市,攤位密度高、價格實在。",
      "無論你是觀光客還是在地人,夜市的魅力在於邊走邊吃的自由。記得攜帶環保餐具,一起讓夜市更永續。",
    ],
    publishedAt: hoursAgo(8),
    tags: [
      { slug: "night-market", nameZh: "夜市" },
      { slug: "food", nameZh: "美食" },
    ],
  },
  {
    category: "tech",
    slugBase: "ai-assistant-taiwan-startups",
    title: "台灣新創搶進 AI 助理市場 繁中語料成為關鍵競爭力",
    lead: "生成式 AI 帶動新一波創業潮,多家台灣新創鎖定繁體中文 AI 助理市場。業者指出,高品質繁中語料與在地知識是與國際大廠差異化的關鍵。",
    body: [
      "生成式 AI 應用持續升溫,台灣新創圈今年明顯將資源集中在 AI 助理與企業導入服務,鎖定金融、醫療與電商場景。",
      "多位創辦人指出,國際大廠的模型在繁體中文與台灣在地知識上仍有落差,高品質的繁中語料庫與客製化能力,成為台灣團隊的競爭利基。",
      { h2: "企業導入需求快速成長" },
      "顧問業者觀察,過去一年企業對內部知識庫問答、客服自動化的詢問量成長數倍,但同時也更重視資料安全與地端部署選項。",
      "法規面上,主管機關正在研擬 AI 基本法草案,新創業者普遍希望在個資保護與創新之間取得務實平衡。",
    ],
    publishedAt: hoursAgo(11),
    tags: [
      { slug: "ai", nameZh: "AI" },
      { slug: "startup", nameZh: "新創" },
    ],
  },
  {
    category: "travel",
    slugBase: "hualien-slow-travel",
    title: "花蓮慢旅提案:三天兩夜的縱谷線 稻浪、溫泉與部落餐桌",
    lead: "不趕行程的花蓮玩法:沿著花東縱谷安排三天兩夜,從富里稻浪、瑞穗溫泉到部落餐桌體驗,適合想要放慢腳步的旅人。",
    body: [
      "說到花蓮,多數人想到太魯閣與七星潭,但花東縱谷的慢旅路線,更適合想遠離人潮的旅人。",
      { h2: "第一天:富里與池上邊界" },
      "從花蓮車站租車南下,沿台9線經過鳳林、光復,傍晚抵達富里。金黃稻浪與中央山脈的景色,是縱谷線最經典的畫面。",
      { h2: "第二天:瑞穗溫泉與咖啡莊園" },
      "瑞穗的黃金湯溫泉富含鐵質,搭配舞鶴台地的咖啡莊園巡禮,下午在茶園間散步,晚上入住溫泉旅宿。",
      { h2: "第三天:部落餐桌體驗" },
      "近年多個阿美族部落推出餐桌體驗,由族人帶領採集野菜、認識傳統食材,一頓飯吃進土地的故事。建議提前一週預約。",
      "回程若搭火車,記得選靠山側座位,縱谷的景色會一路陪你到台北。",
    ],
    publishedAt: hoursAgo(20),
    tags: [
      { slug: "hualien", nameZh: "花蓮" },
      { slug: "slow-travel", nameZh: "慢旅" },
    ],
  },
  {
    category: "society",
    slugBase: "typhoon-preparedness-checklist",
    title: "颱風季前必看:居家防颱檢查清單與最新停班停課查詢方式",
    lead: "颱風季即將到來,本文整理居家防颱檢查清單、避難包準備要點,以及停班停課資訊的官方查詢管道,一次收藏備用。",
    body: [
      "中央氣象署預估今年颱風生成數量接近常年平均,提醒民眾提前做好防颱準備。",
      { h2: "居家檢查五要點" },
      "一、檢查門窗與排水孔;二、固定陽台盆栽與雜物;三、準備三天份飲用水與乾糧;四、確認手電筒與行動電源電量;五、留意低窪地區停車資訊。",
      { h2: "停班停課這樣查" },
      "停班停課資訊以行政院人事行政總處網站為準,各縣市政府也會透過官方社群同步公告。提醒民眾避免轉傳未經證實的訊息。",
      "防災準備平時做,颱風來時才不慌。建議將本清單存入手機備忘錄,每年颱風季前檢查一次。",
    ],
    publishedAt: hoursAgo(26),
    tags: [{ slug: "typhoon", nameZh: "颱風" }],
  },
  {
    category: "sports",
    slugBase: "cpbl-attendance-milestone",
    title: "中職觀眾人數創開季新高 主場經營與應援文化成長雙引擎",
    lead: "中華職棒本季進場人數持續攀升,單週觀眾創開季以來新高。球團主場經營升級與應援文化出圈,被視為帶動買氣的兩大引擎。",
    body: [
      "中華職棒本季買氣持續升溫,上週各主場合計進場人數創下開季以來單週新高,多場比賽門票完售。",
      "球團近年強化主場經營,從餐飲、周邊商品到親子區規劃都更加精緻,吸引許多首次進場的觀眾。",
      { h2: "應援文化成為城市風景" },
      "啦啦隊與應援曲在社群平台上的高討論度,讓職棒觀賽成為年輕族群的休閒選項之一,也帶動客隊球迷跨城市移動的「遠征」風潮。",
      "聯盟表示,下半季將持續推動主題日活動,並研議擴大電子票證與快速入場通道,改善尖峰時段的進場體驗。",
    ],
    publishedAt: hoursAgo(30),
    tags: [{ slug: "cpbl", nameZh: "中職" }],
  },
  {
    category: "health",
    slugBase: "summer-heatstroke-prevention",
    title: "高溫警戒天數增加 醫師提醒:三類族群最容易中暑 補水時機是關鍵",
    lead: "今夏高溫警戒天數明顯增加,急診中暑就診人次上升。醫師提醒戶外工作者、長者與慢性病患者是高風險族群,並說明正確的補水時機。",
    body: [
      "受極端高溫影響,今年夏天全台高溫警戒天數較往年增加,各大醫院急診的熱傷害就診人次也明顯上升。",
      "急診科醫師指出,戶外工作者、六十五歲以上長者與慢性病患者是中暑的三大高風險族群,家人應多加留意。",
      { h2: "補水不是渴了才喝" },
      "醫師強調,等到口渴才喝水通常已經輕微脫水,建議戶外活動時每15至20分鐘補充100至200毫升水分,並避開正午時段外出。",
      "若出現頭暈、噁心、皮膚乾熱無汗等症狀,應立即移至陰涼處降溫並就醫。",
    ],
    publishedAt: hoursAgo(36),
    tags: [{ slug: "heatstroke", nameZh: "中暑" }],
  },
  {
    category: "world",
    slugBase: "global-supply-chain-shift",
    title: "全球供應鏈重組加速 東南亞設廠潮下的台商新戰略",
    lead: "地緣政治推動全球供應鏈重組,東南亞成為設廠熱點。台商在越南、泰國與馬來西亞的布局策略,以及人才與物流的新挑戰,一文解析。",
    body: [
      "地緣政治風險與客戶分散生產的要求,讓全球供應鏈重組在過去兩年明顯加速,東南亞成為電子業設廠的首選區域。",
      { h2: "越南、泰國、馬來西亞三強鼎立" },
      "越南以電子組裝見長,泰國深耕汽車供應鏈,馬來西亞則在半導體封測有數十年基礎。台商多採「台灣接單、亞洲多點生產」的模式分散風險。",
      "不過,當地人才競爭激烈、基礎設施負載與跨國物流成本,是台商普遍面臨的三大挑戰。",
      "專家建議,企業在海外布局的同時,應保留台灣作為高階製程與研發中心的角色,形成梯次分工。",
    ],
    publishedAt: hoursAgo(44),
    tags: [{ slug: "supply-chain", nameZh: "供應鏈" }],
  },
  {
    category: "entertainment",
    slugBase: "taiwan-film-festival-lineup",
    title: "金馬影展前哨:今年最受期待的五部台灣電影 從紀錄片到類型片",
    lead: "影展季即將展開,本文整理今年最受影迷期待的五部台灣電影,從深耕多年的紀錄片導演新作,到挑戰類型片的新銳導演,台片能量持續累積。",
    body: [
      "隨著影展季接近,今年台灣電影的片單陸續公開,從紀錄片到類型片,展現創作能量的多元面貌。",
      "紀錄片方面,多位深耕議題多年的導演推出新作,題材涵蓋環境、勞動與家庭記憶,預料將是影展討論焦點。",
      { h2: "類型片的新嘗試" },
      "劇情片部分,幾位新銳導演挑戰懸疑與犯罪類型,並結合台灣在地場景與語言,被視為台片走向商業與作者平衡的重要嘗試。",
      "院線方面,發行商表示將配合影展熱度規劃上映檔期,希望把影展觀眾轉化為一般觀影人潮。",
    ],
    publishedAt: hoursAgo(50),
    tags: [{ slug: "film", nameZh: "電影" }],
  },
  {
    category: "local",
    slugBase: "tainan-old-street-renewal",
    title: "台南老街活化新模式:青年返鄉開店 與里民共管的「街區合作社」",
    lead: "台南多條老街近年出現新型態的活化模式:返鄉青年與在地里民組成街區合作社,共同決定店鋪型態與街區活動,避免過度觀光化。",
    body: [
      "老街活化常見的難題,是觀光人潮帶來租金上漲,反而擠走在地生活感。台南幾個街區近年嘗試的「街區合作社」模式,提供了另一種解法。",
      "由返鄉青年與里民共同組成的合作社,統一承租街區內的閒置店面,再以低於市場行情的租金,分租給符合街區定位的小店。",
      { h2: "不只是商店街,更是生活街" },
      "合作社也規劃固定比例的空間留給裁縫、五金等民生店家,讓街區同時服務觀光客與在地居民。",
      "文化局表示,正在評估將此模式納入老屋活化補助的參考案例,提供其他縣市借鏡。",
    ],
    publishedAt: hoursAgo(60),
    tags: [{ slug: "tainan", nameZh: "台南" }],
  },
  {
    category: "press-release",
    slugBase: "greenride-escooter-launch",
    title: "綠騎科技發表新一代共享電動機車 月底前於雙北試營運",
    lead: "綠騎科技今日發表新一代共享電動機車,搭載可交換電池與強化定位系統,預計月底前在台北市與新北市展開試營運,首波投放五百輛。",
    body: [
      "綠騎科技股份有限公司今日舉行發表會,推出新一代共享電動機車,並宣布月底前於台北市與新北市展開試營運。",
      "新車款搭載可交換式電池,單次滿電續航力達八十公里,並強化定位精度與安全帽感測功能。",
      { h2: "首波投放五百輛" },
      "公司表示,試營運期間將投放五百輛車輛,涵蓋捷運站周邊與大型商圈,並提供前一萬名註冊用戶免費騎乘金。",
      "綠騎科技指出,未來將視營運數據逐步擴大服務範圍,目標於明年進入桃園與台中市場。",
    ],
    publishedAt: hoursAgo(15),
    prSourceName: "綠騎科技股份有限公司",
    tags: [{ slug: "shared-mobility", nameZh: "共享運具" }],
  },
  {
    category: "business",
    slugBase: "housing-policy-qa",
    title: "新青安貸款政策再調整 五個關鍵問答看懂申請條件與影響",
    lead: "新青安貸款政策近期再度調整,本文以五個關鍵問答整理最新申請條件、利率補貼與轉貸限制,幫助首購族快速掌握重點。",
    body: [
      "政府針對新青年安心成家購屋貸款(新青安)政策近期再度調整,引發首購族關注。本文整理五個最常見的問題。",
      { h2: "Q1:誰符合申請資格?" },
      "申請人須年滿18歲,本人、配偶及未成年子女名下均無自有住宅,且購屋標的位於國內。",
      { h2: "Q2:利率與補貼怎麼算?" },
      "貸款利率由公股銀行提供優惠計息,政府補貼部分利息,實際數字依各銀行公告為準。",
      { h2: "Q3:這次調整了什麼?" },
      "本次調整重點在防杜人頭戶與轉租行為,新增切結自住條款,違者將取消優惠並追回補貼。",
      "專家提醒,貸款成數與寬限期雖具吸引力,仍應以家庭現金流可負擔為前提,避免過度槓桿。",
    ],
    publishedAt: hoursAgo(70),
    tags: [{ slug: "housing", nameZh: "房市" }],
  },
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

  console.log("Seeding users...");
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin1234";
  const admin = await prisma.user.upsert({
    where: { email: "admin@huandaonews.com" },
    create: {
      email: "admin@huandaonews.com",
      passwordHash: await bcrypt.hash(password, 12),
      name: "編輯部",
      slug: "editorial",
      role: "admin",
      bio: "環島新聞網編輯部",
    },
    update: {},
  });
  const reporter = await prisma.user.upsert({
    where: { email: "reporter@huandaonews.com" },
    create: {
      email: "reporter@huandaonews.com",
      passwordHash: await bcrypt.hash(password, 12),
      name: "林詠真",
      slug: "lin-yung-chen",
      role: "author",
      bio: "主跑交通與地方新聞。",
    },
    update: {},
  });

  console.log("Seeding articles...");
  for (const [i, a] of ARTICLES.entries()) {
    const category = await prisma.category.findUniqueOrThrow({
      where: { slug: a.category },
    });
    const slug = `${dateStamp(a.publishedAt)}-${a.slugBase}`;
    const author = i % 3 === 0 ? admin : reporter;

    const article = await prisma.article.upsert({
      where: { slug },
      create: {
        slug,
        title: a.title,
        lead: a.lead,
        body: doc(a.body),
        status: "published",
        publishedAt: a.publishedAt,
        categoryId: category.id,
        authorId: author.id,
        isBreaking: a.isBreaking ?? false,
        isPinned: a.isPinned ?? false,
        prSourceName: a.prSourceName ?? null,
        viewCount: Math.floor(5000 / (i + 1)),
      },
      update: {},
    });

    for (const tag of a.tags ?? []) {
      const t = await prisma.tag.upsert({
        where: { slug: tag.slug },
        create: tag,
        update: {},
      });
      await prisma.articleTag.upsert({
        where: { articleId_tagId: { articleId: article.id, tagId: t.id } },
        create: { articleId: article.id, tagId: t.id },
        update: {},
      });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
