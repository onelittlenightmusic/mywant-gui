/**
 * A picture made into a character's avatar (Character.avatarImage): the middle
 * square of it, AVATAR_PX on a side, as a JPEG data: URL — about 10KB, small
 * enough to travel with the character everywhere it is drawn.
 *
 * AVATAR_PX is three times the largest badge the board draws (the CursorMan,
 * about 50px), so a 3× phone screen draws it sharp.
 */
export const AVATAR_PX = 160;

export async function imageToAvatar(file: Blob): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('画像を読み込めませんでした'));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error('画像を読み込めませんでした');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = AVATAR_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('画像を縮められませんでした');
    // A JPEG has no transparency: what a PNG leaves clear comes out white.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, AVATAR_PX, AVATAR_PX);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
