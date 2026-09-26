/** The Results tab — this want's current/goal/plan state, plus its user-added fields. */
import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Eye, Bot, Edit, FileText, ChevronDown, ChevronRight, Database, Plus, Eraser, Sparkles, UserCog } from 'lucide-react';
import { Want } from '@/types/want';
import { classNames } from '@/utils/helpers';
import { CONTROL_MIN_H, CONTROL_ICON_CLASS } from '@/design/controls';
import { WantCard } from '@/components/dashboard/WantCard/WantCard';
import { isPlainObject } from '@/components/common/ObjectResultDisplay';
import { DerivedFieldEditor, readDefs, deleteDerivedField } from '@/components/sidebar/DerivedFieldEditor';
import { StateDef } from '@/types/wantType';
import { ExposeEntry } from '@/components/forms/sections/ExposeSection';
import { apiClient } from '@/api/client';
import { Recommendation } from '@/types/interact';
import {
  DetailsSidebar,
  TabContent,
  TabSection,
  TabGrid,
  EmptyState,
  InfoRow,
  TabConfig
} from '../DetailsSidebar';
import { useInputActions } from '@/hooks/useInputActions';
import { useCardGridNavigation } from '@/hooks/useCardGridNavigation';

import { SECTION_CONTAINER_CLASS } from './shared';
import { NestedCard } from './NestedCard';
import { StateFieldCard, sortStateEntries } from './StateFieldCard';
import { StateSectionCards } from './StateSectionCards';
import { JsonFieldCard } from './JsonFieldCard';


// Fields added via the add-field UI (DerivedFieldEditor). Rendered separately from the
// regular Current grid so schema-declared and user-authored fields stay visually distinct.
// JSON-shaped values (object) get the nested JsonFieldCard; scalar/text values reuse the
// standard StateFieldCard.
const UserCustomSection: React.FC<{
  entries: [string, unknown][];
  stateDefs?: StateDef[];
  exposes?: ExposeEntry[];
  imports?: Record<string, string>;
  /** subType declared via the add-field UI's subtype picker, keyed by field name. */
  subTypes?: Map<string, string>;
  onGoToExpose?: (key?: string) => void;
  onGoToImport?: (key?: string) => void;
  onDeleteField?: (key: string) => void;
  onEditField?: (key: string) => void;
  /** The add-field UI (DerivedFieldEditor) — rendered as the grid's trailing
   * cell so its collapsed "add field" tile matches the other cards' size,
   * instead of a separate full-width row below the grid. */
  derivedFieldEditor: React.ReactNode;
  /** Whether this section's tab is showing — enables grid keyboard/gamepad nav. */
  isActive?: boolean;
  /** A card here was clicked — see StateSectionCards' note of the same name. */
  onFieldFocused?: () => void;
}> = ({ entries, stateDefs, exposes, imports, subTypes, onGoToExpose, onGoToImport, onDeleteField, onEditField, derivedFieldEditor, isActive = true, onFieldFocused }) => {
  // Same navigation contract as the schema-declared field grid above: arrows
  // move the focus ring, Shift+Enter / gamepad Start opens the focused card's
  // action overlay. Previously these cards were right-click only.
  const [navFocused, setNavFocused] = useState(-1);
  const [activatedIndex, setActivatedIndex] = useState<number | null>(null);
  const [nameIndex, setNameIndex] = useState<number | null>(null);
  const [followIndex, setFollowIndex] = useState<number | null>(null);

  const { gridProps: navGridProps } = useCardGridNavigation({
    count: entries.length,
    cols: 2,
    isActive,
    focusedIndex: navFocused,
    setFocusedIndex: setNavFocused,
    onContextMenu: (i) => setActivatedIndex(i),
    onButtonX: (i) => setNameIndex(i),
    onYButton: (i) => setFollowIndex(i),
  });

  useEffect(() => {
    if (!isActive) setNavFocused(-1);
  }, [isActive]);

  return (
  <div>
    <div className="flex items-center gap-1.5 mb-2">
      <UserCog className="w-3 h-3 text-gray-400 dark:text-gray-500" />
      <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">User Custom</span>
      <span className="text-[10px] text-gray-400 dark:text-gray-500">({entries.length})</span>
    </div>
    <div className="grid grid-cols-3 sm:grid-cols-2 gap-2 sm:gap-3 outline-none" {...navGridProps}>
      {entries.map(([k, v], i) => (
        isPlainObject(v)
          ? <JsonFieldCard key={k} name={k} value={v as Record<string, unknown>} declaredSubType={subTypes?.get(k)} exposes={exposes} onGoToExpose={onGoToExpose} onDelete={onDeleteField ? () => onDeleteField(k) : undefined} onEdit={onEditField ? () => onEditField(k) : undefined}
              isFocused={navFocused === i} activated={activatedIndex === i} onActivationConsumed={() => setActivatedIndex(null)} onFocusRequest={() => { setNavFocused(i); onFieldFocused?.(); }} />
          : <StateFieldCard key={k} name={k} value={v} declaredSubType={subTypes?.get(k)} stateDefs={stateDefs} exposes={exposes} imports={imports} onGoToExpose={onGoToExpose} onGoToImport={onGoToImport} onDelete={onDeleteField ? () => onDeleteField(k) : undefined} onEdit={onEditField ? () => onEditField(k) : undefined}
              nameRequest={nameIndex === i} onNameRequestConsumed={() => setNameIndex(null)}
              followRequest={followIndex === i} onFollowRequestConsumed={() => setFollowIndex(null)}
              isFocused={navFocused === i} activated={activatedIndex === i} onActivationConsumed={() => setActivatedIndex(null)} onFocusRequest={() => { setNavFocused(i); onFieldFocused?.(); }} />
      ))}
      {derivedFieldEditor}
    </div>
  </div>
  );
};

export const ResultsTab: React.FC<{
  want: Want;
  /**
   * Up from the top row of the fields: hand focus back to the panel's card.
   *
   * The card itself is no longer this tab's to draw — it stands above the tab
   * bar now — but this tab is still what the arrows walk down into from it, so
   * the way back up still starts here.
   */
  onBackToCard?: () => void;
  /**
   * A field card here was clicked, so the arrows belong to this tab now.
   *
   * The mirror of onBackToCard: that one is the walk leaving the fields upward,
   * this one is the mouse arriving in them without a walk at all.
   */
  onFieldFocused?: () => void;
  onRecommendationSelect?: (rec: Recommendation) => void;
  onClearState?: () => void;
  stateDefs?: StateDef[];
  onGoToExpose?: (key?: string) => void;
  onGoToImport?: (key?: string) => void;
  onWantUpdate?: () => void;
  sidebarDetailFocused?: boolean;
}> = ({ want, onBackToCard, onFieldFocused, onRecommendationSelect, onClearState, stateDefs: statDefsFromParent, onGoToExpose, onGoToImport, onWantUpdate, sidebarDetailFocused = false }) => {
  const exposes: ExposeEntry[] = want.spec?.exposes ?? [];
  const imports: Record<string, string> = want.spec?.imports ?? {};

  const [fetchedStateDefs, setFetchedStateDefs] = useState<StateDef[] | undefined>(undefined);
  useEffect(() => {
    const typeName = want.metadata?.type;
    if (!typeName) { setFetchedStateDefs(undefined); return; }
    apiClient.getWantType(typeName).then(def => setFetchedStateDefs(def.state)).catch(() => setFetchedStateDefs(undefined));
  }, [want.metadata?.type]);
  const stateDefs = statDefsFromParent ?? fetchedStateDefs;
  const recommendations: Recommendation[] =
    (want.state?.current?.proposed_recommendations as Recommendation[]) ||
    (want.state?.current?.recommendations as Recommendation[]) || [];
  const ts = want.state_timestamps;

  const SYSTEM_KEYS = new Set(['proposed_recommendations', 'proposed_breakdown', 'proposed_response', 'recommendations', 'interactive']);

  const currentEntries = sortStateEntries(
    want.state?.current as Record<string, unknown> ?? {}, stateDefs, ts
  ).filter(([k]) => !SYSTEM_KEYS.has(k));
  const goalEntries = sortStateEntries(
    want.state?.goal as Record<string, unknown> ?? {}, stateDefs, ts
  );
  const planEntries = sortStateEntries(
    want.state?.plan as Record<string, unknown> ?? {}, stateDefs, ts
  );

  // Fields added via the add-field UI (DerivedFieldEditor) render separately in a
  // "User Custom" area instead of mixed into the regular Current grid.
  const derivedDefs = readDefs(want);
  const userCustomKeys = new Set(derivedDefs.map(d => d.key));
  const regularCurrentEntries = currentEntries.filter(([k]) => !userCustomKeys.has(k));
  const userCustomEntries = currentEntries.filter(([k]) => userCustomKeys.has(k));
  // Declared subType hint from the add-field UI, keyed by field name — falls back
  // in the card's subtype resolution when the value isn't itself self-descriptive.
  const userCustomSubTypes = new Map(derivedDefs.filter(d => d.subType).map(d => [d.key, d.subType as string]));

  // Key of the user-custom field currently being edited (from a field card's Edit
  // overlay action) — reopens DerivedFieldEditor pre-filled with its definition.
  const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
  const editingDef = editingFieldKey ? derivedDefs.find(d => d.key === editingFieldKey) ?? null : null;

  const hasCurrent = currentEntries.length > 0;
  const hasGoal = goalEntries.length > 0;
  const hasPlan = planEntries.length > 0;
  const navActiveSection = hasCurrent ? 'current' : hasGoal ? 'goal' : 'plan';
  const hasHiddenState = !!(want.hidden_state && Object.keys(want.hidden_state).length > 0);


  // Which section's title row carries the eraser: the first one on screen.
  //
  // Not simply "Current", because Current is not always the section that
  // renders — a want may have only a goal, or only hidden state — and an
  // action attached to a section nobody drew is an action nobody can reach.
  const clearHost = !onClearState ? null
    : regularCurrentEntries.length > 0 ? 'current'
    : hasGoal ? 'goal'
    : hasPlan ? 'plan'
    : hasHiddenState ? 'hidden'
    : null;

  const clearStateButton = onClearState ? (
    <button
      onClick={onClearState}
      title="Clear all state data"
      aria-label="Clear all state data"
      className={classNames(
        CONTROL_MIN_H.sm,
        'flex items-center justify-center px-2 rounded-md transition-colors',
        'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20',
      )}
    >
      <Eraser className={CONTROL_ICON_CLASS.sm} />
    </button>
  ) : null;
  const [isHiddenStateExpanded, setIsHiddenStateExpanded] = useState(false);
  const hasFinalResult = want.state?.final_result != null && want.state?.final_result !== '';
  const [finalResultCopied, setFinalResultCopied] = useState(false);

  const proposedBreakdown = want.state?.current?.proposed_breakdown as any[] | undefined;
  const proposedResponse = want.state?.current?.proposed_response as string | undefined;

  const handleCopyFinalResult = () => {
    const value = want.state?.final_result;
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    navigator.clipboard.writeText(text).then(() => {
      setFinalResultCopied(true);
      setTimeout(() => setFinalResultCopied(false), 1500);
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 pt-0 pb-3 sm:pb-4">
        <div className="space-y-4 pt-1">

          {/* AI Ideas Section */}
          {recommendations.length > 0 && (
            <TabSection title="AI Ideas" className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
              <div className="flex items-center gap-2 mb-3 text-blue-700 dark:text-blue-300">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-medium italic">Select an idea to materialize into a real want.</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {recommendations.map((rec) => (
                  <button
                    key={rec.id}
                    onClick={() => onRecommendationSelect?.(rec)}
                    className="flex items-center gap-3 w-full text-left p-3 rounded-lg bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition-all group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">{rec.title}</div>
                      {rec.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{rec.description}</div>
                      )}
                    </div>
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="h-5 w-5" />
                    </div>
                  </button>
                ))}
              </div>
            </TabSection>
          )}

          {/* AI Decomposition Proposal */}
          {proposedBreakdown && proposedBreakdown.length > 0 && (
            <TabSection title="AI Decomposition Proposal" className="bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30">
              <div className="flex items-center gap-2 mb-3 text-purple-700 dark:text-purple-300">
                <Bot className="h-4 w-4" />
                <span className="text-xs font-medium italic">Approve this plan on the card to execute.</span>
              </div>
              {proposedResponse && (
                <div className="mb-4 text-sm text-purple-800 dark:text-purple-300 leading-relaxed italic border-l-2 border-purple-300 dark:border-purple-700 pl-3">
                  "{proposedResponse}"
                </div>
              )}
              <div className="space-y-3">
                {proposedBreakdown.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-2.5 rounded-md bg-white/60 dark:bg-gray-800/60 border border-purple-100/50 dark:border-purple-800/50">
                    <div className="mt-1 w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-[10px] font-bold text-purple-600 dark:text-purple-400 flex-shrink-0">{idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-tight">{item.type}</span>
                      </div>
                      <p className="text-xs text-gray-700 dark:text-gray-200 font-medium leading-normal">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </TabSection>
          )}

          {/* The want's own card used to stand here, at the top of this one
              tab. It is the panel's card, not the Results tab's, so it now
              lives above the tab bar where every other detail panel keeps
              theirs — see the sidebar shell. */}

          {/* Clearing the state belongs to the state, so it rides the title row
              of whichever section is showing first rather than a band of its
              own at the foot of the panel. */}
          {/* Current / Goal / Plan as state field cards */}
          {regularCurrentEntries.length > 0 && <StateSectionCards action={clearHost === 'current' ? clearStateButton : undefined} entries={regularCurrentEntries} icon={Eye} label="Current" stateDefs={stateDefs} exposes={exposes} imports={imports} onGoToExpose={onGoToExpose} onGoToImport={onGoToImport} wantId={want.metadata?.id} wantType={want.metadata?.type} section="current" onExitTop={onBackToCard} onFieldFocused={onFieldFocused} isActive={sidebarDetailFocused && navActiveSection === 'current'} />}
          {/* Always rendered (even with 0 custom fields yet) so the "add field"
              tile — now a same-size grid cell, not a separate full-width row
              — has a consistent place to live. */}
          <UserCustomSection
            entries={userCustomEntries}
            stateDefs={stateDefs}
            exposes={exposes}
            imports={imports}
            subTypes={userCustomSubTypes}
            onGoToExpose={onGoToExpose}
            onGoToImport={onGoToImport}
            onDeleteField={(key) => { deleteDerivedField(want, key).then(() => onWantUpdate?.()); }}
            onEditField={(key) => setEditingFieldKey(key)}
            // Unlike the Current/Goal/Plan sections this one never auto-focuses
            // a card, so it can stay "active" alongside them: useInputActions
            // resolves the capture slot by which grid actually holds DOM focus.
            isActive={sidebarDetailFocused}
            onFieldFocused={onFieldFocused}
            derivedFieldEditor={
              <DerivedFieldEditor
                want={want}
                fieldNames={currentEntries.map(([k]) => k)}
                onSaved={onWantUpdate}
                editTarget={editingDef}
                onEditConsumed={() => setEditingFieldKey(null)}
              />
            }
          />
          {hasGoal    && <StateSectionCards action={clearHost === 'goal' ? clearStateButton : undefined} entries={goalEntries}   icon={Sparkles} label="Goal"    stateDefs={stateDefs} exposes={exposes} imports={imports} onGoToExpose={onGoToExpose} onGoToImport={onGoToImport} wantId={want.metadata?.id} wantType={want.metadata?.type} section="goal" onExitTop={onBackToCard} onFieldFocused={onFieldFocused} isActive={sidebarDetailFocused && navActiveSection === 'goal'} />}
          {hasPlan    && <StateSectionCards action={clearHost === 'plan' ? clearStateButton : undefined} entries={planEntries}   icon={FileText} label="Plan"    stateDefs={stateDefs} exposes={exposes} imports={imports} onGoToExpose={onGoToExpose} onGoToImport={onGoToImport} wantId={want.metadata?.id} wantType={want.metadata?.type} section="plan" onExitTop={onBackToCard} onFieldFocused={onFieldFocused} isActive={sidebarDetailFocused && navActiveSection === 'plan'} />}

          {/* Hidden State */}
          {hasHiddenState && (
            <>
              <button
                onClick={() => setIsHiddenStateExpanded(!isHiddenStateExpanded)}
                className="flex items-center gap-2 font-medium text-gray-800 dark:text-gray-200 text-sm hover:text-gray-900 dark:hover:text-white py-2 mt-2 transition-colors"
              >
                {isHiddenStateExpanded ? <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />}
                Hidden State
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">({Object.keys(want.hidden_state).length})</span>
              </button>
              {clearHost === 'hidden' && <div className="flex justify-end -mt-9 mb-2">{clearStateButton}</div>}
              {isHiddenStateExpanded && (
                <div className={SECTION_CONTAINER_CLASS}><NestedCard data={want.hidden_state} /></div>
              )}
            </>
          )}

          {!hasFinalResult && !hasCurrent && !hasGoal && !hasPlan && !hasHiddenState && recommendations.length === 0 && (
            <div className="text-center py-12">
              <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No state data available</p>
              <p className="text-xs text-gray-400 mt-2">State will appear here once the want executes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

