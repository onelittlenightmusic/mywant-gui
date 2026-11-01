/** The History tab — past parameter, state and log snapshots. */
import React, { useEffect, useRef } from 'react';
import { usePanelAtBottom } from '@/hooks/useDisplaySettings';
import { Bot, FileText, Sparkles } from 'lucide-react';
import { outputSummary, outputWhen, shortWhen } from '@/utils/outputSummary';
import { outputEntryKey } from '@/stores/outputFocusStore';
import { guideOf, openWithGuide } from '@/lib/webGuide';
import { Want } from '@/types/want';
import { useSidebarFocusStore } from '@/stores/sidebarFocusStore';
import { SubTabBar } from '../SubTabBar';
import { useScrollKeys } from '@/hooks/useScrollKeys';

import { HistorySubTab } from './shared';
import { AgentsTab } from './AgentsTab';
import { HistoryCard } from './HistoryCard';



const lineCount = (text: string) => text.split('\n').filter(l => l.trim().length > 0).length;

const LogBody: React.FC<{ text: string }> = ({ text }) => (
  <pre className="text-[11px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words font-mono max-h-64 overflow-auto rounded-md bg-gray-50 dark:bg-gray-900 px-2 py-1.5">
    {text}
  </pre>
);

export const HistoryTab: React.FC<{
  want: Want;
  results: any;
  historySubTab: HistorySubTab;
  setHistorySubTab: (t: HistorySubTab) => void;
  /** An answer to light up and bring into view — see outputFocusStore. */
  highlightOutput?: string | null;
}> = ({ want, results, historySubTab, setHistorySubTab, highlightOutput }) => {
  const isBottom = usePanelAtBottom();

  /**
   * Up and down read the list, here for the same reason they do in the thing
   * panel: history is the one tab with nothing to walk, and without this a
   * long one had no bottom on a gamepad. See useScrollKeys.
   */
  const listRef = useRef<HTMLDivElement>(null);
  const panelHasKeys = useSidebarFocusStore(s => s.focused);
  useScrollKeys({
    target: () => listRef.current,
    enabled: panelHasKeys,
    scope: () => listRef.current?.closest<HTMLElement>('[data-sidebar="true"]') ?? null,
  });

  const hasLogHistory = !!(want.history?.logHistory && want.history.logHistory.length > 0);
  const hasLogs = !!(results?.logs && results.logs.length > 0);

  const hasLogContent = hasLogs || hasLogHistory;
  const hasAgentsContent = !!(
    want.current_agent ||
    (want.running_agents && want.running_agents.length > 0) ||
    (want.history?.agentHistory && want.history.agentHistory.length > 0)
  );

  const outputs = want.history?.resultHistory ?? [];
  // The answer asked about, scrolled to once it is drawn.
  useEffect(() => {
    if (historySubTab !== 'outputs' || !highlightOutput) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-output-key="${CSS.escape(highlightOutput)}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [historySubTab, highlightOutput, outputs.length]);

  const HISTORY_SUB_TABS = [
    { id: 'outputs' as HistorySubTab, label: 'Outputs', icon: Sparkles, hasData: outputs.length > 0 },
    { id: 'log'    as HistorySubTab, label: 'Log',    icon: FileText,  hasData: hasLogContent },
    { id: 'agents' as HistorySubTab, label: 'Agents', icon: Bot,       hasData: hasAgentsContent },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Sub-tab bar at TOP when header is at top */}
      {!isBottom && (
        <SubTabBar tabs={HISTORY_SUB_TABS} active={historySubTab} onChange={(id) => setHistorySubTab(id as HistorySubTab)} isBottom={false} />
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 sm:px-4 pt-1.5 pb-3">
        {/* What the want found — its answers, newest first. The same ones
            the board draws as balls beside the want; tapping one opens here
            with it lit. */}
        {historySubTab === 'outputs' && (
          <>
            {outputs.slice().reverse().map((entry, i, all) => {
              const key = outputEntryKey(entry);
              return (
                <HistoryCard
                  key={key}
                  kind="output"
                  dataAttrs={{ 'data-output-key': key }}
                  lit={key === highlightOutput}
                  last={i === all.length - 1}
                  title={(() => {
                    // An answer that is a place on a page (url + goto): a way
                    // there, from any want (lib/webGuide).
                    const place = guideOf(entry.result, want.state?.current?.goto_template);
                    const words = outputSummary(entry) || '—';
                    return place ? (
                      <button
                        type="button"
                        className="text-left underline decoration-dotted underline-offset-2 hover:decoration-solid"
                        onClick={(e) => { e.stopPropagation(); openWithGuide(want.metadata.id ?? '', place.url, place.goto); }}
                      >
                        {words}
                      </button>
                    ) : words;
                  })()}
                  when={shortWhen(outputWhen(entry))}
                  meta={entry.type}
                />
              );
            })}
            {outputs.length === 0 && (
              <div className="text-center py-10 text-gray-400 dark:text-gray-500">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No outputs yet</p>
              </div>
            )}
          </>
        )}

        {historySubTab === 'log' && (
          <>
            {(() => {
              // The run's own log first, then what the history kept, newest first.
              const logs = [
                ...(results?.logs ?? []).map((text: string) => ({ title: 'Execution log', text, when: undefined as string | undefined })),
                ...(want.history?.logHistory ?? []).slice().reverse().map((e: any) => ({ title: 'Log', text: e.logs || '', when: e.timestamp ? shortWhen(e.timestamp) : undefined })),
              ];
              return logs.map((l, i) => (
                <HistoryCard
                  key={i}
                  kind="log"
                  last={i === logs.length - 1}
                  title={l.title}
                  when={l.when}
                  meta={`${lineCount(l.text)}行`}
                >
                  <LogBody text={l.text} />
                </HistoryCard>
              ));
            })()}
            {!hasLogContent && (
              <div className="text-center py-10 text-gray-400 dark:text-gray-500">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No logs available</p>
              </div>
            )}
          </>
        )}

        {historySubTab === 'agents' && (
          <AgentsTab want={want} />
        )}
      </div>
      {/* Sub-tab bar at BOTTOM when header is at bottom */}
      {isBottom && (
        <SubTabBar tabs={HISTORY_SUB_TABS} active={historySubTab} onChange={(id) => setHistorySubTab(id as HistorySubTab)} isBottom={true} />
      )}
    </div>
  );
};
