import { absoluteUrl } from "@/lib/site";

/**
 * 主要AIクローラーを明示的に許可(引用される露出を優先する方針)。
 * /admin とプレビューURLは全クローラー禁止。
 */
const AI_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "Claude-Web",
  "PerplexityBot",
  "Google-Extended",
  "CCBot",
  "Applebot-Extended",
];

export function GET() {
  const aiBlocks = AI_CRAWLERS.map(
    (ua) => `User-agent: ${ua}
Allow: /
Disallow: /admin
Disallow: /api
Disallow: /preview
`
  ).join("\n");

  const body = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api
Disallow: /preview
Disallow: /search

${aiBlocks}
Sitemap: ${absoluteUrl("/sitemap.xml")}
Sitemap: ${absoluteUrl("/news-sitemap.xml")}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400",
    },
  });
}
