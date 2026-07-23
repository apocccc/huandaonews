import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // 静的ファイル・API・管理画面・フィード類(ドットを含むパス)は除外
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)"],
};
