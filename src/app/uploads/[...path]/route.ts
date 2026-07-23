import { readFile } from "fs/promises";
import path from "path";
import { notFound } from "next/navigation";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

/**
 * ランタイムにアップロードされた画像の配信。
 * Next.js は public/ 配下のファイルをビルド時点のものしか配信しないため、
 * 稼働中に保存された public/uploads/* はこのルートで配信する
 * (Vercel Blob 使用時はこのルートを通らない)。
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await params;
  const rel = parts.join("/");
  if (rel.includes("..") || rel.includes("\0")) notFound();

  const file = path.join(process.cwd(), "public", "uploads", rel);
  try {
    const buf = await readFile(file);
    const type =
      CONTENT_TYPES[path.extname(file).toLowerCase()] ??
      "application/octet-stream";
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    notFound();
  }
}
