import React, { useContext } from 'react';
import { TileFaceContext } from './registry';

/**
 * A page embedded in a card — the one place a card frames a page (a Grafana
 * panel, a note's opened link, a replay's recording browser, the card's own
 * embed), so that what a frame does on the tile's face is decided once.
 *
 * On a card it is the iframe, as given. On the want's tile up close
 * (TileFaceContext) it is the page's screenshot when there is one, and
 * otherwise nothing: a board holds many, a frame loads, runs and takes input
 * as soon as it is mounted, and a face shows only what the card shows. A card
 * whose face would be this blank says it has no face (WantCardPlugin.tileFace).
 */
export const EmbeddedPage = React.forwardRef<
  HTMLIFrameElement,
  React.IframeHTMLAttributes<HTMLIFrameElement> & {
    /** A screenshot of the page: what the face shows of it. */
    picture?: string;
  }
>(({ picture, ...frame }, ref) => {
  if (useContext(TileFaceContext)) {
    return (
      <div className={`${/\b(absolute|fixed)\b/.test(frame.className ?? '') ? '' : 'relative'} overflow-hidden ${frame.className ?? ''}`} style={frame.style}>
        {picture && <PagePicture shot={picture} />}
      </div>
    );
  }
  return <iframe ref={ref} {...frame} />;
});
EmbeddedPage.displayName = 'EmbeddedPage';

/** A page's screenshot, from the top, filling its box — as a card shows a page it cannot frame. */
export const PagePicture: React.FC<{ shot: string }> = ({ shot }) => (
  <img src={shot} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover object-top" />
);
