/**
 * Cronエンドポイントの認可。
 * 本番では CRON_SECRET が未設定の場合も「拒否」に倒す(fail-closed)。
 * 環境変数の消し忘れ・設定漏れで公開エンドポイント化することを防ぐ。
 */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // ローカル開発時のみ認証なしで許可
    return process.env.NODE_ENV !== "production" || !process.env.VERCEL;
  }
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
