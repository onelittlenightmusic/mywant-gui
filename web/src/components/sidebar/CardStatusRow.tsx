import React from 'react';
import { classNames } from '@/utils/helpers';

// The same facts the card's top-left pill carries, restated at the top of the
// details sidebar. A pill is small and iconographic by necessity; opening the
// card should not mean losing what it just told you, nor guessing what an icon
// meant — so each item repeats here with its icon and a word.

export interface CardStatusItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  title?: string;
  /** Set where the pill's own chip is interactive (thing's group chips). */
  onClick?: () => void;
}

export const CardStatusRow: React.FC<{ items: CardStatusItem[] }> = ({ items }) => {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map(({ key, icon, label, title, onClick }) => {
        const content = (
          <>
            <span className="flex-shrink-0 inline-flex items-center">{icon}</span>
            <span className="truncate">{label}</span>
          </>
        );
        const className = classNames(
          'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
          'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200',
          onClick && 'hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors',
        );

        return onClick ? (
          <button key={key} type="button" onClick={onClick} className={className} title={title}>
            {content}
          </button>
        ) : (
          <span key={key} className={className} title={title}>
            {content}
          </span>
        );
      })}
    </div>
  );
};
