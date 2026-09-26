import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FOMO Indexes — Smart Money Index Engine",
  description:
    "Daily-rebalancing crypto index powered by Nansen Analytics. Smart Money inflow rankings, correlation-adjusted weights, and statistical arbitrage signals.",
  keywords: ["crypto index", "smart money", "Nansen", "DeFi", "onchain analytics", "arbitrage", "quantitative"],
  authors: [{ name: "FOMO Indexes" }],
  creator: "FOMO Indexes",
  metadataBase: new URL("https://fomo-indexes.vercel.app"),
  openGraph: {
    title: "FOMO Indexes — Smart Money Index Engine",
    description:
      "Daily-rebalancing crypto index powered by Nansen Analytics. Smart Money inflow rankings, correlation-adjusted weights, and statistical arbitrage signals.",
    url: "/",
    siteName: "FOMO Indexes",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FOMO Indexes — Smart Money Index Engine",
    description:
      "Daily-rebalancing crypto index powered by Nansen Analytics. Smart Money inflow rankings, correlation-adjusted weights, and statistical arbitrage signals.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
