import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ResultPages } from '../hooks/useResultPages';

/**
 * How you deal through a want card's answers: one control at each edge, and
 * the card's number.
 *
 * This started as a strip along the bottom of the card, which cost a whole row
 * of the card's height to say something the card only needs when somebody is
 * looking for it — and a want card's height is the scarcest thing on the board.
 * So it OVERLAYS instead: absolutely positioned, `pointer-events-none` except
 * on the two controls, so the face underneath keeps every pixel and stays
 * clickable everywhere else.
 *
 * Each control is at the edge it deals toward — left goes back through the
 * answers, right comes forward — and simply is not there when there is nothing
 * that way, which says where you are in the deck without a disabled button to
 * read. The number is the only text: which card of how many, newest first, so
 * 1/4 is now and 4/4 is the oldest answer kept.
 *
 * Nothing here at all on a card with a single answer, which is most of the
 * board.
 */
export const ResultPager: React.FC<{ pages: ResultPages }> = ({ pages }) => {
  const { page, turn } = pages;
  const total = pages.pages.length;
  if (total < 2) return null;

  // The card underneath opens a panel on click; dealing a card is not that.
  const stop = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); };

  const edge =
    'pointer-events-auto flex h-6 w-5 items-center justify-center rounded ' +
    'bg-black/25 text-white/85 backdrop-blur-[1px] transition-colors ' +
    'hover:bg-black/45 hover:text-white';

  return (
    <div className="absolute inset-0 z-[25] pointer-events-none">
      {page < total - 1 && (
        <button
          type="button"
          title="前の答え"
          onClick={(e) => { stop(e); turn(1); }}
          onMouseDown={stop}
          className={`${edge} absolute left-0 top-1/2 -translate-y-1/2 rounded-l-none`}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      )}

      {page > 0 && (
        <button
          type="button"
          title="次の答え"
          onClick={(e) => { stop(e); turn(-1); }}
          onMouseDown={stop}
          className={`${edge} absolute right-0 top-1/2 -translate-y-1/2 rounded-r-none`}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Which card of how many. Amber once you are off the front of the deck,
          the one place a remembered answer still says so in words — the tint on
          the face says it at a glance, this says it exactly. */}
      <span
        className={[
          'absolute bottom-0.5 left-1/2 -translate-x-1/2 rounded px-1',
          'text-[0.55rem] font-semibold tabular-nums leading-tight',
          page > 0
            ? 'bg-amber-500/25 text-amber-900 dark:text-amber-100'
            : 'bg-black/15 text-white/60 dark:text-white/60',
        ].join(' ')}
      >
        {page + 1}/{total}
      </span>
    </div>
  );
};
