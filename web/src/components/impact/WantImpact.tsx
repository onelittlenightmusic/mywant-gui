/**
 * Something landing on a want — an attack's hit, a mend, a freeze, a value
 * handed on — drawn over whatever shows that want (its tile on the board, its
 * card in the list), with its sound.
 *
 * Only the framework: the moments come from impactStore (the acting want's
 * `impact` field, turned round to the want it acted on), and each is drawn by
 * its kind's look (effects/, one file each) over the box this is put in — it
 * fills its positioned parent unless `style` places it — and goes when its
 * motions are over. The sound is the first motion's, made by the first
 * drawing of the moment (claimImpactSound).
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { subscribeImpacts, claimImpactSound, type ImpactMoment } from '@/stores/impactStore';
import { playMotion } from '@/utils/motion';
import { IMPACT_EFFECTS } from './effects';

const plain = (color: string) => color;

/** One moment, drawn until its motions are over. */
const Burst: React.FC<{ m: ImpactMoment; ink: (color: string) => string; onDone: () => void }> = ({ m, ink, onDone }) => {
  const effect = IMPACT_EFFECTS[m.kind];
  const parts = useRef<Array<Element | null>>([]);
  const done = useRef(onDone);
  done.current = onDone;
  const me = useRef({});

  useLayoutEffect(() => {
    const { motions } = effect;
    const silent = !claimImpactSound(m, me.current);
    const played = motions.map((mo, i) => playMotion(parts.current[i], mo, { silent: silent || i > 0 }));
    // Reduced motion: nothing to watch, so it is gone with its sound.
    const longest = Math.max(...motions.map(mo => mo.options.duration + (Number(mo.options.delay) || 0)));
    const t = setTimeout(() => done.current(), played.some(p => p.animation) ? longest + 40 : 0);
    return () => { clearTimeout(t); played.forEach(p => p.cancel()); };
  }, [m, effect]);

  const at = (i: number) => (el: Element | null) => { parts.current[i] = el; };
  return <effect.Draw m={m} at={at} ink={ink} />;
};

interface Props {
  /** The want acted on, by name — what an `impact`'s `to` names. */
  wantName: string | undefined;
  /**
   * What every look's colours are passed through — the board's ink (its
   * tiers) on the board; unchanged elsewhere. Must give back a plain hex.
   */
  ink?: (color: string) => string;
  /** Where it is drawn; by default over the whole of its positioned parent. */
  style?: React.CSSProperties;
  /** Told while something is being drawn — for a parent that has to lift it over its neighbours. */
  onActive?: (active: boolean) => void;
}

export const WantImpact: React.FC<Props> = ({ wantName, ink = plain, style, onActive }) => {
  const [moments, setMoments] = useState<ImpactMoment[]>([]);

  useEffect(() => {
    if (!wantName) return;
    // Only the newest few: a want under a storm of hits shows a storm, not a queue.
    return subscribeImpacts(wantName, m => setMoments(ms => [...ms.slice(-3), m]));
  }, [wantName]);

  const active = moments.length > 0;
  const told = useRef(onActive);
  told.current = onActive;
  useEffect(() => { told.current?.(active); }, [active]);

  if (!active) return null;
  return (
    // A size container: what a look says over the want is sized off it (cqh).
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', containerType: 'size', ...style }}>
      {moments.map(m => (
        <Burst key={m.id} m={m} ink={ink}
          onDone={() => setMoments(ms => ms.filter(x => x.id !== m.id))} />
      ))}
    </div>
  );
};
