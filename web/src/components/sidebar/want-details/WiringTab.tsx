/** The Wiring tab — how this want is joined to the others. */
import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from 'react';
import { LucideIcon, ArrowUpFromLine, ArrowDownToLine } from 'lucide-react';
import { Want } from '@/types/want';
import { classNames } from '@/utils/helpers';
import { WantCard } from '@/components/dashboard/WantCard/WantCard';
import { readDefs } from '@/components/sidebar/DerivedFieldEditor';
import { useWiringMarks } from '@/hooks/useWiringMarks';
import { StateDef } from '@/types/wantType';
import { ExposeSection, ExposeEntry } from '@/components/forms/sections/ExposeSection';
import { ImportSection } from '@/components/forms/sections/ImportSection';
import { apiClient } from '@/api/client';
import {
  DetailsSidebar,
  TabContent,
  TabSection,
  TabGrid,
  EmptyState,
  InfoRow,
  TabConfig
} from '../DetailsSidebar';
import { useCardGridNavigation } from '@/hooks/useCardGridNavigation';


// ---------------------------------------------------------------------------
// The Wiring tab — how this want is joined to the others
// ---------------------------------------------------------------------------

/** One half's heading: what it is, and how many of them there are. */
const WiringHeading: React.FC<{ icon: LucideIcon; label: string; count: number; className: string }> = ({
  icon: Icon, label, count, className,
}) => (
  <div className="flex items-center gap-1.5 mb-2">
    <Icon className={classNames('w-3 h-3', className)} />
    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
    <span className="text-[10px] text-gray-400 dark:text-gray-500">({count})</span>
  </div>
);

/**
 * What comes in, and what goes out — in that order, on one page.
 *
 * Import and Expose were two tabs, and reading a want's wiring meant switching
 * between them and holding one half in your head while looking at the other.
 * They are the two ends of one sentence: values arrive from other wants, this
 * want does something, values leave for other wants. Imports are drawn first
 * because that is the end the value comes from — the same order the field
 * cards' badges read in (see useWiringMarks).
 *
 * One want-type fetch serves both halves, which is also what the two tabs used
 * to do twice.
 *
 * The arrow keys walk the two grids as one: only the half the focus is in
 * captures them, and down off the end of Import lands on Expose (see
 * useCardGridNavigation's onExitBottom).
 */
export const WiringTab: React.FC<{
  want: Want;
  updateWant: (id: string, req: any) => Promise<void>;
  onWantUpdate?: () => void;
  globalStateKeys?: string[];
  initialImportKey?: string | null;
  onImportKeyConsumed?: () => void;
  initialExposeKey?: string | null;
  onExposeKeyConsumed?: () => void;
  sidebarDetailFocused?: boolean;
  focusRequest?: number;
}> = ({
  want, updateWant, onWantUpdate, globalStateKeys = [],
  initialImportKey, onImportKeyConsumed, initialExposeKey, onExposeKeyConsumed,
  sidebarDetailFocused = false, focusRequest,
}) => {
  const [imports, setImports] = useState<Record<string, string>>(want.spec?.imports ?? {});
  const [exposes, setExposes] = useState<ExposeEntry[]>(want.spec?.exposes ?? []);
  const [wantTypeDef, setWantTypeDef] = useState<import('@/types/wantType').WantTypeDetailResponse | null>(null);

  useEffect(() => { setImports(want.spec?.imports ?? {}); }, [want.spec?.imports]);
  useEffect(() => { setExposes(want.spec?.exposes ?? []); }, [want.spec?.exposes]);
  useEffect(() => {
    const typeName = want.metadata?.type;
    if (!typeName) return;
    apiClient.getWantType(typeName).then(def => setWantTypeDef(def)).catch(() => {});
  }, [want.metadata?.type]);

  const handleImportsChange = useCallback(async (newImports: Record<string, string>) => {
    const id = want.metadata?.id;
    if (!id) return;
    const old = imports;
    setImports(newImports);
    try {
      await updateWant(id, { metadata: want.metadata, spec: { ...want.spec, imports: newImports } });
      onWantUpdate?.();
    } catch { setImports(old); }
  }, [want, imports, updateWant, onWantUpdate]);

  const handleExposesChange = useCallback(async (newExposes: ExposeEntry[]) => {
    const id = want.metadata?.id;
    if (!id) return;
    const old = exposes;
    setExposes(newExposes);
    try {
      await updateWant(id, { metadata: want.metadata, spec: { ...want.spec, exposes: newExposes } });
      onWantUpdate?.();
    } catch { setExposes(old); }
  }, [want, exposes, updateWant, onWantUpdate]);

  // User-custom fields (added via the add-field UI) aren't part of the want type's
  // schema, so they never show up in wantTypeDef.state — merge synthetic entries in
  // so they're selectable in the "add expose" candidate list too.
  const customFieldNames = React.useMemo(() => new Set(readDefs(want).map(d => d.key)), [want]);
  const mergedStateDefs = React.useMemo(() => {
    const schema = wantTypeDef?.state ?? [];
    const schemaNames = new Set(schema.map(s => s.name));
    const custom: StateDef[] = Array.from(customFieldNames)
      .filter(name => !schemaNames.has(name))
      .map(name => ({ name, description: 'User custom field', type: 'string', persistent: true, exposable: false }));
    return [...schema, ...custom];
  }, [wantTypeDef, customFieldNames]);

  /**
   * Which half the keys are in. Two grids on one page cannot both listen, so
   * one holds them at a time and the arrows hand them over at the seam.
   *
   * Each half is nudged to its first card as it takes over — the same request
   * the sidebar makes when a tab is switched into, so arriving by arrow and
   * arriving by tab land the same way.
   */
  const [half, setHalf] = useState<'import' | 'expose'>('import');
  const [importArrival, setImportArrival] = useState(0);
  const [exposeArrival, setExposeArrival] = useState(0);
  const base = focusRequest ?? 0;
  // A key asked for from a field card decides which half opens: that is the
  // half the question was about.
  useEffect(() => { if (initialExposeKey) setHalf('expose'); }, [initialExposeKey]);
  useEffect(() => { if (initialImportKey) setHalf('import'); }, [initialImportKey]);

  return (
    <div className="h-full overflow-y-auto pt-1 px-3 sm:px-4 pb-3 space-y-4">
      <div>
        <WiringHeading icon={ArrowDownToLine} label="Import" count={Object.keys(imports).length}
          className="text-teal-500 dark:text-teal-400" />
        <ImportSection
          imports={imports}
          onImportsChange={handleImportsChange}
          stateDefs={wantTypeDef?.state}
          globalStateKeys={globalStateKeys}
          initialAddKey={initialImportKey}
          onInitialKeyConsumed={onImportKeyConsumed}
          isActive={sidebarDetailFocused && half === 'import'}
          focusRequest={base + importArrival}
          onExitBottom={() => { setHalf('expose'); setExposeArrival(t => t + 1); }}
        />
      </div>
      <div>
        <WiringHeading icon={ArrowUpFromLine} label="Expose" count={exposes.length}
          className="text-purple-500 dark:text-purple-400" />
        <ExposeSection
          exposes={exposes}
          onExposesChange={handleExposesChange}
          stateDefs={mergedStateDefs}
          customFieldNames={customFieldNames}
          initialAddKey={initialExposeKey}
          onInitialKeyConsumed={onExposeKeyConsumed}
          isActive={sidebarDetailFocused && half === 'expose'}
          focusRequest={base + exposeArrival}
          onExitTop={() => { setHalf('import'); setImportArrival(t => t + 1); }}
        />
      </div>
    </div>
  );
};

