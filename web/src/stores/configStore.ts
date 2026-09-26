import { create } from 'zustand';
import { ServerConfig } from '@/types/config';
import { apiClient } from '@/api/client';
import { send } from '@/api/outbox';
import { combinePatches, mergePatch } from '@/utils/ext';

// Dark mode, the canvas ground colour and the sound flag used to be pushed from
// here. They belong to whoever is using the app rather than to the server, so
// they are pushed from hooks/useDisplaySettings now, driven by my character.

interface ConfigStore {
  config: ServerConfig | null;
  loading: boolean;
  error: string | null;
  fetchConfig: () => Promise<void>;
  updateConfig: (updates: Partial<ServerConfig>) => Promise<void>;
  applyColorMode: (mode: 'light' | 'dark' | 'system') => void;
}

/**
 * Config changes still owed to the server, keyed so a newer value for the same
 * setting replaces an older one rather than queueing behind it.
 *
 * The keeping-on-trying used to live here, in a copy of the same backoff loop
 * that suspending a want and moving the cursor each had their own version of.
 * It is one module now (api/outbox), and this keeps only what is particular to
 * config: that several settings changed close together go in one PATCH.
 */
const pendingUpdates = new Map<string, unknown>();

/** Push whatever is owed. The outbox is what makes sure it lands. */
function deliverPending(): void {
  send('server-config', 'config change', async () => {
    const batch = Object.fromEntries(pendingUpdates) as Parameters<typeof apiClient.patchServerConfig>[0];
    if (Object.keys(batch).length === 0) return;
    const updated = await apiClient.patchServerConfig(batch);
    // Only clear what this attempt actually carried: anything set while it was
    // in flight is newer and still owed.
    for (const [k, v] of Object.entries(batch)) {
      if (pendingUpdates.get(k) === v) pendingUpdates.delete(k);
    }
    useConfigStore.setState({ config: updated, error: null });
    if (pendingUpdates.size > 0) deliverPending();
  });
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: null,
  loading: false,
  error: null,

  fetchConfig: async () => {
    set({ loading: true, error: null });
    try {
      const config = await apiClient.getServerConfig();
      set({ config, loading: false });
    } catch (err) {
      console.error('Failed to fetch config:', err);
      const fallback: ServerConfig = {
        port: 8080,
        host: 'localhost',
        debug: false,
        header_position: 'top',
        color_mode: 'system',
        card_height: 'sm',
      };
      set({ 
        error: err instanceof Error ? err.message : 'Failed to fetch config', 
        loading: false,
        config: fallback
      });
    }
  },

  updateConfig: async (updates) => {
    const current = get().config;
    if (!current) return;

    // Applied here, before the request, and NOT rolled back if it fails.
    //
    // Config drives things people press: the on-screen pad opens from it, the
    // header lights its button from it. Waiting for a round-trip to the server
    // before any of that moves means the press is answered at network speed —
    // on a phone the pad's opening animation began a visible beat after the
    // finger left the button, which reads as the button having missed rather
    // than as the pad being slow.
    //
    // Nothing here is a value the server computes or corrects, so showing it
    // immediately cannot show something wrong; the response still lands and
    // replaces it.
    // `ext` is a patch, not a value: it merges into what is there (see
    // utils/ext), here exactly as the server will merge it.
    const merged: Partial<ServerConfig> = updates.ext
      ? { ...updates, ext: mergePatch(current.ext, updates.ext) as ServerConfig['ext'] }
      : updates;
    set({ config: { ...current, ...merged } });

    // A failed request is a delivery problem, not a veto.
    //
    // Undoing the change on failure treats the network as the authority on
    // what the user asked for: the pad closes itself again a second after
    // being opened, on a train, and the person who pressed the button is told
    // they did not. They did. The asking is local and already true; getting it
    // to the server is this function's problem, so it keeps trying.
    //
    // Superseded rather than stacked: if the same key is set again while a
    // retry is pending, the newer value is the one that matters and the older
    // attempt stops — otherwise a flurry of presses would deliver its own
    // history, last write winning by luck of arrival.
    for (const key of Object.keys(updates)) {
      const value = updates[key as keyof typeof updates];
      // Two ext patches before a delivery are one patch, not the later one.
      pendingUpdates.set(key, key === 'ext' ? combinePatches(pendingUpdates.get('ext'), value) : value);
    }
    deliverPending();
  },

  applyColorMode: (mode) => {
    const root = window.document.documentElement;
    const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  },
}));
