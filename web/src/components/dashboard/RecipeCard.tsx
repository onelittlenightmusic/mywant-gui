import React from 'react';
import { Edit2, Trash2, BookOpen, Play, Zap, Download } from 'lucide-react';
import { GenericRecipe } from '@/types/recipe';
import { truncateText, classNames } from '@/utils/helpers';
import { MENU_COLORS, menuTintBg } from '@/utils/menuColors';
import { EntityCard, EntityCardAction } from '@/components/common/EntityCard';
import { entityCardId } from '@/stores/cardOverlayStore';

interface RecipeCardProps {
  recipe: GenericRecipe;
  selected?: boolean;
  /** Embedded in a sidebar: do not pull DOM focus (see EntityCard). */
  keepFocus?: boolean;
  onView: (recipe: GenericRecipe) => void;
  onEdit: (recipe: GenericRecipe) => void;
  onDelete: (recipe: GenericRecipe) => void;
  onDeploy?: (recipe: GenericRecipe) => void;
  onDeployExample?: (recipe: GenericRecipe) => void;
  onDownload?: (recipe: GenericRecipe) => void;
  className?: string;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  selected = false, keepFocus,
  onView,
  onEdit,
  onDelete,
  onDeploy,
  onDeployExample,
  onDownload,
  className,
}) => {
  const recipeName = recipe.recipe.metadata.name || 'Unnamed Recipe';
  const version = recipe.recipe.metadata.version || '';
  const wantCount = recipe.recipe.wants?.length ?? 0;
  const hasExample = !!recipe.recipe.example?.wants?.length;

  // The recipe's contents (which want types, which parameters) live in the
  // details sidebar's Wants/Parameters tabs — the card only says how many.
  const actions: EntityCardAction[] = [
    {
      icon: <Play className="w-5 h-5 text-white" fill="currentColor" />,
      label: 'Deploy',
      onClick: () => onDeploy?.(recipe),
      tone: 'confirm',
      disabled: !onDeploy,
      title: 'Deploy recipe with parameters',
    },
    {
      icon: <Zap className="w-5 h-5 text-white" />,
      label: 'Example',
      onClick: () => onDeployExample?.(recipe),
      tone: 'primary',
      disabled: !hasExample || !onDeployExample,
      title: 'Deploy recipe example',
    },
    {
      icon: <Edit2 className="w-5 h-5 text-white" />,
      label: 'Edit',
      onClick: () => onEdit(recipe),
      tone: 'primary',
    },
    {
      icon: <Download className="w-5 h-5 text-white" />,
      label: 'Download',
      onClick: () => onDownload?.(recipe),
      tone: 'special',
      disabled: !onDownload,
    },
    {
      icon: <Trash2 className="w-5 h-5 text-white" />,
      label: 'Delete',
      onClick: () => onDelete(recipe),
      tone: 'danger',
      confirm: true,
    },
  ];

  return (
    <EntityCard
      navId={entityCardId('recipe', recipeName)}
      title={truncateText(recipeName, 30)}
      selected={selected}
      keepFocus={keepFocus}
      onView={() => onView(recipe)}
      actions={actions}
      className={className}
      iconBadgeColor={MENU_COLORS.recipes}
      icon={<BookOpen style={{ color: MENU_COLORS.recipes }} />}
      titleIcon={<BookOpen className="h-2 w-2 sm:h-3.5 sm:w-3.5 flex-shrink-0 text-indigo-500" />}
      badges={
        <>
          <span className="px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[8px] sm:text-[10px] text-gray-600 dark:text-gray-400">
            {wantCount} want{wantCount === 1 ? '' : 's'}
          </span>
          {version && (
            <span className="px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[8px] sm:text-[10px] text-gray-600 dark:text-gray-400">
              v{version}
            </span>
          )}
        </>
      }
    />
  );
};
