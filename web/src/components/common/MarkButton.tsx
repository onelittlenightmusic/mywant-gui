import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { ThingDot } from '@/components/common/ThingDot';
import { WantIcon } from '@/components/dashboard/WantIcon';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { useIconFont } from '@/hooks/useDisplaySettings';
import { useMarkJumpStore } from '@/stores/markJumpStore';
import { hasExtensionRoute } from '@/extensions/registry';
import { classNames } from '@/utils/helpers';
import type { IconFamily } from '@/components/dashboard/WantTypeVisuals';

/**
 * What a card turned out to be pointing at.
 *
 * One shape for every "and there it is" a card can carry: the thing this value
 * is, the want this field is published to or fed from, the global key it passes
 * through on the way. The badge changes its face with the kind — a thing wears
 * its own dot, a want wears its type's icon — and the press goes to whatever it
 * is showing.
 *
 * `via` is the direction the want lies in: an exposed field's want is
 * downstream of it, an imported field's is upstream, and the arrow says which
 * before the icon says who.
 */
export type Mark =
  | { kind: 'thing'; id?: string; name: string; color: string; icon?: string }
  | { kind: 'want'; id: string; name: string; wantType?: string; via?: 'expose' | 'import' }
  | { kind: 'global'; key: string; via: 'expose' | 'import' };

/** A stable React key for a mark — the thing/want it names, or the global key. */
export function markKey(mark: Mark): string {
  return mark.kind === 'global' ? `global:${mark.key}` : `${mark.kind}:${mark.id ?? mark.name}`;
}

const VIA_STYLE = {
  expose: { bg: 'bg-purple-500 hover:bg-purple-600', Icon: ArrowUpFromLine },
  import: { bg: 'bg-teal-500 hover:bg-teal-600', Icon: ArrowDownToLine },
} as const;

function markTitle(mark: Mark): string {
  switch (mark.kind) {
    case 'thing':
      return mark.id ? `${mark.name} — go to this thing on the canvas` : mark.name;
    case 'want':
      return mark.via === 'import'
        ? `Imported from "${mark.name}" — go to that want`
        : mark.via === 'expose'
          ? `Exposed to "${mark.name}" — go to that want`
          : `${mark.name} — go to this want`;
    case 'global':
      return mark.via === 'import'
        ? `Imported from the global "${mark.key}" — nothing reads it yet; open the global card`
        : `Exposed as the global "${mark.key}" — nothing reads it yet; open the global card`;
  }
}

/**
 * One mark, as the badge a card wears in its corner.
 *
 * The shape is the expose/import badge that has always sat there — a small
 * round mark on the card's top-right — because that is what these all are: a
 * card saying what else this value is, and offering to go there. What changes
 * is the face and where the press lands.
 *
 * Pressing is a journey, and the journeys are not the same: a thing and a want
 * are places on the board, so going to them means walking there (the character
 * is warped, the panel follows); a global key lives in the Global panel, so
 * going to it opens that panel on the card in question. Dashboard performs all
 * three — see markJumpStore for why the ask travels through a store.
 */
/**
 * Following a mark, wherever the press came from.
 *
 * The badge is one way in; the focused card's Y button is another (see
 * useCardGridNavigation). One journey, so one piece of code — a shortcut that
 * reimplemented the button's click is a shortcut that drifts from it.
 */
/**
 * Where a want or a thing is gone to: the board, when this build has one;
 * otherwise the list, which answers the jump itself (see WantListPage).
 */
const boardPath = () => (hasExtensionRoute('/canvas') ? '/canvas' : '/dashboard');

export function useMarkJump(): (mark: Mark) => void {
  const requestJump = useMarkJumpStore(s => s.requestJump);
  const navigate = useNavigate();
  const location = useLocation();

  return (mark: Mark) => {
    if (mark.kind === 'thing') {
      if (!mark.id) return;
      requestJump({ kind: 'thing', id: mark.id, name: mark.name });
      navigate(boardPath());
      return;
    }
    if (mark.kind === 'want') {
      requestJump({ kind: 'want', id: mark.id, name: mark.name });
      navigate(boardPath());
      return;
    }
    requestJump({ kind: 'global', key: mark.key });
    // The Global panel is the dashboard's, in either of its two views. From
    // anywhere else, the list is the one that needs no board to be ready.
    if (location.pathname !== '/canvas' && location.pathname !== '/dashboard') navigate('/dashboard');
  };
}

export const MarkButton: React.FC<{ mark: Mark; size?: number; className?: string }> = ({
  mark, size = 20, className,
}) => {
  const jump = useMarkJump();
  const iconFont = useIconFont() as IconFamily;
  const wantTypes = useWantTypeStore(s => s.wantTypes);

  const press = (e: React.MouseEvent) => {
    // The card underneath opens an editor on click and its actions on
    // right-click; neither is what pressing the mark means.
    e.stopPropagation();
    jump(mark);
  };

  const shared = {
    type: 'button' as const,
    onClick: press,
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
    onContextMenu: (e: React.MouseEvent) => e.stopPropagation(),
    title: markTitle(mark),
  };

  // A thing is drawn as the canvas draws it — its own colour, its own glyph —
  // rather than in a badge colour of ours. The dot IS the identity, and the
  // tile out there is the same object seen twice.
  if (mark.kind === 'thing') {
    return (
      <button {...shared} className={classNames('shadow-none hover:opacity-80 transition-opacity', className)}>
        <ThingDot color={mark.color} icon={mark.icon} label={mark.name} size={size} />
      </button>
    );
  }

  const via = mark.kind === 'global' ? mark.via : mark.via;
  const style = VIA_STYLE[via ?? 'expose'];
  const ViaIcon = style.Icon;
  const wantType = mark.kind === 'want' ? mark.wantType : undefined;
  const category = wantType ? (wantTypes.find(t => t.name === wantType)?.category ?? '') : '';

  return (
    <button
      {...shared}
      className={classNames(
        'flex items-center justify-center gap-0.5 rounded-full shadow transition-colors text-white',
        via ? style.bg : 'bg-gray-500',
        // A pill when it carries two marks, a circle when it carries one.
        mark.kind === 'want' && via ? 'px-1' : '',
        className,
      )}
      style={{ height: size, minWidth: size }}
    >
      {/* Which way the value goes, before who it goes to. */}
      {via && <ViaIcon style={{ width: size * 0.5, height: size * 0.5 }} />}
      {mark.kind === 'want' && (
        wantType
          ? <WantIcon typeName={wantType} category={category} iconFont={iconFont} size={Math.round(size * 0.62)} isLight={false} />
          : <span className="text-[9px] font-bold px-0.5 max-w-[4rem] truncate">{mark.name}</span>
      )}
    </button>
  );
};

/**
 * The marks a card carries, where a card carries them: the top-right corner,
 * where the expose badge has always been. Several can be true at once — a value
 * that is a thing AND is published to a want has both to say — so they sit in a
 * row rather than taking turns.
 */
export const MarkBadges: React.FC<{ marks: Mark[]; children?: React.ReactNode }> = ({ marks, children }) => {
  if (marks.length === 0 && !children) return null;
  return (
    <div className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 z-30">
      {marks.map((m, i) => (
        <MarkButton key={`${markKey(m)}-${i}`} mark={m} />
      ))}
      {children}
    </div>
  );
};
