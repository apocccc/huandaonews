import { getTranslations } from "next-intl/server";

/** 記事ページのシェアボタン(X / Facebook / LINE)。JS不要のインテントリンク */
export async function ShareButtons({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  const t = await getTranslations();
  const u = encodeURIComponent(url);
  const text = encodeURIComponent(title);

  const items = [
    {
      name: "X",
      href: `https://twitter.com/intent/tweet?url=${u}&text=${text}`,
      bg: "bg-ink",
      label: "X",
    },
    {
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      bg: "bg-[#1877F2]",
      label: "f",
    },
    {
      name: "LINE",
      href: `https://social-plugins.line.me/lineit/share?url=${u}`,
      bg: "bg-[#06C755]",
      label: "LINE",
    },
  ];

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-gray">{t("labels.share")}</span>
      {items.map((item) => (
        <a
          key={item.name}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={item.name}
          className={`flex h-7 items-center justify-center rounded-sm px-2.5 text-[11px] font-black text-white opacity-90 hover:opacity-100 ${item.bg}`}
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}
