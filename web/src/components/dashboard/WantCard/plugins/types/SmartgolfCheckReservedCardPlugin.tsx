import React from 'react';
import { CalendarCheck, CalendarX, ExternalLink } from 'lucide-react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { WantCardLayout } from '../../WantCardLayout';
import { CardFrame, CardFrameBadge, CardFrameTitle, CardFrameLine, CardFrameNote } from '../../CardFrame';

/**
 * Whether there is a booking, and if so where and when — the two questions this
 * want exists to answer, and nothing else.
 *
 * The eyecatch carries the answer at a glance from across the room; the store
 * and time are read, not skimmed, so they take the frame's title scale.
 */

/**
 * "北新宿店/両打席予約(Room02)" → "Room2".
 *
 * The bay is the part of next_room worth seeing beside the store — the rest
 * repeats the store name and the booking type, which the card already implies.
 * The leading zero goes: it is how the site writes it, not how anyone says it.
 */
function roomLabel(raw: string): string {
  const m = /Room\s*0*(\d+)/i.exec(raw);
  return m ? `Room${m[1]}` : '';
}

/**
 * Where to send somebody who points at the store name.
 *
 * Two sources, in this order, because the booking page is per store and not
 * derivable from its name (北新宿店 → smartgolf_kitashinjuku/3421038):
 *
 *  1. `next_url` — the href the site itself puts on "<店名> 打席予約ページ"
 *     on the reservations page, which main.py now reads into the reservation.
 *     This is the real source: it needs no list kept anywhere and is right for
 *     any store the user books.
 *  2. the type's `reservation-urls` label, a store → URL map. What answers the
 *     click for an answer recorded BEFORE next_url existed — every entry
 *     already in a card's deck — and if the site ever stops making that text a
 *     link.
 *
 * The label is read from metadata rather than state on purpose: paging the card
 * back replaces `state.current` with what that run found (useResultPages) and
 * leaves metadata alone, so the fallback reaches every card in the deck.
 */
const RESERVATION_URLS_LABEL = 'reservation-urls';

function reservationUrl(
  storeUrl: unknown,
  store: string,
  labels: Record<string, string> | undefined,
): string | undefined {
  if (typeof storeUrl === 'string' && storeUrl) return storeUrl;
  const raw = labels?.[RESERVATION_URLS_LABEL];
  if (!raw || !store) return undefined;
  try {
    const map = JSON.parse(raw) as Record<string, string>;
    const hit = map[store];
    return typeof hit === 'string' && hit ? hit : undefined;
  } catch {
    // A malformed map is a want type's typo, not something a card should
    // break on: the name simply is not a link.
    return undefined;
  }
}

/** "2026-08-08 12:00" → "8/8 12:00". The year is noise on a card this size. */
function shortWhen(raw: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/.exec(raw.trim());
  if (!m) return raw;
  return `${Number(m[2])}/${Number(m[3])} ${m[4]}`;
}

const SmartgolfCheckReservedContent: React.FC<WantCardPluginProps> = ({ want }) => {
  const cur = want.state?.current ?? {};

  const reserved = cur.is_reserved === true;
  const store = String(cur.next_store ?? '');
  const when = String(cur.next_datetime ?? '');
  const room = roomLabel(String(cur.next_room ?? ''));
  const url = reservationUrl(cur.next_url, store, want.metadata?.labels);

  /**
   * The store name is the way to the booking itself.
   *
   * Straight to a new tab rather than through the card's どこで開く？ overlay:
   * that overlay exists for a URL the card is ASKED to open, where "in the
   * card" is a real second option. This is a name somebody pointed at, and the
   * one thing they can have meant is the booking page.
   *
   * The click is stopped dead: the card underneath opens the detail panel, and
   * a link that also opened the panel would be two answers to one press.
   */
  const openReservation = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const storeName = url ? (
    <button
      type="button"
      onClick={openReservation}
      onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
      title="予約ページを開く"
      className="group inline-flex items-baseline gap-1 min-w-0 text-left
                 underline decoration-dotted decoration-current/40 underline-offset-[3px]
                 hover:decoration-solid hover:decoration-current"
    >
      <CardFrameTitle>{store || '—'}</CardFrameTitle>
      <ExternalLink className="w-[0.7em] h-[0.7em] flex-shrink-0 self-center opacity-40 group-hover:opacity-80" />
    </button>
  ) : (
    <CardFrameTitle>{store || '—'}</CardFrameTitle>
  );

  const content = (
    <CardFrame
      eyecatch={
        <CardFrameBadge
          color={reserved ? '#10b981' : '#9ca3af'}
          filled={reserved}
          icon={reserved
            ? <CalendarCheck className="w-[1.8em] h-[1.8em]" strokeWidth={2.5} />
            : <CalendarX className="w-[1.8em] h-[1.8em]" strokeWidth={2.5} />}
          caption={reserved ? '予約あり' : '予約なし'}
        />
      }
    >
      {reserved ? (
        <>
          <span className="flex items-baseline gap-1.5 min-w-0">
            {storeName}
            {room && (
              <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[0.7em] font-bold
                               bg-emerald-100 text-emerald-700
                               dark:bg-emerald-900/50 dark:text-emerald-300">
                {room}
              </span>
            )}
          </span>
          <CardFrameLine>{when ? shortWhen(when) : '—'}</CardFrameLine>
        </>
      ) : (
        <CardFrameNote>これから予約はありません</CardFrameNote>
      )}
    </CardFrame>
  );

  return <WantCardLayout content={content} />;
};

registerWantCardPlugin({
  types: ['smartgolf_check_reserved'],
  ContentSection: SmartgolfCheckReservedContent,
  hideFinalResult: true,
});
