import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JobPrep AI — চাকরির প্রস্তুতি",
    short_name: "JobPrep AI",
    description: "টপিক ধরে পরীক্ষা, বিসিএস অগ্রাধিকার, ভুল প্রশ্নের রিভিউ আর অ্যানালিটিক্স",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0f14",
    theme_color: "#0b0f14",
    lang: "bn",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
