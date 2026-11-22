import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { PanelFloatButton } from '@/components/common/PanelFloatButton';
import { classNames } from '@/utils/helpers';

/**
 * A new world: its name, and the round button that opens it — laid as Add
 * Thing is (the field at the top, the button floating at the bottom right,
 * its icon alone, the app's own in an app's sheet: useHostActions).
 *
 * It replaced a window.prompt, which an app's web view does not show — New
 * World did nothing there.
 */
export const AddWorldSidebar: React.FC<{
  /** Names already taken: opening one of them is not making it. */
  taken: string[];
  busy?: boolean;
  error?: string | null;
  onCreate: (name: string) => void;
  onCancel?: () => void;
}> = ({ taken, busy, error, onCreate, onCancel }) => {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const exists = !!trimmed && taken.includes(trimmed);
  const canCreate = !!trimmed && !exists && !busy;
  const create = () => { if (canCreate) onCreate(trimmed); };

  return (
    <div className="relative h-full flex flex-col">
      <div className="p-4 flex-1 min-h-0 flex flex-col gap-3">
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Name
        </label>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') create();
            if (e.key === 'Escape') onCancel?.();
          }}
          placeholder="New world name"
          className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <p className={classNames('text-[11px]', exists || error ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400')}>
          {exists
            ? `World "${trimmed}" already exists — open it from its card instead.`
            : error || 'The wants on the board now are kept under the world you are in, and the new one starts empty.'}
        </p>
      </div>

      {/* The round button, floating — as Add Want's and Add Thing's. */}
      <PanelFloatButton label="New World" icon={Layers} onPress={create} disabled={!canCreate} />
    </div>
  );
};
