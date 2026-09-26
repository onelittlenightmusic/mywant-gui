// Transient notices are not rendered here — they speak through the robot's
// bubble (robotStore.notify). What remains in this folder is the confirmation
// flow, which needs an answer from the user and so cannot be a passing bubble.
export type NotificationSeverity = 'success' | 'info' | 'warning' | 'error';

export interface BaseNotificationProps {
  isVisible: boolean;
  onDismiss: () => void;
  message?: string | null;
  title?: string;
  severity?: NotificationSeverity;
}

export interface ConfirmationProps extends BaseNotificationProps {
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  layout?: 'bottom-center' | 'inline-header' | 'dashboard-right' | 'header-overlay';
  danger?: boolean;
  children?: React.ReactNode;
}
