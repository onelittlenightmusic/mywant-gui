import React from 'react';
import { Edit, Trash2, Bot, Monitor, Zap, Brain } from 'lucide-react';
import { Agent } from '@/types/agent';
import { truncateText, classNames } from '@/utils/helpers';
import { EntityCard, EntityCardAction } from '@/components/common/EntityCard';
import { entityCardId } from '@/stores/cardOverlayStore';
import { MENU_COLORS, menuTintBg } from '@/utils/menuColors';

interface AgentCardProps {
  agent: Agent;
  selected?: boolean;
  /** Embedded in a sidebar: do not pull DOM focus (see EntityCard). */
  keepFocus?: boolean;
  onView: (agent: Agent) => void;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
  className?: string;
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  do: Zap,
  monitor: Monitor,
  think: Brain,
};

const TYPE_COLORS: Record<string, string> = {
  do: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  monitor: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  think: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

const TYPE_HEX: Record<string, string> = {
  do: '#3b82f6',
  monitor: '#22c55e',
  think: '#8b5cf6',
};

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  selected = false, keepFocus,
  onView,
  onEdit,
  onDelete,
  className,
}) => {
  const agentName = agent.name || 'Unnamed Agent';
  const agentType = agent.type || 'unknown';
  const TypeIcon = TYPE_ICONS[agentType] ?? Bot;
  const typeColor = TYPE_COLORS[agentType] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';

  const actions: EntityCardAction[] = [
    {
      icon: <Edit className="w-5 h-5 text-white" />,
      label: 'Edit',
      onClick: () => onEdit(agent),
      tone: 'primary',
    },
    {
      icon: <Trash2 className="w-5 h-5 text-white" />,
      label: 'Delete',
      onClick: () => onDelete(agent),
      tone: 'danger',
      confirm: true,
    },
  ];

  return (
    <EntityCard
      navId={entityCardId('agent', agentName)}
      title={truncateText(agentName, 30)}
      selected={selected}
      keepFocus={keepFocus}
      onView={() => onView(agent)}
      actions={actions}
      className={className}
      iconBadgeColor={TYPE_HEX[agentType] ?? MENU_COLORS.agents}
      icon={<TypeIcon style={{ color: TYPE_HEX[agentType] ?? MENU_COLORS.agents }} />}
      titleIcon={<Bot className="h-2 w-2 sm:h-3.5 sm:w-3.5 flex-shrink-0 text-blue-500" />}
      badges={
        <span className={classNames(
          'inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-medium',
          typeColor,
        )}>
          <TypeIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          <span className="ml-1 capitalize hidden sm:inline">{agentType}</span>
        </span>
      }
    />
  );
};
