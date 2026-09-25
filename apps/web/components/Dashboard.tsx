'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, IndexState, Rebalance, Arbitrage, Backtest } from '../lib/api';

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-green-800 bg-black/60 p-4">
      <h2 className="mb-3 border-b border-green-900 pb-2 text-sm tracking-widest text-green-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

const SPARK_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

function sparkline(values: number[], width = 48): string {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = Math.max(1, Math.floor(values.length / width));
  const out: string[] = [];
  for (let i = 0; i < values.length; i += step) {
    const slice = values.slice(i, i + step);
    const v = slice.reduce((a, b) => a + b, 0) / slice.length;
    const idx = Math.min(SPARK_CHARS.length - 1, Math.floor(((v - min) / range) * (SPARK_CHARS.length - 1)));
    out.push(SPARK_CHARS[idx]);
  }
  return out.join('');
}

function BacktestView({ bt }: { bt: Backtest }) {
  const navSeries = useMemo(
    () => bt.series.map((p) => p.nav).filter((n): n is number => typeof n === 'number' && Number.isFinite(n)),
    [bt.series],
  );
  const line = sparkline(navSeries);
  const ret = typeof bt.returnPct === 'number' ? bt.returnPct : 0;
  const startNav = typeof bt.startNav === 'number' ? bt.startNav : 1;
  const endNav = typeof bt.endNav === 'number' ? bt.endNav : 1;
  const maxDd = typeof bt.maxDrawdownPct === 'number' ? bt.maxDrawdownPct : 0;
  const retClass = ret > 0 ? 'text-green-400' : ret < 0 ? 'text-red-400' : 'text-green-700';
  const ddClass = maxDd > 20 ? 'text-red-400' : maxDd > 10 ? 'text-amber-400' : 'text-green-400';
  const fmtPct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
  return (
    <div className="text-sm">
      {bt.status !== 'ok' || bt.series.length < 2 ? (
        <p className="text-amber-400">— {bt.message ?? bt.status ?? 'insufficient data'}</p>
      ) : (
        <>
          <p className="text-base">
            <span className={retClass}>{fmtPct(ret)}</span>
            <span className="text-green-700"> · NAV {startNav.toFixed(2)} → {endNav.toFixed(2)}</span>
          </p>
          <p className="text-xs text-green-700">
            window {bt.windowStart} → {bt.windowEnd} · universe {bt.universeSize}/{bt.requestedSize} · max DD <span className={ddClass}>{fmtPct(maxDd)}</span>
          </p>
          {line && <p className="my-2 break-all text-cyan-300">{line}</p>}
          {bt.bestDay && typeof bt.bestDay.pct === 'number' && (
            <p className="text-xs">
              best day: <span className="text-green-400">{bt.bestDay.date} {fmtPct(bt.bestDay.pct)}</span>
              {bt.worstDay && typeof bt.worstDay.pct === 'number' && (
                <> · worst: <span className="text-red-400">{bt.worstDay.date} {fmtPct(bt.worstDay.pct)}</span></>
              )}
            </p>
          )}
          <table className="mt-3 w-full text-xs">
            <thead className="text-green-600">
              <tr>
                <th className="text-left">SYMBOL</th>
                <th className="text-right">WT%</th>
                <th className="text-right">RETURN</th>
                <th className="text-right">#CANDLES</th>
              </tr>
            </thead>
            <tbody>
              {bt.legs.slice(0, 10).map((l) => (
                <tr key={l.symbol} className="border-t border-green-950">
                  <td className="text-cyan-300">{l.symbol}</td>
                  <td className="text-right">{l.weight}</td>
                  <td className={`text-right ${l.returnPct > 0 ? 'text-green-400' : l.returnPct < 0 ? 'text-red-400' : ''}`}>
                    {l.returnPct > 0 ? '+' : ''}{l.returnPct.toFixed(2)}%
                  </td>
                  <td className="text-right text-green-700">{l.candles}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [index, setIndex] = useState<IndexState | null>(null);
  const [reb, setReb] = useState<Rebalance | null>(null);
  const [arb, setArb] = useState<Arbitrage | null>(null);
  const [bt, setBt] = useState<Backtest | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [clock, setClock] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [i, r, a] = await Promise.all([api.index(), api.rebalance(), api.arbitrage()]);
        setIndex(i); setReb(r); setArb(a); setErr(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'fetch failed');
      }
    };
    const loadBt = async () => {
      try {
        setBt(await api.backtest(30));
      } catch {
        /* leave previous */
      }
    };
    load();
    loadBt();
    const t = setInterval(load, 30_000);
    const tBt = setInterval(loadBt, 5 * 60_000);
    const c = setInterval(() => setClock(new Date().toUTCString()), 1000);
    return () => { clearInterval(t); clearInterval(tBt); clearInterval(c); };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0e0a] font-mono text-green-400">
      <header className="flex items-center justify-between border-b border-green-800 px-6 py-3">
        <span className="text-lg font-bold tracking-widest">FOMO INDEXES</span>
        <span className="text-xs text-green-600">[LIVE] ⚡ {clock}</span>
      </header>

      <main className="grid gap-4 p-6 lg:grid-cols-2">
        <Panel title="INDEX STATUS">
          {err && <p className="text-red-500">API unreachable: {err} — is Nest on :3001?</p>}
          {index ? (
            <div className="text-sm">
              <p>Name: <span className="text-cyan-300">{index.indexName}</span></p>
              <p>Updated: {new Date(index.lastUpdate).toLocaleTimeString()}</p>
              <p>
                Status:{' '}
                <span className={
                  index.status === 'ok' ? 'text-green-400' :
                  index.status === 'nansen-empty' ? 'text-amber-400' :
                  'text-red-400'
                }>
                  {index.status}
                </span>
                {index.message && (
                  <span className="ml-2 text-amber-400">— {index.message}</span>
                )}
              </p>
              <p>
                Nansen calls:{' '}
                <span className="text-amber-400">{index.successfulCalls}</span>
                <span className="text-green-700"> / {index.apiCalls} total</span>
              </p>
              <p>
                Credits left:{' '}
                <span
                  className={
                    (index.credits?.totalRemaining ?? 0) <= 10
                      ? 'text-red-400'
                      : (index.credits?.totalRemaining ?? 0) <= 50
                        ? 'text-amber-400'
                        : 'text-cyan-300'
                  }
                >
                  {index.credits?.totalRemaining ?? '—'}
                </span>
                <span className="text-green-700">
                  {' '}
                  (included {index.credits?.includedRemaining ?? '—'} / plan {index.credits?.plan ?? '—'})
                </span>
              </p>
              <p className="text-green-700">
                Tokens: <span className="text-cyan-300">{index.tokens.length}</span>
              </p>
            </div>
          ) : <p>loading…</p>}
        </Panel>

        <Panel title="REBALANCE SIGNAL">
          {reb ? (
            <div className="text-sm">
              <p>Status: {reb.triggered
                ? <span className="text-amber-400">● TRIGGERED</span>
                : <span className="text-green-500">○ HOLD</span>}</p>
              <p>Drift: {reb.drift}% · Confidence: {(reb.confidence * 100).toFixed(0)}%</p>
              <ul className="mt-2">
                {reb.actions.slice(0, 5).map((a) => (
                  <li key={a.token} className={a.action === 'HOLD' ? '' : a.action === 'BUY' ? 'text-cyan-300' : 'text-red-400'}>
                    {a.action} {a.token} {a.change}
                  </li>
                ))}
              </ul>
            </div>
          ) : <p>loading…</p>}
        </Panel>

        <Panel title="TOP HOLDINGS">
          <table className="w-full text-xs">
            <thead className="text-green-600">
              <tr>
                <th className="text-left">#</th>
                <th className="text-left">TOKEN</th>
                <th className="text-left">CHAIN</th>
                <th className="text-right" title="Token share in the index (sums to 100%). Computed from SM + CORR + WHALE%">WEIGHT</th>
                <th className="text-right" title="Smart Money Score (0–100). Nansen: net inflow/outflow in USD from smart-money wallets over 24h. >50 = inflow, <50 = outflow">SM</th>
                <th className="text-right" title="Correlation proxy (0–1). Internal estimate of token 'quality': 50% smart-money trader count + 50% market cap. Closer to 1 = larger and more active">CORR</th>
                <th className="text-right" title="Whale concentration (0–100%). Share of large smart-money traders among holders. 100% = almost all holders are whales; low = retail">WHALE%</th>
                <th className="text-right" title="Smart money net flow over the last 24 hours, USD. Green = buying, red = selling">FLOW 24H</th>
              </tr>
            </thead>
            <tbody>
              {index?.tokens.slice(0, 10).map((t, i) => {
                const href = t.chain && t.tokenAddress ? `/token/${t.chain}/${t.tokenAddress}` : null;
                const flow = t.netflow24hUsd ?? 0;
                return (
                  <tr
                    key={t.symbol}
                    onClick={href ? () => router.push(href) : undefined}
                    title={href ? `View ${t.symbol} details on ${t.chain}` : undefined}
                    className={`group border-t border-green-950 transition-colors hover:bg-green-950/40 ${href ? 'cursor-pointer' : ''}`}
                  >
                    <td>{i + 1}</td>
                    <td className="text-cyan-300 group-hover:underline">{t.symbol}</td>
                    <td className="text-green-700">{t.chain ?? '—'}</td>
                    <td className="text-right">{t.weight}%</td>
                    <td className="text-right">{t.smartMoneyScore}</td>
                    <td className="text-right">{t.correlation.toFixed(2)}</td>
                    <td className="text-right">{t.whaleConcentration}%</td>
                    <td className={`text-right ${flow > 0 ? 'text-green-400' : flow < 0 ? 'text-red-400' : ''}`}>
                      {flow === 0
                        ? '—'
                        : `${flow > 0 ? '+' : '-'}$${Math.abs(flow) >= 1000 ? `${(Math.abs(flow) / 1000).toFixed(1)}k` : Math.abs(flow).toFixed(0)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 border-t border-green-950 pt-2 text-[10px] leading-relaxed text-green-700">
            <span className="text-green-600">SM</span> — smart-money score 0–100 (Nansen netflow 24h; &gt;50 inflow, &lt;50 outflow) ·{' '}
            <span className="text-green-600">CORR</span> — correlation/quality proxy 0–1 (trader count + market cap) ·{' '}
            <span className="text-green-600">WHALE%</span> — whale concentration (100% = all held by smart money) ·{' '}
            click a row — token details, chart, DEX/CEX
          </p>
        </Panel>

        <Panel title={`BACKTEST (${bt?.days ?? 30}D BUY-&-HOLD)`}>
          {bt ? (
            <BacktestView bt={bt} />
          ) : (
            <p className="text-sm text-green-700">loading backtest…</p>
          )}
        </Panel>

        <Panel title="ARBITRAGE OPPORTUNITIES">
          {arb && arb.opportunities.length > 0 ? (
            <table className="w-full text-xs">
              <thead className="text-green-600">
                <tr><th className="text-left">PAIR</th><th className="text-right">CORR</th><th className="text-right">DIV%</th><th className="text-left">SIGNAL</th><th className="text-right">EST</th></tr>
              </thead>
              <tbody>
                {arb.opportunities.map((o) => (
                  <tr key={o.pair} className="border-t border-green-950">
                    <td className="text-cyan-300">{o.pair}</td>
                    <td className="text-right">{o.correlation}</td>
                    <td className="text-right text-amber-400">{o.divergence}</td>
                    <td>{o.signal}</td>
                    <td className="text-right">{o.expectedReturn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-green-700">
              {arb?.message ?? (
                arb?.status === 'nansen-empty'
                  ? 'Nansen returned no index data — cannot scan pairs'
                  : 'no opportunities above threshold — corr≥0.85 · |div|≥5%'
              )}
            </p>
          )}
        </Panel>
      </main>

      <footer className="border-t border-green-800 px-6 py-2 text-center text-xs text-green-700">
        ⟳ auto-refresh 5m · backend: :3001 · Nansen-powered
      </footer>
    </div>
  );
}
