import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Images, Loader2, Upload } from 'lucide-react';
import { hostDrawsThingArt, drawThingArt } from '@/lib/thingArtHost';
import { classNames } from '@/utils/helpers';

/**
 * A picture for the board's floor — a thing's art, a constellation's: having
 * one drawn, or choosing one, looking at it, and keeping it. What it is drawn
 * from, what there is to choose and where it is kept are the caller's; the
 * asking, the review and the three answers are this.
 *
 * Two ways to one:
 *   作る  the app framing the page draws it (Image Playground on the iPhone,
 *         lib/thingArtHost — on its own screen there). Only where one can.
 *   選ぶ  a picture already there — the thing's own photo, its kind's picture,
 *         a member's (`choices`) — or a file from the device.
 * Either is shown as it will lie on the floor (`preview`), and kept only when
 * 保存 is pressed; やめる leaves things as they were.
 */

const BTN = 'px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-40';
const BTN_MAIN = 'bg-blue-600 text-white hover:bg-blue-700';
const BTN_PLAIN = 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600';

/** The side a file chosen from the device is brought down to, in px — a drawing's. */
const FILE_SIDE = 384;

/** A picture to keep: a PNG made here (drawn, or a file), or one already somewhere. */
export type Art = { png: Blob } | { url: string };

interface Candidate {
  /** What is shown. */
  image: string;
  /** What was drawn from, in words — for a drawing. */
  prompt?: string;
  art: Art;
}

type Step =
  | { at: 'idle' }
  | { at: 'drawing' }
  | { at: 'choosing' }
  | { at: 'review'; c: Candidate }
  | { at: 'saving'; c: Candidate };

export const ArtMaker: React.FC<{
  /** What it is a picture of, and what kind of thing that is — handed to the drawing. */
  value: string;
  kind: string;
  /** Whose picture this is: another owner, and what was in hand for the last is not its. */
  owner: string;
  /** The picture kept now, if any. */
  current?: string;
  /** Pictures already there to choose from (URLs). */
  choices?: string[];
  onSave: (art: Art) => Promise<void>;
  /** Takes the kept one away. */
  onRemove: () => Promise<void>;
  /** The picture as it will lie on the floor, beside the picture itself. */
  preview?: (image: string) => React.ReactNode;
  className?: string;
}> = ({ value, kind, owner, current, choices = [], onSave, onRemove, preview = image => <FloorPreview image={image} />, className }) => {
  const [step, setStep] = useState<Step>({ at: 'idle' });
  const [problem, setProblem] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setStep({ at: 'idle' }); setProblem(null); }, [owner]);

  const canDraw = hostDrawsThingArt();
  const shownChoices = [...new Set(choices.filter(u => u && u !== current))];
  const failed = (e: unknown) => setProblem(e instanceof Error ? e.message : String(e));

  const draw = async () => {
    setProblem(null);
    setStep({ at: 'drawing' });
    try {
      const drawn = await drawThingArt(value, kind);
      if (!drawn) { setStep({ at: 'idle' }); return; }
      const png = await (await fetch(drawn.image)).blob();
      setStep({ at: 'review', c: { image: drawn.image, prompt: drawn.prompt, art: { png } } });
    } catch (e) {
      failed(e);
      setStep({ at: 'idle' });
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
      await onSave(c.art);
      setStep({ at: 'idle' });
    } catch (e) {
      failed(e);
      setStep({ at: 'review', c });
    }
  };

  const remove = async () => {
    setProblem(null);
    try { await onRemove(); } catch (e) { failed(e); }
  };

  const shown = step.at === 'review' || step.at === 'saving' ? step.c : null;
  const busy = step.at === 'drawing' || step.at === 'saving';

  return (
    <div className={classNames('space-y-2', className)}>
      <div className="text-sm text-gray-600 dark:text-gray-400">背景アイコン</div>

      {current && !shown && step.at !== 'choosing' && (
        <div className="flex items-center gap-3">{preview(current)}</div>
      )}

      {shown && (
        <div className="flex items-center gap-3">
          <img src={shown.image} alt="" className="w-24 h-24 rounded-lg object-cover shadow-sm" />
          {preview(shown.image)}
        </div>
      )}
      {shown?.prompt && <div className="text-xs text-gray-500 dark:text-gray-400 break-words">「{shown.prompt}」</div>}

      {step.at === 'choosing' && (
        <div className="flex flex-wrap gap-2">
          {shownChoices.map(url => (
            <button key={url} type="button" title="これにする"
              className="w-16 h-16 rounded-md overflow-hidden ring-1 ring-black/10 dark:ring-white/15 hover:ring-2 hover:ring-blue-500"
              onClick={() => setStep({ at: 'review', c: { image: url, art: { url } } })}>
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
          <button type="button" title="ファイルから"
            className="w-16 h-16 rounded-md flex flex-col items-center justify-center gap-1 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
            onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4" />ファイル
          </button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void fromFile(f); }} />

      <div className="flex flex-wrap gap-2">
        {shown ? (
          <>
            <button type="button" className={classNames(BTN, BTN_MAIN)} disabled={busy} onClick={() => void save(shown)}>
              {step.at === 'saving' ? '保存中…' : '保存'}
            </button>
            {shown.prompt !== undefined && (
              <button type="button" className={classNames(BTN, BTN_PLAIN)} disabled={busy} onClick={() => void draw()}>
                やり直す
              </button>
            )}
            <button type="button" className={classNames(BTN, BTN_PLAIN)} disabled={busy} onClick={() => setStep({ at: 'idle' })}>
              やめる
            </button>
          </>
        ) : step.at === 'choosing' ? (
          <button type="button" className={classNames(BTN, BTN_PLAIN)} onClick={() => setStep({ at: 'idle' })}>
            やめる
          </button>
        ) : (
          <>
            {canDraw && (
              <button type="button" className={classNames(BTN, BTN_MAIN, 'inline-flex items-center gap-1.5')} disabled={busy} onClick={() => void draw()}>
                {step.at === 'drawing'
                  ? <><Loader2 className="w-4 h-4 animate-spin" />描いています…</>
                  : <><ImagePlus className="w-4 h-4" />{current ? '作り直す' : '作る'}</>}
              </button>
            )}
            <button type="button" className={classNames(BTN, canDraw ? BTN_PLAIN : BTN_MAIN, 'inline-flex items-center gap-1.5')} disabled={busy}
              onClick={() => { setProblem(null); setStep({ at: 'choosing' }); }}>
              <Images className="w-4 h-4" />選ぶ
            </button>
            {current && step.at === 'idle' && (
              <button type="button" className={classNames(BTN, BTN_PLAIN)} onClick={() => void remove()}>
                消す
              </button>
            )}
          </>
        )}
      </div>
      {problem && <div className="text-xs text-red-600 dark:text-red-400">{problem}</div>}
    </div>
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
