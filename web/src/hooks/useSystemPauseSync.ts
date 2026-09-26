import { useEffect } from 'react';
import { subscribeSSE } from '@/api/sseClient';
import { useSystemPauseStore } from '@/stores/systemPauseStore';
import { useNavBadgeStore, hasAnyNavBadge } from '@/stores/navBadgeStore';
import { useCharacterStore } from '@/stores/characterStore';
import { apiClient } from '@/api/client';
import { useAttentionStore } from '@/stores/attentionStore';

/**
 * Keeps the control pill's two cross-tab facts current. Mount once, at the app
 * shell.
 *
 * - The pause flag: one fetch on mount, then the server's `system_pause`
 *   announcements. Re-fetched when the tab comes back into view, since an
 *   announcement missed while the SSE stream was down would otherwise stand.
 * - The menu's attention dot: published into gui_state as
 *   `nav_attention_<characterId>`, because a pill drawn on some other site (by
 *   the extension or the bookmarklet) cannot read this tab's store — the
 *   badges are worked out here, from this browser's own seen-sets.
 */
export function useSystemPauseSync(): void {
  const load = useSystemPauseStore(s => s.load);
  const setPaused = useSystemPauseStore(s => s.setPaused);

  useEffect(() => {
    void load();
    const unsub = subscribeSSE<{ paused: boolean }>('system_pause', (d) => {
      if (d && typeof d.paused === 'boolean') setPaused(d.paused);
    });
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { unsub(); document.removeEventListener('visibilitychange', onVisible); };
  }, [load, setPaused]);

  // What needs a person (the pill's attention button): asked every few
  // seconds while the tab is looked at, and at once when it comes into view
  // or a want changes.
  const loadAttention = useAttentionStore(s => s.load);
  useEffect(() => {
    void loadAttention();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void loadAttention(); }, 5000);
    const unsub = subscribeSSE('want_changed', () => { void loadAttention(); });
    const onVisible = () => { if (document.visibilityState === 'visible') void loadAttention(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); unsub(); document.removeEventListener('visibilitychange', onVisible); };
  }, [loadAttention]);

  const attention = useNavBadgeStore(s => hasAnyNavBadge(s.badges));
  const myCharacterId = useCharacterStore(s => s.myCharacterId);
  useEffect(() => {
    if (!myCharacterId) return;
    // null deletes the key, so a quiet menu leaves nothing behind.
    apiClient.updateGUIState({ ['nav_attention_' + myCharacterId]: attention ? true : null }).catch(() => {});
  }, [attention, myCharacterId]);
}
