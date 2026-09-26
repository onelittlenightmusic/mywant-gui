import * as React from 'react';
import * as ReactJsxRuntime from 'react/jsx-runtime';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as ReactRouterDOM from 'react-router-dom';

/**
 * This app's modules, for an extension loaded at runtime.
 *
 * An extension built on its own (see extensions/runtime) is not bundled with
 * this app, but it is written against it: it imports `@/stores/wantStore`,
 * `@/hooks/useInputActions`, React. Those imports have to reach the very
 * modules this app is running — one want store, one React, one router — or
 * the extension talks to copies nobody else reads. So they are all handed out
 * here, by the name the extension imported them by, and its build turns each
 * such import into a lookup in this table.
 *
 * Every module under src is here, not a chosen few: which of them an
 * extension needs is its business, and a list kept here would lag behind it.
 * The price is that all of them are the extension's API, which is why an
 * extension names the version of this app it was built against and is not
 * loaded by any other (see the server's /api/v1/gui-extensions).
 *
 * Left out: the entry and extensions/installed (the build-time extension
 * slot, nothing an extension imports), and the card plugins, which register
 * themselves on import and are imported once already by plugins/index.
 */
const sourceModules = import.meta.glob(
  [
    '/src/**/*.{ts,tsx}',
    '!/src/**/*.d.ts',
    '!/src/main.tsx',
    '!/src/extensions/installed.ts',
    '!/src/extensions/modules.ts',
    '!/src/extensions/runtime.ts',
    '!/src/components/dashboard/WantCard/plugins/types/**',
  ],
  { eager: true },
);

/** `/src/stores/wantStore.ts` → `@/stores/wantStore`; `/src/x/index.ts` answers `@/x` too. */
function aliasesOf(file: string): string[] {
  const noExt = file.replace(/^\/src\//, '@/').replace(/\.(tsx?|jsx?)$/, '');
  return noExt.endsWith('/index') ? [noExt, noExt.slice(0, -'/index'.length)] : [noExt];
}

export type ModuleTable = Record<string, unknown>;

declare global {
  interface Window {
    __mywantModules?: ModuleTable;
  }
}

/** Publish the table on window.__mywantModules. Idempotent. */
export function exposeModules(): ModuleTable {
  if (window.__mywantModules) return window.__mywantModules;
  const table: ModuleTable = {
    react: React,
    'react/jsx-runtime': ReactJsxRuntime,
    'react-dom': ReactDOM,
    'react-dom/client': ReactDOMClient,
    'react-router-dom': ReactRouterDOM,
  };
  for (const [file, mod] of Object.entries(sourceModules)) {
    for (const name of aliasesOf(file)) table[name] = mod;
  }
  window.__mywantModules = table;
  return table;
}
