import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, Monitor } from 'lucide-react';

const URL_RE = /https?:\/\/[^\s<>"'()[\]{}]+/g;

interface LinkifiedTextProps {
  text: string;
  onOpenIframe?: (url: string) => void;
  className?: string;
}

interface PopoverState {
  url: string;
  x: number;
  y: number;
}

export const LinkifiedText: React.FC<LinkifiedTextProps> = ({ text, onOpenIframe, className }) => {
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!popover) return;
    const close = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopover(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [popover]);

  const handleLinkClick = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setPopover({ url, x: rect.left, y: rect.bottom + 4 });
  };

  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const url = match[0];
    nodes.push(
      <a
        key={match.index}
        href={url}
        onClick={(e) => handleLinkClick(e, url)}
        className="text-blue-500 underline hover:text-blue-700 break-all"
        title={url}
      >
        {url}
      </a>
    );
    last = match.index + url.length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return (
    <span ref={containerRef} className={className} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {nodes}
      {popover && (
        <span
          className="fixed z-[9999] flex gap-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-1.5"
          style={{ top: popover.y, left: Math.min(popover.x, window.innerWidth - 200) }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {onOpenIframe && (
            <button
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-white/80 hover:bg-white/10 transition-colors whitespace-nowrap"
              onClick={(e) => { e.stopPropagation(); onOpenIframe(popover.url); setPopover(null); }}
            >
              <Monitor className="w-3 h-3" />
              iframe
            </button>
          )}
          <button
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-white/80 hover:bg-white/10 transition-colors whitespace-nowrap"
            onClick={(e) => { e.stopPropagation(); window.open(popover.url, '_blank'); setPopover(null); }}
          >
            <ExternalLink className="w-3 h-3" />
            新タブ
          </button>
        </span>
      )}
    </span>
  );
};
