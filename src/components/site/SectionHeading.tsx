export function SectionHeading({
  children,
  as: Tag = "h2",
}: {
  children: React.ReactNode;
  /** ページ見出しとして使う場合は "h1"(h1 の中に h2 を入れ子にしない) */
  as?: "h1" | "h2";
}) {
  return (
    <Tag
      className={`flex items-center gap-2 font-black tracking-wide ${
        Tag === "h1" ? "text-2xl" : "text-lg"
      }`}
    >
      <span
        className={`inline-block w-1.5 rounded-sm bg-primary ${Tag === "h1" ? "h-6" : "h-5"}`}
        aria-hidden="true"
      />
      {children}
    </Tag>
  );
}
