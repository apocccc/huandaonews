export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-black tracking-wide">
      <span className="inline-block h-5 w-1.5 rounded-sm bg-primary" aria-hidden="true" />
      {children}
    </h2>
  );
}
