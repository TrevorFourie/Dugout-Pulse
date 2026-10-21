import React from 'react';
import { ConfirmationModal } from './ConfirmationModal';
import { openAppNotificationSettings } from '../utils/gameNotifications';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The one and only "notifications are blocked" prompt, shared by App and Settings.
 * "Open Settings" deliberately leaves the modal open: when the user comes back,
 * the caller re-checks permission and closes it if the problem is fixed.
 */
export const NotificationBlockedModal: React.FC<Props> = ({ isOpen, onClose }) => (
  <ConfirmationModal
    isOpen={isOpen}
    title="Notifications are off"
    message="Android is blocking notifications for Dugout Pulse, so game reminders can't reach you. Turn them on in Settings, then come back."
    confirmLabel="Open Settings"
    cancelLabel="Not now"
    onConfirm={() => {
      void openAppNotificationSettings();
    }}
    onCancel={onClose}
  />
);
