import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import TokenPageClient from '@/components/TokenPageClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ chain: string; address: string }>;
}): Promise<Metadata> {
  const { chain, address } = await params;
  const symbol = address.slice(0, 6).toUpperCase();

  return {
    title: `${symbol} on ${chain} — FOMO Indexes`,
    description: `Token details, 30-day OHLCV chart, smart-money score and risk/reward indicators for ${symbol} on ${chain}.`,
    openGraph: {
      title: `${symbol} on ${chain} — FOMO Indexes`,
      description: `Token details, 30-day OHLCV chart, smart-money score and risk/reward indicators for ${symbol} on ${chain}.`,
      url: `/token/${chain}/${address}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${symbol} on ${chain} — FOMO Indexes`,
      description: `Token details, 30-day OHLCV chart, smart-money score and risk/reward indicators for ${symbol} on ${chain}.`,
    },
  };
}

export default async function TokenPage({
  params,
}: {
  params: Promise<{ chain: string; address: string }>;
}) {
  const { chain, address } = await params;

  if (!chain || !address) {
    notFound();
  }

  return <TokenPageClient chain={chain} address={address} />;
}
