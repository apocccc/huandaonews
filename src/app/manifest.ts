import type { MetadataRoute } from "next";
import { SITE_NAME_ZH } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME_ZH,
    short_name: SITE_NAME_ZH,
    description: "面向台灣讀者的綜合新聞與生活資訊網站",
    lang: "zh-Hant",
    start_url: "/",
    display: "browser",
    background_color: "#FFFFFF",
    theme_color: "#D7263D",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
