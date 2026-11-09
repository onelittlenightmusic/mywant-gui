import React from 'react';
import { Bot, MessageCircle } from 'lucide-react';
import { classNames } from '@/utils/helpers';

/**
 * The robot's chat: the robot with a speech bubble at its shoulder — the same
 * mark the phone's chat button carries (its app draws it with SF Symbols).
 */
export const RobotChatIcon: React.FC<{ className?: string; size?: number }> = ({ className, size = 24 }) => (
  <span className={classNames('relative inline-block', className)} style={{ width: size, height: size }}>
    <Bot style={{ width: size * 0.82, height: size * 0.82 }} className="absolute left-0 bottom-0" />
    <MessageCircle
      style={{ width: size * 0.5, height: size * 0.5 }}
      className="absolute right-0 top-0 fill-current [&>path]:stroke-[2.5]"
      strokeWidth={0}
    />
  </span>
);
