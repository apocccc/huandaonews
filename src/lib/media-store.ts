import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";

const MAX_WIDTH = 1600;
const MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024;

export type StoredMedia = { id: string; url: string; width: number; height: number };

/**
 * 画像バッファをWebP変換・リサイズして保存し、Media レコードを作成する。
 * Vercel Blob(トークンがあれば)またはローカル public/uploads へ保存。
 */
export async function storeImage(
  input: Buffer,
  alt: string,
  uploadedBy: string,
  subdir = "media"
): Promise<StoredMedia> {
  const webp = await sharp(input)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const meta = await sharp(webp).metadata();

  const filename = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.webp`;

  let url: string;
  if (
    process.env.R2_BUCKET &&
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_PUBLIC_BASE_URL
  ) {
    // Cloudflare R2 (S3互換)。公開画像はカスタムドメイン(img.*)から配信
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    const key = `${subdir}/${filename}`;
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: webp,
        ContentType: "image/webp",
        ContentDisposition: "inline",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    url = `${process.env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  } else if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`${subdir}/${filename}`, webp, {
      access: "public",
      contentType: "image/webp",
    });
    url = blob.url;
  } else {
    const dir = path.join(process.cwd(), "public", "uploads", subdir);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), webp);
    url = `/uploads/${subdir}/${filename}`;
  }

  const media = await prisma.media.create({
    data: {
      url,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      alt,
      mimeType: "image/webp",
      uploadedBy,
    },
  });

  return { id: media.id, url: media.url, width: media.width, height: media.height };
}

/** リモート画像をダウンロードして保存する。失敗時は null(取り込みを止めない) */
export async function storeRemoteImage(
  imageUrl: string,
  alt: string,
  uploadedBy: string,
  subdir = "rss"
): Promise<StoredMedia | null> {
  try {
    const res = await fetch(imageUrl, {
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "HuandaoNewsBot/1.0 (+https://huandaonews.com)" },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_DOWNLOAD_BYTES) return null;
    return await storeImage(buf, alt, uploadedBy, subdir);
  } catch (e) {
    console.error(`[media-store] failed to download ${imageUrl}:`, e);
    return null;
  }
}
