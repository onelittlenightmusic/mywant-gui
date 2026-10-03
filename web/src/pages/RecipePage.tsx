import { useHostPanel } from '@/lib/nativeHost';
import { useState, useEffect, useRef, useCallback } from 'react';
import { notify } from '@/stores/noticeStore';
import { Plus } from 'lucide-react';
import { useRecipeStore } from '@/stores/recipeStore';
import { useWantStore } from '@/stores/wantStore';
import { useUIStore } from '@/stores/uiStore';
import { GenericRecipe } from '@/types/recipe';
import { useDashboardNav } from '@/hooks/useDashboardNav';
import { useGridCols } from '@/hooks/useGridCols';
import { useRightSidebarExclusivity } from '@/hooks/useRightSidebarExclusivity';
import RecipeModal from '@/components/modals/RecipeModal';
import { RecipeDetailsSidebar, downloadRecipeYAML } from '@/components/sidebar/RecipeDetailsSidebar';
import { useCardOverlayStore, entityCardId } from '@/stores/cardOverlayStore';
import { useAppSidebar } from '@/hooks/useAppSidebar';
import { useAppHeader } from '@/hooks/useAppHeader';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { RecipeGrid } from '@/components/dashboard/RecipeGrid';


export default function RecipePage() {
  const toggleCardOverlay = useCardOverlayStore(s => s.toggleCardOverlay);
  const {
    recipes,
    loading,
    error,
    fetchRecipes,
    deleteRecipe,
    clearError,
  } = useRecipeStore();

  const {
    createWant,
  } = useWantStore();

  // UI State
  const sidebar = useRightSidebarExclusivity<GenericRecipe>();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<GenericRecipe | null>(null);
  // Notices speak through the robot's bubble (the app-wide RobotCursor), so this
  // page holds no notification state and renders no toast of its own. The wrapper
  // keeps the {message, type} call shape; severity, which a spoken bubble has no
  // colour for, is carried by the ✗ marker — the same convention as elsewhere.
  const setNotification = useCallback((n: { message: string; type: 'success' | 'error' }) => {
    notify(n.type === 'error' ? `✗ ${n.message}` : n.message);
  }, []);
  const [filteredRecipes, setFilteredRecipes] = useState<GenericRecipe[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const cols = useGridCols(gridRef);

  // Map hook state to modal visibility
  const showCreateModal = sidebar.showForm && !editingRecipe;
  const showEditModal = sidebar.showForm && !!editingRecipe;

  // For backward compatibility
  const selectedRecipe = sidebar.selectedItem;

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  // ?focus=<custom_type> — auto-select a recipe when opened from picker overlay.
  // Runs once after recipes are loaded.
  const focusAppliedRef = useRef(false);
  useEffect(() => {
    if (focusAppliedRef.current) return;
    if (recipes.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const focusType = params.get('focus');
    if (!focusType) return;
    const target = recipes.find(r => r.recipe.metadata.custom_type === focusType);
    if (!target) return;
    focusAppliedRef.current = true;
    handleViewRecipe(target);
    setTimeout(() => {
      const el = document.querySelector(`[data-recipe-custom-type="${CSS.escape(focusType)}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes]);

  // Clear editing recipe when Edit modal closes
  useEffect(() => {
    if (!showEditModal) {
      setEditingRecipe(null);
    }
  }, [showEditModal]);

  const handleCreateRecipe = () => {
    setEditingRecipe(null);
    sidebar.openForm();
  };

  const handleEditRecipe = (recipe: GenericRecipe) => {
    setEditingRecipe(recipe);
    sidebar.openForm();
  };

  const handleViewRecipe = (recipe: GenericRecipe) => {
    sidebar.selectItem(recipe);
  };

  const handleDeleteRecipe = (recipe: GenericRecipe) => {
    sidebar.selectItem(recipe);
    setShowDeleteModal(true);
  };

  const confirmDeleteRecipe = async () => {
    if (selectedRecipe) {
      await deleteRecipe(selectedRecipe.recipe.metadata.name);
      setShowDeleteModal(false);
      sidebar.clearSelection();
    }
  };

  const handleDeployRecipe = async (recipe: GenericRecipe) => {
    try {
      const customType = recipe.recipe.metadata.custom_type || 'unknown';
      const recipeFileName = customType.toLowerCase().replace(/\s+/g, '-');

      // Create a want that references the recipe
      await createWant({
        metadata: {
          name: recipeFileName,
          type: customType,
          labels: {},
        },
        spec: {
          recipe: `yaml/recipes/${recipeFileName}.yaml`,
          params: Object.fromEntries((recipe.recipe.parameters ?? []).filter(p => p.default !== undefined).map(p => [p.name, p.default])),
        },
      });
      setNotification({
        message: `Recipe "${recipe.recipe.metadata.name}" deployed successfully!`,
        type: 'success',
      });
    } catch (err) {
      setNotification({
        message: `Failed to deploy recipe: ${err instanceof Error ? err.message : 'Unknown error'}`,
        type: 'error',
      });
    }
  };

  const handleDeployRecipeExample = async (recipe: GenericRecipe) => {
    try {
      if (!recipe.recipe.example || !recipe.recipe.example.wants || recipe.recipe.example.wants?.length === 0) {
        throw new Error('No example configuration available for this recipe');
      }

      // Deploy each want from the example
      for (const exampleWant of recipe.recipe.example.wants) {
        const metadata = exampleWant.metadata || {};
        // Ensure required fields
        if (!metadata.name || !metadata.type) {
          throw new Error('Example want must have name and type');
        }

        await createWant({
          metadata: {
            name: metadata.name,
            type: metadata.type,
            labels: metadata.labels || {},
          },
          spec: exampleWant.spec || {},
        });
      }

      setNotification({
        message: `Recipe example "${recipe.recipe.metadata.name}" deployed successfully!`,
        type: 'success',
      });
    } catch (err) {
      setNotification({
        message: `Failed to deploy recipe example: ${err instanceof Error ? err.message : 'Unknown error'}`,
        type: 'error',
      });
    }
  };

  const handleDeployRecipeExampleDef = async (recipe: GenericRecipe, exampleParams: Record<string, any>) => {
    try {
      const customType = recipe.recipe.metadata.custom_type || 'unknown';
      const recipeFileName = customType.toLowerCase().replace(/\s+/g, '-');
      await createWant({
        metadata: {
          name: recipeFileName,
          type: customType,
          labels: {},
        },
        spec: {
          recipe: `yaml/recipes/${recipeFileName}.yaml`,
          params: { ...Object.fromEntries((recipe.recipe.parameters ?? []).filter(p => p.default !== undefined).map(p => [p.name, p.default])), ...exampleParams },
        },
      });
      setNotification({
        message: `Recipe example deployed successfully!`,
        type: 'success',
      });
    } catch (err) {
      setNotification({
        message: `Failed to deploy: ${err instanceof Error ? err.message : 'Unknown error'}`,
        type: 'error',
      });
    }
  };

  // Keyboard / gamepad navigation — replaces useKeyboardNavigation + useEscapeKey
  const currentRecipeIndex = selectedRecipe
    ? filteredRecipes.findIndex(r => r.recipe.metadata.name === selectedRecipe.recipe.metadata.name)
    : -1;

  useDashboardNav({
    itemCount: filteredRecipes.length,
    currentIndex: currentRecipeIndex,
    onNavigate: (index) => {
      if (index >= 0 && index < filteredRecipes.length) {
        handleViewRecipe(filteredRecipes[index]);
      }
    },
    onClose: selectedRecipe
      ? () => sidebar.clearSelection()
      : undefined,
    // Shift+Enter / gamepad Start opens the focused card's action overlay.
    onContextMenu: () => {
      if (selectedRecipe) {
        toggleCardOverlay(entityCardId('recipe', selectedRecipe.recipe.metadata.name || 'Unnamed Recipe'));
      }
    },
    enabled: !sidebar.showForm && filteredRecipes.length > 0,
    cols,
  });

  const panelRoute = useHostPanel(selectedRecipe?.recipe.metadata.name, (name) => {
    const r = recipes.find(x => x.recipe.metadata.name === name);
    if (!r) return false;
    sidebar.selectItem(r);
  }, recipes.length);

  useAppSidebar({
    // In an app on a phone, the app's own sheet (lib/nativeHost, useHostPanel).
    hostRoute: panelRoute,
    open: !!selectedRecipe,
    title: selectedRecipe?.recipe.metadata.name ?? '',
    onClose: () => sidebar.clearSelection(),
    // A detail panel opens on its subject's card and takes the host's
    // identity row — one name, one close, in the same place on every page.
    chromeless: true,
    content: selectedRecipe ? (
      <RecipeDetailsSidebar
        recipe={selectedRecipe}
        onEdit={handleEditRecipe}
        onDelete={handleDeleteRecipe}
        onDeploy={handleDeployRecipe}
        onDeployExample={handleDeployRecipeExample}
        onDownload={downloadRecipeYAML}
        onDeployExampleDef={handleDeployRecipeExampleDef}
        onDeploySuccess={(message) => setNotification({ message, type: 'success' })}
        onDeployError={(error) => setNotification({ message: error, type: 'error' })}
        loading={loading}
      />
    ) : null,
  });

  useAppHeader({
    onCreateWant: handleCreateRecipe,
    title: 'Recipes',
    createButtonLabel: 'Add Recipe',
    itemCount: recipes.length,
    itemLabel: 'recipe',
  });

  return (
    <>
      {/* Main content area with sidebar-aware layout */}
      <main className="flex-1 flex overflow-hidden bg-transparent lg:mr-[480px] mr-0">
        {/* Left content area - main dashboard */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-6 pb-24">
            {/* Loading State */}
            {loading && recipes.length === 0 && (
              <div className="flex items-center justify-center h-64">
                <div className="text-gray-500 dark:text-gray-400">Loading recipes...</div>
              </div>
            )}

            {/* Error Message */}
            {error && <ErrorBanner message={error} onDismiss={clearError} />}

            {/* Recipes Grid */}
            <RecipeGrid
              recipes={recipes}
              loading={loading}
              selectedRecipe={selectedRecipe}
              onViewRecipe={handleViewRecipe}
              onEditRecipe={handleEditRecipe}
              onDeleteRecipe={handleDeleteRecipe}
              onDeployRecipe={handleDeployRecipe}
              onDeployRecipeExample={handleDeployRecipeExample}
              onDownloadRecipe={downloadRecipeYAML}
              onGetFilteredRecipes={setFilteredRecipes}
              gridRef={gridRef}
            />
          </div>
        </div>
      </main>

      {/* Detail/summary sidebar is rendered by the app-root shell (Layout →
          AppSidebarHost); registered via useAppSidebar above. */}

      {/* Modals */}
      <RecipeModal
        isOpen={showCreateModal}
        onClose={() => sidebar.closeForm()}
        recipe={null}
        mode="create"
      />

      <RecipeModal
        isOpen={showEditModal}
        onClose={() => {
          sidebar.closeForm();
          setEditingRecipe(null);
        }}
        recipe={editingRecipe}
        mode="edit"
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Delete Recipe</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete the recipe "{selectedRecipe?.recipe.metadata.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteRecipe}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
