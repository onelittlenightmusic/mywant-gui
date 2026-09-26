import { useEffect, useRef } from 'react';
import { subscribeSSE } from '@/api/sseClient';

/**
 * Subscribe to a named SSE event for the lifetime of the component.
 * The handler is wrapped in a ref so it can be replaced on each render
 * without re-subscribing to the event source.
 */
export function useSSEEvent<T = unknown>(
  type: string,
  handler: (data: T) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return subscribeSSE<T>(type, (data) => handlerRef.current(data));
  }, [type]);
}
