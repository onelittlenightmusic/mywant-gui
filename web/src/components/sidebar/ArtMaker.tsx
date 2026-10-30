import React, { useEffect, useRef, useState } from 'react';
import { Brush, Check, Image as ImageIcon, ImagePlus, Images, Loader2, RefreshCw, RotateCcw, Trash2, Upload, X, ZoomIn, ZoomOut } from 'lucide-react';
import { OverlayCell, OVERLAY_STAGGER_MS } from '@/components/overlay';
import { DisplayCard } from '@/components/forms/CardPrimitives';
import { getTypeStyle } from '@/components/forms/sections/ParameterGridSection';
import { apiClient } from '@/api/client';
import { hostDrawsArt, describeArt, drawArt, artScale, nextArtScale, ART_SCALES, type ArtKind } from '@/lib/art';
import { classNames } from '@/utils/helpers';

/**
 * A picture for the board's floor — a thing's, a want's, a constellation's
 * art (lib/art, the engine's art.go): having one drawn, or choosing one,
 * looking at it, and keeping it. The same for all three; the caller says what
 * it is of, what there is to choose, and what to reload once it has changed.
 *
 * Two ways to one:
 *   作る  the app framing the page draws it (Image Playground on the iPhone,
 *         lib/art — on its own screen there). Elsewhere it is shown, not
 *         pressable. First the
 *         words it will be drawn from (the phone's own model's), shown to be
 *         read, changed or asked for again (プロンプトを作り直す); then 描く.
 *   選ぶ  a picture already there — the thing's own photo, its kind's picture,
 *         a member's (`choices`) — or a file from the device.
 * Either is shown as it will lie on the floor (FloorPreview), and kept only
 * when 保存 is pressed; やめる leaves things as they were. Once there is one,
 * 小さく / 大きく set how large it lies (lib/art's ART_SCALES).
 *
 * A card like a field's (DisplayCard: its name in the card's ink, a glyph
 * behind), and its buttons overlay cells (components/overlay) side by side
 * with nothing between them, as an overlay's grid lays them: what each does
 * is its tone, as in every overlay.
 */

/** The side a file chosen from the device is brought down to, in px — a drawing's. */
const FILE_SIDE = 384;

/** A cell's side here, in px: an overlay's cell, a little smaller for a sidebar's row. */
const CELL = 60;

/** The card's colours and glyph: a field card's, for a picture. */
const { scheme, BgIcon } = getTypeStyle('', false, ImageIcon);

type Art = { png: Blob } | { url: string };

interface Candidate {
  /** What is shown. */
  image: string;
  /** What was drawn from, in words — a drawing's. */
  prompt?: string;
  art: Art;
}

type Step =
  | { at: 'idle' }
  /** The words being thought of — again, when `instead` is the last. */
  | { at: 'describing'; instead?: string }
  /** The words, to be read or changed before anything is drawn. */
  | { at: 'prompt'; text: string }
  | { at: 'drawing'; text: string }
  | { at: 'choosing' }
  | { at: 'review'; c: Candidate }
  | { at: 'saving'; c: Candidate };

export const ArtMaker: React.FC<{
  /** Whose art: as the engine's /api/v1/art/{kind}/{id} names it. */
  kind: ArtKind;
  id: string;
  /** What it is a picture of, and what sort of thing that is, in words — for the drawing. */
  value: string;
  about: string;
  /** A little of what it holds (a note's text, say), for the words too (artContextOf). */
  context?: string;
  /** The art it has now, if any. */
  current?: string;
  /** Pictures already there to choose from (URLs). */
  choices?: string[];
  /** Its art changed — reload what shows it. */
  onChanged: () => Promise<unknown> | void;
  className?: string;
}> = ({ kind, id, value, about, context, current, choices = [], onChanged, className }) => {
  const [step, setStep] = useState<Step>({ at: 'idle' });
  const [problem, setProblem] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Another subject: what was in hand for the last is not this one's.
  useEffect(() => { setStep({ at: 'idle' }); setProblem(null); }, [kind, id]);

  const canDraw = hostDrawsArt();
  const shownChoices = [...new Set(choices.filter(u => u && u !== current))];
  const failed = (e: unknown) => setProblem(e instanceof Error ? e.message : String(e));

  const describe = async (instead?: string) => {
    setProblem(null);
    setStep({ at: 'describing', instead });
    try {
      setStep({ at: 'prompt', text: await describeArt(value, about, instead, context) });
    } catch (e) {
      failed(e);
      setStep(instead ? { at: 'prompt', text: instead } : { at: 'idle' });
    }
  };

  const draw = async (text: string) => {
    setProblem(null);
    setStep({ at: 'drawing', text });
    try {
      const drawn = await drawArt(text);
      // Closed without one: back to the words, to change them or try again.
      if (!drawn) { setStep({ at: 'prompt', text }); return; }
      const png = await (await fetch(drawn.image)).blob();
      setStep({ at: 'review', c: { image: drawn.image, prompt: drawn.prompt, art: { png } } });
    } catch (e) {
      failed(e);
      setStep({ at: 'prompt', text });
    }
  };

  const fromFile = async (file: File) => {
    setProblem(null);
    try {
      const png = await squarePng(file, FILE_SIDE);
      setStep({ at: 'review', c: { image: URL.createObjectURL(png), art: { png } } });
    } catch (e) {
      failed(e);
    }
  };

  const save = async (c: Candidate) => {
    setStep({ at: 'saving', c });
    try {
      await apiClient.putArt(kind, id, c.art);
      await onChanged();
      setStep({ at: 'idle' });
    } catch (e) {
      failed(e);
      setStep({ at: 'review', c });
    }
  };

  const rescale = async (dir: -1 | 1) => {
    setProblem(null);
    try {
      await apiClient.setArtScale(kind, id, nextArtScale(artScale(current), dir));
      await onChanged();
    } catch (e) {
      failed(e);
    }
  };

  const remove = async () => {
    setProblem(null);
    try {
      await apiClient.deleteArt(kind, id);
      await onChanged();
    } catch (e) {
      failed(e);
    }
  };

  const shown = step.at === 'review' || step.at === 'saving' ? step.c : null;
  const icon = 'w-5 h-5';

  // The row of cells for where things stand: one overlay's worth of choices.
  const cells: React.ReactNode[] = [];
  const cell = (key: string, props: React.ComponentProps<typeof OverlayCell>) => cells.push(
    <div key={key} style={{ width: CELL, height: CELL }} className="shrink-0">
      <OverlayCell delay={cells.length * OVERLAY_STAGGER_MS} {...props} />
    </div>,
  );
  if (shown) {
    cell('save', { icon: step.at === 'saving' ? <Loader2 className={classNames(icon, 'animate-spin')} /> : <Check className={icon} />,
      label: '保存', tone: 'confirm', disabled: step.at === 'saving', onClick: () => void save(shown) });
    if (shown.prompt !== undefined) {
      cell('again', { icon: <RotateCcw className={icon} />, label: 'やり直す', tone: 'caution', disabled: step.at === 'saving',
        onClick: () => setStep({ at: 'prompt', text: shown.prompt ?? '' }) });
    }
    cell('cancel', { icon: <X className={icon} />, label: 'やめる', tone: 'cancel', disabled: step.at === 'saving', onClick: () => setStep({ at: 'idle' }) });
  } else if (step.at === 'prompt' || step.at === 'drawing' || (step.at === 'describing' && step.instead !== undefined)) {
    const text = step.at === 'describing' ? step.instead! : step.text;
    const busy = step.at !== 'prompt';
    cell('draw', { icon: step.at === 'drawing' ? <Loader2 className={classNames(icon, 'animate-spin')} /> : <Brush className={icon} />,
      label: step.at === 'drawing' ? '描いています' : '描く', tone: 'special', disabled: busy || !text.trim(),
      onClick: () => void draw(text.trim()) });
    cell('reprompt', { icon: <RefreshCw className={classNames(icon, step.at === 'describing' && 'animate-spin')} />,
      label: '作り直す', title: 'プロンプトを作り直す', tone: 'caution', disabled: busy, onClick: () => void describe(text) });
    cell('cancel', { icon: <X className={icon} />, label: 'やめる', tone: 'cancel', disabled: step.at === 'drawing', onClick: () => setStep({ at: 'idle' }) });
  } else if (step.at === 'choosing') {
    for (const url of shownChoices) {
      cell(url, { icon: <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover rounded-[inherit]" />,
        title: 'これにする', tone: 'muted', showLabel: false,
        onClick: () => setStep({ at: 'review', c: { image: url, art: { url } } }) });
    }
    cell('file', { icon: <Upload className={icon} />, label: 'ファイル', tone: 'info', onClick: () => fileRef.current?.click() });
    cell('cancel', { icon: <X className={icon} />, label: 'やめる', tone: 'cancel', onClick: () => setStep({ at: 'idle' }) });
  } else {
    const describing = step.at === 'describing';
    // Shown where nothing can draw too, not pressable: left out, the card did
    // not say there was such a thing as having one made.
    cell('make', { icon: describing ? <Loader2 className={classNames(icon, 'animate-spin')} /> : <ImagePlus className={icon} />,
      label: describing ? '考えています' : current ? '作り直す' : '作る',
      title: canDraw ? undefined : '描けるのは iPhone のアプリの中だけです（Image Playground）',
      tone: 'special', disabled: describing || !canDraw, onClick: () => void describe() });
    cell('choose', { icon: <Images className={icon} />, label: '選ぶ', tone: 'primary', disabled: describing,
      onClick: () => { setProblem(null); setStep({ at: 'choosing' }); } });
    if (current) {
      const scale = artScale(current);
      cell('smaller', { icon: <ZoomOut className={icon} />, label: '小さく', title: `いま ×${scale}`, tone: 'info',
        disabled: describing || scale <= ART_SCALES[0], onClick: () => void rescale(-1) });
      cell('larger', { icon: <ZoomIn className={icon} />, label: '大きく', title: `いま ×${scale}`, tone: 'info',
        disabled: describing || scale >= ART_SCALES[ART_SCALES.length - 1], onClick: () => void rescale(1) });
      cell('remove', { icon: <Trash2 className={icon} />, label: '消す', tone: 'danger', disabled: describing, onClick: () => void remove() });
    }
  }

  return (
    <DisplayCard
      className={classNames('relative rounded-lg sm:rounded-xl p-1.5 shadow-sm', scheme.cardBg, className)}
      BgIcon={BgIcon}
      bgIconColor={scheme.bgIconColor}
      inkColor={scheme.color}
      headerLeft={<span className="text-[11px] font-semibold card-ink truncate leading-none">背景アイコン</span>}
    >
      <div className="relative space-y-1.5">
        {(shown || (current && step.at !== 'choosing')) && (
          <div className="flex items-center gap-3">
            {shown && <img src={shown.image} alt="" className="w-24 h-24 rounded-lg object-cover shadow-sm" />}
            <FloorPreview image={shown?.image ?? current!} />
          </div>
        )}
        {shown?.prompt && <div className="text-xs text-gray-500 dark:text-gray-400 break-words">「{shown.prompt}」</div>}

        {/* The words it will be drawn from: read, changed, or asked for again. */}
        {(step.at === 'prompt' || step.at === 'drawing' || (step.at === 'describing' && step.instead !== undefined)) && (
          <textarea
            value={step.at === 'describing' ? step.instead : step.text}
            onChange={e => { if (step.at === 'prompt') setStep({ at: 'prompt', text: e.target.value }); }}
            readOnly={step.at !== 'prompt'}
            rows={3}
            aria-label="プロンプト"
            className={classNames(
              'w-full text-xs rounded-md px-2 py-1.5 resize-none',
              'bg-white/80 dark:bg-gray-900/60 text-gray-800 dark:text-gray-100',
              'ring-1 ring-black/10 dark:ring-white/15 focus:outline-none focus:ring-2 focus:ring-blue-500',
              step.at !== 'prompt' && 'opacity-60',
            )}
          />
        )}

        {/* One strip, the cells touching, rounded only at its ends — an
            overlay's grid, one row of it. It scrolls sideways rather than
            wrapping when there are more choices than room. */}
        <div className="flex w-max max-w-full overflow-x-auto rounded-md">{cells}</div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void fromFile(f); }} />
        {problem && <div className="text-xs text-red-600 dark:text-red-400">{problem}</div>}
      </div>
    </DisplayCard>
  );
};

/** As it lies on the board's floor: faint, and soft to nothing at its edge. */
export const FloorPreview: React.FC<{ image: string }> = ({ image }) => (
  <div
    className="w-24 h-24"
    style={{
      backgroundImage: `url("${image}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      opacity: 0.55,
      maskImage: 'radial-gradient(circle at 50% 50%, black 45%, transparent 70%)',
      WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 45%, transparent 70%)',
    }}
  />
);

/** A picture file, cut to its middle square and brought down to `side` px, as a PNG. */
async function squarePng(file: File, side: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const s = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(side, s);
  const g = canvas.getContext('2d');
  if (!g) throw new Error('画像を読めませんでした');
  g.drawImage(bitmap, (bitmap.width - s) / 2, (bitmap.height - s) / 2, s, s, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('画像を作れませんでした'))), 'image/png'));
}
