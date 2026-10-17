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
 * read. Where you are in the deck is a row of dots, one per answer, laid as
 * the controls deal — the oldest at the left, now at the right — with the one
 * showing larger. A long deck shows the few around it, the dots at an end that
 * runs on shrinking to say there are more that way.
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

      {/* Which card of how many, as dots. Amber once you are off the front of
          the deck, as the tint on the face says. */}
      <div
        aria-label={`${page + 1}/${total}`}
        className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-[3px] rounded-full bg-black/15 px-1 py-[2px]"
      >
        {shownDots(page, total).map(({ i, size }) => (
          <span
            key={i}
            className={[
              'rounded-full transition-all',
              i === page
                ? page > 0 ? 'bg-amber-400' : 'bg-white'
                : 'bg-white/55',
            ].join(' ')}
            style={{ width: size, height: size }}
          />
        ))}
      </div>
    </div>
  );
};

/** At most this many dots; a longer deck shows the ones around the page. */
const MAX_DOTS = 7;
const DOT = 4;
const DOT_NOW = 7;
const DOT_MORE = 2.5;

/**
 * The dots drawn, left to right — oldest first, so the page index runs down —
 * each with its size: the page showing largest, a dot at an end with more
 * beyond it smallest.
 */
function shownDots(page: number, total: number): { i: number; size: number }[] {
  const n = Math.min(total, MAX_DOTS);
  const lo = Math.min(Math.max(0, page - Math.floor(n / 2)), total - n);
  const hi = lo + n - 1;
  const out: { i: number; size: number }[] = [];
  for (let i = hi; i >= lo; i--) {
    const more = (i === hi && hi < total - 1) || (i === lo && lo > 0);
    out.push({ i, size: i === page ? DOT_NOW : more ? DOT_MORE : DOT });
  }
  return out;
}
