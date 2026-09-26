import React, { useRef, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, UserX } from 'lucide-react';
import { Character } from '@/types/character';
import { classNames } from '@/utils/helpers';

interface CharacterSelectProps {
  characters: Character[];
  currentCharacterId: string | undefined;
  onChange: (characterId: string | null) => void;
  disabled?: boolean;
  tabIndex?: number;
}

export const CharacterSelect: React.FC<CharacterSelectProps> = ({
  characters,
  currentCharacterId,
  onChange,
  disabled = false,
  tabIndex,
}) => {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const current = characters.find(c => c.id === currentCharacterId);

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();

    const handleClose = (e: MouseEvent) => {
      if (
        buttonRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    const handleScroll = () => setOpen(false);

    document.addEventListener('mousedown', handleClose);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleClose);
    return () => {
      document.removeEventListener('mousedown', handleClose);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [open]);

  const select = (id: string | null) => {
    onChange(id);
    setOpen(false);
  };

  const dropdown = open ? ReactDOM.createPortal(
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden"
    >
      {currentCharacterId && (
        <button
          onClick={() => select(null)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <UserX className="w-3.5 h-3.5" />
          Unassign
        </button>
      )}
      {characters.map(c => (
        <button
          key={c.id}
          onClick={() => select(c.id)}
          className={classNames(
            'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors',
            c.id === currentCharacterId
              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700',
          )}
        >
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0"
            style={{ backgroundColor: c.color + '33', border: `1.5px solid ${c.color}` }}
          >
            {c.avatar}
          </span>
          <span className="truncate font-medium" style={{ color: c.color }}>{c.name}</span>
        </button>
      ))}
    </div>,
    document.body,
  ) : null;

  return (
    <div className="relative mt-2" onClick={e => e.stopPropagation()}>
      <button
        ref={buttonRef}
        disabled={disabled || characters.length === 0}
        onClick={() => setOpen(o => !o)}
        tabIndex={tabIndex}
        className={classNames(
          'w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all border',
          current
            ? 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100'
            : 'bg-gray-100 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500',
          'hover:border-indigo-400 dark:hover:border-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed',
        )}
      >
        {current ? (
          <>
            <span className="text-base leading-none">{current.avatar}</span>
            <span className="truncate" style={{ color: current.color }}>{current.name}</span>
          </>
        ) : (
          <span className="truncate">{characters.length === 0 ? 'No characters' : '— none —'}</span>
        )}
        <ChevronDown className="w-3 h-3 ml-auto flex-shrink-0 text-gray-400" />
      </button>

      {dropdown}
    </div>
  );
};
