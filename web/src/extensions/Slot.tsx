import React from 'react';
import { extensionSlot, type ExtensionSlots } from './registry';

/**
 * Everything registered for one named place, drawn with the props the host
 * gives it. Nothing at all when no extension fills it — which is the public
 * edition, at every one of these places.
 */
export function Slot<K extends keyof ExtensionSlots>(
  { name, ...props }: { name: K } & React.ComponentProps<ExtensionSlots[K]>,
) {
  const parts = extensionSlot(name);
  if (parts.length === 0) return null;
  return (
    <>
      {parts.map((Part, i) => {
        const C = Part as React.ComponentType<Record<string, unknown>>;
        return <C key={i} {...(props as Record<string, unknown>)} />;
      })}
    </>
  );
}
