import React from 'react';
import { Pipette, X } from 'lucide-react';
import { usePickStore, cancelPick } from '@/stores/pickStore';
import { useInputActions } from '@/hooks/useInputActions';

/**
 * What is being picked while a parameter asks for its value (pick mode,
 * stores/pickStore) — said over everything, at the top, with the way out. B /
 * Escape is bound here, so it is the same way out on the board and in a list.
 */
export const PickBanner: React.FC = () => {
  const request = usePickStore(s => s.request);
  useInputActions({ enabled: !!request, ignoreWhenInSidebar: false, onCancel: cancelPick });
  if (!request) return null;
  return (
    <div
      role="status"
      className="fixed left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 rounded-full bg-sky-600 text-white shadow-lg pl-3 pr-1.5 py-1.5 text-sm"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
    >
      <Pipette className="w-4 h-4 flex-shrink-0" />
      <span className="whitespace-nowrap">
        「{request.label}」を選ぶ
        <span className="opacity-75 ml-2 text-xs">B / Esc でやめる</span>
      </span>
      <button
        type="button"
        onClick={cancelPick}
        aria-label="やめる"
        className="ml-1 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
