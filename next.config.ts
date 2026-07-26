import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    // Vercelの画像最適化(変換課金)を使わず、R2 + Cloudflare CDN から直接配信する。
    // 画像は取り込み時に WebP・最大1600px へ変換済みのため最適化は不要。
    // これにより /_next/image が任意URLのプロキシになる抜け道も塞がる。
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
