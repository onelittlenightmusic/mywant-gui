import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { WantCardLayout } from '../../WantCardLayout';
import { CardFrame, CardFrameImage, CardFrameTitle, CardFrameNote } from '../../CardFrame';

/**
 * The picture the board is wearing, and where it came from.
 *
 * The obvious member of the eyecatch family: the image IS the eyecatch, so it
 * fills the left half clipped, and grows to the top half when the card is
 * maximised — which is the one card where that rearrangement really pays, since
 * a background is a thing you want to actually look at.
 *
 * Previously unregistered, on the grounds that an image URL already renders
 * generically through FinalResultDisplay's isImageUrl(). That gave a picture
 * and nothing else; the frame gives the picture *and* says which of the two
 * URLs is on screen and whether the fetch worked.
 */

/** The last path segment, undecorated — enough to tell two images apart. */
function fileLabel(url: string): string {
  try {
    const path = new URL(url, window.location.origin).pathname;
    return decodeURIComponent(path.split('/').filter(Boolean).pop() ?? '') || url;
  } catch {
    return url;
  }
}

const DynamicBackgroundContentSection: React.FC<WantCardPluginProps> = ({ want }) => {
  const cur = want.state?.current ?? {};
  const currentUrl = (cur.current_image_url as string) || '';
  const sourceUrl = (cur.source_image_url as string) || '';
  const status = (cur.status as string) || '';
  const displayUrl = currentUrl || sourceUrl;

  const content = (
    <CardFrame
      eyecatch={
        <CardFrameImage
          src={displayUrl}
          alt="background preview"
          fallback={<ImageIcon className="w-[2em] h-[2em]" />}
        />
      }
    >
      <CardFrameTitle>
        {displayUrl ? fileLabel(displayUrl) : <span className="italic text-gray-400">画像なし</span>}
      </CardFrameTitle>
      {/* Which of the two the card is showing. They differ while a fetch is in
          flight, and that difference is the only thing status can't say. */}
      {displayUrl && (
        <CardFrameNote>{currentUrl ? '表示中' : 'ソースのみ'}</CardFrameNote>
      )}
      {status && <CardFrameNote>{status}</CardFrameNote>}
    </CardFrame>
  );

  return <WantCardLayout content={content} />;
};

registerWantCardPlugin({
  types: ['dynamic_background'],
  ContentSection: DynamicBackgroundContentSection,
  hideFinalResult: true,
});
