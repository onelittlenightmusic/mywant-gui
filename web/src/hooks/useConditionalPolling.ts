import { useState, useEffect, useRef } from 'react';

/**
 * Polls `fetcher` every `intervalMs` milliseconds using ETag-based conditional
 * GET. The ETag from each response is stored and passed as `ifNoneMatch` on the
 * next call; when the server responds 304, the stored data is not replaced.
 *
 * Returns the latest non-null data, or null before the first successful fetch.
 * Resets data and the stored ETag when `active` switches to false.
 */
export function useConditionalPolling<T>(
  active: boolean,
  fetcher: (ifNoneMatch?: string) => Promise<{ data: T | null; etag: string | undefined }>,
  intervalMs: number,
): T | null {
  const [data, setData] = useState<T | null>(null);
  const activeRef = useRef(active);
  const fetcherRef = useRef(fetcher);
  const lastETagRef = useRef<string | undefined>(undefined);

  activeRef.current = active;
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!active) {
      setData(null);
      lastETagRef.current = undefined;
      return;
    }

    let cancelled = false;

    const poll = async () => {
      if (!activeRef.current || cancelled) return;
      try {
        const result = await fetcherRef.current(lastETagRef.current);
        if (result.etag) lastETagRef.current = result.etag;
        if (result.data !== null) setData(result.data);
      } catch {
        // ignore transient errors
      }
    };

    poll();
    const t = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(t);
      setData(null);
      lastETagRef.current = undefined;
    };
  }, [active, intervalMs]);

  return data;
}
