import type { Metadata } from 'next';
import Dashboard from '../components/Dashboard';

export const metadata: Metadata = {
  title: "FOMO Indexes Dashboard",
  description:
    "Live smart-money index weights, rebalance signals, arbitrage opportunities and backtest results.",
  openGraph: {
    title: "FOMO Indexes Dashboard",
    description:
      "Live smart-money index weights, rebalance signals, arbitrage opportunities and backtest results.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "FOMO Indexes Dashboard",
    description:
      "Live smart-money index weights, rebalance signals, arbitrage opportunities and backtest results.",
  },
};

export default function Home() {
  return <Dashboard />;
}
