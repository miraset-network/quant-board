'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, TokenDetails, TokenRisk, TokenRiskIndicator } from '@/lib/api';

const CHAIN_META: Record<string, { explorer: (a: string) => string; dexscreener: string; gecko: string }> = {
  ethereum: {
    explorer: (a) => `https://etherscan.io/token/${a}`,
    dexscreener: 'ethereum',
    gecko: 'ethereum',
  },
  solana: {
    explorer: (a) => `https://solscan.io/token/${a}`,
    dexscreener: 'solana',
    gecko: 'solana',
  },
  base: {
    explorer: (a) => `https://basescan.org/token/${a}`,
    dexscreener: 'base',
    gecko: 'base',
  },
  bsc: {
    explorer: (a) => `https://bscscan.com/token/${a}`,
    dexscreener: 'bsc',
    gecko: 'binance-smart-chain',
  },
  arbitrum: {
    explorer: (a) => `https://arbiscan.io/token/${a}`,
    dexscreener: 'arbitrum',
    gecko: 'arbitrum-one',
  },
  optimism: {
    explorer: (a) => `https://optimistic.etherscan.io/token/${a}`,
    dexscreener: 'optimism',
    gecko: 'optimistic-ethereum',
  },
  polygon: {
    explorer: (a) => `https://polygonscan.com/token/${a}`,
    dexscreener: 'polygon',
    gecko: 'polygon-pos',
  },
  avalanche: {
    explorer: (a) => `https://snowtrace.io/token/${a}`,
    dexscreener: 'avalanche',
    gecko: 'avalanche',
  },
};

const CEX_BY_SYMBOL: Record<string, string[]> = {
  WBTC: ['binance', 'coinbase', 'kraken'],
  ZEC: ['binance', 'coinbase', 'kraken'],
  QNT: ['binance', 'kraken', 'kucoin'],
  PYTH: ['binance', 'okx', 'bybit'],
  OP: ['binance', 'coinbase', 'okx'],
  MASK: ['binance', 'okx'],
};

function fmtUsd(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtNum(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return n.toLocaleString();
}

function fmtPrice(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return '—';
  if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (p >= 1) return `$${p.toFixed(4)}`;
  if (p >= 0.001) return `$${p.toFixed(6)}`;
  return `$${p.toExponential(3)}`;
}

function StatCard({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className="border border-green-900 bg-black/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-green-700">{label}</div>
      <div className={`mt-1 text-sm ${className ?? 'text-cyan-300'}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-green-700">{sub}</div>}
    </div>
  );
}

function sma(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    const slice = values.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function PriceChart({ series }: { series: TokenDetails['series'] }) {
  const [hover, setHover] = useState<number | null>(null);

  const candles = useMemo(
    () =>
      series.filter(
        (p) =>
          typeof p.close === 'number' &&
          Number.isFinite(p.close) &&
          typeof p.high === 'number' &&
          typeof p.low === 'number' &&
          p.high >= p.low,
      ),
    [series],
  );

  const stats = useMemo(() => {
    if (candles.length < 2) return null;
    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const vols = candles.map((c) => (typeof c.volumeUsd === 'number' ? c.volumeUsd : 0));
    const hi = Math.max(...highs);
    const lo = Math.min(...lows);
    const maxVol = Math.max(...vols, 1);
    const ma7 = sma(closes, 7);
    const first = closes[0];
    const last = closes[closes.length - 1];
    const chgPct = first > 0 ? ((last - first) / first) * 100 : 0;
    return { closes, highs, lows, vols, hi, lo, maxVol, ma7, first, last, chgPct };
  }, [candles]);

  if (!stats) return <p className="text-sm text-amber-400">no price history</p>;

  // Layout: left price axis + candles + volume strip + right date axis
  const W = 720;
  const priceH = 220;
  const volH = 44;
  const axisH = 16;
  const padT = 8;
  const padR = 56; // price labels
  const padL = 6;
  const H = padT + priceH + volH + axisH + 4;

  const plotW = W - padL - padR;
  const n = candles.length;
  const stepX = plotW / Math.max(1, n);
  const candleW = Math.max(2, Math.min(14, stepX * 0.65));

  const priceMin = stats.lo;
  const priceMax = stats.hi;
  const range = priceMax - priceMin || 1;
  const priceY = (v: number) => padT + (1 - (v - priceMin) / range) * priceH;
  const volY = (v: number) => padT + priceH + 4 + (1 - v / stats.maxVol) * (volH - 4);

  const x = (i: number) => padL + i * stepX + stepX / 2;

  // grid lines at 5 horizontal levels
  const gridLevels = Array.from({ length: 5 }, (_, i) => priceMin + (range * i) / 4);

  // MA path (skip leading nulls)
  const maPath = stats.ma7
    .map((v, i) => (v === null ? null : `${stats.ma7[i - 1] === null && i > 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${priceY(v).toFixed(1)}`))
    .filter((s): s is string => s !== null)
    .join(' ');

  const hovered = hover !== null ? candles[hover] : null;

  const trend = stats.chgPct >= 0;

  return (
    <div>
      {/* tooltip legend */}
      <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-green-700">
        <span>
          {stats.chgPct >= 0 ? '▲' : '▼'} {stats.chgPct.toFixed(2)}% · close {fmtPrice(stats.last)} · hi {fmtPrice(stats.hi)} · lo {fmtPrice(stats.lo)}
        </span>
        <span className="text-green-600">— MA7</span>
        {hovered && (
          <span className="text-cyan-300">
            {hovered.date} · O {fmtPrice(hovered.open)} H {fmtPrice(hovered.high)} L {fmtPrice(hovered.low)} C {fmtPrice(hovered.close)} · vol {fmtUsd(hovered.volumeUsd)}
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const rx = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.max(0, Math.min(n - 1, Math.round((rx - padL - stepX / 2) / stepX)));
          setHover(i);
        }}
      >
        {/* price-area background */}
        <rect x={padL} y={padT} width={plotW} height={priceH} fill="#000000" opacity={0.4} />

        {/* horizontal gridlines + right price labels */}
        {gridLevels.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={padL + plotW} y1={priceY(v)} y2={priceY(v)} stroke="#14532d" strokeWidth={0.5} strokeDasharray="2 3" opacity={0.6} />
            <text x={padL + plotW + 4} y={priceY(v) + 3} fontSize={9} fill="#4ade80">{fmtPrice(v)}</text>
          </g>
        ))}

        {/* volume bars */}
        {candles.map((c, i) => {
          const v = typeof c.volumeUsd === 'number' ? c.volumeUsd : 0;
          const up = c.close >= (c.open ?? c.close);
          return (
            <rect
              key={`v${i}`}
              x={x(i) - candleW / 2}
              y={volY(v)}
              width={candleW}
              height={Math.max(1, padT + priceH + 4 + (volH - 4) - volY(v))}
              fill={up ? '#16a34a' : '#dc2626'}
              opacity={hover === null || hover === i ? 0.7 : 0.25}
            />
          );
        })}

        {/* candles */}
        {candles.map((c, i) => {
          const up = c.close >= (c.open ?? c.close);
          const color = up ? '#4ade80' : '#f87171';
          const bodyTop = priceY(Math.max(c.open ?? c.close, c.close));
          const bodyBot = priceY(Math.min(c.open ?? c.close, c.close));
          const bodyH = Math.max(1, bodyBot - bodyTop);
          const dim = hover !== null && hover !== i;
          return (
            <g key={`c${i}`} opacity={dim ? 0.3 : 1}>
              <line x1={x(i)} x2={x(i)} y1={priceY(c.high)} y2={priceY(c.low)} stroke={color} strokeWidth={1} />
              <rect x={x(i) - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={color} />
            </g>
          );
        })}

        {/* MA7 */}
        {maPath && <path d={maPath} fill="none" stroke="#22d3ee" strokeWidth={1.2} opacity={0.85} />}

        {/* hover crosshair */}
        {hover !== null && hovered && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + priceH + volH} stroke="#a3e635" strokeWidth={0.6} strokeDasharray="3 3" />
            <line x1={padL} x2={padL + plotW} y1={priceY(hovered.close)} y2={priceY(hovered.close)} stroke="#a3e635" strokeWidth={0.6} strokeDasharray="3 3" opacity={0.6} />
            <circle cx={x(hover)} cy={priceY(hovered.close)} r={3} fill="#a3e635" />
          </g>
        )}

        {/* date axis labels (first / mid / last) */}
        <text x={padL} y={padT + priceH + volH + 12} fontSize={9} fill="#4ade80">{candles[0].date}</text>
        <text x={x(Math.floor(n / 2))} y={padT + priceH + volH + 12} fontSize={9} fill="#4ade80" textAnchor="middle">
          {candles[Math.floor(n / 2)].date}
        </text>
        <text x={padL + plotW} y={padT + priceH + volH + 12} fontSize={9} fill={trend ? '#4ade80' : '#f87171'} textAnchor="end">
          {candles[n - 1].date}
        </text>
      </svg>
    </div>
  );
}

function riskColor(score: string | null): string {
  switch (score) {
    case 'low':
    case 'bullish':
      return 'bg-green-950 text-green-400 border-green-700';
    case 'medium':
    case 'neutral':
      return 'bg-amber-950 text-amber-400 border-amber-700';
    case 'high':
    case 'bearish':
      return 'bg-red-950 text-red-400 border-red-700';
    default:
      return 'bg-green-950 text-green-700 border-green-900';
  }
}

function RiskRow({ label, ind }: { label: string; ind: TokenRiskIndicator | null }) {
  if (!ind) {
    return (
      <div className="flex items-center justify-between border-b border-green-950 py-1.5 text-xs">
        <span className="text-green-700">{label}</span>
        <span className="text-green-800">—</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between border-b border-green-950 py-1.5 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-green-400">{label}</span>
        {ind.lastTriggerOn && <span className="text-[9px] text-green-800">since {ind.lastTriggerOn}</span>}
      </div>
      <div className="flex items-center gap-2">
        {ind.percentile !== null && (
          <div className="flex items-center gap-1">
            <div className="h-1 w-12 overflow-hidden rounded bg-green-950">
              <div
                className={`h-full ${ind.percentile >= 75 ? 'bg-red-400' : ind.percentile >= 50 ? 'bg-amber-400' : 'bg-green-400'}`}
                style={{ width: `${Math.min(100, ind.percentile)}%` }}
              />
            </div>
            <span className="w-7 text-right text-[10px] text-green-700">{ind.percentile.toFixed(0)}</span>
          </div>
        )}
        <span className={`inline-block border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${riskColor(ind.score)}`}>
          {ind.score ?? '?'}
        </span>
      </div>
    </div>
  );
}

function RiskPanel({ risk }: { risk: TokenRisk | null }) {
  if (!risk) {
    return (
      <section className="border border-green-800 bg-black/60 p-4 lg:col-span-3">
        <h2 className="mb-3 border-b border-green-900 pb-2 text-sm tracking-widest text-green-500">
          RISK / REWARD — NANSEN INDICATORS
        </h2>
        <p className="text-xs text-green-700">loading…</p>
      </section>
    );
  }

  if (risk.skipped) {
    return (
      <section className="border border-green-800 bg-black/60 p-4 lg:col-span-3">
        <h2 className="mb-3 border-b border-green-900 pb-2 text-sm tracking-widest text-green-500">
          RISK / REWARD — NANSEN INDICATORS
        </h2>
        <p className="text-xs text-amber-400">⚠ {risk.reason ?? 'skipped to save credits'}</p>
      </section>
    );
  }

  if (risk.error) {
    return (
      <section className="border border-green-800 bg-black/60 p-4 lg:col-span-3">
        <h2 className="mb-3 border-b border-green-900 pb-2 text-sm tracking-widest text-green-500">
          RISK / REWARD — NANSEN INDICATORS
        </h2>
        <p className="text-xs text-red-400">{risk.error}</p>
      </section>
    );
  }

  if (!risk.riskIndicators || risk.riskIndicators.length === 0) {
    return (
      <section className="border border-green-800 bg-black/60 p-4 lg:col-span-3">
        <h2 className="mb-3 border-b border-green-900 pb-2 text-sm tracking-widest text-green-500">
          RISK / REWARD — NANSEN INDICATORS
        </h2>
        <p className="text-xs text-green-700">нет данных по этому токену</p>
      </section>
    );
  }

  const riskByType = new Map(risk.riskIndicators.map((i) => [i.type, i]));
  const rewardByType = new Map((risk.rewardIndicators ?? []).map((i) => [i.type, i]));
  const overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' =
    risk.riskIndicators.some((i) => i.score === 'high') ? 'HIGH'
    : risk.riskIndicators.some((i) => i.score === 'medium') ? 'MEDIUM'
    : 'LOW';
  const overallClass = overallRisk === 'HIGH' ? 'text-red-400' : overallRisk === 'MEDIUM' ? 'text-amber-400' : 'text-green-400';

  return (
    <section className="border border-green-800 bg-black/60 p-4 lg:col-span-3">
      <div className="mb-3 flex items-baseline justify-between border-b border-green-900 pb-2">
        <h2 className="text-sm tracking-widest text-green-500">
          RISK / REWARD — NANSEN INDICATORS
          {risk.cached && <span className="ml-2 text-[10px] text-green-700">(cached, 24h TTL — экономим 5 cr)</span>}
        </h2>
        <span className={`text-xs font-bold ${overallClass}`}>RISK: {overallRisk}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-red-400/80">Risk (чем хуже — тем больше)</div>
          <RiskRow label="BTC reflexivity" ind={riskByType.get('btc-reflexivity') ?? null} />
          <RiskRow label="Liquidity risk" ind={riskByType.get('liquidity-risk') ?? null} />
          <RiskRow label="Concentration risk" ind={riskByType.get('concentration-risk') ?? null} />
          <RiskRow label="Supply inflation" ind={riskByType.get('token-supply-inflation') ?? null} />
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-cyan-400/80">Reward (чем лучше — тем больше alpha)</div>
          <RiskRow label="Chain TVL" ind={rewardByType.get('chain-tvl') ?? null} />
          <RiskRow label="Trading range" ind={rewardByType.get('trading-range') ?? null} />
          <RiskRow label="Price momentum" ind={rewardByType.get('price-momentum') ?? null} />
          <RiskRow label="Chain fees" ind={rewardByType.get('chain-fees') ?? null} />
          <RiskRow label="CEX flows" ind={rewardByType.get('cex-flows') ?? null} />
          <RiskRow label="Funding rate" ind={rewardByType.get('funding-rate') ?? null} />
        </div>
      </div>

      {risk.tokenInfo && (
        <div className="mt-3 border-t border-green-950 pt-2 text-[10px] text-green-700">
          {risk.tokenInfo.market_cap_group && <span>cap group: <span className="text-cyan-300">{risk.tokenInfo.market_cap_group}</span></span>}
          {risk.tokenInfo.is_stablecoin && <span className="ml-3 text-amber-400">stablecoin</span>}
        </div>
      )}
    </section>
  );
}

export default function TokenPage() {
  const params = useParams<{ chain: string; address: string }>();
  const chain = decodeURIComponent(params.chain ?? '');
  const address = decodeURIComponent(params.address ?? '');
  const [data, setData] = useState<TokenDetails | null>(null);
  const [risk, setRisk] = useState<TokenRisk | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!chain || !address) return;
    api
      .token(chain, address, 30)
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : 'fetch failed'));
    api.tokenRisk(chain, address).then(setRisk).catch(() => setRisk(null));
  }, [chain, address]);

  const meta = CHAIN_META[chain.toLowerCase()];
  const symbol = data?.symbol ?? '';
  const cexes = symbol ? (CEX_BY_SYMBOL[symbol.toUpperCase()] ?? []) : [];

  return (
    <div className="min-h-screen bg-[#0a0e0a] font-mono text-green-400">
      <header className="flex items-center justify-between border-b border-green-800 px-6 py-3">
        <div>
          <Link href="/" className="text-xs text-green-700 hover:text-green-400">
            ← FOMO INDEXES
          </Link>
          <div className="mt-1 text-lg font-bold tracking-widest">
            {symbol ? (
              <>
                <span className="text-cyan-300">{symbol}</span>
                <span className="ml-2 text-xs uppercase text-green-700">on {chain}</span>
              </>
            ) : (
              <span className="text-green-600">TOKEN DETAILS</span>
            )}
          </div>
        </div>
        <span className="text-xs text-green-700">{chain}/{address.slice(0, 6)}…{address.slice(-4)}</span>
      </header>

      <main className="grid gap-4 p-6 lg:grid-cols-3">
        {err && <p className="text-red-500 lg:col-span-3">API error: {err}</p>}
        {!data && !err && <p className="text-green-700 lg:col-span-3">loading…</p>}

        {data && (
          <>
            {/* Stats */}
            <section className="lg:col-span-1">
              <div className="grid grid-cols-2 gap-2">
                <StatCard label="Chain" value={chain} sub="on-chain дом токена" />
                <StatCard
                  label="Price (30d)"
                  value={fmtPrice(data.price)}
                  sub={data.changePct !== null ? `${data.changePct > 0 ? '+' : ''}${data.changePct}% за 30d` : 'нет данных'}
                  className={data.changePct !== null ? (data.changePct >= 0 ? 'text-green-400' : 'text-red-400') : 'text-cyan-300'}
                />
                <StatCard label="Index Weight" value={data.weight !== null ? `${data.weight}%` : '—'} sub="доля в индексе" />
                <StatCard label="Market Cap" value={fmtUsd(data.marketCapUsd)} sub="оценка Nansen" />

                <StatCard
                  label="Smart Money Score"
                  value={data.smartMoneyScore !== null ? `${data.smartMoneyScore}/100` : '—'}
                  sub="Nansen netflow 24h: >50 приток, <50 отток"
                />
                <StatCard label="Correlation" value={data.correlation !== null ? data.correlation.toFixed(2) : '—'} sub="proxy 0–1: quality + liquidity" />
                <StatCard
                  label="Whale %"
                  value={data.whaleConcentration !== null ? `${data.whaleConcentration}%` : '—'}
                  sub="доля whales среди держателей"
                />
                <StatCard label="Traders (24h)" value={fmtNum(data.traderCount)} sub="smart-money трейдеры" />

                <StatCard
                  label="Netflow 24h"
                  value={fmtUsd(data.netflow24hUsd)}
                  sub="продажи / покупки smart money"
                  className={data.netflow24hUsd !== null ? (data.netflow24hUsd >= 0 ? 'text-green-400' : 'text-red-400') : ''}
                />
                <StatCard label="Netflow 7d" value={fmtUsd(data.netflow7dUsd)} className={data.netflow7dUsd !== null ? (data.netflow7dUsd >= 0 ? 'text-green-400' : 'text-red-400') : ''} />
                <StatCard label="Netflow 30d" value={fmtUsd(data.netflow30dUsd)} className={data.netflow30dUsd !== null ? (data.netflow30dUsd >= 0 ? 'text-green-400' : 'text-red-400') : ''} />
                <StatCard label="Age" value={data.tokenAgeDays !== null ? `${data.tokenAgeDays}d` : '—'} sub="возраст токена" />
              </div>

              {data.sectors.length > 0 && (
                <div className="mt-2 border border-green-900 bg-black/40 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-green-700">Sector</div>
                  <div className="mt-1 text-xs text-cyan-300">{data.sectors.join(' · ')}</div>
                </div>
              )}
            </section>

            {/* Price chart (Nansen OHLCV) */}
            <section className="border border-green-800 bg-black/60 p-4 lg:col-span-2">
              <h2 className="mb-3 border-b border-green-900 pb-2 text-sm tracking-widest text-green-500">
                30D PRICE — NANSEN OHLCV ({data.windowStart} → {data.windowEnd})
              </h2>
              <PriceChart series={data.series} />
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead className="text-green-600">
                    <tr>
                      <th className="text-left">DATE</th>
                      <th className="text-right">OPEN</th>
                      <th className="text-right">HIGH</th>
                      <th className="text-right">LOW</th>
                      <th className="text-right">CLOSE</th>
                      <th className="text-right">VOLUME</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.series.slice(-14).reverse().map((p) => (
                      <tr key={p.date} className="border-t border-green-950">
                        <td className="text-green-700">{p.date}</td>
                        <td className="text-right">{fmtPrice(p.open)}</td>
                        <td className="text-right">{fmtPrice(p.high)}</td>
                        <td className="text-right">{fmtPrice(p.low)}</td>
                        <td className="text-right text-cyan-300">{fmtPrice(p.close)}</td>
                        <td className="text-right text-green-700">{fmtUsd(p.volumeUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.ohlcvError && (
                <p className="mt-2 text-xs text-amber-400">OHLCV error: {data.ohlcvError}</p>
              )}
            </section>

            {/* Risk / Reward indicators from Nansen TGM */}
            <RiskPanel risk={risk} />

            {/* Where to trade */}
            <section className="border border-green-800 bg-black/60 p-4 lg:col-span-3">
              <h2 className="mb-3 border-b border-green-900 pb-2 text-sm tracking-widest text-green-500">
                WHERE TO TRADE / EXPLORERS
              </h2>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-widest text-green-700">DEX (on-chain)</div>
                  <ul className="space-y-1 text-xs">
                    {meta && (
                      <>
                        <li>
                          <a
                            className="text-cyan-300 hover:underline"
                            href={`https://dexscreener.com/${meta.dexscreener}/${address}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            → Dexscreener ({chain})
                          </a>
                        </li>
                        <li>
                          <a
                            className="text-cyan-300 hover:underline"
                            href={`https://www.geckoterminal.com/${meta.gecko}/tokens/${address}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            → GeckoTerminal
                          </a>
                        </li>
                      </>
                    )}
                    {!meta && <li className="text-green-700">chain &lsquo;{chain}&rsquo; не поддержан (нет ссылок)</li>}
                  </ul>
                </div>

                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-widest text-green-700">CEX (centralized)</div>
                  <ul className="space-y-1 text-xs">
                    {cexes.length > 0 ? (
                      cexes.map((c) => (
                        <li key={c}>
                          <a
                            className="text-cyan-300 hover:underline"
                            href={`https://www.${c}.com/en/trade/${symbol.toUpperCase()}_USDT`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            → {c.charAt(0).toUpperCase() + c.slice(1)} {symbol.toUpperCase()}/USDT
                          </a>
                        </li>
                      ))
                    ) : (
                      <li className="text-green-700">в CEX-мэппинге нет — используй DEX</li>
                    )}
                  </ul>
                </div>

                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-widest text-green-700">Explorer</div>
                  <ul className="space-y-1 text-xs">
                    {meta && (
                      <li>
                        <a
                          className="text-cyan-300 hover:underline"
                          href={meta.explorer(address)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          → {chain} explorer
                        </a>
                      </li>
                    )}
                    <li>
                      <a
                        className="text-cyan-300 hover:underline"
                        href={`https://app.nansen.ai/token-god-mode?tokenAddress=${address}&chain=${chain}&tab=transactions`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        → Nansen Token God Mode
                      </a>
                    </li>
                  </ul>
                  <div className="mt-2 break-all border-t border-green-950 pt-2 text-[10px] text-green-700">
                    {address}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
