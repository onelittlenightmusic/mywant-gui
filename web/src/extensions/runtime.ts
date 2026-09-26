import { exposeModules } from './modules';

/**
 * Extensions installed beside this app rather than built into it.
 *
 * The server lists them at /api/v1/gui-extensions — each a script and its
 * stylesheets, served from ~/.mywant/gui-extensions/<name>/ — and only those
 * built for this version of the app (see server/extensions.go). Each script
 * registers itself with extensions/registry when it runs, reaching this app's
 * modules through window.__mywantModules (see extensions/modules).
 *
 * Run before the first render, like the build-time extensions: the registry's
 * lists are read as fixed from then on (routes, menu, hooks). A server that
 * does not answer, or a script that fails, costs that extension and nothing
 * else — the app starts without it.
 */

export interface GuiExtensionManifest {
  name: string;
  version?: string;
  /** URL of the extension's script (an IIFE that registers it). */
  script: string;
  /** URLs of its stylesheets. */
  styles?: string[];
}

/** How long startup waits for the list before going on without extensions. */
const LIST_TIMEOUT_MS = 3000;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = false;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(el);
  });
}

function addStylesheet(href: string): void {
  const el = document.createElement('link');
  el.rel = 'stylesheet';
  el.href = href;
  document.head.appendChild(el);
}

async function fetchList(): Promise<GuiExtensionManifest[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LIST_TIMEOUT_MS);
  try {
    const res = await fetch('/api/v1/gui-extensions', { signal: ctrl.signal });
    if (!res.ok) return [];
    const list = await res.json();
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function loadRuntimeExtensions(): Promise<void> {
  exposeModules();
  for (const ext of await fetchList()) {
    try {
      for (const href of ext.styles ?? []) addStylesheet(href);
      await loadScript(ext.script);
    } catch (err) {
      console.error(`[gui-extensions] ${ext.name}:`, err);
    }
  }
}
