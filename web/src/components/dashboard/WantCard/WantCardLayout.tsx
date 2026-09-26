import React from 'react';

interface WantCardLayoutProps {
  /** Anchored to the top of the card (flex-shrink-0) */
  top?: React.ReactNode;
  /** Fills the remaining space between top and bottom (flex-1) */
  content: React.ReactNode;
  /** Anchored to the bottom of the card (flex-shrink-0) */
  bottom?: React.ReactNode;
  /** When true, centers content within the middle section */
  centerContent?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Standard 3-section layout for want cards and plugins.
 *
 * top    — aligned to the top of the card (e.g. status bar, header)
 * content — fills remaining space, optionally centered
 * bottom  — aligned to the bottom of the card (e.g. result, log)
 */
export const WantCardLayout: React.FC<WantCardLayoutProps> = ({
  top,
  content,
  bottom,
  centerContent = false,
  className,
  style,
}) => (
  <div className={`h-full flex flex-col${className ? ` ${className}` : ''}`} style={style}>
    {top != null && <div className="flex-shrink-0">{top}</div>}
    <div
      className={`flex-1 min-h-0 overflow-hidden${centerContent ? ' flex items-center justify-center' : ''}`}
    >
      {content}
    </div>
    {bottom != null && <div className="flex-shrink-0">{bottom}</div>}
  </div>
);
