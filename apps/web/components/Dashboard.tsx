'use client';

import { useEffect, useState } from 'react';
import { api, IndexState, Rebalance, Arbitrage } from '../lib/api';

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

export default function Dashboard() {
  const [index, setIndex] = useState<IndexState | null>(null);
  const [reb, setReb] = useState<Rebalance | null>(null);
  const [arb, setArb] = useState<Arbitrage | null>(null);
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
    load();
    const t = setInterval(load, 5 * 60_000);
    const c = setInterval(() => setClock(new Date().toUTCString()), 1000);
    return () => { clearInterval(t); clearInterval(c); };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0e0a] font-mono text-green-400">
      <header className="flex items-center justify-between border-b border-green-800 px-6 py-3">
        <span className="text-lg font-bold tracking-widest">TOKEN GOD INDEXES</span>
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
              <tr><th className="text-left">#</th><th className="text-left">TOKEN</th><th className="text-right">WEIGHT</th><th className="text-right">SM</th><th className="text-right">CORR</th><th className="text-right">WHALE%</th></tr>
            </thead>
            <tbody>
              {index?.tokens.slice(0, 10).map((t, i) => (
                <tr key={t.symbol} className="border-t border-green-950">
                  <td>{i + 1}</td><td className="text-cyan-300">{t.symbol}</td>
                  <td className="text-right">{t.weight}%</td>
                  <td className="text-right">{t.smartMoneyScore}</td>
                  <td className="text-right">{t.correlation.toFixed(2)}</td>
                  <td className="text-right">{t.whaleConcentration}%</td>
                </tr>
              ))}
            </tbody>
          </table>
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
