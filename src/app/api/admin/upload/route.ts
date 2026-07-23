import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { storeImage } from "@/lib/media-store";

export const runtime = "nodejs";

/** 管理画面からの画像アップロード(WebP変換して保存) */
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
  const media = await storeImage(input, alt, session.user.id);
  return NextResponse.json({ id: media.id, url: media.url });
}
