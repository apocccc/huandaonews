import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_WIDTH = 1600;

/**
 * 画像アップロード。WebPへ変換・リサイズし、Vercel Blob(トークンがあれば)
 * またはローカル public/uploads(開発時)へ保存する。
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const alt = (formData.get("alt") as string) ?? "";
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "not an image" }, { status: 400 });
  }

  const input = Buffer.from(await file.arrayBuffer());
  const webp = await sharp(input)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const meta = await sharp(webp).metadata();

  const filename = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.webp`;

  let url: string;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`media/${filename}`, webp, {
      access: "public",
      contentType: "image/webp",
    });
    url = blob.url;
  } else {
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), webp);
    url = `/uploads/${filename}`;
  }

  const media = await prisma.media.create({
    data: {
      url,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      alt,
      mimeType: "image/webp",
      uploadedBy: session.user.id,
    },
  });

  return NextResponse.json({ id: media.id, url: media.url });
}
