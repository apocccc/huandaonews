"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { Link } from "@/i18n/navigation";

/**
 * ヘッダーのロゴ。トップページでのみ <h1> で包む(トップの唯一の h1)。
 * 他のページはページ固有の h1 があるため <div>。
 */
export function LogoHeading({
  name,
  nameEn,
  homeSuffix,
}: {
  name: string;
  nameEn: string;
  /** トップの h1 に続けて表示する補足(例: 「台灣即時新聞」) */
  homeSuffix: string;
}) {
  // [locale] レイアウト直下のセグメント。トップページ(page.tsx)のときだけ null
  // (usePathname は内部パス /zh-Hant を返すため判定に使わない)
  const segment = useSelectedLayoutSegment();
  const isHome = segment === null;
  const Tag = isHome ? "h1" : "div";
  return (
    <Tag className="shrink-0 leading-none">
      <Link href="/" className="flex items-baseline gap-2">
        <span className="text-[26px] font-black tracking-tight text-primary leading-none">
          {name}
        </span>
        {isHome ? (
          <span className="text-[12px] font-bold text-ink/70">｜{homeSuffix}</span>
        ) : null}
        <span className="hidden sm:inline text-[10px] font-medium uppercase tracking-widest text-gray">
          {nameEn}
        </span>
      </Link>
    </Tag>
  );
}
