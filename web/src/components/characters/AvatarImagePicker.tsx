import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { imageToAvatar } from '@/shared/avatarImage';

/**
 * The picture a character is drawn with (Character.avatarImage), chosen from a
 * file — on a phone, the photo library or the camera — dropped on, or pasted
 * while the editor is open. Shrunk to a small square here (imageToAvatar);
 * what to do with it is the editor's (`onPick`, '' to go back to the emoji).
 */
export const AvatarImagePicker: React.FC<{
  image?: string;
  onPick: (image: string) => void;
}> = ({ image, onPick }) => {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  const take = async (file: Blob | null | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    setError('');
    try { pickRef.current(await imageToAvatar(file)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const takeRef = useRef(take);
  takeRef.current = take;

  // A picture pasted anywhere while the editor is open: a screenshot, an image
  // copied from a profile page. Text pastes go on to wherever they were going.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find(f => f.type.startsWith('image/'));
      if (!file) return;
      e.preventDefault();
      void takeRef.current(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  return (
    <div
      className={`flex items-center gap-2 rounded-lg p-1 ${over ? 'ring-2 ring-indigo-500' : ''}`}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files[0]); }}
    >
      {image && (
        <span className="relative flex-shrink-0">
          <img src={image} alt="" className="w-10 h-10 rounded-full object-cover" draggable={false} />
          <button
            type="button"
            onClick={() => onPick('')}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gray-700 text-white flex items-center justify-center"
            aria-label="Remove the picture"
            title="画像を外す（絵文字に戻す）"
          ><X className="w-3 h-3" /></button>
        </span>
      )}
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-xs font-semibold text-gray-700 dark:text-gray-200"
      >
        <ImagePlus className="w-3.5 h-3.5" />{image ? 'Change photo' : 'Use a photo'}
      </button>
      <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">or paste / drop one</span>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { void take(e.target.files?.[0]); e.target.value = ''; }}
      />
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  );
};
