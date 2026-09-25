'use client';

import { useEffect, useState } from 'react';
import { FOMO_ITEMS, FomoItem } from '../lib/fomo';

function pick(current: number | null): number {
  if (FOMO_ITEMS.length === 1) return 0;
  let i = Math.floor(Math.random() * FOMO_ITEMS.length);
  while (current !== null && i === current) {
    i = Math.floor(Math.random() * FOMO_ITEMS.length);
  }
  return i;
}

export default function FomoButton() {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState<number | null>(null);

  const openModal = () => {
    setIdx(pick(null));
    setOpen(true);
  };

  const reroll = () => setIdx(pick(idx));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const item: FomoItem | null = idx !== null ? FOMO_ITEMS[idx] : null;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="border border-red-500 bg-red-500/10 px-4 py-1.5 text-xs font-bold tracking-widest text-red-400 transition-colors hover:bg-red-500/30 hover:text-red-300"
      >
        ▲ FOMO
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="FOMO wisdom"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg border-2 border-red-500 bg-[#0a0e0a] p-6 shadow-[0_0_40px_rgba(239,68,68,0.35)]"
          >
            <div className="mb-4 flex items-center justify-between border-b border-red-900 pb-2">
              <span className="text-xs tracking-widest text-red-400">
                {item?.kind === 'quote' ? '⚠ ANTI-FOMO QUOTE' : '⚠ ANTI-FOMO TIP'}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-red-500 hover:text-red-300"
              >
                [ESC] ✕
              </button>
            </div>

            <blockquote className="text-base leading-relaxed text-green-300">
              “{item?.text}”
            </blockquote>
            {item?.author && (
              <p className="mt-3 text-right text-xs text-amber-400">— {item.author}</p>
            )}

            <div className="mt-6 flex justify-between text-xs">
              <button
                type="button"
                onClick={reroll}
                className="border border-green-700 px-3 py-1 text-green-400 transition-colors hover:bg-green-950"
              >
                ⟳ ANOTHER ONE
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="border border-red-700 px-3 py-1 text-red-400 transition-colors hover:bg-red-950/40"
              >
                I FEEL CALMER →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
