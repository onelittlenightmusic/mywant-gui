import React, { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { classNames } from '@/utils/helpers';
import { useEscapeKey } from '@/hooks/useEscapeKey';

/** Matches --motion-fast; the modal stays mounted this long while exiting. */
const EXIT_MS = 180;

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
}

export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  showCloseButton = true
}) => {
  // Handle ESC key
  useEscapeKey({
    onEscape: onClose,
    enabled: isOpen
  });

  // Prevent scrolling on body when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Enter/exit animation: keep the modal mounted for EXIT_MS after close so
  // the backdrop can fade and the panel can scale away instead of vanishing.
  const [rendered, setRendered] = useState(isOpen);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setRendered(true);
      // Two RAFs so the closed styles paint first and the transition runs.
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setRendered(false), EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!rendered) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw]'
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] overflow-y-auto">
      {/* Backdrop */}
      <div
        className={classNames(
          "fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm transition-opacity",
          visible ? "opacity-100" : "opacity-0"
        )}
        style={{ transitionDuration: 'var(--motion-fast)' }}
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={classNames(
            "relative w-full transform overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl transition-[opacity,transform]",
            visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2",
            sizeClasses[size]
          )}
          style={{ transitionDuration: 'var(--motion-fast)', transitionTimingFunction: 'var(--ease-settle)' }}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-4">
              {title ? (
                <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-none">
                  {title}
                </h3>
              ) : <div />}
              
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div className="px-6 py-6">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-6 py-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
