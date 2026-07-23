import { createHmac, timingSafeEqual } from "crypto";

/** 未公開記事の署名付きプレビューURL用トークン(社外共有可) */
export function previewToken(articleId: string): string {
  const secret = process.env.PREVIEW_SECRET ?? process.env.AUTH_SECRET ?? "dev";
  return createHmac("sha256", secret).update(articleId).digest("hex").slice(0, 32);
}

export function verifyPreviewToken(articleId: string, token: string): boolean {
  const expected = previewToken(articleId);
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
