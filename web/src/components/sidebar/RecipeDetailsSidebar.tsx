import React, { useState } from 'react';
import { usePanelAtBottom } from '@/hooks/useDisplaySettings';
import { RecipeCard } from '@/components/dashboard/RecipeCard';
import { BookOpen, Settings, List, FileText, Play, Lightbulb } from 'lucide-react';
import { SidebarTabBar } from '@/components/common/SidebarTabBar';
import { useSidebarTabNav } from '@/hooks/useSidebarTabNav';
import { useConfigStore } from '@/stores/configStore';
import { RecipeExampleDef } from '@/types/recipe';
import { GenericRecipe } from '@/types/recipe';
import { classNames, truncateText } from '@/utils/helpers';
import { getBackgroundImage } from '@/utils/backgroundStyles';
import {
  TabContent,
  TabSection,
  TabGrid,
  InfoRow,
  EmptyState,
} from './DetailsSidebar';

interface RecipeDetailsSidebarProps {
  recipe: GenericRecipe | null;
  /** Deploys one named example chosen in the Examples tab. Deploying the
   *  recipe itself, editing, downloading and deleting are card overlay
   *  actions (see components/dashboard/RecipeCard). */
  onDeployExampleDef?: (recipe: GenericRecipe, params: Record<string, any>) => Promise<void>;
  onDeploySuccess?: (message: string) => void;
  /** The card overlay's own actions. Without these the embedded card renders
   *  them greyed out — EntityCard disables any action with no handler. */
  onEdit?: (recipe: GenericRecipe) => void;
  onDelete?: (recipe: GenericRecipe) => void;
  onDeploy?: (recipe: GenericRecipe) => void;
  onDeployExample?: (recipe: GenericRecipe) => void;
  onDownload?: (recipe: GenericRecipe) => void;
  onDeployError?: (error: string) => void;
  loading?: boolean;
}

type TabType = 'overview' | 'parameters' | 'wants' | 'results' | 'examples';

export const RecipeDetailsSidebar: React.FC<RecipeDetailsSidebarProps> = ({
  recipe,
  onEdit,
  onDelete,
  onDeploy,
  onDeployExample,
  onDownload,
  onDeployExampleDef,
  onDeploySuccess,
  onDeployError,
  loading = false
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [deploying, setDeploying] = useState(false);
  const config = useConfigStore(s => s.config);
  const isBottom = usePanelAtBottom();

  const tabs = React.useMemo(() => {
    const baseTabs = [
      { id: 'overview' as TabType, label: 'Overview', icon: FileText },
      { id: 'parameters' as TabType, label: 'Parameters', icon: Settings },
      { id: 'wants' as TabType, label: 'Wants', icon: List },
      { id: 'results' as TabType, label: 'Results', icon: BookOpen },
    ];
    if ((recipe?.recipe.examples?.length ?? 0) > 0) {
      baseTabs.push({ id: 'examples' as TabType, label: 'Examples', icon: Lightbulb });
    }
    return baseTabs;
  }, [recipe?.recipe.examples]);

  // Keyboard Tab + Gamepad L/R bumpers cycle through tabs
  useSidebarTabNav({
    tabs,
    activeTab,
    onTabChange: (id) => setActiveTab(id as TabType),
    enabled: !!recipe,
  });

  if (!recipe) {
    return (
      <div className="text-center py-12">
        <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Select a recipe to view details</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Deploy / Example / Edit / Download / Delete live on the recipe card's
          overlay grid, so they are reachable the same way on every page — and
          the card is embedded right here, above the tabs, so that grid is
          reachable even on a phone, where the sheet covers the page behind it.
          `selected` matters: EntityCard shuts an overlay opened on a card it
          does not consider selected. */}
      {/* order-first alongside the tab body: when the sheet docks to the
          bottom the content is re-ordered above the tab bar, and a card left at
          DOM order would sink below it. Both being order-first keeps DOM order
          between them, so the card stays first. */}
      <div className={classNames('flex-shrink-0 px-3 pt-3 h-32 sm:h-36', isBottom ? 'order-first' : '')}>
        <RecipeCard
          recipe={recipe}
          selected
          keepFocus
          onView={() => {}}
          onEdit={(r) => onEdit?.(r)}
          onDelete={(r) => onDelete?.(r)}
          onDeploy={onDeploy}
          onDeployExample={onDeployExample}
          onDownload={onDownload}
        />
      </div>

      {/* Tab Navigation */}
      <SidebarTabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabType)}
        isBottom={isBottom}
      />

      {/* Content */}
      <div className={classNames('flex-1 overflow-y-auto', isBottom ? 'order-first' : '')}>
        {activeTab === 'overview' && <OverviewTab recipe={recipe} />}
        {activeTab === 'parameters' && <ParametersTab recipe={recipe} />}
        {activeTab === 'wants' && <WantsTab recipe={recipe} />}
        {activeTab === 'results' && <ResultsTab recipe={recipe} />}
        {activeTab === 'examples' && (
          <ExamplesTab
            recipe={recipe}
            deploying={deploying}
            setDeploying={setDeploying}
            onDeployExampleDef={onDeployExampleDef}
            onDeploySuccess={onDeploySuccess}
            onDeployError={onDeployError}
          />
        )}
      </div>
    </div>
  );
};

// Helper functions
const formatParameterValue = (value: any) => {
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
};

const formatWantParams = (params: any) => {
  if (!params || Object.keys(params).length === 0) {
    return 'No parameters';
  }
  return JSON.stringify(params, null, 2);
};

// Tab Components
const OverviewTab: React.FC<{ recipe: GenericRecipe }> = ({ recipe }) => (
  <TabContent>
    <TabSection title="Metadata">
      <div className="space-y-3">
        <InfoRow label="Name" value={recipe.recipe.metadata.name} />
        {recipe.recipe.metadata.version && (
          <InfoRow label="Version" value={<span className="font-mono">{recipe.recipe.metadata.version}</span>} />
        )}
        {recipe.recipe.metadata.custom_type && (
          <InfoRow label="Custom Type" value={recipe.recipe.metadata.custom_type} />
        )}
        {recipe.recipe.metadata.description && (
          <div>
            <dt className="text-sm text-gray-600 mb-1">Description:</dt>
            <dd className="text-sm font-medium text-gray-900">{recipe.recipe.metadata.description}</dd>
          </div>
        )}
      </div>
    </TabSection>

    <TabSection title="Summary">
      <div className="space-y-3">
        <InfoRow
          label="Parameters"
          value={recipe.recipe.parameters?.length ?? 0}
        />
        <InfoRow label="Wants" value={recipe.recipe.wants?.length || 0} />
        <InfoRow
          label="Results"
          value={recipe.recipe.result ? recipe.recipe.result.length : 0}
        />
      </div>
    </TabSection>
  </TabContent>
);

const ParametersTab: React.FC<{ recipe: GenericRecipe }> = ({ recipe }) => (
  <TabContent>
    {recipe.recipe.parameters && recipe.recipe.parameters.length > 0 ? (
      <div className="space-y-4">
        {recipe.recipe.parameters.map((param) => (
            <TabSection key={param.name} title={param.name}>
              <div className="space-y-3">
                {param.description && (
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Description:</p>
                    <p className="text-sm text-gray-700">{param.description}</p>
                  </div>
                )}
                {param.type && (
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Type:</p>
                    <p className="text-sm text-gray-700">{param.type}</p>
                  </div>
                )}
                {param.validation?.min !== undefined && param.validation?.max !== undefined && (
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Range:</p>
                    <p className="text-sm text-gray-700">{param.validation.min} – {param.validation.max}</p>
                  </div>
                )}
                {param.validation?.enum && (
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Options:</p>
                    <p className="text-sm text-gray-700">{(param.validation.enum as string[]).join(', ')}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-600 mb-2">Default Value:</p>
                  <pre className="text-xs text-gray-800 bg-gray-50 p-3 rounded border overflow-x-auto whitespace-pre-wrap">
                    {formatParameterValue(param.default)}
                  </pre>
                </div>
              </div>
            </TabSection>
          ))}
      </div>
    ) : (
      <EmptyState icon={Settings} message="No parameters defined for this recipe" />
    )}
  </TabContent>
);

const WantsTab: React.FC<{ recipe: GenericRecipe }> = ({ recipe }) => (
  <TabContent>
    {recipe.recipe.wants && recipe.recipe.wants.length > 0 ? (
      <div className="space-y-3">
        {recipe.recipe.wants.map((want, index) => (
          <RecipeWantCard key={index} want={want} index={index} />
        ))}
      </div>
    ) : (
      <EmptyState icon={List} message="No wants defined for this recipe" />
    )}
  </TabContent>
);

// Child want card component for recipe wants display
interface RecipeWantCardProps {
  want: any;
  index: number;
}

const RecipeWantCard: React.FC<RecipeWantCardProps> = ({ want, index }) => {
  const wantType = want.type || want.metadata?.type || 'unknown';
  const wantName = want.metadata?.name || want.name || `Want ${index + 1}`;
  const labels = want.metadata?.labels || want.labels || {};
  const params = want.params || want.spec?.params || {};
  const using = want.using || want.spec?.using || [];

  // Get background image based on want type - uses shared utility from backgroundStyles

  const backgroundImage = getBackgroundImage(wantType);

  return (
    <div
      className={classNames(
        "relative overflow-hidden rounded-md border hover:shadow-sm transition-all duration-200 cursor-default",
        "border-gray-200 hover:border-gray-300"
      )}
      style={backgroundImage ? {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: '100% auto',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'scroll'
      } : { backgroundColor: 'white' }}
    >
      {/* Content wrapper with semi-transparent background */}
      <div className={classNames('p-3', backgroundImage ? 'bg-white bg-opacity-70 relative z-10' : 'bg-white')}>
        {/* Header with Type and Name */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 truncate">
              {wantType}
            </h4>
            <p className="text-xs text-gray-500 mt-1 truncate">
              {wantName}
            </p>
          </div>
        </div>

        {/* Content Grid */}
        <div className="space-y-3">
        {/* Parameters Section */}
        {Object.keys(params).length > 0 && (
          <div>
            <h5 className="text-xs font-medium text-gray-700 mb-1">Parameters</h5>
            <div className="flex flex-wrap gap-1">
              {Object.entries(params).map(([key, value]) => (
                <span key={key} className="text-xs bg-blue-50 text-blue-800 px-2 py-1 rounded border border-blue-200">
                  <span className="font-medium">{key}:</span> {String(value).substring(0, 20)}
                  {String(value).length > 20 ? '...' : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Labels Section */}
        {Object.keys(labels).length > 0 && (
          <div>
            <h5 className="text-xs font-medium text-gray-700 mb-1">Labels</h5>
            <div className="flex flex-wrap gap-1">
              {Object.entries(labels as Record<string, any>).map(([key, value]) => {
                const labelText = `${key}=${value}`;
                const displayText = truncateText(labelText, 20);
                return (
                  <span key={key} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded border border-green-300" title={labelText.length > 20 ? labelText : undefined}>
                    {displayText}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Using Selectors Section */}
        {using && using.length > 0 && (
          <div>
            <h5 className="text-xs font-medium text-gray-700 mb-1">Dependencies</h5>
            <div className="flex flex-wrap gap-1">
              {using.map((selector, idx) => (
                <span key={idx} className="text-xs bg-amber-50 text-amber-800 px-2 py-1 rounded border border-amber-200">
                  {Object.entries(selector as Record<string, string>)
                    .map(([k, v]) => `${k}:${v}`)
                    .join(', ')}
                </span>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

const ResultsTab: React.FC<{ recipe: GenericRecipe }> = ({ recipe }) => (
  <TabContent>
    {recipe.recipe.result && recipe.recipe.result.length > 0 ? (
      <div className="space-y-4">
        {recipe.recipe.result.map((result, index) => (
          <TabSection key={index} title={`Result ${index + 1}`}>
            <div className="space-y-3">
              <InfoRow label="Want Name" value={<span className="font-mono">{result.want_name}</span>} />
              <InfoRow label="Stat Name" value={<span className="font-mono">{result.stat_name}</span>} />
              {result.description && (
                <div>
                  <dt className="text-sm text-gray-600 mb-1">Description:</dt>
                  <dd className="text-sm font-medium text-gray-900">{result.description}</dd>
                </div>
              )}
            </div>
          </TabSection>
        ))}
      </div>
    ) : (
      <EmptyState icon={BookOpen} message="No result configuration defined for this recipe" />
    )}
  </TabContent>
);

interface ExamplesTabProps {
  recipe: GenericRecipe;
  deploying: boolean;
  setDeploying: (v: boolean) => void;
  onDeployExampleDef?: (recipe: GenericRecipe, params: Record<string, any>) => Promise<void>;
  onDeploySuccess?: (message: string) => void;
  onDeployError?: (error: string) => void;
}

const ExamplesTab: React.FC<ExamplesTabProps> = ({
  recipe,
  deploying,
  setDeploying,
  onDeployExampleDef,
  onDeploySuccess,
  onDeployError,
}) => {
  const examples = recipe.recipe.examples ?? [];

  const handleDeploy = async (example: RecipeExampleDef) => {
    if (!onDeployExampleDef || deploying) return;
    setDeploying(true);
    try {
      await onDeployExampleDef(recipe, example.params ?? {});
      onDeploySuccess?.(`"${example.name}" deployed successfully!`);
    } catch (err) {
      onDeployError?.(err instanceof Error ? err.message : 'Deploy failed');
    } finally {
      setDeploying(false);
    }
  };

  if (examples.length === 0) {
    return <EmptyState icon={Lightbulb} message="No examples defined for this recipe" />;
  }

  return (
    <TabContent>
      <div className="space-y-4">
        {examples.map((example, index) => (
          <TabSection key={index} title={example.name}>
            <div className="space-y-3">
              {example.description && (
                <p className="text-sm text-gray-600">{example.description}</p>
              )}
              {example.expectedBehavior && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Expected behavior:</p>
                  <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded border">{example.expectedBehavior}</p>
                </div>
              )}
              {example.params && Object.keys(example.params).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Parameters:</p>
                  <div className="space-y-1">
                    {Object.entries(example.params).map(([key, value]) => (
                      <div key={key} className="flex items-start gap-2 text-xs">
                        <span className="font-mono text-blue-700 font-medium min-w-0 shrink-0">{key}:</span>
                        <span className="text-gray-700 break-all">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={() => handleDeploy(example)}
                disabled={deploying}
                className={classNames(
                  'w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors',
                  deploying
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                )}
              >
                <Play className="h-3 w-3" />
                この例で試す
              </button>
            </div>
          </TabSection>
        ))}
      </div>
    </TabContent>
  );
};

/**
 * Convert object to YAML string
 */
function convertToYAML(obj: any, indent = 0): string {
  const spaces = ' '.repeat(indent);
  let result = '';

  if (Array.isArray(obj)) {
    obj.forEach((item) => {
      if (typeof item === 'object' && item !== null) {
        // For array items that are objects, format as YAML list items
        const itemYaml = convertToYAML(item, indent + 2);
        result += `${spaces}- ${itemYaml.substring(indent + 2)}`;
      } else {
        result += `${spaces}- ${item}\n`;
      }
    });
  } else if (typeof obj === 'object' && obj !== null) {
    // Filter out null, undefined, and empty values
    const entries = Object.entries(obj).filter(([, value]) => {
      if (value === null || value === undefined) return false;
      if (typeof value === 'object' && Object.keys(value).length === 0 && !Array.isArray(value)) return false;
      return true;
    });

    entries.forEach(([key, value]) => {
      result += `${spaces}${key}`;
      if (Array.isArray(value)) {
        result += `:\n${convertToYAML(value, indent + 2)}`;
      } else if (typeof value === 'object' && value !== null) {
        result += `:\n${convertToYAML(value, indent + 2)}`;
      } else if (typeof value === 'string') {
        result += `: "${value}"\n`;
      } else if (typeof value === 'boolean' || typeof value === 'number') {
        result += `: ${value}\n`;
      } else {
        result += `: ${JSON.stringify(value)}\n`;
      }
    });
  }

  return result;
}

/**
 * Download recipe as YAML file
 */
export function downloadRecipeYAML(recipe: GenericRecipe): void {
  const recipeName = recipe.recipe.metadata.name || 'recipe';
  const yamlContent = `recipe:\n${convertToYAML(recipe.recipe, 2)}`;

  const element = document.createElement('a');
  element.setAttribute(
    'href',
    `data:text/yaml;charset=utf-8,${encodeURIComponent(yamlContent)}`
  );
  element.setAttribute('download', `${recipeName}.yaml`);
  element.style.display = 'none';

  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}