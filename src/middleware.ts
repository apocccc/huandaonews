import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // 静的ファイル・API・管理画面・OGP画像生成・フィード類(ドットを含むパス)は除外
  matcher: ["/((?!api|admin|og/|_next|_vercel|.*\\..*).*)"],
};
