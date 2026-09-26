'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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

  const W = 720;
  const priceH = 220;
  const volH = 44;
  const axisH = 16;
  const padT = 8;
  const padR = 56;
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

  const gridLevels = Array.from({ length: 5 }, (_, i) => priceMin + (range * i) / 4);

  const maPath = stats.ma7
    .map((v, i) => (v === null ? null : `${stats.ma7[i - 1] === null && i > 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${priceY(v).toFixed(1)}`))
    .filter((s): s is string => s !== null)
    .join(' ');

  const hovered = hover !== null ? candles[hover] : null;

  const trend = stats.chgPct >= 0;

  return (
    <div>
      <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-green-700">
        <span>
          {stats.chgPct >= 0 ? '▲' : '▼'} {stats.chgPct.toFixed(2)}% · close {fmtPrice(stats.last)} · hi {fmtPrice(stats.hi)} · lo {fmtPrice(stats.lo)}
        </span>
        <span className="text-green-600">— MA7</span>
        {hovered && (
          <span className="text-cyan-300">
            {hovered.date} · O {fmtPrice(hovered.open)} · H {fmtPrice(hovered.high)} · L {fmtPrice(hovered.low)} · C {fmtPrice(hovered.close)} · V {fmtUsd(hovered.volumeUsd)}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setHover(null)} onClick={() => setHover(null)}>
        {gridLevels.map((lvl, i) => (
          <line key={i} x1={padL} x2={W - padR} y1={priceY(lvl)} y2={priceY(lvl)} stroke="#0f3d0f" strokeWidth="1" />
        ))}
        <line x1={padL} y1={padT} x2={padL} y2={padT + priceH} stroke="#1a4d1a" strokeWidth="1" />
        <line x1={W - padR} y1={padT} x2={W - padR} y2={padT + priceH} stroke="#1a4d1a" strokeWidth="1" />
        {candles.map((c, i) => {
          const isUp = c.close >= (c.open ?? c.close);
          const color = isUp ? '#22c55e' : '#ef4444';
          const x0 = x(i) - candleW / 2;
          const yTop = priceY(Math.max(c.open ?? c.close, c.high));
          const yBottom = priceY(Math.min(c.open ?? c.close, c.low));
          const bodyTop = priceY(Math.max(c.open ?? c.close, c.close));
          const bodyBottom = priceY(Math.min(c.open ?? c.close, c.close));
          const bodyH = Math.max(1, bodyBottom - bodyTop);
          return (
            <g key={c.date} onMouseEnter={() => setHover(i)}>
              <line x1={x(i)} x2={x(i)} y1={yTop} y2={yBottom} stroke={color} strokeWidth="1" />
              <rect x={x0} y={bodyTop} width={candleW} height={bodyH} fill={color} />
            </g>
          );
        })}
        {maPath && <path d={maPath} fill="none" stroke="#06b6d4" strokeWidth="1.5" />}
        {candles.map((c, i) => {
          const volPct = (typeof c.volumeUsd === 'number' ? c.volumeUsd : 0) / stats.maxVol;
          const vy = volY(volPct);
          const vh = padT + priceH + volH - vy;
          return <rect key={`v-${c.date}`} x={x(i) - candleW / 2} y={vy} width={candleW} height={vh} fill="#14532d" />;
        })}
        {gridLevels.map((lvl, i) => (
          <text key={`p-${i}`} x={W - padR + 4} y={priceY(lvl) + 3} fill="#22c55e" fontSize="9" textAnchor="start">
            {fmtPrice(lvl)}
          </text>
        ))}
        {candles.map((c, i) => {
          const show = i % Math.max(1, Math.floor(n / 8)) === 0;
          if (!show) return null;
          return (
            <text key={`d-${c.date}`} x={x(i)} y={H - 2} fill="#15803d" fontSize="8" textAnchor="middle">
              {c.date.slice(5)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function RiskRow({ label, ind }: { label: string; ind: TokenRiskIndicator | null }) {
  if (!ind) return (
    <div className="flex items-center justify-between border-t border-green-950 py-2">
      <span className="text-green-700">{label}</span>
      <span className="text-green-800">—</span>
    </div>
  );

  const signalColor =
    ind.score === 'high' || ind.score === 'bearish'
      ? 'text-red-400'
      : ind.score === 'low' || ind.score === 'bullish'
        ? 'text-green-400'
        : 'text-amber-400';

  return (
    <div className="flex items-center justify-between border-t border-green-950 py-2">
      <span className="text-green-700">{label}</span>
      <div className={`text-right text-xs ${signalColor}`}>
        <div className="font-bold">{ind.score ?? '—'}</div>
        {ind.signal !== null && <div>signal {ind.signal.toFixed(2)}</div>}
        {ind.percentile !== null && <div className="text-green-600">p{ind.percentile.toFixed(0)}</div>}
      </div>
    </div>
  );
}

function RiskPanel({ risk }: { risk: TokenRisk | null }) {
  if (!risk) return null;
  if (risk.skipped) return (
    <section className="border border-green-800 bg-black/60 p-4 lg:col-span-3">
      <h2 className="mb-3 border-b border-green-900 pb-2 text-sm tracking-widest text-green-500">RISK / REWARD INDICATORS</h2>
      <p className="text-xs text-amber-400">skipped: {risk.reason ?? 'no reason'}</p>
    </section>
  );
  if (risk.error) return (
    <section className="border border-green-800 bg-black/60 p-4 lg:col-span-3">
      <h2 className="mb-3 border-b border-green-900 pb-2 text-sm tracking-widest text-green-500">RISK / REWARD INDICATORS</h2>
      <p className="text-xs text-red-400">error: {risk.error}</p>
    </section>
  );

  const riskByType = new Map(risk.riskIndicators?.map((i) => [i.type, i]) ?? []);
  const rewardByType = new Map(risk.rewardIndicators?.map((i) => [i.type, i]) ?? []);

  return (
    <section className="border border-green-800 bg-black/60 p-4 lg:col-span-3">
      <h2 className="mb-3 border-b border-green-900 pb-2 text-sm tracking-widest text-green-500">
        RISK / REWARD INDICATORS {risk.cached && <span className="ml-2 text-xs text-green-700">(cached)</span>}
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-red-400/70">Risk</div>
          <RiskRow label="Liquidity" ind={riskByType.get('token-liquidity') ?? null} />
          <RiskRow label="Concentration" ind={riskByType.get('token-concentration') ?? null} />
          <RiskRow label="Smart money holders" ind={riskByType.get('smart-money-token-holders') ?? null} />
          <RiskRow label="Supply inflation" ind={riskByType.get('token-supply-inflation') ?? null} />
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-green-400/70">Reward</div>
          <RiskRow label="Exchange inflows" ind={rewardByType.get('exchange-inflows') ?? null} />
          <RiskRow label="Exchange netflows" ind={rewardByType.get('exchange-netflows') ?? null} />
          <RiskRow label="Stablecoin inflows" ind={rewardByType.get('stablecoin-exchange-inflows') ?? null} />
        </div>
      </div>

      {risk.tokenInfo && (
        <div className="mt-3 border-t border-green-950 pt-2 text-xs text-green-600">
          {risk.tokenInfo.market_cap_group && <span>cap group: <span className="text-cyan-300">{risk.tokenInfo.market_cap_group}</span></span>}
          {risk.tokenInfo.is_stablecoin && <span className="ml-3 text-amber-400">stablecoin</span>}
        </div>
      )}
    </section>
  );
}

export default function TokenPageClient({ chain, address }: { chain: string; address: string }) {
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
            <section className="lg:col-span-1">
              <div className="grid grid-cols-2 gap-2">
                <StatCard label="Chain" value={chain} sub="token's home chain" />
                <StatCard
                  label="Price (30d)"
                  value={fmtPrice(data.price)}
                  sub={data.changePct !== null ? `${data.changePct > 0 ? '+' : ''}${data.changePct}% over 30d` : 'no data'}
                  className={data.changePct !== null ? (data.changePct >= 0 ? 'text-green-400' : 'text-red-400') : 'text-cyan-300'}
                />
                <StatCard label="Index Weight" value={data.weight !== null ? `${data.weight}%` : '—'} sub="share in the index" />
                <StatCard label="Market Cap" value={fmtUsd(data.marketCapUsd)} sub="Nansen estimate" />

                <StatCard
                  label="Smart Money Score"
                  value={data.smartMoneyScore !== null ? `${data.smartMoneyScore}/100` : '—'}
                  sub="Nansen netflow 24h: >50 inflow, <50 outflow"
                />
                <StatCard label="Correlation" value={data.correlation !== null ? data.correlation.toFixed(2) : '—'} sub="proxy 0–1: quality + liquidity" />
                <StatCard
                  label="Whale %"
                  value={data.whaleConcentration !== null ? `${data.whaleConcentration}%` : '—'}
                  sub="whale share among holders"
                />
                <StatCard label="Traders (24h)" value={fmtNum(data.traderCount)} sub="smart-money traders" />

                <StatCard
                  label="Netflow 24h"
                  value={fmtUsd(data.netflow24hUsd)}
                  sub="smart money sells / buys"
                  className={data.netflow24hUsd !== null ? (data.netflow24hUsd >= 0 ? 'text-green-400' : 'text-red-400') : ''}
                />
                <StatCard label="Netflow 7d" value={fmtUsd(data.netflow7dUsd)} className={data.netflow7dUsd !== null ? (data.netflow7dUsd >= 0 ? 'text-green-400' : 'text-red-400') : ''} />
                <StatCard label="Netflow 30d" value={fmtUsd(data.netflow30dUsd)} className={data.netflow30dUsd !== null ? (data.netflow30dUsd >= 0 ? 'text-green-400' : 'text-red-400') : ''} />
                <StatCard label="Age" value={data.tokenAgeDays !== null ? `${data.tokenAgeDays}d` : '—'} sub="token age" />
              </div>

              {data.sectors.length > 0 && (
                <div className="mt-2 border border-green-900 bg-black/40 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-green-700">Sector</div>
                  <div className="mt-1 text-xs text-cyan-300">{data.sectors.join(' · ')}</div>
                </div>
              )}
            </section>

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

            <RiskPanel risk={risk} />

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
                    {!meta && <li className="text-green-700">chain &lsquo;{chain}&rsquo; not supported (no links)</li>}
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
                      <li className="text-green-700">not in CEX mapping — use a DEX</li>
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
