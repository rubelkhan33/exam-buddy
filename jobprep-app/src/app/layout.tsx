import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, Space_Grotesk } from "next/font/google";
import ServiceWorker from "@/components/ServiceWorker";
import "./globals.css";

const hind = Hind_Siliguri({
  variable: "--font-hind",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
});

const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "JobPrep AI — চাকরির প্রস্তুতি",
  description: "টপিক ধরে পরীক্ষা, বিসিএস অগ্রাধিকার, ভুল প্রশ্নের রিভিউ আর অ্যানালিটিক্স",
  appleWebApp: { capable: true, title: "JobPrep AI", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b0f14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="bn" className={`${hind.variable} ${grotesk.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
