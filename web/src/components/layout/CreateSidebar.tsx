import React from 'react';
import { PanelCloseButton } from '@/components/sidebar/PanelCloseButton';
import { classNames } from '@/utils/helpers';

interface CreateSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

export const CreateSidebar: React.FC<CreateSidebarProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  headerAction
}) => {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 transition-opacity duration-300 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={classNames(
          'fixed top-0 right-0 h-full w-[480px] bg-white dark:bg-gray-900 shadow-xl transform transition-transform duration-300 ease-in-out z-40 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden',
          isOpen ? 'translate-x-0' : 'translate-x-full',
          className || ''
        )}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 px-8 py-6 border-b border-gray-200 dark:border-gray-700 z-10">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white truncate">{title}</h2>
            <div className="flex items-center gap-2 flex-shrink-0">
              {headerAction && (
                <div>
                  {headerAction}
                </div>
              )}
              {/* The one close, the same one every other panel wears. This is
                  the app's second sidebar shell and it had grown its own — a
                  36px button with a 20px glyph beside the 44px one the frame
                  draws — so which shell a panel happened to be built on decided
                  what leaving it looked like. See PanelCloseButton. */}
              <PanelCloseButton onClick={onClose} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto h-full px-8 py-6">
          {children}
        </div>
      </div>
    </>
  );
};